namespace Zodiac_Crystal.DTOs
{
    public class CategorySalesDto
    {
        public int CategoryId { get; set; }
        public string CategoryName { get; set; } = null!;
        public int QuantitySold { get; set; }
        public decimal Revenue { get; set; }
    }
}
