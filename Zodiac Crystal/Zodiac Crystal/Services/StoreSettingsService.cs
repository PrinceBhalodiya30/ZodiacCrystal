using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Zodiac_Crystal.Data;
using Zodiac_Crystal.DTOs;
using Zodiac_Crystal.Models;

namespace Zodiac_Crystal.Services
{
    public class StoreSettingsService
    {
        private readonly CrystalsDbContext _context;
        private readonly IMemoryCache _cache;
        private readonly AuditLogService _auditLogService;
        private const string CacheKey = "StoreSettings_Public";
        private static readonly TimeSpan CacheDuration = TimeSpan.FromMinutes(10);

        public StoreSettingsService(CrystalsDbContext context, IMemoryCache cache, AuditLogService auditLogService)
        {
            _context = context;
            _cache = cache;
            _auditLogService = auditLogService;
        }

        public async Task<StoreSettingsDto> GetSettingsAsync()
        {
            if (_cache.TryGetValue(CacheKey, out StoreSettingsDto? cached) && cached != null)
            {
                return cached;
            }

            var setting = await _context.StoreSettings
                .AsNoTracking()
                .Include(s => s.UpdatedByUser)
                .OrderBy(s => s.Id)
                .FirstOrDefaultAsync();

            if (setting == null)
            {
                setting = new StoreSetting();
                _context.StoreSettings.Add(setting);
                await _context.SaveChangesAsync();
            }

            var dto = MapToDto(setting);
            _cache.Set(CacheKey, dto, CacheDuration);
            return dto;
        }

        public async Task<(decimal FreeShippingThreshold, decimal FlatShippingRate)> GetShippingRulesAsync()
        {
            var settings = await GetSettingsAsync();
            return (settings.FreeShippingThreshold, settings.FlatShippingRate);
        }

        public async Task<StoreSettingsDto> UpdateSettingsAsync(UpdateStoreSettingsDto dto, int? adminUserId)
        {
            var setting = await _context.StoreSettings
                .OrderBy(s => s.Id)
                .FirstOrDefaultAsync();

            if (setting == null)
            {
                setting = new StoreSetting();
                _context.StoreSettings.Add(setting);
            }

            var changes = DetectSettingChanges(setting, dto);
            ApplySettingUpdates(setting, dto, adminUserId);

            if (adminUserId.HasValue && changes.Count > 0)
            {
                _auditLogService.Log(
                    adminUserId.Value,
                    "UpdateStoreSettings",
                    "StoreSettings",
                    setting.Id,
                    string.Join("; ", changes)
                );
            }

            await _context.SaveChangesAsync();
            _cache.Remove(CacheKey);

            return await GetSettingsAsync();
        }

        private static List<string> DetectSettingChanges(StoreSetting setting, UpdateStoreSettingsDto dto)
        {
            var changes = new List<string>();

            if (setting.AnnouncementEnabled != dto.AnnouncementEnabled)
                changes.Add($"AnnouncementEnabled: {setting.AnnouncementEnabled} → {dto.AnnouncementEnabled}");

            if (setting.AnnouncementText != dto.AnnouncementText)
                changes.Add("AnnouncementText updated");

            if (setting.AnnouncementStyle != dto.AnnouncementStyle)
                changes.Add($"AnnouncementStyle: {setting.AnnouncementStyle} → {dto.AnnouncementStyle}");

            if (setting.FreeShippingThreshold != dto.FreeShippingThreshold)
                changes.Add($"FreeShippingThreshold: ₹{setting.FreeShippingThreshold} → ₹{dto.FreeShippingThreshold}");

            if (setting.FlatShippingRate != dto.FlatShippingRate)
                changes.Add($"FlatShippingRate: ₹{setting.FlatShippingRate} → ₹{dto.FlatShippingRate}");

            if (setting.HeroTitle != dto.HeroTitle)
                changes.Add("HeroTitle updated");

            if (setting.MoonBannerEnabled != dto.MoonBannerEnabled)
                changes.Add($"MoonBannerEnabled: {setting.MoonBannerEnabled} → {dto.MoonBannerEnabled}");

            if (setting.MoonBannerMode != dto.MoonBannerMode)
                changes.Add($"MoonBannerMode: {setting.MoonBannerMode} → {dto.MoonBannerMode}");

            if (setting.MoonBannerStyle != dto.MoonBannerStyle)
                changes.Add($"MoonBannerStyle: {setting.MoonBannerStyle} → {dto.MoonBannerStyle}");

            return changes;
        }

