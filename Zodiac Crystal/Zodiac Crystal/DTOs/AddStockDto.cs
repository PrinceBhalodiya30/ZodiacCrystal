using System.ComponentModel.DataAnnotations;

namespace Zodiac_Crystal.DTOs
{
    public class AddStockDto
    {
        [Range(1, 10000, ErrorMessage = "Quantity must be between 1 and 10,000.")]
        public int Quantity { get; set; }
    }
}
