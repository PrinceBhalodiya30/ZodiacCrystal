using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Zodiac_Crystal.Data;
using Zodiac_Crystal.DTOs;
using Zodiac_Crystal.Models;
using Zodiac_Crystal.Services;

namespace Zodiac_Crystal.Controllers
{
    [Route("api/Admin/Reviews")]
    [ApiController]
    [Authorize(Roles = "Admin")]
    public class AdminReviewsController : ControllerBase
    {
        private static readonly string[] ValidStatuses = { "Approved", "Rejected" };

        private readonly CrystalsDbContext _context;
        private readonly AuditLogService _auditLogService;
        private readonly NotificationService _notificationService;

        public AdminReviewsController(CrystalsDbContext context, AuditLogService auditLogService, NotificationService notificationService)
        {
            _context = context;
            _auditLogService = auditLogService;
            _notificationService = notificationService;
        }

        // GET: api/admin/reviews/paged?pageNumber=1&pageSize=20&search=&minRating=&status=&photos=
        // photos: "any" = has photos, "pending" = has photos waiting for approval.
        [HttpGet("paged")]
        public async Task<ActionResult<PagedResult<AdminReviewDto>>> GetReviewsPaged(
            int pageNumber = 1,
            int pageSize = 20,
            string? search = null,
            int? minRating = null,
            string? status = null,
            string? photos = null,
            bool includeDeleted = false)
        {
            if (pageNumber < 1)
            {
                pageNumber = 1;
            }

            if (pageSize < 1)
            {
                pageSize = 20;
            }
            else if (pageSize > 100)
            {
                pageSize = 100;
            }

            var query = ApplyFilters(_context.ProductReviews.AsNoTracking(), search, minRating, status, photos, includeDeleted);

            var totalCount = await query.CountAsync();

            var reviews = await query
                .OrderByDescending(r => r.CreatedAt)
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .Select(r => new AdminReviewDto
                {
                    ReviewId = r.ReviewId,
                    ProductId = r.ProductId,
                    ProductName = r.Product.Name,
                    UserId = r.UserId,
                    UserName = r.User.Name,
                    Rating = r.Rating,
                    Comment = r.Comment,
                    CreatedAt = r.CreatedAt,
                    Status = r.Status,
                    AdminReply = r.AdminReply,
                    AdminReplyAt = r.AdminReplyAt,
                    Images = r.Images
                        .OrderBy(i => i.SortOrder)
                        .Select(i => new ReviewPhotoDto
                        {
                            ReviewImageId = i.ReviewImageId,
                            ImageUrl = i.ImageUrl,
                            Status = i.Status
                        })
                        .ToList()
                })
                .ToListAsync();

            return Ok(new PagedResult<AdminReviewDto>
            {
                Items = reviews,
                TotalCount = totalCount,
                PageNumber = pageNumber,
                PageSize = pageSize
            });
        }

        // GET: api/admin/reviews/export?search=&minRating=&status=&photos=
        // Same filters as the Reviews page (shared ApplyFilters), so the file always
        // matches the list the admin is looking at. Times are UTC, as stored.
        [HttpGet("export")]
        public async Task<IActionResult> ExportReviews(
            [FromServices] CsvExportService csv,
            string? search = null,
            int? minRating = null,
            string? status = null,
            string? photos = null,
            bool includeDeleted = false)
        {
            var reviews = await ApplyFilters(_context.ProductReviews.AsNoTracking(), search, minRating, status, photos, includeDeleted)
                .OrderByDescending(r => r.CreatedAt)
                .Select(r => new
                {
                    r.ReviewId,
                    r.ProductId,
                    ProductName = r.Product.Name,
                    r.Product.Sku,
                    Reviewer = r.User.Name,
                    ReviewerEmail = r.User.Email,
                    r.Rating,
                    r.Comment,
                    r.Status,
                    r.AdminReply,
                    r.CreatedAt,
                    r.IsDeleted,
                    Photos = r.Images.OrderBy(i => i.SortOrder).Select(i => new { i.ImageUrl, i.Status }).ToList()
                })
                .ToListAsync();

            var file = csv.BuildCsv(
                new[]
                {
                    "ReviewId", "ProductId", "Product", "SKU", "Reviewer", "ReviewerEmail", "Rating", "Comment",
                    "Status", "Photos", "PhotosApproved", "PhotosPending", "PhotosRejected", "PhotoUrls",
                    "AdminReply", "Created (UTC)", "Deleted"
                },
                reviews.Select(r => new object?[]
                {
                    r.ReviewId, r.ProductId, r.ProductName, r.Sku, r.Reviewer, r.ReviewerEmail, r.Rating, r.Comment ?? "",
                    r.Status,
                    r.Photos.Count,
                    r.Photos.Count(p => p.Status == ReviewPhotoStatuses.Approved),
                    r.Photos.Count(p => p.Status == ReviewPhotoStatuses.Pending),
                    r.Photos.Count(p => p.Status == ReviewPhotoStatuses.Rejected),
                    // One cell, one URL per line, each with its moderation status.
                    string.Join("\n", r.Photos.Select(p => $"{p.ImageUrl} ({p.Status})")),
                    r.AdminReply ?? "", r.CreatedAt, r.IsDeleted
                }));

            return File(file, "text/csv", "reviews-export.csv");
        }

