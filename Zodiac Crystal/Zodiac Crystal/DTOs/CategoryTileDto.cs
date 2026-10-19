namespace Zodiac_Crystal.DTOs
{
    // Per-category numbers for the storefront category tiles (home page and
    // /categories), counted over active products only.
    public class CategoryTileDto
    {
        public int CategoryId { get; set; }

        // Products in this category plus all its sub-categories (any depth) -
        // the same set the products page shows when the tile is clicked.
        public int ProductCount { get; set; }

        // Picture borrowed from the first product in that subtree that has one.
        public string? ImageUrl { get; set; }

        // Products sitting directly in this category (no sub-categories).
        public int DirectProductCount { get; set; }

        public string? DirectImageUrl { get; set; }
    }
}
