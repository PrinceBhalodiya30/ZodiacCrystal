using System.Text;
using System.Xml;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Zodiac_Crystal.Data;
using Zodiac_Crystal.Services;

namespace Zodiac_Crystal.Controllers
{
    // GET /sitemap.xml - the storefront's public pages for search engines,
    // built from live data so new products appear without a frontend rebuild.
    // robots.txt on the storefront points here.
    [ApiController]
    [AllowAnonymous]
    public class SitemapController : ControllerBase
    {
        // Public pages with no data behind them. Keep in sync with app.routes.ts.
        private static readonly string[] StaticPaths =
        {
            "/", "/products", "/zodiac", "/categories", "/mystery-box", "/guides",
            "/about", "/faq", "/contact", "/shipping-returns", "/privacy", "/terms"
        };

        // Guide pages live in the frontend (guides.data.ts). Keep in sync.
        private static readonly string[] GuideSlugs =
        {
            "crystal-buying-guide", "crystal-care", "raw-vs-tumbled", "crystal-towers-explained",
            "crystal-spheres-explained", "crystals-by-zodiac-sign", "how-to-choose-a-crystal"
        };

        private readonly CrystalsDbContext _context;
        private readonly string _siteUrl;

        public SitemapController(CrystalsDbContext context, IOptions<EmailSettings> emailSettings)
        {
            _context = context;
            _siteUrl = emailSettings.Value.SiteUrl.TrimEnd('/');
        }

        [HttpGet("/sitemap.xml")]
        // Short cache so newly added or deactivated products show up quickly.
        [ResponseCache(Duration = 300)]
        public async Task<IActionResult> GetSitemap()
        {
            var productIds = await _context.Products
                .Where(p => p.IsActive)
                .Select(p => p.ProductId)
                .ToListAsync();

            var zodiacIds = await _context.ZodiacSigns
                .Select(z => z.ZodiacId)
                .ToListAsync();

            var settings = new XmlWriterSettings { Encoding = new UTF8Encoding(false), Indent = true };
            using var stream = new MemoryStream();
            using (var writer = XmlWriter.Create(stream, settings))
            {
                writer.WriteStartDocument();
                writer.WriteStartElement("urlset", "http://www.sitemaps.org/schemas/sitemap/0.9");

                foreach (var path in StaticPaths)
                {
                    WriteUrl(writer, path);
                }
                foreach (var slug in GuideSlugs)
                {
                    WriteUrl(writer, $"/guides/{slug}");
                }
                foreach (var id in zodiacIds)
                {
                    WriteUrl(writer, $"/zodiac/{id}");
                }
                // No <lastmod>: products have no updated-at column, and a creation
                // date would tell crawlers an edited product hasn't changed.
                foreach (var productId in productIds)
                {
                    WriteUrl(writer, $"/products/{productId}");
                }

                writer.WriteEndElement();
                writer.WriteEndDocument();
            }

            return File(stream.ToArray(), "application/xml");
        }

        private void WriteUrl(XmlWriter writer, string path)
        {
            writer.WriteStartElement("url");
            writer.WriteElementString("loc", path == "/" ? $"{_siteUrl}/" : _siteUrl + path);
            writer.WriteEndElement();
        }
    }
}
