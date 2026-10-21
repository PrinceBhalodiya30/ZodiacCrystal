using Zodiac_Crystal.Controllers;
using Zodiac_Crystal.Models;

namespace Zodiac_Crystal.Tests;

public class MysteryBoxSelectionTests
{
    [Fact]
    public void SelectBoxProducts_with_matching_zodiac_prioritizes_zodiac_crystals()
    {
        var zodiac = new ZodiacSign { ZodiacId = 5, Name = "Leo" };
        var otherZodiac = new ZodiacSign { ZodiacId = 2, Name = "Taurus" };

        var products = new List<Product>
        {
            new() { ProductId = 1, Name = "Leo Citrine", Price = 900m, Zodiacs = new List<ZodiacSign> { zodiac } },
            new() { ProductId = 2, Name = "Leo Sunstone", Price = 950m, Zodiacs = new List<ZodiacSign> { zodiac } },
            new() { ProductId = 3, Name = "Leo Carnelian", Price = 1000m, Zodiacs = new List<ZodiacSign> { zodiac } },
            new() { ProductId = 4, Name = "Leo Tiger Eye", Price = 850m, Zodiacs = new List<ZodiacSign> { zodiac } },
            new() { ProductId = 5, Name = "Taurus Emerald", Price = 1200m, Zodiacs = new List<ZodiacSign> { otherZodiac } },
            new() { ProductId = 6, Name = "General Amethyst", Price = 1100m, Zodiacs = new List<ZodiacSign>() }
        };

        var selected = MysteryBoxController.SelectBoxProducts(products, zodiacId: 5);

        Assert.NotNull(selected);
        Assert.Equal(3, selected.Count);
        Assert.True(selected.Sum(p => p.Price) >= 2500m);
        // All items should be attuned to Leo (ZodiacId = 5)
        Assert.All(selected, p => Assert.Contains(p.Zodiacs, z => z.ZodiacId == 5));
    }

    [Fact]
    public void SelectBoxProducts_combines_constrained_zodiac_with_general_catalog_to_meet_guarantee()
    {
        var zodiac = new ZodiacSign { ZodiacId = 8, Name = "Scorpio" };

        var products = new List<Product>
        {
            // Only 1 Scorpio product in stock
            new() { ProductId = 1, Name = "Scorpio Obsidian", Price = 1000m, Zodiacs = new List<ZodiacSign> { zodiac } },
            new() { ProductId = 2, Name = "Clear Quartz", Price = 800m, Zodiacs = new List<ZodiacSign>() },
            new() { ProductId = 3, Name = "Rose Quartz", Price = 900m, Zodiacs = new List<ZodiacSign>() },
            new() { ProductId = 4, Name = "Selenite", Price = 700m, Zodiacs = new List<ZodiacSign>() }
        };

        var selected = MysteryBoxController.SelectBoxProducts(products, zodiacId: 8);

        Assert.NotNull(selected);
        Assert.Equal(3, selected.Count);
        Assert.True(selected.Sum(p => p.Price) >= 2500m);
        // Must include the matching Scorpio crystal
        Assert.Contains(selected, p => p.ProductId == 1);
    }

    [Fact]
    public void SelectBoxProducts_falls_back_when_no_matching_zodiac_crystals_in_stock()
    {
        var otherZodiac = new ZodiacSign { ZodiacId = 1, Name = "Aries" };

        var products = new List<Product>
        {
            new() { ProductId = 1, Name = "Aries Red Jasper", Price = 900m, Zodiacs = new List<ZodiacSign> { otherZodiac } },
            new() { ProductId = 2, Name = "Clear Quartz", Price = 850m, Zodiacs = new List<ZodiacSign>() },
            new() { ProductId = 3, Name = "Rose Quartz", Price = 900m, Zodiacs = new List<ZodiacSign>() }
        };

        // Customer chooses Pisces (ZodiacId = 12) but no Pisces products in stock
        var selected = MysteryBoxController.SelectBoxProducts(products, zodiacId: 12);

        Assert.NotNull(selected);
        Assert.Equal(3, selected.Count);
        Assert.True(selected.Sum(p => p.Price) >= 2500m);
    }

    [Fact]
    public void SelectBoxProducts_without_zodiacId_selects_valid_box()
    {
        var products = new List<Product>
        {
            new() { ProductId = 1, Name = "Citrine", Price = 900m },
            new() { ProductId = 2, Name = "Amethyst", Price = 900m },
            new() { ProductId = 3, Name = "Clear Quartz", Price = 900m }
        };

        var selected = MysteryBoxController.SelectBoxProducts(products);

        Assert.NotNull(selected);
        Assert.Equal(3, selected.Count);
        Assert.Equal(2700m, selected.Sum(p => p.Price));
    }
}
