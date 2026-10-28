using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Zodiac_Crystal.DTOs;
using Zodiac_Crystal.Services;

namespace Zodiac_Crystal.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class SettingsController : ControllerBase
    {
        private readonly StoreSettingsService _settingsService;

        public SettingsController(StoreSettingsService settingsService)
        {
            _settingsService = settingsService;
        }

        // GET: api/settings/public
        // Fast, cached endpoint for storefront components (Navbar, Cart, Hero, Footer)
        [HttpGet("public")]
        [AllowAnonymous]
        public async Task<ActionResult<StoreSettingsDto>> GetPublicSettings()
        {
            var settings = await _settingsService.GetSettingsAsync();
            return Ok(settings);
        }

        // GET: api/settings/admin
        [HttpGet("admin")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<StoreSettingsDto>> GetAdminSettings()
        {
            var settings = await _settingsService.GetSettingsAsync();
            return Ok(settings);
        }

        // PUT: api/settings/admin
        [HttpPut("admin")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<StoreSettingsDto>> UpdateSettings([FromBody] UpdateStoreSettingsDto dto)
        {
            if (dto == null)
            {
                return BadRequest(new { message = "Settings data is required" });
            }

            if (dto.FreeShippingThreshold < 0)
            {
                return BadRequest(new { message = "Free shipping threshold cannot be negative" });
            }

            if (dto.FlatShippingRate < 0)
            {
                return BadRequest(new { message = "Flat shipping rate cannot be negative" });
            }

            int? adminUserId = null;
            var claim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (int.TryParse(claim, out var parsedId))
            {
                adminUserId = parsedId;
            }

            var updated = await _settingsService.UpdateSettingsAsync(dto, adminUserId);
            return Ok(updated);
        }
    }
}