        // PUT: api/admin/reviews/images/7/status  { "status": "Approved" | "Rejected" }
        [HttpPut("images/{imageId}/status")]
        public async Task<IActionResult> UpdatePhotoStatus(int imageId, UpdateReviewPhotoStatusDto dto)
        {
            if (!ReviewPhotoStatuses.Moderated.Contains(dto.Status))
            {
                return BadRequest(new { message = "Invalid photo status" });
            }

            var photo = await _context.ReviewImages.FirstOrDefaultAsync(i => i.ReviewImageId == imageId);
            if (photo == null)
            {
                return NotFound(new { message = "Photo not found" });
            }

            var previousStatus = photo.Status;
            photo.Status = dto.Status;

            _auditLogService.Log(GetCurrentAdminId(), "ReviewPhotoStatusChanged", "Review", photo.ReviewId,
                $"Photo {photo.ReviewImageId}: {previousStatus} -> {dto.Status}");
            await _context.SaveChangesAsync();

            await _notificationService.BroadcastAdminChangeAsync("review", photo.ReviewId, "photo-status");

            return NoContent();
        }

        // Shared by the Reviews list and its export.
        private static IQueryable<ProductReview> ApplyFilters(
            IQueryable<ProductReview> query, string? search, int? minRating, string? status, string? photos, bool includeDeleted)
        {
            if (!includeDeleted)
            {
                query = query.Where(r => !r.IsDeleted);
            }

            if (!string.IsNullOrWhiteSpace(search))
            {
                query = query.Where(r =>
                    r.Product.Name.Contains(search) ||
                    r.User.Name.Contains(search) ||
                    (r.Comment != null && r.Comment.Contains(search)));
            }

            if (minRating.HasValue)
            {
                query = query.Where(r => r.Rating >= minRating.Value);
            }

            if (!string.IsNullOrWhiteSpace(status))
            {
                query = query.Where(r => r.Status == status);
            }

            if (photos == "any")
            {
                query = query.Where(r => r.Images.Any());
            }
            else if (photos == "pending")
            {
                query = query.Where(r => r.Images.Any(i => i.Status == ReviewPhotoStatuses.Pending));
            }

            return query;
        }

        // PUT: api/admin/reviews/5/status
        [HttpPut("{id}/status")]
        public async Task<IActionResult> UpdateStatus(int id, UpdateReviewStatusDto dto)
        {
            if (!ValidStatuses.Contains(dto.Status))
            {
                return BadRequest(new { message = "Invalid review status" });
            }

            var review = await _context.ProductReviews.FirstOrDefaultAsync(r => r.ReviewId == id);
            if (review == null)
            {
                return NotFound(new { message = "Review not found" });
            }

            var previousStatus = review.Status;
            review.Status = dto.Status;

            _auditLogService.Log(GetCurrentAdminId(), "ReviewStatusChanged", "Review", review.ReviewId, $"{previousStatus} -> {dto.Status}");
            await _context.SaveChangesAsync();

            return NoContent();
        }

        // POST: api/admin/reviews/bulk-status
        [HttpPost("bulk-status")]
        public async Task<IActionResult> BulkUpdateStatus(BulkReviewStatusDto dto)
        {
            if (!ValidStatuses.Contains(dto.Status))
            {
                return BadRequest(new { message = "Invalid review status" });
            }

            if (dto.ReviewIds.Count == 0)
            {
                return BadRequest(new { message = "No reviews selected" });
            }

            var reviews = await _context.ProductReviews
                .Where(r => dto.ReviewIds.Contains(r.ReviewId))
                .ToListAsync();

            var adminId = GetCurrentAdminId();
            foreach (var review in reviews)
            {
                var previousStatus = review.Status;
                review.Status = dto.Status;
                _auditLogService.Log(adminId, "ReviewStatusChanged", "Review", review.ReviewId, $"{previousStatus} -> {dto.Status}");
            }

            await _context.SaveChangesAsync();

            return NoContent();
        }

        // PUT: api/admin/reviews/5/reply
        [HttpPut("{id}/reply")]
        public async Task<IActionResult> UpdateReply(int id, UpdateReviewReplyDto dto)
        {
            var review = await _context.ProductReviews.FirstOrDefaultAsync(r => r.ReviewId == id);
            if (review == null)
            {
                return NotFound(new { message = "Review not found" });
            }

            review.AdminReply = string.IsNullOrWhiteSpace(dto.Reply) ? null : dto.Reply;
            review.AdminReplyAt = review.AdminReply != null ? DateTime.UtcNow : null;

            _auditLogService.Log(GetCurrentAdminId(), "ReviewReplyUpdated", "Review", review.ReviewId, null);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        // DELETE: api/admin/reviews/5 (soft delete)
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteReview(int id)
        {
            var review = await _context.ProductReviews.FirstOrDefaultAsync(r => r.ReviewId == id);
            if (review == null)
            {
                return NotFound(new { message = "Review not found" });
            }

            review.IsDeleted = true;
            review.DeletedAt = DateTime.UtcNow;

            _auditLogService.Log(GetCurrentAdminId(), "ReviewDeleted", "Review", review.ReviewId, $"Review by user {review.UserId} on product {review.ProductId}");
            await _context.SaveChangesAsync();

            return NoContent();
        }

        // PUT: api/admin/reviews/5/restore
        [HttpPut("{id}/restore")]
        public async Task<IActionResult> RestoreReview(int id)
        {
            var review = await _context.ProductReviews.FirstOrDefaultAsync(r => r.ReviewId == id);
            if (review == null)
            {
                return NotFound(new { message = "Review not found" });
            }

            review.IsDeleted = false;
            review.DeletedAt = null;

            _auditLogService.Log(GetCurrentAdminId(), "ReviewRestored", "Review", review.ReviewId, null);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        private int GetCurrentAdminId()
        {
            var claim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            return int.Parse(claim!);
        }
    }
}
