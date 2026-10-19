using SkiaSharp;

namespace Zodiac_Crystal.Services
{
    /// <summary>
    /// Generates WebP copies of an uploaded product image next to the original:
    /// name.webp (original size) plus name-400.webp / name-800.webp / name-1200.webp
    /// for responsive srcset. Purely a file naming convention - no DB change - so the
    /// frontend can derive the variant URLs from the stored original ImageUrl, and
    /// images without variants simply fall back to the original.
    /// Static (no DI registration needed); uses SkiaSharp (MIT licensed).
    /// </summary>
    public static class ImageVariantService
    {
        public static readonly int[] Widths = { 400, 800, 1200 };
        private const int WebpQuality = 80;

        // Returns true when variants were written. Never throws - a failed conversion
        // must not fail the upload itself, since the original file is still usable.
        public static bool GenerateVariants(string originalPath)
        {
            try
            {
                using var source = SKBitmap.Decode(originalPath);

                if (source == null)
                {
                    return false;
                }

                var folder = Path.GetDirectoryName(originalPath)!;
                var baseName = Path.GetFileNameWithoutExtension(originalPath);

                // Original-size WebP (skipped if the upload already is a .webp, which
                // would just overwrite the original with itself).
                if (!originalPath.EndsWith(".webp", StringComparison.OrdinalIgnoreCase))
                {
                    WriteWebp(source, Path.Combine(folder, $"{baseName}.webp"));
                }

                foreach (var width in Widths)
                {
                    var target = Path.Combine(folder, $"{baseName}-{width}.webp");

                    // Never upscale - a small source just gets re-encoded at its own size,
                    // so every srcset URL the frontend builds still exists.
                    if (source.Width <= width)
                    {
                        WriteWebp(source, target);
                        continue;
                    }

                    var height = (int)Math.Round(source.Height * (width / (double)source.Width));

                    using var resized = source.Resize(
                        new SKImageInfo(width, height),
                        new SKSamplingOptions(SKCubicResampler.Mitchell));

                    if (resized != null)
                    {
                        WriteWebp(resized, target);
                    }
                }

                return true;
            }
            catch
            {
                return false;
            }
        }

        // Deletes every generated variant for an original upload (used when the
        // image itself is deleted).
        public static void DeleteVariants(string originalPath)
        {
            var folder = Path.GetDirectoryName(originalPath)!;
            var baseName = Path.GetFileNameWithoutExtension(originalPath);

            var paths = Widths.Select(w => Path.Combine(folder, $"{baseName}-{w}.webp")).ToList();

            if (!originalPath.EndsWith(".webp", StringComparison.OrdinalIgnoreCase))
            {
                paths.Add(Path.Combine(folder, $"{baseName}.webp"));
            }

            foreach (var path in paths.Where(File.Exists))
            {
                File.Delete(path);
            }
        }

        private static void WriteWebp(SKBitmap bitmap, string path)
        {
            using var image = SKImage.FromBitmap(bitmap);
            using var data = image.Encode(SKEncodedImageFormat.Webp, WebpQuality);
            using var stream = File.Create(path);
            data.SaveTo(stream);
        }
    }
}
