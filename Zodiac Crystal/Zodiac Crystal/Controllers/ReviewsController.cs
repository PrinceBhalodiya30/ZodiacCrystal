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
    [Route("api/products/{productId}/reviews")]
    [ApiController]
    public class ReviewsController : ControllerBase
    {
        private readonly CrystalsDbContext _context;
        private readonly AuditLogService _auditLogService;
        private readonly NotificationService _notificationService;
        private readonly IWebHostEnvironment _environment;

        public ReviewsController(
            CrystalsDbContext context,
            AuditLogService auditLogService,
            NotificationService notificationService,
            IWebHostEnvironment environment)
        {
            _context = context;
            _auditLogService = auditLogService;
            _notificationService = notificationService;
            _environment = environment;
        }

        // GET: api/products/1/reviews
        [HttpGet]
        public async Task<ActionResult<ProductReviewsDto>> GetReviews(int productId)
        {
            var productExists = await _context.Products.AnyAsync(p => p.ProductId == productId);

            if (!productExists)
            {
                return NotFound(new { message = "Product not found" });
            }

            // Everyone sees approved photos; a signed-in author also sees their
            // own photos that are still waiting for moderation.
            var viewerId = int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : 0;

            var reviews = await _context.ProductReviews
                .Include(r => r.User)
                .Where(r => r.ProductId == productId && !r.IsDeleted && r.Status == "Approved")
                .OrderByDescending(r => r.CreatedAt)
                .Select(r => new ReviewDto
                {
                    ReviewId = r.ReviewId,
                    ProductId = r.ProductId,
                    UserId = r.UserId,
                    UserName = r.User.Name,
                    Rating = r.Rating,
                    Comment = r.Comment,
                    CreatedAt = r.CreatedAt,
                    AdminReply = r.AdminReply,
                    AdminReplyAt = r.AdminReplyAt,
                    Images = r.Images
                        .Where(i => i.Status == ReviewPhotoStatuses.Approved ||
                                    (i.Status == ReviewPhotoStatuses.Pending && r.UserId == viewerId))
                        .OrderBy(i => i.SortOrder)
                        .Select(i => new ReviewPhotoDto
                        {
                            ReviewImageId = i.ReviewImageId,
                            ImageUrl = i.ImageUrl,
                            Status = r.UserId == viewerId ? i.Status : null
                        })
                        .ToList()
                })
                .ToListAsync();

            var result = new ProductReviewsDto
            {
                ReviewCount = reviews.Count,
                AverageRating = reviews.Count > 0 ? Math.Round(reviews.Average(r => r.Rating), 1) : 0,
                Reviews = reviews
            };

            return Ok(result);
        }

        // POST: api/products/1/reviews
        [Authorize]
        [HttpPost]
        public async Task<ActionResult<ReviewDto>> CreateReview(int productId, CreateReviewDto dto)
        {
            var product = await _context.Products.FirstOrDefaultAsync(p => p.ProductId == productId);

            if (product == null)
            {
                return NotFound(new { message = "Product not found" });
            }

            var userId = GetCurrentUserId();

            var alreadyReviewed = await _context.ProductReviews
                .AnyAsync(r => r.ProductId == productId && r.UserId == userId);

            if (alreadyReviewed)
            {
                return Conflict(new { message = "You have already reviewed this product" });
            }

            var review = new ProductReview
            {
                ProductId = productId,
                UserId = userId,
                Rating = dto.Rating,
                Comment = dto.Comment,
                CreatedAt = DateTime.UtcNow
            };

            _context.ProductReviews.Add(review);

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException)
            {
                return Conflict(new { message = "You have already reviewed this product" });
            }

            await _notificationService.BroadcastAdminChangeAsync("review", review.ReviewId, "created");

            var user = await _context.Users.FirstAsync(u => u.UserId == userId);

            var reviewDto = new ReviewDto
            {
                ReviewId = review.ReviewId,
                ProductId = review.ProductId,
                UserId = review.UserId,
                UserName = user.Name,
                Rating = review.Rating,
                Comment = review.Comment,
                CreatedAt = review.CreatedAt
            };

            return CreatedAtAction(nameof(GetReviews), new { productId }, reviewDto);
        }

        // DELETE: api/products/1/reviews/5
        [Authorize]
        [HttpDelete("{reviewId}")]
        public async Task<IActionResult> DeleteReview(int productId, int reviewId)
        {
            var review = await _context.ProductReviews
                .FirstOrDefaultAsync(r => r.ReviewId == reviewId && r.ProductId == productId);

            if (review == null)
            {
                return NotFound(new { message = "Review not found" });
            }

            var userId = GetCurrentUserId();
            var isAdmin = User.IsInRole("Admin");

            if (review.UserId != userId && !isAdmin)
            {
                return NotFound(new { message = "Review not found" });
            }

            // Only log when an admin is moderating someone else's review - a
            // customer deleting their own review isn't an admin action worth auditing.
            if (isAdmin && review.UserId != userId)
            {
                _auditLogService.Log(userId, "ReviewDeleted", "Review", review.ReviewId, $"Review by user {review.UserId} on product {review.ProductId}");
            }

            var photoUrls = await _context.ReviewImages
                .Where(i => i.ReviewId == review.ReviewId)
                .Select(i => i.ImageUrl)
                .ToListAsync();

            // Photo rows go with the review (ON DELETE CASCADE); their files are removed after.
            _context.ProductReviews.Remove(review);
            await _context.SaveChangesAsync();

            var folder = ReviewPhotoService.Folder(_environment.ContentRootPath);
            foreach (var url in photoUrls)
            {
                ReviewPhotoService.DeleteFile(url, folder);
            }

            await _notificationService.BroadcastAdminChangeAsync("review", review.ReviewId, "deleted");

            return NoContent();
        }

        // GET: api/products/1/reviews/photo-eligibility
        // Photos are for verified buyers: someone with a delivered order containing this product.
        [Authorize]
        [HttpGet("photo-eligibility")]
        public async Task<ActionResult<object>> GetPhotoEligibility(int productId)
        {
            return Ok(new
            {
                canUploadPhotos = await HasDeliveredOrderAsync(GetCurrentUserId(), productId),
                maxPhotos = ReviewPhotoService.MaxPhotosPerReview
            });
        }

        // POST: api/products/1/reviews/5/images (multipart, field "files")
        // Adds up to MaxPhotosPerReview photos to the caller's own review. Each one
        // waits for admin approval before it shows on the product page.
        [Authorize]
        [HttpPost("{reviewId}/images")]
        [RequestSizeLimit(ReviewPhotoService.MaxFileSizeBytes * ReviewPhotoService.MaxPhotosPerReview + 1024 * 1024)]
        public async Task<ActionResult<List<ReviewPhotoDto>>> UploadPhotos(int productId, int reviewId, [FromForm] List<IFormFile> files)
        {
            var userId = GetCurrentUserId();

            var review = await _context.ProductReviews
                .Include(r => r.Images)
                .FirstOrDefaultAsync(r => r.ReviewId == reviewId && r.ProductId == productId && !r.IsDeleted);

            if (review == null || review.UserId != userId)
            {
                return NotFound(new { message = "Review not found" });
            }

            if (!await HasDeliveredOrderAsync(userId, productId))
            {
                return BadRequest(new { message = "Photos can be added once your order with this product has been delivered." });
            }

            if (files == null || files.Count == 0)
            {
                return BadRequest(new { message = "Please choose at least one photo." });
            }

            if (review.Images.Count + files.Count > ReviewPhotoService.MaxPhotosPerReview)
            {
                return BadRequest(new { message = $"You can add up to {ReviewPhotoService.MaxPhotosPerReview} photos to a review." });
            }

            // Check every file before saving any, so a bad one doesn't leave half an upload.
            var contents = new List<MemoryStream>();
            try
            {
                foreach (var file in files)
                {
                    if (file.Length == 0 || file.Length > ReviewPhotoService.MaxFileSizeBytes)
                    {
                        return BadRequest(new { message = "Each photo must be 5 MB or smaller." });
                    }

                    var content = new MemoryStream();
                    contents.Add(content);
                    await file.CopyToAsync(content);
                    content.Position = 0;

                    var invalid = ImageUploadValidator.Validate(content, Path.GetExtension(file.FileName).ToLowerInvariant());
                    if (invalid != null)
                    {
                        return BadRequest(new { message = invalid });
                    }
                    content.Position = 0;
                }

                var folder = ReviewPhotoService.Folder(_environment.ContentRootPath);
                var sortOrder = review.Images.Count == 0 ? 0 : review.Images.Max(i => i.SortOrder) + 1;
                var added = new List<ReviewImage>();

                foreach (var content in contents)
                {
                    var fileName = ReviewPhotoService.Save(content, folder);
                    if (fileName == null)
                    {
                        foreach (var saved in added)
                        {
                            ReviewPhotoService.DeleteFile(saved.ImageUrl, folder);
                        }
                        return BadRequest(new { message = "One of the photos could not be read. Please try another." });
                    }

                    // Absolute URL, like product images, so it works as an <img src> as-is.
                    added.Add(new ReviewImage
                    {
                        ReviewId = review.ReviewId,
                        ImageUrl = $"{Request.Scheme}://{Request.Host}{ReviewPhotoService.UrlFolder}{fileName}",
                        Status = ReviewPhotoStatuses.Pending,
                        SortOrder = sortOrder++
                    });
                }

                _context.ReviewImages.AddRange(added);
                await _context.SaveChangesAsync();

                await _notificationService.BroadcastAdminChangeAsync("review", review.ReviewId, "photos");

                return Ok(added.Select(i => new ReviewPhotoDto
                {
                    ReviewImageId = i.ReviewImageId,
                    ImageUrl = i.ImageUrl,
                    Status = i.Status
                }).ToList());
            }
            finally
            {
                foreach (var content in contents)
                {
                    content.Dispose();
                }
            }
        }

        private Task<bool> HasDeliveredOrderAsync(int userId, int productId) =>
            _context.Orders.AnyAsync(o =>
                o.UserId == userId &&
                o.Status == "Delivered" &&
                o.OrderItems.Any(i => i.ProductId == productId));

        private int GetCurrentUserId()
        {
            var claim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            return int.Parse(claim!);
        }
    }
}
