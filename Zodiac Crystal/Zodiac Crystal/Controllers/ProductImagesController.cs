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
    [Authorize(Roles = "Admin")]
    public class ProductImagesController : ControllerBase
    {
        private static readonly string[] AllowedExtensions = { ".jpg", ".jpeg", ".png", ".webp" };
        private static readonly string[] AllowedContentTypes = { "image/jpeg", "image/png", "image/webp" };
        private const long MaxFileSizeBytes = 5 * 1024 * 1024; // 5 MB

        private readonly CrystalsDbContext _context;
        private readonly IWebHostEnvironment _environment;

        public ProductImagesController(CrystalsDbContext context, IWebHostEnvironment environment)
        {
            _context = context;
            _environment = environment;
        }

        // GET: api/productimages
        [HttpGet]
        public async Task<ActionResult<IEnumerable<ProductImageDto>>> GetImages()
        {
            var images = await _context.ProductImages
                .Select(i => new ProductImageDto
                {
                    ProductImageId = i.ProductImageId,
                    ProductId = i.ProductId,
                    ImageUrl = i.ImageUrl,
                    IsPrimary = i.IsPrimary
                })
                .ToListAsync();

            return Ok(images);
        }

        // GET: api/productimages/1
        [HttpGet("{id}")]
        public async Task<ActionResult<ProductImageDto>> GetImage(int id)
        {
            var image = await _context.ProductImages
                .Where(i => i.ProductImageId == id)
                .Select(i => new ProductImageDto
                {
                    ProductImageId = i.ProductImageId,
                    ProductId = i.ProductId,
                    ImageUrl = i.ImageUrl,
                    IsPrimary = i.IsPrimary
                })
                .FirstOrDefaultAsync();

            if (image == null)
            {
                return NotFound(new
                {
                    message = "Product image not found"
                });
            }

            return Ok(image);
        }

        // POST: api/productimages
        [HttpPost]
        public async Task<IActionResult> CreateImage(
            CreateProductImageDto dto)
        { 
            var productExists = await _context.Products
                .AnyAsync(p => p.ProductId == dto.ProductId);

            if (!productExists)
            {
                return BadRequest(new
                {
                    message = "Product does not exist"
                });
            }

            if (dto.IsPrimary)
            {
                await ClearOtherPrimaryImages(dto.ProductId, excludeImageId: null);
            }

            var image = new ProductImage
            {
                ProductId = dto.ProductId,
                ImageUrl = dto.ImageUrl,
                IsPrimary = dto.IsPrimary
            };

            _context.ProductImages.Add(image);

            await _context.SaveChangesAsync();

            var createdDto = new ProductImageDto
            {
                ProductImageId = image.ProductImageId,
                ProductId = image.ProductId,
                ImageUrl = image.ImageUrl,
                IsPrimary = image.IsPrimary
            };

            return CreatedAtAction(
                nameof(GetImage),
                new { id = image.ProductImageId },
                createdDto
            );
        }

        // POST: api/productimages/upload (multipart/form-data: file, productId, isPrimary)
        [HttpPost("upload")]
        [RequestSizeLimit(MaxFileSizeBytes)]
        public async Task<IActionResult> UploadImage([FromForm] UploadProductImageDto dto)
        {
            var file = dto.File;
            var productId = dto.ProductId;
            var isPrimary = dto.IsPrimary;

            var productExists = await _context.Products.AnyAsync(p => p.ProductId == productId);

            if (!productExists)
            {
                return BadRequest(new { message = "Product does not exist" });
            }

            if (file == null || file.Length == 0)
            {
                return BadRequest(new { message = "No file was uploaded" });
            }

            if (file.Length > MaxFileSizeBytes)
            {
                return BadRequest(new { message = "Image must be 5 MB or smaller" });
            }

            var extension = Path.GetExtension(file.FileName).ToLowerInvariant();

            if (!AllowedExtensions.Contains(extension) || !AllowedContentTypes.Contains(file.ContentType))
            {
                return BadRequest(new { message = "Only JPG, PNG, or WEBP images are allowed" });
            }

            // The extension and Content-Type come from the client; check the bytes too.
            using var content = new MemoryStream();
            await file.CopyToAsync(content);
            content.Position = 0;

            var invalid = ImageUploadValidator.Validate(content, extension);
            if (invalid != null)
            {
                return BadRequest(new { message = invalid });
            }

            var uploadsFolder = Path.Combine(_environment.ContentRootPath, "wwwroot", "uploads", "products");
            Directory.CreateDirectory(uploadsFolder);

            var fileName = $"{Guid.NewGuid()}{extension}";
            var filePath = Path.Combine(uploadsFolder, fileName);

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                content.Position = 0;
                await content.CopyToAsync(stream);
            }

            // WebP + responsive-size variants alongside the original (name-400.webp etc.)
            // for the frontend's srcset. Best-effort: the original is always kept and served
            // if conversion fails.
            ImageVariantService.GenerateVariants(filePath);

            if (isPrimary)
            {
                await ClearOtherPrimaryImages(productId, excludeImageId: null);
            }

            // Stored as a full absolute URL (not a relative path) so every existing
            // frontend consumer - which already expects a ready-to-use <img src> value
            // like the external stock-photo URLs used elsewhere - works unchanged.
            var imageUrl = $"{Request.Scheme}://{Request.Host}/uploads/products/{fileName}";

            var image = new ProductImage
            {
                ProductId = productId,
                ImageUrl = imageUrl,
                IsPrimary = isPrimary
            };

            _context.ProductImages.Add(image);

            await _context.SaveChangesAsync();

            var createdDto = new ProductImageDto
            {
                ProductImageId = image.ProductImageId,
                ProductId = image.ProductId,
                ImageUrl = image.ImageUrl,
                IsPrimary = image.IsPrimary
            };

            return CreatedAtAction(
                nameof(GetImage),
                new { id = image.ProductImageId },
                createdDto
            );
        }

        // PUT: api/productimages/1
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateImage(
            int id,
            UpdateProductImageDto dto)
        {
            var image = await _context.ProductImages
                .FindAsync(id);

            if (image == null)
            {
                return NotFound(new
                {
                    message = "Product image not found"
                });
            }

            var productExists = await _context.Products
                .AnyAsync(p => p.ProductId == dto.ProductId);

            if (!productExists)
            {
                return BadRequest(new
                {
                    message = "Product does not exist"
                });
            }

            if (dto.IsPrimary)
            {
                await ClearOtherPrimaryImages(dto.ProductId, excludeImageId: id);
            }

            image.ProductId = dto.ProductId;
            image.ImageUrl = dto.ImageUrl;
            image.IsPrimary = dto.IsPrimary;

            await _context.SaveChangesAsync();

            return NoContent();
        }

        // PUT: api/productimages/1/set-primary
        [HttpPut("{id}/set-primary")]
        public async Task<IActionResult> SetPrimary(int id)
        {
            var image = await _context.ProductImages
                .FindAsync(id);

            if (image == null)
            {
                return NotFound(new
                {
                    message = "Product image not found"
                });
            }

            await ClearOtherPrimaryImages(image.ProductId, excludeImageId: id);

            image.IsPrimary = true;

            await _context.SaveChangesAsync();

            return NoContent();
        }

        // DELETE: api/productimages/1
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteImage(int id)
        {
            var image = await _context.ProductImages
                .FindAsync(id);

            if (image == null)
            {
                return NotFound(new
                {
                    message = "Product image not found"
                });
            }

            _context.ProductImages.Remove(image);

            await _context.SaveChangesAsync();

            // Only delete from disk if this is one of our own uploaded files, not an
            // external URL (e.g. a stock photo link) - never attempt to touch other hosts.
            var uploadsMarker = "/uploads/products/";
            var markerIndex = image.ImageUrl.IndexOf(uploadsMarker, StringComparison.OrdinalIgnoreCase);

            if (markerIndex >= 0)
            {
                var relativePath = image.ImageUrl[(markerIndex + 1)..]; // "uploads/products/xyz.jpg"
                var filePath = Path.Combine(_environment.ContentRootPath, "wwwroot", relativePath);

                if (System.IO.File.Exists(filePath))
                {
                    System.IO.File.Delete(filePath);
                }

                ImageVariantService.DeleteVariants(filePath);
            }

            return NoContent();
        }

        // POST: api/productimages/generate-variants
        // One-off backfill: creates WebP/responsive variants for existing uploads that
        // don't have them yet. Safe to re-run - files that already have variants are skipped.
        [HttpPost("generate-variants")]
        public IActionResult GenerateMissingVariants()
        {
            var uploadsFolder = Path.Combine(_environment.ContentRootPath, "wwwroot", "uploads", "products");

            if (!Directory.Exists(uploadsFolder))
            {
                return Ok(new { generated = 0, failed = 0 });
            }

            int generated = 0, failed = 0;

            var originals = Directory.EnumerateFiles(uploadsFolder)
                .Where(f => AllowedExtensions.Contains(Path.GetExtension(f).ToLowerInvariant()))
                // Skip our own generated files (name-400.webp) and name.webp copies of a jpg/png
                .Where(f => !System.Text.RegularExpressions.Regex.IsMatch(Path.GetFileName(f), @"-(400|800|1200)\.webp$", System.Text.RegularExpressions.RegexOptions.IgnoreCase))
                .ToList();

            foreach (var original in originals)
            {
                var baseName = Path.GetFileNameWithoutExtension(original);
                var isWebpCopy = original.EndsWith(".webp", StringComparison.OrdinalIgnoreCase) &&
                    originals.Any(o => o != original && Path.GetFileNameWithoutExtension(o) == baseName);

                if (isWebpCopy || System.IO.File.Exists(Path.Combine(uploadsFolder, $"{baseName}-400.webp")))
                {
                    continue;
                }

                if (ImageVariantService.GenerateVariants(original)) generated++;
                else failed++;
            }

            return Ok(new { generated, failed });
        }

        // A product should have at most one primary image - unset any others
        // before a new one is marked primary.
        private async Task ClearOtherPrimaryImages(int productId, int? excludeImageId)
        {
            var otherPrimaryImages = await _context.ProductImages
                .Where(i =>
                    i.ProductId == productId &&
                    i.IsPrimary &&
                    i.ProductImageId != excludeImageId)
                .ToListAsync();

            foreach (var image in otherPrimaryImages)
            {
                image.IsPrimary = false;
            }
        }
    }
}