        private static void ApplySettingUpdates(StoreSetting setting, UpdateStoreSettingsDto dto, int? adminUserId)
        {
            setting.AnnouncementEnabled = dto.AnnouncementEnabled;
            setting.AnnouncementText = dto.AnnouncementText?.Trim() ?? string.Empty;
            setting.AnnouncementLink = TrimOrNull(dto.AnnouncementLink);
            setting.AnnouncementStyle = NormalizeOrDefault(dto.AnnouncementStyle, "emerald");
            setting.FreeShippingThreshold = Math.Max(0, dto.FreeShippingThreshold);
            setting.FlatShippingRate = Math.Max(0, dto.FlatShippingRate);
            setting.HeroEyebrow = dto.HeroEyebrow?.Trim() ?? string.Empty;
            setting.HeroTitle = dto.HeroTitle?.Trim() ?? string.Empty;
            setting.HeroSubtitle = dto.HeroSubtitle?.Trim() ?? string.Empty;
            setting.MoonBannerEnabled = dto.MoonBannerEnabled;
            setting.MoonBannerMode = NormalizeOrDefault(dto.MoonBannerMode, "auto");
            setting.MoonBannerCustomText = TrimOrNull(dto.MoonBannerCustomText);
            setting.MoonBannerCustomCrystal = TrimOrNull(dto.MoonBannerCustomCrystal);
            setting.MoonBannerCustomBenefit = TrimOrNull(dto.MoonBannerCustomBenefit);
            setting.MoonBannerCustomLink = TrimOrNull(dto.MoonBannerCustomLink);
            setting.MoonBannerShowModal = dto.MoonBannerShowModal;
            setting.MoonBannerStyle = NormalizeOrDefault(dto.MoonBannerStyle, "midnight");
            setting.UpdatedAt = DateTime.UtcNow;
            setting.UpdatedByUserId = adminUserId;
        }

        private static string? TrimOrNull(string? value) =>
            string.IsNullOrWhiteSpace(value) ? null : value.Trim();

        private static string NormalizeOrDefault(string? value, string defaultValue) =>
            string.IsNullOrWhiteSpace(value) ? defaultValue : value.Trim().ToLowerInvariant();

        public void InvalidateCache()
        {
            _cache.Remove(CacheKey);
        }

        private static StoreSettingsDto MapToDto(StoreSetting s) => new()
        {
            Id = s.Id,
            AnnouncementEnabled = s.AnnouncementEnabled,
            AnnouncementText = s.AnnouncementText,
            AnnouncementLink = s.AnnouncementLink,
            AnnouncementStyle = s.AnnouncementStyle,
            FreeShippingThreshold = s.FreeShippingThreshold,
            FlatShippingRate = s.FlatShippingRate,
            HeroEyebrow = s.HeroEyebrow,
            HeroTitle = s.HeroTitle,
            HeroSubtitle = s.HeroSubtitle,
            MoonBannerEnabled = s.MoonBannerEnabled,
            MoonBannerMode = s.MoonBannerMode,
            MoonBannerCustomText = s.MoonBannerCustomText,
            MoonBannerCustomCrystal = s.MoonBannerCustomCrystal,
            MoonBannerCustomBenefit = s.MoonBannerCustomBenefit,
            MoonBannerCustomLink = s.MoonBannerCustomLink,
            MoonBannerShowModal = s.MoonBannerShowModal,
            MoonBannerStyle = s.MoonBannerStyle,
            UpdatedAt = DateTime.SpecifyKind(s.UpdatedAt, DateTimeKind.Utc),
            UpdatedByEmail = s.UpdatedByUser?.Email
        };
    }
}

