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
    public class ZodiacController : ControllerBase
    {
        private readonly CrystalsDbContext _context;
        private readonly AuditLogService _auditLogService;

        public ZodiacController(CrystalsDbContext context, AuditLogService auditLogService)
        {
            _context = context;
            _auditLogService = auditLogService;
        }

        // GET: api/zodiac
        [HttpGet]
        public async Task<ActionResult<IEnumerable<ZodiacDto>>> GetZodiacSigns()
        {
            var zodiacSigns = await _context.ZodiacSigns
                .Select(z => new ZodiacDto
                {
                    ZodiacId = z.ZodiacId,
                    Name = z.Name,
                    RashiName = z.RashiName,
                    Symbol = z.Symbol,
                    Description = z.Description,
                    ImageUrl = z.ImageUrl
                })
                .ToListAsync();

            return Ok(zodiacSigns);
        }

        // GET: api/zodiac/1
        [HttpGet("{id}")]
        public async Task<ActionResult<ZodiacDto>> GetZodiacSign(int id)
        {
            var zodiac = await _context.ZodiacSigns
                .Where(z => z.ZodiacId == id)
                .Select(z => new ZodiacDto
                {
                    ZodiacId = z.ZodiacId,
                    Name = z.Name,
                    RashiName = z.RashiName,
                    Symbol = z.Symbol,
                    Description = z.Description,
                    ImageUrl = z.ImageUrl
                })
                .FirstOrDefaultAsync();

            if (zodiac == null)
            {
                return NotFound(new
                {
                    message = "Zodiac sign not found"
                });
            }

            return Ok(zodiac);
        }

        // GET: api/zodiac/1/products
        [HttpGet("{id}/products")]
        public async Task<ActionResult<IEnumerable<ProductDto>>> GetProductsByZodiac(
            int id)
        {
            var zodiacExists = await _context.ZodiacSigns
                .AnyAsync(z => z.ZodiacId == id);

            if (!zodiacExists)
            {
                return NotFound(new
                {
                    message = "Zodiac sign not found"
                });
            }

            var products = await _context.Products
                .Where(p => p.Zodiacs.Any(z => z.ZodiacId == id))
                .Include(p => p.Category)
                .Include(p => p.ProductImages)
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
                        .ToList()
                })
                .ToListAsync();

            return Ok(products);
        }

        // POST: api/zodiac
        [Authorize(Roles = "Admin")]
        [HttpPost]
        public async Task<IActionResult> CreateZodiac(
            CreateZodiacDto dto)
        {
            var nameExists = await _context.ZodiacSigns
                .AnyAsync(z => z.Name == dto.Name);

            if (nameExists)
            {
                return BadRequest(new
                {
                    message = "Zodiac sign already exists"
                });
            }

            var zodiac = new ZodiacSign
            {
                Name = dto.Name,
                RashiName = dto.RashiName,
                Symbol = dto.Symbol,
                Description = dto.Description,
                ImageUrl = dto.ImageUrl
            };

            _context.ZodiacSigns.Add(zodiac);

            await _context.SaveChangesAsync();

            return CreatedAtAction(
                nameof(GetZodiacSign),
                new { id = zodiac.ZodiacId },
                zodiac
            );
        }

        // PUT: api/zodiac/1
        [Authorize(Roles = "Admin")]
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateZodiac(
            int id,
            UpdateZodiacDto dto)
        {
            var zodiac = await _context.ZodiacSigns
                .FindAsync(id);

            if (zodiac == null)
            {
                return NotFound(new
                {
                    message = "Zodiac sign not found"
                });
            }

            var nameExists = await _context.ZodiacSigns
                .AnyAsync(z =>
                    z.Name == dto.Name &&
                    z.ZodiacId != id);

            if (nameExists)
            {
                return BadRequest(new
                {
                    message = "Zodiac sign already exists"
                });
            }

            zodiac.Name = dto.Name;
            zodiac.RashiName = dto.RashiName;
            zodiac.Symbol = dto.Symbol;
            zodiac.Description = dto.Description;
            zodiac.ImageUrl = dto.ImageUrl;

            await _context.SaveChangesAsync();

            return NoContent();
        }

        // DELETE: api/zodiac/1
        [Authorize(Roles = "Admin")]
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteZodiac(int id)
        {
            var zodiac = await _context.ZodiacSigns
                .Include(z => z.Products)
                .FirstOrDefaultAsync(z => z.ZodiacId == id);

            if (zodiac == null)
            {
                return NotFound(new
                {
                    message = "Zodiac sign not found"
                });
            }

            // Unlink products first so the ProductZodiacs rows don't block the delete.
            zodiac.Products.Clear();
            _context.ZodiacSigns.Remove(zodiac);

            _auditLogService.Log(
                int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var adminId) ? adminId : 0,
                "ZodiacDeleted", "ZodiacSign", zodiac.ZodiacId, zodiac.Name);

            await _context.SaveChangesAsync();

            return NoContent();
        }
    }
}