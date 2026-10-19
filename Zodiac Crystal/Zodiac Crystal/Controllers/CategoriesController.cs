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
    [Route("api/[controller]")]
    [ApiController]
    public class CategoriesController : ControllerBase
    {
        private readonly CrystalsDbContext _context;
        private readonly AuditLogService _auditLogService;

        public CategoriesController(CrystalsDbContext context, AuditLogService auditLogService)
        {
            _context = context;
            _auditLogService = auditLogService;
        }
     
        // GET: api/categories
        [HttpGet]
        public async Task<ActionResult<IEnumerable<CategoryDto>>> GetCategories()
        {
            var categories = await _context.Categories
                .Select(c => new CategoryDto
                {
                    CategoryId = c.CategoryId,
                    Name = c.Name,
                    Description = c.Description,
                    ParentCategoryId = c.ParentCategoryId,
                    IsActive = c.IsActive
                })
                .ToListAsync();

            return Ok(categories);
        }

        // GET: api/categories/product-counts  ->  { "3": 12, "5": 4 }
        // Products directly in each category (active or not), counted in the database
        // so the admin page doesn't download the whole catalogue. Sub-category totals
        // are rolled up on the client, which already has the category tree.
        [Authorize(Roles = "Admin")]
        [HttpGet("product-counts")]
        public async Task<ActionResult<Dictionary<int, int>>> GetProductCounts()
        {
            var counts = await _context.Products
                .GroupBy(p => p.CategoryId)
                .Select(g => new { CategoryId = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.CategoryId, x => x.Count);

            return Ok(counts);
        }

        // GET: api/categories/tiles
        // Product counts and a picture per category for the storefront tiles, so
        // the home and categories pages don't download the whole catalogue.
        // Active products only. Only three columns per product are read; the
        // image is the product's primary one, else its first.
        [HttpGet("tiles")]
        public async Task<ActionResult<IEnumerable<CategoryTileDto>>> GetCategoryTiles()
        {
            var categories = await _context.Categories
                .AsNoTracking()
                .Select(c => new { c.CategoryId, c.ParentCategoryId })
                .ToListAsync();

            var products = await _context.Products
                .AsNoTracking()
                .Where(p => p.IsActive)
                .OrderBy(p => p.ProductId)
                .Select(p => new
                {
                    p.CategoryId,
                    ImageUrl = p.ProductImages
                        .OrderByDescending(i => i.IsPrimary)
                        .ThenBy(i => i.ProductImageId)
                        .Select(i => i.ImageUrl)
                        .FirstOrDefault()
                })
                .ToListAsync();

            var byCategory = products
                .GroupBy(p => p.CategoryId)
                .ToDictionary(
                    g => g.Key,
                    g => (Count: g.Count(), ImageUrl: g.Select(p => p.ImageUrl).FirstOrDefault(u => !string.IsNullOrEmpty(u))));

            var childrenOf = categories
                .Where(c => c.ParentCategoryId.HasValue)
                .ToLookup(c => c.ParentCategoryId!.Value, c => c.CategoryId);

            var tiles = categories.Select(category =>
            {
                // The category plus all its sub-categories (any depth) - same rule
                // as the products page's category filter, so the counts match.
                var subtree = new HashSet<int> { category.CategoryId };
                var queue = new Queue<int>(subtree);
                while (queue.Count > 0)
                {
                    foreach (var childId in childrenOf[queue.Dequeue()])
                    {
                        if (subtree.Add(childId))
                        {
                            queue.Enqueue(childId);
                        }
                    }
                }

                byCategory.TryGetValue(category.CategoryId, out var direct);

                // First product (by id) in the subtree that has an image.
                var subtreeImage = products
                    .Where(p => subtree.Contains(p.CategoryId) && !string.IsNullOrEmpty(p.ImageUrl))
                    .Select(p => p.ImageUrl)
                    .FirstOrDefault();

                return new CategoryTileDto
                {
                    CategoryId = category.CategoryId,
                    ProductCount = subtree.Sum(id => byCategory.TryGetValue(id, out var c) ? c.Count : 0),
                    ImageUrl = subtreeImage,
                    DirectProductCount = direct.Count,
                    DirectImageUrl = direct.ImageUrl
                };
            }).ToList();

            return Ok(tiles);
        }

        // GET: api/categories/1
        [HttpGet("{id}")]
        public async Task<ActionResult<CategoryDto>> GetCategory(int id)
        {
            var category = await _context.Categories
                .Where(c => c.CategoryId == id)                                     
                .Select(c => new CategoryDto    
                {                   
                    CategoryId = c.CategoryId,
                    Name = c.Name,              
                    Description = c.Description,            
                    ParentCategoryId = c.ParentCategoryId,  
                    IsActive = c.IsActive   
                })                      
                .FirstOrDefaultAsync();

            if (category == null)
            {
                return NotFound(new
                {
                    message = "Category not found"
                });
            }

            return Ok(category);
        }
                
        // POST: api/categories
        [Authorize(Roles = "Admin")]
        [HttpPost]
        public async Task<IActionResult> CreateCategory(
            CreateCategoryDto dto)
        {
            if (dto.ParentCategoryId.HasValue)
            {
                var parentExists = await _context.Categories
                    .AnyAsync(c =>
                        c.CategoryId == dto.ParentCategoryId.Value);

                if (!parentExists)
                {
                    return BadRequest(new
                    {
                        message = "Parent category does not exist"
                    });
                }
            }

            var category = new Category
            {
                Name = dto.Name,
                Description = dto.Description,
                ParentCategoryId = dto.ParentCategoryId,
                IsActive = dto.IsActive
            };

            _context.Categories.Add(category);

            await _context.SaveChangesAsync();

            return CreatedAtAction(
                nameof(GetCategory),
                new { id = category.CategoryId },
                category
            );
        }

        // PUT: api/categories/1
        [Authorize(Roles = "Admin")]
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateCategory(
            int id,
            UpdateCategoryDto dto)
        {
            var category = await _context.Categories
                .FindAsync(id);

            if (category == null)
            {
                return NotFound(new
                {
                    message = "Category not found"
                });
            }

            if (dto.ParentCategoryId.HasValue)
            {
                if (dto.ParentCategoryId.Value == id)
                {
                    return BadRequest(new
                    {
                        message = "Category cannot be its own parent"
                    });
                }

                var parentExists = await _context.Categories
                    .AnyAsync(c =>
                        c.CategoryId == dto.ParentCategoryId.Value);

                if (!parentExists)
                {
                    return BadRequest(new
                    {
                        message = "Parent category does not exist"
                    });
                }
            }

            category.Name = dto.Name;
            category.Description = dto.Description;
            category.ParentCategoryId = dto.ParentCategoryId;
            category.IsActive = dto.IsActive;

            await _context.SaveChangesAsync();

            return NoContent();
        }

        // DELETE: api/categories/1
        [Authorize(Roles = "Admin")]
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteCategory(int id)
        {
            var category = await _context.Categories
                .FindAsync(id);

            if (category == null)
            {
                return NotFound(new
                {
                    message = "Category not found"
                });
            }

            var hasProducts = await _context.Products
                .AnyAsync(p => p.CategoryId == id);

            if (hasProducts)
            {
                return BadRequest(new
                {
                    message = "Cannot delete category because products exist in this category"
                });
            }

            var hasSubcategories = await _context.Categories
                .AnyAsync(c => c.ParentCategoryId == id);

            if (hasSubcategories)
            {
                return BadRequest(new
                {
                    message = "Cannot delete category because it has sub-categories. Move or delete them first"
                });
            }

            _context.Categories.Remove(category);

            _auditLogService.Log(
                int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var adminId) ? adminId : 0,
                "CategoryDeleted", "Category", category.CategoryId, category.Name);

            await _context.SaveChangesAsync();

            return NoContent();
        }
    }
}