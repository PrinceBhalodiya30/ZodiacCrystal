using System.ComponentModel.DataAnnotations;

namespace Zodiac_Crystal.DTOs
{
    public class OrderItemInputDto
    {
        [Range(1, int.MaxValue, ErrorMessage = "ProductId must be a valid id")]
        public int ProductId { get; set; }

        [Range(1, int.MaxValue, ErrorMessage = "Quantity must be at least 1.")]
        public int Quantity { get; set; }
    }
}
