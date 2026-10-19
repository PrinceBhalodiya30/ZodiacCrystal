using System.ComponentModel.DataAnnotations;

namespace Zodiac_Crystal.DTOs
{
    public class AdjustStockDto
    {
        // Signed change, e.g. +5 after a recount or -3 for damaged items.
        [Range(-100000, 100000, ErrorMessage = "Change must be between -100,000 and 100,000.")]
        public int Delta { get; set; }
    }
}
