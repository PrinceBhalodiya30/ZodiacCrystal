namespace Zodiac_Crystal.DTOs
{
    // POST api/products/bulk-update. Targets either the ticked ProductIds or,
    // when null, every product matching Filter (the admin list's filters).
    // Preview = true computes the changes without saving them.
    public class BulkUpdateProductsDto
    {
        public List<int>? ProductIds { get; set; }
        public BulkProductFilterDto? Filter { get; set; }

        // setPrice | increasePercent | decreasePercent | increaseAmount | decreaseAmount
        // | startSale | endSale | activate | deactivate | setCategory
        public string Action { get; set; } = "";
        public decimal? Value { get; set; }
        // none | whole | 99 (price actions only)
        public string? Rounding { get; set; }
        public int? CategoryId { get; set; }
        public bool Preview { get; set; }
    }

    public class BulkProductFilterDto
    {
        public string? Search { get; set; }
        public int? CategoryId { get; set; }
        public string? Status { get; set; }
        public string? Stock { get; set; }
    }

    public class BulkUpdateRowDto
    {
        public int ProductId { get; set; }
        public string Sku { get; set; } = "";
        public string Name { get; set; } = "";
        public decimal OldPrice { get; set; }
        public decimal NewPrice { get; set; }
        public decimal? OldCompareAtPrice { get; set; }
        public decimal? NewCompareAtPrice { get; set; }
        public bool OldIsActive { get; set; }
        public bool NewIsActive { get; set; }
        public string OldCategory { get; set; } = "";
        public string NewCategory { get; set; } = "";
        public bool Changed { get; set; }
        // Set when the row can't take this change; it is left untouched.
        public string? SkipReason { get; set; }
    }

    public class BulkUpdateResultDto
    {
        public bool Applied { get; set; }
        public int ChangedCount { get; set; }
        public int SkippedCount { get; set; }
        public int UnchangedCount { get; set; }
        public List<BulkUpdateRowDto> Rows { get; set; } = new();
    }
}
