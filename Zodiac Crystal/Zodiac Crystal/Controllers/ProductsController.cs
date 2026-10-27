using Microsoft.AspNetCore.RateLimiting;
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
    public class ProductsController : ControllerBase
    {
        private readonly CrystalsDbContext _context;
        private readonly CsvExportService _csvExportService;
        private readonly AuditLogService _auditLogService;
        private readonly NotificationService _notificationService;

        private static readonly HashSet<string> AllowedMarketingBadges = new(StringComparer.OrdinalIgnoreCase)
        {
            "Bestseller",
            "Rare Specimen",
            "Trending",
            "New Arrival",
            "Staff Pick"
        };

        public ProductsController(CrystalsDbContext context, CsvExportService csvExportService, AuditLogService auditLogService, NotificationService notificationService)
        {
            _context = context;
            _csvExportService = csvExportService;
            _auditLogService = auditLogService;
            _notificationService = notificationService;
        }

        // A category plus all of its sub-categories (any depth). A parent such as
        // "Crystals" often has no products of its own - they all sit in its
        // sub-categories - so filtering by the parent must include them, matching
        // the product count shown on its category card.
        private async Task<List<int>?> CategoryWithDescendantsAsync(int? categoryId)
        {
            if (!categoryId.HasValue)
            {
                return null;
            }

            var all = await _context.Categories
                .AsNoTracking()
                .Select(c => new { c.CategoryId, c.ParentCategoryId })
                .ToListAsync();

            var ids = new List<int> { categoryId.Value };
            for (var i = 0; i < ids.Count; i++)
            {
                var parentId = ids[i];
                ids.AddRange(all
                    .Where(c => c.ParentCategoryId == parentId && !ids.Contains(c.CategoryId))
                    .Select(c => c.CategoryId));
            }

            return ids;
        }

        private static IQueryable<Product> ApplyFilters(
            IQueryable<Product> query,
            string? search,
            List<int>? categoryIds,
            bool activeOnly,
            decimal? minPrice,
            decimal? maxPrice,
            int? zodiacId,
            bool inStockOnly,
            bool matchSku = true)
        {
            if (!string.IsNullOrWhiteSpace(search))
            {
                query = matchSku
                    ? query.Where(p => p.Name.Contains(search) || p.Sku.Contains(search))
                    : query.Where(p => p.Name.Contains(search));
            }

            if (categoryIds != null)
            {
                query = query.Where(p => categoryIds.Contains(p.CategoryId));
            }

            if (activeOnly)
            {
                query = query.Where(p => p.IsActive);
            }

            if (minPrice.HasValue)
            {
                query = query.Where(p => p.Price >= minPrice.Value);
            }

            if (maxPrice.HasValue)
            {
                query = query.Where(p => p.Price <= maxPrice.Value);
            }

            if (zodiacId.HasValue)
            {
                query = query.Where(p => p.Zodiacs.Any(z => z.ZodiacId == zodiacId.Value));
            }

            if (inStockOnly)
            {
                query = query.Where(p => p.StockQuantity > 0);
            }

            return query;
        }

        // Admin list filters (Products / Product Images pages), shared by the
        // paged list and the CSV export so both always match.
        // status: "active" | "inactive"; stock: "in" | "low" | "out".
        private static IQueryable<Product> ApplyAdminFilters(IQueryable<Product> query, string? status, string? stock, bool missingImagesOnly)
        {
            query = status?.ToLowerInvariant() switch
            {
                "active" => query.Where(p => p.IsActive),
                "inactive" => query.Where(p => !p.IsActive),
                _ => query
            };

            query = stock?.ToLowerInvariant() switch
            {
                "in" => query.Where(p => p.StockQuantity > StockRules.LowStockThreshold),
                "low" => query.Where(p => p.StockQuantity > 0 && p.StockQuantity <= StockRules.LowStockThreshold),
                "out" => query.Where(p => p.StockQuantity <= 0),
                _ => query
            };

            if (missingImagesOnly)
            {
                query = query.Where(p => !p.ProductImages.Any());
            }

            return query;
        }

        // GET: api/products
        // Inactive (hidden) products are only ever returned to admins - the shop
        // must not be able to list or open them, even by calling the API directly.
        private bool IsAdmin => User.IsInRole("Admin");

        // Unpaged - returns the whole catalogue. Kept for external callers; the
        // storefront uses /paged and /api/categories/tiles instead.
        [HttpGet]
        public async Task<ActionResult<IEnumerable<ProductDto>>> GetProducts()
        {
            var isAdmin = IsAdmin;
            var products = await _context.Products
                .AsNoTracking()
                .Where(p => isAdmin || p.IsActive)
                .Include(p => p.Category)
                .Include(p => p.ProductImages)
                .Include(p => p.Zodiacs)
                .Select(p => new ProductDto
                {
                    ProductId = p.ProductId,
                    SKU = p.Sku,
                    Name = p.Name,
                    Description = p.Description,
                    Price = p.Price,
                    CompareAtPrice = p.CompareAtPrice,
                    StockQuantity = p.StockQuantity,
                    CategoryId = p.CategoryId,
                    CategoryName = p.Category.Name,
                    IsActive = p.IsActive,
                    CreatedAt = p.CreatedAt,
                    WaterSafe = p.WaterSafe,
                    SunlightExposure = p.SunlightExposure,
                    Chakra = p.Chakra,
                    Element = p.Element,
                    MarketingBadge = p.MarketingBadge,

                    Images = p.ProductImages
                        .Select(i => new ProductImageDto
                        {
                            ProductImageId = i.ProductImageId,
                            ProductId = i.ProductId,
                            ImageUrl = i.ImageUrl,
                            IsPrimary = i.IsPrimary
                        })
                        .ToList(),

                    Zodiacs = p.Zodiacs
                        .Select(z => new ZodiacDto
                        {
                            ZodiacId = z.ZodiacId,
                            Name = z.Name,
                            Symbol = z.Symbol,
                            Description = z.Description,
                            ImageUrl = z.ImageUrl
                        })
                        .ToList()
                })
                .ToListAsync();

            return Ok(products);
        }

        // GET: api/products/paged?pageNumber=1&pageSize=12&search=&categoryId=
        [EnableRateLimiting(RateLimitPolicies.Search)]
        [HttpGet("paged")]
        public async Task<ActionResult<PagedResult<ProductDto>>> GetProductsPaged(
            int pageNumber = 1,
            int pageSize = 12,
            string? search = null,
            int? categoryId = null,
            bool activeOnly = false,
            decimal? minPrice = null,
            decimal? maxPrice = null,
            int? zodiacId = null,
            bool inStockOnly = false,
            string? sortBy = null,
            bool lowStockOnly = false,
            string? status = null,
            string? stock = null,
            bool missingImagesOnly = false)
        {
            if (pageNumber < 1)
            {
                pageNumber = 1;
            }

            if (pageSize < 1)
            {
                pageSize = 12;
            }
            else if (pageSize > 100)
            {
                pageSize = 100;
            }

            // Non-admins only ever see active products, whatever they ask for.
            var query = ApplyFilters(_context.Products.AsQueryable(), search, await CategoryWithDescendantsAsync(categoryId), activeOnly || !IsAdmin, minPrice, maxPrice, zodiacId, inStockOnly, matchSku: IsAdmin);
            query = ApplyAdminFilters(query, status, stock, missingImagesOnly);

            // Admin Stock page's "Low stock only" filter.
            if (lowStockOnly)
            {
                query = query.Where(p => p.StockQuantity <= StockRules.LowStockThreshold);
            }

            var totalCount = await query.CountAsync();

            query = sortBy switch
            {
                "price_asc" => query.OrderBy(p => p.Price),
                "price_desc" => query.OrderByDescending(p => p.Price),
                "newest" => query.OrderByDescending(p => p.CreatedAt),
                "stock_asc" => query.OrderBy(p => p.StockQuantity).ThenBy(p => p.Name),
                // Same reviews the product page shows: approved and not deleted.
                "rating" => query.OrderByDescending(p =>
                    _context.ProductReviews
                        .Where(r => r.ProductId == p.ProductId && !r.IsDeleted && r.Status == "Approved")
                        .Average(r => (double?)r.Rating) ?? 0),
                _ => query.OrderBy(p => p.ProductId)
            };

            var products = await query
                .Include(p => p.Category)
                .Include(p => p.ProductImages)
                .Include(p => p.Zodiacs)
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .Select(p => new ProductDto
                {
                    ProductId = p.ProductId,
                    SKU = p.Sku,
                    Name = p.Name,
                    Description = p.Description,
                    Price = p.Price,
                    CompareAtPrice = p.CompareAtPrice,
                    StockQuantity = p.StockQuantity,
                    CategoryId = p.CategoryId,
                    CategoryName = p.Category.Name,
                    IsActive = p.IsActive,
                    CreatedAt = p.CreatedAt,
                    WaterSafe = p.WaterSafe,
                    SunlightExposure = p.SunlightExposure,
                    Chakra = p.Chakra,
                    Element = p.Element,
                    MarketingBadge = p.MarketingBadge,

                    AverageRating = _context.ProductReviews
                        .Where(r => r.ProductId == p.ProductId && !r.IsDeleted && r.Status == "Approved")
                        .Average(r => (double?)r.Rating),

                    ReviewCount = _context.ProductReviews
                        .Count(r => r.ProductId == p.ProductId && !r.IsDeleted && r.Status == "Approved"),

                    Images = p.ProductImages
                        .Select(i => new ProductImageDto
                        {
                            ProductImageId = i.ProductImageId,
                            ProductId = i.ProductId,
                            ImageUrl = i.ImageUrl,
                            IsPrimary = i.IsPrimary
                        })
                        .ToList(),

                    Zodiacs = p.Zodiacs
                        .Select(z => new ZodiacDto
                        {
                            ZodiacId = z.ZodiacId,
                            Name = z.Name,
                            Symbol = z.Symbol,
                            Description = z.Description,
                            ImageUrl = z.ImageUrl
                        })
                        .ToList()
                })
                .ToListAsync();

            return Ok(new PagedResult<ProductDto>
            {
                Items = products,
                TotalCount = totalCount,
                PageNumber = pageNumber,
                PageSize = pageSize
            });
        }

        // GET: api/products/export?search=&categoryId=&activeOnly=&minPrice=&maxPrice=&zodiacId=&inStockOnly=
        // Reuses the exact same ApplyFilters logic as GetProductsPaged (just without
        // pagination), so the export always matches whatever the admin currently has
        // filtered on the Products page.
        [Authorize(Roles = "Admin")]
        [HttpGet("export")]
        public async Task<IActionResult> ExportProducts(
            string? search = null,
            int? categoryId = null,
            bool activeOnly = false,
            decimal? minPrice = null,
            decimal? maxPrice = null,
            int? zodiacId = null,
            bool inStockOnly = false,
            string? status = null,
            string? stock = null,
            bool missingImagesOnly = false)
        {
            var products = await ApplyAdminFilters(
                    ApplyFilters(_context.Products.AsQueryable(), search, await CategoryWithDescendantsAsync(categoryId), activeOnly, minPrice, maxPrice, zodiacId, inStockOnly),
                    status, stock, missingImagesOnly)
                .Include(p => p.Category)
                .OrderBy(p => p.ProductId)
                .Select(p => new
                {
                    p.ProductId,
                    SKU = p.Sku,
                    p.Name,
                    CategoryName = p.Category.Name,
                    p.Price,
                    p.CompareAtPrice,
                    p.StockQuantity,
                    p.WaterSafe,
                    p.SunlightExposure,
                    p.Chakra,
                    p.Element,
                    p.MarketingBadge,
                    p.IsActive,
                    p.CreatedAt,
                    Zodiacs = p.Zodiacs.Select(z => z.Name).ToList()
                })
                .ToListAsync();

            var headers = new[] { "ProductId", "SKU", "Name", "Category", "Price", "CompareAtPrice", "StockQuantity", "WaterSafe", "SunlightExposure", "Chakra", "Element", "MarketingBadge", "ZodiacSigns", "IsActive", "CreatedAt" };

            var rows = products.Select(p => new object?[]
            {
                p.ProductId, p.SKU, p.Name, p.CategoryName, p.Price, p.CompareAtPrice, p.StockQuantity,
                p.WaterSafe, p.SunlightExposure, p.Chakra, p.Element, p.MarketingBadge,
                string.Join("; ", p.Zodiacs.OrderBy(z => z)), p.IsActive, p.CreatedAt
            });

            var csv = _csvExportService.BuildCsv(headers, rows);

            return File(csv, "text/csv", "products-export.csv");
        }

        // GET: api/products/export-stock?search=&lowStockOnly=
        // Same filters as the admin Stock page: name/SKU search, plus the
        // "Low stock only" toggle (which the page also sorts lowest stock first).
        [Authorize(Roles = "Admin")]
        [HttpGet("export-stock")]
        public async Task<IActionResult> ExportStock(string? search = null, bool lowStockOnly = false)
        {
            var query = ApplyFilters(_context.Products.AsQueryable(), search, null, false, null, null, null, false);

            if (lowStockOnly)
            {
                query = query.Where(p => p.StockQuantity <= StockRules.LowStockThreshold);
            }

            var ordered = lowStockOnly
                ? query.OrderBy(p => p.StockQuantity).ThenBy(p => p.Name)
                : query.OrderBy(p => p.ProductId);

            var products = await ordered
                .Select(p => new
                {
                    SKU = p.Sku,
                    p.Name,
                    CategoryName = p.Category.Name,
                    p.StockQuantity
                })
                .ToListAsync();

            var headers = new[] { "SKU", "Product", "Category", "StockQuantity", "StockStatus" };

            var rows = products.Select(p => new object?[]
            {
                p.SKU, p.Name, p.CategoryName, p.StockQuantity, GetStockStatusLabel(p.StockQuantity)
            });

            var csv = _csvExportService.BuildCsv(headers, rows);

            return File(csv, "text/csv", "stock-export.csv");
        }

        // Mirrors the frontend's stock-status.util.ts thresholds exactly (<=0 out of
        // stock, <=5 low stock) so the export always agrees with what the Stock page
        // itself displays for the same product.
        private static string GetStockStatusLabel(int stockQuantity)
        {
            if (stockQuantity <= 0)
            {
                return "Out of Stock";
            }

            if (stockQuantity <= StockRules.LowStockThreshold)
            {
                return "Low Stock";
            }

            return "In Stock";
        }
        // GET: api/products/1
        [HttpGet("{id}")]
        public async Task<ActionResult<ProductDto>> GetProduct(int id)
        {
            var isAdmin = IsAdmin;
            var product = await _context.Products
                .Include(p => p.Category)
                .Include(p => p.ProductImages)
                .Include(p => p.Zodiacs)
                .Where(p => p.ProductId == id && (isAdmin || p.IsActive))
                .Select(p => new ProductDto
                {
                    ProductId = p.ProductId,
                    SKU = p.Sku,
                    Name = p.Name,
                    Description = p.Description,
                    Price = p.Price,
                    CompareAtPrice = p.CompareAtPrice,
                    StockQuantity = p.StockQuantity,
                    CategoryId = p.CategoryId,
                    CategoryName = p.Category.Name,
                    IsActive = p.IsActive,
                    CreatedAt = p.CreatedAt,
                    WaterSafe = p.WaterSafe,
                    SunlightExposure = p.SunlightExposure,
                    Chakra = p.Chakra,
                    Element = p.Element,
                    MarketingBadge = p.MarketingBadge,

                    // Approved, not-deleted reviews only (same as the list endpoints);
                    // the product page's JSON-LD rating comes from these.
                    AverageRating = _context.ProductReviews
                        .Where(r => r.ProductId == p.ProductId && !r.IsDeleted && r.Status == "Approved")
                        .Average(r => (double?)r.Rating),

                    ReviewCount = _context.ProductReviews
                        .Count(r => r.ProductId == p.ProductId && !r.IsDeleted && r.Status == "Approved"),

                    Images = p.ProductImages
                        .Select(i => new ProductImageDto
                        {
                            ProductImageId = i.ProductImageId,
                            ProductId = i.ProductId,
                            ImageUrl = i.ImageUrl,
                            IsPrimary = i.IsPrimary
                        })
                        .ToList(),

                    Zodiacs = p.Zodiacs
                        .Select(z => new ZodiacDto
                        {
                            ZodiacId = z.ZodiacId,
                            Name = z.Name,
                            Symbol = z.Symbol,
                            Description = z.Description,
                            ImageUrl = z.ImageUrl
                        })
                        .ToList()
                })
                .FirstOrDefaultAsync();

            if (product == null)
            {
                return NotFound(new
                {
                    message = "Product not found"
                });
            }

            return Ok(product);
        }

        // GET: api/products/5/related
        // Ranking: shared zodiac + same category scores highest, then shared zodiac
        // alone, then same category alone; in-stock items are preferred as a tie
        // breaker. Only active products are considered. Two lean queries (ids first,
        // full projection second) instead of loading the whole catalog into memory.
        [HttpGet("{id}/related")]
        public async Task<ActionResult<IEnumerable<ProductDto>>> GetRelatedProducts(int id, int limit = 6)
        {
            if (limit < 4)
            {
                limit = 4;
            }
            else if (limit > 6)
            {
                limit = 6;
            }

            var current = await _context.Products
                .AsNoTracking()
                .Where(p => p.ProductId == id)
                .Select(p => new
                {
                    p.CategoryId,
                    ZodiacIds = p.Zodiacs.Select(z => z.ZodiacId).ToList()
                })
                .FirstOrDefaultAsync();

            if (current == null)
            {
                return NotFound(new { message = "Product not found" });
            }

            var rankedIds = await _context.Products
                .AsNoTracking()
                .Where(p => p.ProductId != id && p.IsActive)
                .Select(p => new
                {
                    p.ProductId,
                    p.CreatedAt,
                    InStock = p.StockQuantity > 0,
                    ZodiacMatch = p.Zodiacs.Any(z => current.ZodiacIds.Contains(z.ZodiacId)),
                    CategoryMatch = p.CategoryId == current.CategoryId
                })
                .Where(p => p.ZodiacMatch || p.CategoryMatch)
                .Select(p => new
                {
                    p.ProductId,
                    p.InStock,
                    p.CreatedAt,
                    Score = (p.ZodiacMatch ? 2 : 0) + (p.CategoryMatch ? 1 : 0)
                })
                .OrderByDescending(p => p.Score)
                .ThenByDescending(p => p.InStock)
                .ThenByDescending(p => p.CreatedAt)
                .Take(limit)
                .Select(p => p.ProductId)
                .ToListAsync();

            if (rankedIds.Count == 0)
            {
                return Ok(new List<ProductDto>());
            }

            var products = await _context.Products
                .AsNoTracking()
                .Include(p => p.Category)
                .Include(p => p.ProductImages)
                .Include(p => p.Zodiacs)
                .Where(p => rankedIds.Contains(p.ProductId))
                .Select(p => new ProductDto
                {
                    ProductId = p.ProductId,
                    SKU = p.Sku,
                    Name = p.Name,
                    Description = p.Description,
                    Price = p.Price,
                    CompareAtPrice = p.CompareAtPrice,
                    StockQuantity = p.StockQuantity,
                    CategoryId = p.CategoryId,
                    CategoryName = p.Category.Name,
                    IsActive = p.IsActive,
                    CreatedAt = p.CreatedAt,
                    WaterSafe = p.WaterSafe,
                    SunlightExposure = p.SunlightExposure,
                    Chakra = p.Chakra,
                    Element = p.Element,
                    MarketingBadge = p.MarketingBadge,

                    Images = p.ProductImages
                        .Select(i => new ProductImageDto
                        {
                            ProductImageId = i.ProductImageId,
                            ProductId = i.ProductId,
                            ImageUrl = i.ImageUrl,
                            IsPrimary = i.IsPrimary
                        })
                        .ToList(),

                    Zodiacs = p.Zodiacs
                        .Select(z => new ZodiacDto
                        {
                            ZodiacId = z.ZodiacId,
                            Name = z.Name,
                            Symbol = z.Symbol,
                            Description = z.Description,
                            ImageUrl = z.ImageUrl
                        })
                        .ToList()
                })
                .ToListAsync();

            // The DB query above doesn't preserve rankedIds' order, so reorder in memory.
            var ordered = rankedIds
                .Select(pid => products.FirstOrDefault(p => p.ProductId == pid))
                .Where(p => p != null)
                .Select(p => p!)
                .ToList();

            return Ok(ordered);
        }

        // POST: api/products
        [Authorize(Roles = "Admin")]
        [HttpPost]
        public async Task<IActionResult> CreateProduct(
            CreateProductDto dto)
        {
            var categoryExists = await _context.Categories
                .AnyAsync(c => c.CategoryId == dto.CategoryId);

            if (!categoryExists)
            {
                return BadRequest(new
                {
                    message = "Category does not exist"
                });
            }

            var skuExists = await _context.Products
                .AnyAsync(p => p.Sku == dto.SKU);

            if (skuExists)
            {
                return BadRequest(new
                {
                    message = "SKU already exists"
                });
            }

            if (dto.CompareAtPrice.HasValue && dto.CompareAtPrice.Value <= dto.Price)
            {
                return BadRequest(new
                {
                    message = "Compare-at price must be greater than the selling price"
                });
            }

            var zodiacs = await _context.ZodiacSigns
                .Where(z => dto.ZodiacIds.Contains(z.ZodiacId))
                .ToListAsync();

            if (zodiacs.Count != dto.ZodiacIds.Distinct().Count())
            {
                return BadRequest(new
                {
                    message = "One or more zodiac signs do not exist"
                });
            }

            if (!string.IsNullOrWhiteSpace(dto.MarketingBadge) && !AllowedMarketingBadges.Contains(dto.MarketingBadge.Trim()))
            {
                return BadRequest(new
                {
                    message = $"Invalid marketing badge '{dto.MarketingBadge}'. Allowed values: {string.Join(", ", AllowedMarketingBadges)}"
                });
            }

            var product = new Product
            {
                Sku = dto.SKU,
                Name = dto.Name,
                Description = dto.Description,
                Price = dto.Price,
                CompareAtPrice = dto.CompareAtPrice,
                StockQuantity = dto.StockQuantity,
                CategoryId = dto.CategoryId,
                IsActive = dto.IsActive,
                WaterSafe = dto.WaterSafe,
                SunlightExposure = dto.SunlightExposure,
                Chakra = dto.Chakra,
                Element = dto.Element,
                MarketingBadge = dto.MarketingBadge?.Trim(),
                Zodiacs = zodiacs
            };

            _context.Products.Add(product);

            await _context.SaveChangesAsync();

            // Logged after the first save so the new ProductId is known.
            _auditLogService.Log(CurrentAdminId(), "ProductCreated", "Product", product.ProductId,
                $"{product.Name} ({product.Sku}), ₹{product.Price:0.00}, stock {product.StockQuantity}");
            await _context.SaveChangesAsync();

            // Live: open admin screens refresh (e.g. the sidebar's low-stock badge).
            await _notificationService.BroadcastStockAsync(new[] { product });

            var createdProduct = await GetProduct(product.ProductId);
            var createdDto = (createdProduct.Result as OkObjectResult)?.Value;

            return CreatedAtAction(
                nameof(GetProduct),
                new { id = product.ProductId },
                createdDto
            );
        }

        // PUT: api/products/1
        [Authorize(Roles = "Admin")]
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateProduct(
            int id,
            UpdateProductDto dto)
        {
            var product = await _context.Products
                .Include(p => p.Zodiacs)
                .FirstOrDefaultAsync(p => p.ProductId == id);

            if (product == null)
            {
                return NotFound(new
                {
                    message = "Product not found"
                });
            }

            var categoryExists = await _context.Categories
                .AnyAsync(c => c.CategoryId == dto.CategoryId);

            if (!categoryExists)
            {
                return BadRequest(new
                {
                    message = "Category does not exist"
                });
            }

            var skuExists = await _context.Products
                .AnyAsync(p =>
                    p.Sku == dto.SKU &&
                    p.ProductId != id);

            if (skuExists)
            {
                return BadRequest(new
                {
                    message = "SKU already exists"
                });
            }

            if (dto.CompareAtPrice.HasValue && dto.CompareAtPrice.Value <= dto.Price)
            {
                return BadRequest(new
                {
                    message = "Compare-at price must be greater than the selling price"
                });
            }

            var zodiacs = await _context.ZodiacSigns
                .Where(z => dto.ZodiacIds.Contains(z.ZodiacId))
                .ToListAsync();

            if (zodiacs.Count != dto.ZodiacIds.Distinct().Count())
            {
                return BadRequest(new
                {
                    message = "One or more zodiac signs do not exist"
                });
            }

            if (!string.IsNullOrWhiteSpace(dto.MarketingBadge) && !AllowedMarketingBadges.Contains(dto.MarketingBadge.Trim()))
            {
                return BadRequest(new
                {
                    message = $"Invalid marketing badge '{dto.MarketingBadge}'. Allowed values: {string.Join(", ", AllowedMarketingBadges)}"
                });
            }

            // What changed, for the audit log (e.g. "Price ₹899.00 → ₹799.00").
            var changes = new List<string>();
            if (product.Name != dto.Name) changes.Add($"Name \"{product.Name}\" → \"{dto.Name}\"");
            if (product.Sku != dto.SKU) changes.Add($"SKU {product.Sku} → {dto.SKU}");
            if (product.Price != dto.Price) changes.Add($"Price ₹{product.Price:0.00} → ₹{dto.Price:0.00}");
            if (product.CompareAtPrice != dto.CompareAtPrice) changes.Add($"Compare-at ₹{product.CompareAtPrice:0.00} → ₹{dto.CompareAtPrice:0.00}");
            if (product.CategoryId != dto.CategoryId) changes.Add($"Category #{product.CategoryId} → #{dto.CategoryId}");
            if (product.IsActive != dto.IsActive) changes.Add(dto.IsActive ? "Activated" : "Deactivated");
            if (product.Description != dto.Description) changes.Add("Description edited");
            if (!product.Zodiacs.Select(z => z.ZodiacId).OrderBy(x => x).SequenceEqual(dto.ZodiacIds.Distinct().OrderBy(x => x)))
                changes.Add("Zodiac signs changed");
            if (product.MarketingBadge != (string.IsNullOrWhiteSpace(dto.MarketingBadge) ? null : dto.MarketingBadge.Trim()))
                changes.Add($"Badge \"{product.MarketingBadge ?? "None"}\" → \"{(string.IsNullOrWhiteSpace(dto.MarketingBadge) ? "None" : dto.MarketingBadge.Trim())}\"");

            _auditLogService.Log(CurrentAdminId(), "ProductUpdated", "Product", product.ProductId,
                $"{dto.Name}: " + (changes.Count > 0 ? string.Join("; ", changes) : "no changes"));

            product.Sku = dto.SKU;
            product.Name = dto.Name;
            product.Description = dto.Description;
            product.Price = dto.Price;
            product.CompareAtPrice = dto.CompareAtPrice;
            product.CategoryId = dto.CategoryId;
            product.IsActive = dto.IsActive;
            product.WaterSafe = dto.WaterSafe;
            product.SunlightExposure = dto.SunlightExposure;
            product.Chakra = dto.Chakra;
            product.Element = dto.Element;
            product.MarketingBadge = dto.MarketingBadge?.Trim();

            product.Zodiacs.Clear();
            foreach (var zodiac in zodiacs)
            {
                product.Zodiacs.Add(zodiac);
            }

            await _context.SaveChangesAsync();
            await _notificationService.BroadcastStockAsync(new[] { product });

            return NoContent();
        }

        private const int BulkUpdateLimit = 1000;

        private static readonly HashSet<string> PriceActions = new(StringComparer.OrdinalIgnoreCase)
        {
            "setPrice", "increasePercent", "decreasePercent", "increaseAmount", "decreaseAmount", "startSale"
        };

        // POST: api/products/bulk-update
        // One change (price, sale, status or category) applied to the ticked
        // products or to everything matching the admin list's filters. With
        // Preview the result is computed but nothing is saved, so the admin can
        // check old → new before applying. The commit recomputes from the current
        // values, saves all rows in one SaveChanges, writes an audit entry per
        // product, and pokes the alert job so wishlist price drops go out batched.
        [Authorize(Roles = "Admin")]
        [HttpPost("bulk-update")]
        public async Task<ActionResult<BulkUpdateResultDto>> BulkUpdate(BulkUpdateProductsDto dto)
        {
            var action = dto.Action?.Trim() ?? "";
            var known = PriceActions.Contains(action) ||
                new[] { "endSale", "activate", "deactivate", "setCategory" }.Contains(action, StringComparer.OrdinalIgnoreCase);
            if (!known)
            {
                return BadRequest(new { message = "Unknown bulk action" });
            }

            var needsValue = PriceActions.Contains(action);
            if (needsValue && (!dto.Value.HasValue || dto.Value.Value <= 0))
            {
                return BadRequest(new { message = "Enter a value greater than 0" });
            }
            if (action.Equals("startSale", StringComparison.OrdinalIgnoreCase) && dto.Value >= 95)
            {
                return BadRequest(new { message = "Sale discount must be below 95%" });
            }
            if (action.Equals("decreasePercent", StringComparison.OrdinalIgnoreCase) && dto.Value >= 100)
            {
                return BadRequest(new { message = "Decrease must be below 100%" });
            }

            Category? newCategory = null;
            if (action.Equals("setCategory", StringComparison.OrdinalIgnoreCase))
            {
                newCategory = dto.CategoryId.HasValue ? await _context.Categories.FindAsync(dto.CategoryId.Value) : null;
                if (newCategory == null)
                {
                    return BadRequest(new { message = "Category does not exist" });
                }
            }

            IQueryable<Product> query = _context.Products.Include(p => p.Category);
            if (dto.ProductIds != null)
            {
                var ids = dto.ProductIds.Distinct().ToList();
                if (ids.Count == 0)
                {
                    return BadRequest(new { message = "Select at least one product" });
                }
                query = query.Where(p => ids.Contains(p.ProductId));
            }
            else
            {
                var f = dto.Filter ?? new BulkProductFilterDto();
                query = ApplyAdminFilters(
                    ApplyFilters(query, f.Search, await CategoryWithDescendantsAsync(f.CategoryId), false, null, null, null, false),
                    f.Status, f.Stock, false);
            }

            var products = await query.OrderBy(p => p.ProductId).Take(BulkUpdateLimit + 1).ToListAsync();
            if (products.Count > BulkUpdateLimit)
            {
                return BadRequest(new { message = $"Bulk updates are limited to {BulkUpdateLimit} products at a time. Narrow the filters." });
            }

            var result = new BulkUpdateResultDto();
            foreach (var p in products)
            {
                var row = new BulkUpdateRowDto
                {
                    ProductId = p.ProductId,
                    Sku = p.Sku,
                    Name = p.Name,
                    OldPrice = p.Price,
                    NewPrice = p.Price,
                    OldCompareAtPrice = p.CompareAtPrice,
                    NewCompareAtPrice = p.CompareAtPrice,
                    OldIsActive = p.IsActive,
                    NewIsActive = p.IsActive,
                    OldCategory = p.Category?.Name ?? "",
                    NewCategory = p.Category?.Name ?? ""
                };

                ComputeBulkRow(row, action, dto.Value ?? 0, dto.Rounding, newCategory);

                row.Changed = row.SkipReason == null &&
                    (row.NewPrice != row.OldPrice || row.NewCompareAtPrice != row.OldCompareAtPrice ||
                     row.NewIsActive != row.OldIsActive || (newCategory != null && p.CategoryId != newCategory.CategoryId));

                if (row.SkipReason != null) result.SkippedCount++;
                else if (row.Changed) result.ChangedCount++;
                else result.UnchangedCount++;

                result.Rows.Add(row);
            }

            if (dto.Preview || result.ChangedCount == 0)
            {
                return Ok(result);
            }

            var adminId = CurrentAdminId();
            var changedProducts = new List<Product>();
            foreach (var (p, row) in products.Zip(result.Rows))
            {
                if (!row.Changed)
                {
                    continue;
                }

                var changes = new List<string>();
                if (row.NewPrice != row.OldPrice) changes.Add($"Price ₹{row.OldPrice:0.00} → ₹{row.NewPrice:0.00}");
                if (row.NewCompareAtPrice != row.OldCompareAtPrice) changes.Add($"Compare-at ₹{row.OldCompareAtPrice:0.00} → ₹{row.NewCompareAtPrice:0.00}");
                if (row.NewIsActive != row.OldIsActive) changes.Add(row.NewIsActive ? "Activated" : "Deactivated");
                if (newCategory != null && p.CategoryId != newCategory.CategoryId) changes.Add($"Category #{p.CategoryId} → #{newCategory.CategoryId}");

                _auditLogService.Log(adminId, "ProductBulkUpdated", "Product", p.ProductId,
                    $"{p.Name} (bulk {action}): {string.Join("; ", changes)}");

                p.Price = row.NewPrice;
                p.CompareAtPrice = row.NewCompareAtPrice;
                p.IsActive = row.NewIsActive;
                if (newCategory != null)
                {
                    p.CategoryId = newCategory.CategoryId;
                }
                changedProducts.Add(p);
            }

            await _context.SaveChangesAsync();
            await _notificationService.BroadcastStockAsync(changedProducts);

            result.Applied = true;
            return Ok(result);
        }

        private static void ComputeBulkRow(BulkUpdateRowDto row, string action, decimal value, string? rounding, Category? newCategory)
        {
            switch (action.ToLowerInvariant())
            {
                case "activate":
                    row.NewIsActive = true;
                    return;
                case "deactivate":
                    row.NewIsActive = false;
                    return;
                case "setcategory":
                    row.NewCategory = newCategory!.Name;
                    return;
                case "endsale":
                    if (row.OldCompareAtPrice.HasValue)
                    {
                        row.NewPrice = row.OldCompareAtPrice.Value;
                        row.NewCompareAtPrice = null;
                    }
                    return;
                case "startsale":
                    // Already on sale: discount off the original "was" price, not the sale price.
                    var original = row.OldCompareAtPrice ?? row.OldPrice;
                    row.NewCompareAtPrice = original;
                    row.NewPrice = RoundBulkPrice(original * (1 - value / 100m), rounding);
                    break;
                case "setprice":
                    row.NewPrice = RoundBulkPrice(value, rounding);
                    break;
                case "increasepercent":
                    row.NewPrice = RoundBulkPrice(row.OldPrice * (1 + value / 100m), rounding);
                    break;
                case "decreasepercent":
                    row.NewPrice = RoundBulkPrice(row.OldPrice * (1 - value / 100m), rounding);
                    break;
                case "increaseamount":
                    row.NewPrice = RoundBulkPrice(row.OldPrice + value, rounding);
                    break;
                case "decreaseamount":
                    row.NewPrice = RoundBulkPrice(row.OldPrice - value, rounding);
                    break;
            }

            if (row.NewPrice <= 0)
            {
                row.SkipReason = "New price would be ₹0 or less";
            }
            else if (row.NewCompareAtPrice.HasValue && row.NewCompareAtPrice.Value <= row.NewPrice)
            {
                row.SkipReason = $"Compare-at ₹{row.NewCompareAtPrice:0.00} would not be above the new price";
            }
        }

        // "whole" → nearest rupee; "99" → nearest price ending in 99 (₹812 → ₹799),
        // falling back to whole rupees under ₹100 so small prices aren't pushed up.
        private static decimal RoundBulkPrice(decimal price, string? rounding)
        {
            switch (rounding?.ToLowerInvariant())
            {
                case "whole":
                    return Math.Round(price, 0, MidpointRounding.AwayFromZero);
                case "99":
                    if (price < 100)
                    {
                        return Math.Round(price, 0, MidpointRounding.AwayFromZero);
                    }
                    return Math.Round(price / 100m, 0, MidpointRounding.AwayFromZero) * 100m - 1m;
                default:
                    return Math.Round(price, 2, MidpointRounding.AwayFromZero);
            }
        }

        // POST: api/products/1/add-stock  { "quantity": 10 }
        // Quick restock (e.g. from the dashboard's low-stock list). Adds to the
        // current stock in the database rather than overwriting it, so an order
        // placed meanwhile isn't lost, and touches no other product fields.
        [Authorize(Roles = "Admin")]
        [HttpPost("{id}/add-stock")]
        public async Task<ActionResult<object>> AddStock(int id, AddStockDto dto)
        {
            var rows = await _context.Products
                .Where(p => p.ProductId == id)
                .ExecuteUpdateAsync(s => s.SetProperty(p => p.StockQuantity, p => p.StockQuantity + dto.Quantity));

            if (rows == 0)
            {
                return NotFound(new
                {
                    message = "Product not found"
                });
            }

            var stockQuantity = await _context.Products
                .Where(p => p.ProductId == id)
                .Select(p => p.StockQuantity)
                .FirstAsync();

            if (int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var adminUserId))
            {
                _auditLogService.Log(adminUserId, "StockAdded", "Product", id, $"+{dto.Quantity} (now {stockQuantity})");
                await _context.SaveChangesAsync();
            }

            await _notificationService.BroadcastStockAsync(new[] { (id, stockQuantity) });

            return Ok(new { stockQuantity });
        }

        // POST: api/products/1/adjust-stock  { "delta": -3 }
        // Stock page edits. Applies the change to the current stock in the database
        // instead of overwriting it, so orders placed since the page loaded aren't
        // lost, and touches no other product fields. Never takes stock below 0.
        [Authorize(Roles = "Admin")]
        [HttpPost("{id}/adjust-stock")]
        public async Task<ActionResult<object>> AdjustStock(int id, AdjustStockDto dto)
        {
            if (!await _context.Products.AnyAsync(p => p.ProductId == id))
            {
                return NotFound(new
                {
                    message = "Product not found"
                });
            }

            var rows = await _context.Products
                .Where(p => p.ProductId == id && p.StockQuantity + dto.Delta >= 0)
                .ExecuteUpdateAsync(s => s.SetProperty(p => p.StockQuantity, p => p.StockQuantity + dto.Delta));

            var stockQuantity = await _context.Products
                .Where(p => p.ProductId == id)
                .Select(p => p.StockQuantity)
                .FirstAsync();

            if (rows == 0)
            {
                return Conflict(new
                {
                    message = $"Stock has changed and is now {stockQuantity}. Reload and try again.",
                    stockQuantity
                });
            }

            if (int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var adminUserId))
            {
                _auditLogService.Log(adminUserId, "StockAdjusted", "Product", id, $"{dto.Delta:+#;-#;0} (now {stockQuantity})");
                await _context.SaveChangesAsync();
            }

            await _notificationService.BroadcastStockAsync(new[] { (id, stockQuantity) });

            return Ok(new { stockQuantity });
        }

        // DELETE: api/products/1
        [Authorize(Roles = "Admin")]
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteProduct(int id)
        {
            var product = await _context.Products
                .Include(p => p.ProductImages)
                .Include(p => p.Zodiacs)
                .FirstOrDefaultAsync(p => p.ProductId == id);

            if (product == null)
            {
                return NotFound(new
                {
                    message = "Product not found"
                });
            }

            var isReferenced =
                await _context.OrderItems.AnyAsync(oi => oi.ProductId == id) ||
                await _context.ProductReviews.AnyAsync(r => r.ProductId == id) ||
                await _context.Wishlists.AnyAsync(w => w.ProductId == id);

            if (isReferenced)
            {
                // Products referenced by orders, reviews or wishlists can't be
                // hard-deleted without breaking those rows, so hide it instead.
                product.IsActive = false;
            }
            else
            {
                _context.ProductImages.RemoveRange(product.ProductImages);
                product.Zodiacs.Clear();
                _context.Products.Remove(product);
            }

            _auditLogService.Log(CurrentAdminId(), "ProductDeleted", "Product", product.ProductId,
                isReferenced ? $"{product.Name} ({product.Sku}) - hidden, it has order/review history" : $"{product.Name} ({product.Sku})");

            await _context.SaveChangesAsync();

            return NoContent();
        }

        private int CurrentAdminId() =>
            int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : 0;
    }
}