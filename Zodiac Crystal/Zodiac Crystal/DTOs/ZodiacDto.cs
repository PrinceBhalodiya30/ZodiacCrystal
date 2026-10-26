namespace Zodiac_Crystal.DTOs
{
    public class ZodiacDto
    {
        public int ZodiacId { get; set; }

        public string Name { get; set; } = null!;

        public string? Symbol { get; set; }

        public string? Description { get; set; }

        public string? ImageUrl { get; set; }

        private string? _rashiName;
        public string? RashiName
        {
            get => !string.IsNullOrWhiteSpace(_rashiName) ? _rashiName : (Name switch
            {
                "Aries" => "Mesha (मेष)",
                "Taurus" => "Vrishabha (वृषभ)",
                "Gemini" => "Mithuna (मिथुन)",
                "Cancer" => "Karka (कर्क)",
                "Leo" => "Simha (सिंह)",
                "Virgo" => "Kanya (कन्या)",
                "Libra" => "Tula (तुला)",
                "Scorpio" => "Vrishchika (वृश्चिक)",
                "Sagittarius" => "Dhanu (धनु)",
                "Capricorn" => "Makara (मकर)",
                "Aquarius" => "Kumbha (कुंभ)",
                "Pisces" => "Meena (मीन)",
                _ => string.Empty
            });
            set => _rashiName = value;
        }

        public string DisplayName => string.IsNullOrEmpty(RashiName) ? Name : $"{Name} · {RashiName}";
    }
}