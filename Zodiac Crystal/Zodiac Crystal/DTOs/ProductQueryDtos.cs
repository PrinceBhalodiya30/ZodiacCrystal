namespace Zodiac_Crystal.DTOs
{
    public class ProductPagedQueryDto
    {
        public int PageNumber { get; set; } = 1;
        public int PageSize { get; set; } = 12;
        public string? Search { get; set; }
        public int? CategoryId { get; set; }
        public bool ActiveOnly { get; set; }
        public decimal? MinPrice { get; set; }
        public decimal? MaxPrice { get; set; }
        public int? ZodiacId { get; set; }
        public bool InStockOnly { get; set; }
        public string? SortBy { get; set; }
        public bool LowStockOnly { get; set; }
        public string? Status { get; set; }
        public string? Stock { get; set; }
        public bool MissingImagesOnly { get; set; }
        public string? Intention { get; set; }
    }

    public class ProductExportQueryDto
    {
        public string? Search { get; set; }
        public int? CategoryId { get; set; }
        public bool ActiveOnly { get; set; }
        public decimal? MinPrice { get; set; }
        public decimal? MaxPrice { get; set; }
        public int? ZodiacId { get; set; }
        public bool InStockOnly { get; set; }
        public string? Status { get; set; }
        public string? Stock { get; set; }
        public bool MissingImagesOnly { get; set; }
        public string? Intention { get; set; }
    }
}

