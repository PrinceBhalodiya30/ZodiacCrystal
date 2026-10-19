using System.Net.Http.Json;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Caching.Memory;

namespace Zodiac_Crystal.Services
{
    // Server-side check for every shipping address (orders, mystery box, address
    // book), so the browser's PIN check can't be skipped by calling the API
    // directly: the PIN code must be a real India Post PIN in the chosen state,
    // and a map pin, when sent, must be inside India.
    //
    // If India Post can't be reached the PIN check is skipped rather than
    // blocking every checkout.
    public partial class AddressCheckService
    {
        public const string IndiaPostUrl = "https://api.postalpincode.in/";

        // Same box the map is restricted to (south-west and north-east corners).
        private const decimal MinLat = 6m, MaxLat = 37.5m, MinLng = 68m, MaxLng = 97.5m;

        private static readonly TimeSpan CacheFor = TimeSpan.FromHours(12);

        private readonly HttpClient _http;
        private readonly IMemoryCache _cache;
        private readonly ILogger<AddressCheckService> _logger;

        public AddressCheckService(HttpClient http, IMemoryCache cache, ILogger<AddressCheckService> logger)
        {
            _http = http;
            _cache = cache;
            _logger = logger;
        }


        // Null when the address is acceptable, otherwise a message for the customer.
        public async Task<string?> ValidateAsync(
            decimal? latitude, decimal? longitude, string city, string state, string postalCode, CancellationToken ct = default)
        {
            // The map pin is optional, but one that's sent must be a real spot in India.
            if (latitude.HasValue && longitude.HasValue
                && (latitude < MinLat || latitude > MaxLat || longitude < MinLng || longitude > MaxLng))
            {
                return "We only deliver within India. Please check the location on the map.";
            }

            var pin = postalCode.Trim();
            var places = await GetPinPlacesAsync(pin, ct);

            if (places == null)
            {
                return null; // India Post unavailable.
            }

            if (places.Count == 0)
            {
                return "This PIN code doesn't exist. Please check it.";
            }

            var wantedState = NormalizeState(state);
            var inState = places.Where(p => wantedState.Length > 0 && p.State == wantedState).ToList();

            if (inState.Count == 0)
            {
                return $"PIN code {pin} is not in {state}. Please check your PIN code.";
            }

            return inState.Any(p => CityMatches(city, p))
                ? null
                : $"PIN code {pin} is not in {city}. Please check your PIN code or city.";
        }

        // Same rule as the checkout page: the city is the post office's district,
        // block, division or office name, and a partial match counts for names of
        // 4+ letters ("Morbi H.O" is Morbi).
        private static bool CityMatches(string city, PinPlace place)
        {
            var c = NormalizeName(city);
            return c.Length > 0 && place.Names.Any(n =>
                n == c || (c.Length >= 4 && n.Length >= 4 && (n.Contains(c) || c.Contains(n))));
        }

        // Each post office for a PIN as (state, names): empty for an unknown PIN,
        // null if the service couldn't be reached.
        private async Task<IReadOnlyList<PinPlace>?> GetPinPlacesAsync(string pin, CancellationToken ct)
        {
            var key = $"pin-places:{pin}";
            if (_cache.TryGetValue(key, out IReadOnlyList<PinPlace>? cached))
            {
                return cached;
            }

            try
            {
                var response = await _http.GetFromJsonAsync<List<IndiaPostResponse>>($"pincode/{Uri.EscapeDataString(pin)}", ct);
                IReadOnlyList<PinPlace> places = (response?.FirstOrDefault()?.PostOffice ?? [])
                    .Where(o => !string.IsNullOrWhiteSpace(o.State))
                    .Select(o => new PinPlace(
                        NormalizeState(o.State!),
                        new[] { o.Name, o.District, o.Block, o.Division }
                            .Where(n => !string.IsNullOrWhiteSpace(n))
                            .Select(n => NormalizeName(n!))
                            .Where(n => n.Length > 0)
                            .ToList()))
                    .ToList();

                _cache.Set(key, places, CacheFor);
                return places;
            }
            catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or System.Text.Json.JsonException)
            {
                _logger.LogWarning(ex, "India Post PIN lookup failed for {Pin}; skipping the PIN check.", pin);
                return null;
            }
        }

        // Old state names India Post still uses, mapped to the current ones in the checkout dropdown.
        private static readonly Dictionary<string, string> StateAliases = new()
        {
            ["damananddiu"] = "dadraandnagarhavelianddamananddiu",
            ["dadraandnagarhaveli"] = "dadraandnagarhavelianddamananddiu",
            ["orissa"] = "odisha",
            ["uttaranchal"] = "uttarakhand",
            ["pondicherry"] = "puducherry",
            ["nationalcapitalterritoryofdelhi"] = "delhi"
        };

        // Old city names India Post uses, as on the checkout page (india-address.util.ts).
        private static readonly Dictionary<string, string> CityAliases = new()
        {
            ["bangalore"] = "bengaluru", ["gurgaon"] = "gurugram", ["bombay"] = "mumbai", ["calcutta"] = "kolkata",
            ["madras"] = "chennai", ["mysore"] = "mysuru", ["poona"] = "pune", ["baroda"] = "vadodara",
            ["trivandrum"] = "thiruvananthapuram", ["cochin"] = "kochi", ["ernakulam"] = "kochi", ["vizag"] = "visakhapatnam",
            ["pondicherry"] = "puducherry", ["allahabad"] = "prayagraj", ["mangalore"] = "mangaluru",
            ["belgaum"] = "belagavi", ["hubli"] = "hubballi", ["gulbarga"] = "kalaburagi", ["benares"] = "varanasi",
            ["ahmadabad"] = "ahmedabad", ["vadodra"] = "vadodara"
        };

        // "Andaman & Nicobar Islands" and "Andaman and Nicobar Islands" compare equal.
        private static string NormalizeState(string s)
        {
            var n = NonLetters().Replace(s.ToLowerInvariant().Replace("&", "and"), "");
            return StateAliases.GetValueOrDefault(n, n);
        }

        // "Bangalore Urban District" -> "bengaluru".
        private static string NormalizeName(string s)
        {
            var n = NonLetters().Replace(AdminWords().Replace(s.ToLowerInvariant().Replace("&", " and "), ""), "");
            return CityAliases.GetValueOrDefault(n, n);
        }

        [GeneratedRegex("[^a-z]")]
        private static partial Regex NonLetters();

        [GeneratedRegex(@"\b(district|taluka|tehsil|tahsil|municipal corporation|corporation|city|urban|rural|subdivision|division|metropolitan region)\b")]
        private static partial Regex AdminWords();

        private sealed record PinPlace(string State, IReadOnlyList<string> Names);

        private sealed class IndiaPostResponse
        {
            public string? Status { get; set; }
            public List<PostOffice>? PostOffice { get; set; }
        }

        private sealed class PostOffice
        {
            public string? Name { get; set; }
            public string? District { get; set; }
            public string? Block { get; set; }
            public string? Division { get; set; }
            public string? State { get; set; }
        }
    }
}
