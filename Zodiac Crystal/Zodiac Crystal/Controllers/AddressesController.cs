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
    [Authorize(Roles = "User")]
    public class AddressesController : ControllerBase
    {
        private readonly CrystalsDbContext _context;
        private readonly AddressCheckService _addressCheckService;

        public AddressesController(CrystalsDbContext context, AddressCheckService addressCheckService)
        {
            _context = context;
            _addressCheckService = addressCheckService;
        }

        // GET: api/addresses (the logged-in user's own addresses)
        [HttpGet]
        public async Task<ActionResult<IEnumerable<AddressDto>>> GetMyAddresses()
        {
            var userId = GetCurrentUserId();

            var addresses = await _context.Addresses
                .AsNoTracking()
                .Where(a => a.UserId == userId)
                .OrderByDescending(a => a.IsDefault)
                .ThenByDescending(a => a.CreatedAt)
                .ToListAsync();

            return Ok(addresses.Select(MapToDto));
        }

        // GET: api/addresses/1
        [HttpGet("{id}")]
        public async Task<ActionResult<AddressDto>> GetAddress(int id)
        {
            var userId = GetCurrentUserId();

            var address = await _context.Addresses
                .AsNoTracking()
                .FirstOrDefaultAsync(a => a.AddressId == id);

            // Returning NotFound (not Forbidden) for someone else's address avoids
            // confirming to an attacker that a given address ID even exists.
            if (address == null || address.UserId != userId)
            {
                return NotFound(new { message = "Address not found" });
            }

            return Ok(MapToDto(address));
        }

        // POST: api/addresses
        [HttpPost]
        public async Task<ActionResult<AddressDto>> CreateAddress(CreateAddressDto dto)
        {
            var userId = GetCurrentUserId();

            var addressError = await _addressCheckService.ValidateAsync(
                dto.Latitude, dto.Longitude, dto.City, dto.State, dto.PostalCode, HttpContext.RequestAborted);
            if (addressError != null)
            {
                return BadRequest(new { message = addressError });
            }

            var isFirstAddress = !await _context.Addresses.AnyAsync(a => a.UserId == userId);

            var address = new Address
            {
                UserId = userId,
                FullName = dto.FullName,
                Phone = dto.Phone,
                AddressLine1 = dto.AddressLine1,
                AddressLine2 = dto.AddressLine2,
                City = dto.City,
                State = dto.State,
                PostalCode = dto.PostalCode,
                Country = dto.Country,
                Latitude = PinOrNull(dto.Latitude, dto.Longitude),
                Longitude = PinOrNull(dto.Longitude, dto.Latitude),
                AddressType = dto.AddressType,
                // A user's very first address is always their default, regardless of
                // what was sent, so checkout always has a sensible address to preselect.
                IsDefault = isFirstAddress || dto.IsDefault,
                CreatedAt = DateTime.UtcNow
            };

            if (address.IsDefault && !isFirstAddress)
            {
                await ClearOtherDefaults(userId, excludeAddressId: null);
            }

            _context.Addresses.Add(address);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetAddress), new { id = address.AddressId }, MapToDto(address));
        }

        // PUT: api/addresses/1
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateAddress(int id, UpdateAddressDto dto)
        {
            var userId = GetCurrentUserId();

            var address = await _context.Addresses.FirstOrDefaultAsync(a => a.AddressId == id);

            if (address == null || address.UserId != userId)
            {
                return NotFound(new { message = "Address not found" });
            }

            var addressError = await _addressCheckService.ValidateAsync(
                dto.Latitude, dto.Longitude, dto.City, dto.State, dto.PostalCode, HttpContext.RequestAborted);
            if (addressError != null)
            {
                return BadRequest(new { message = addressError });
            }

            if (dto.IsDefault && !address.IsDefault)
            {
                await ClearOtherDefaults(userId, excludeAddressId: id);
            }

            address.FullName = dto.FullName;
            address.Phone = dto.Phone;
            address.AddressLine1 = dto.AddressLine1;
            address.AddressLine2 = dto.AddressLine2;
            address.City = dto.City;
            address.State = dto.State;
            address.PostalCode = dto.PostalCode;
            address.Country = dto.Country;
            address.Latitude = PinOrNull(dto.Latitude, dto.Longitude);
            address.Longitude = PinOrNull(dto.Longitude, dto.Latitude);
            address.AddressType = dto.AddressType;
            address.IsDefault = dto.IsDefault || address.IsDefault;

            await _context.SaveChangesAsync();

            return NoContent();
        }

        // POST: api/addresses/1/set-default
        [HttpPost("{id}/set-default")]
        public async Task<IActionResult> SetDefault(int id)
        {
            var userId = GetCurrentUserId();

            var address = await _context.Addresses.FirstOrDefaultAsync(a => a.AddressId == id);

            if (address == null || address.UserId != userId)
            {
                return NotFound(new { message = "Address not found" });
            }

            await ClearOtherDefaults(userId, excludeAddressId: id);
            address.IsDefault = true;

            await _context.SaveChangesAsync();

            return NoContent();
        }

        // DELETE: api/addresses/1
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteAddress(int id)
        {
            var userId = GetCurrentUserId();

            var address = await _context.Addresses.FirstOrDefaultAsync(a => a.AddressId == id);

            if (address == null || address.UserId != userId)
            {
                return NotFound(new { message = "Address not found" });
            }

            var wasDefault = address.IsDefault;

            _context.Addresses.Remove(address);
            await _context.SaveChangesAsync();

            // If the deleted address was the default, promote the most recently
            // added remaining address so the user always has a default to fall
            // back on at checkout, rather than being left with none.
            if (wasDefault)
            {
                var nextDefault = await _context.Addresses
                    .Where(a => a.UserId == userId)
                    .OrderByDescending(a => a.CreatedAt)
                    .FirstOrDefaultAsync();

                if (nextDefault != null)
                {
                    nextDefault.IsDefault = true;
                    await _context.SaveChangesAsync();
                }
            }

            return NoContent();
        }

        // A user should have at most one default address - unset any others
        // before a new one is marked default.
        private async Task ClearOtherDefaults(int userId, int? excludeAddressId)
        {
            var others = await _context.Addresses
                .Where(a => a.UserId == userId && a.IsDefault && a.AddressId != excludeAddressId)
                .ToListAsync();

            foreach (var other in others)
            {
                other.IsDefault = false;
            }
        }

        private int GetCurrentUserId()
        {
            var claim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            return int.Parse(claim!);
        }

        // Only keep a complete pin; half a coordinate is useless.
        private static decimal? PinOrNull(decimal? value, decimal? other) =>
            value.HasValue && other.HasValue ? Math.Round(value.Value, 6) : null;

        private static AddressDto MapToDto(Address a)
        {
            return new AddressDto
            {
                AddressId = a.AddressId,
                FullName = a.FullName,
                Phone = a.Phone,
                AddressLine1 = a.AddressLine1,
                AddressLine2 = a.AddressLine2,
                City = a.City,
                State = a.State,
                PostalCode = a.PostalCode,
                Country = a.Country,
                Latitude = a.Latitude,
                Longitude = a.Longitude,
                AddressType = a.AddressType,
                IsDefault = a.IsDefault,
                CreatedAt = a.CreatedAt
            };
        }
    }
}
