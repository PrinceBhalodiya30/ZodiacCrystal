using SkiaSharp;

namespace Zodiac_Crystal.Services
{
    public static class ReviewPhotoStatuses
    {
        public const string Pending = "Pending";
        public const string Approved = "Approved";
        public const string Rejected = "Rejected";

        public static readonly string[] Moderated = { Approved, Rejected };
    }

    // Saves customer review photos. Every upload is decoded and re-encoded as a
    // fresh JPEG, which drops all metadata (EXIF GPS location, camera serial,
    // embedded thumbnails) and anything hidden after the image data. The phone's
    // EXIF orientation is applied first so portrait photos aren't saved sideways.
    public static class ReviewPhotoService
    {
        public const int MaxPhotosPerReview = 3;
        public const long MaxFileSizeBytes = 5 * 1024 * 1024;
        // Plenty for a review photo; keeps files small and pages fast.
        private const int MaxSide = 1600;
        private const int JpegQuality = 85;

        public const string UrlFolder = "/uploads/reviews/";

        public static string Folder(string contentRoot) =>
            Path.Combine(contentRoot, "wwwroot", "uploads", "reviews");

        // Returns the saved file name, or null if the bytes couldn't be decoded.
        public static string? Save(Stream content, string folder)
        {
            using var codec = SKCodec.Create(content);
            if (codec == null)
            {
                return null;
            }

            using var decoded = SKBitmap.Decode(codec);
            if (decoded == null)
            {
                return null;
            }

            using var upright = ApplyOrientation(decoded, codec.EncodedOrigin);
            using var resized = ResizeToFit(upright);

            Directory.CreateDirectory(folder);
            var fileName = $"{Guid.NewGuid()}.jpg";

            using var image = SKImage.FromBitmap(resized);
            using var data = image.Encode(SKEncodedImageFormat.Jpeg, JpegQuality);
            using var stream = File.Create(Path.Combine(folder, fileName));
            data.SaveTo(stream);

            return fileName;
        }

        // Removes a stored photo's file. Only touches our own reviews folder.
        public static void DeleteFile(string imageUrl, string folder)
        {
            var index = imageUrl.IndexOf(UrlFolder, StringComparison.OrdinalIgnoreCase);
            if (index < 0)
            {
                return;
            }

            var fileName = Path.GetFileName(imageUrl[(index + UrlFolder.Length)..]);
            var path = Path.Combine(folder, fileName);
            if (File.Exists(path))
            {
                File.Delete(path);
            }
        }

        private static SKBitmap ApplyOrientation(SKBitmap source, SKEncodedOrigin origin)
        {
            if (origin == SKEncodedOrigin.TopLeft)
            {
                return source.Copy();
            }

            var swap = origin is SKEncodedOrigin.LeftTop or SKEncodedOrigin.RightTop
                or SKEncodedOrigin.RightBottom or SKEncodedOrigin.LeftBottom;
            var width = swap ? source.Height : source.Width;
            var height = swap ? source.Width : source.Height;

            var result = new SKBitmap(width, height);
            using var canvas = new SKCanvas(result);

            switch (origin)
            {
                case SKEncodedOrigin.TopRight:
                    canvas.Scale(-1, 1, width / 2f, 0);
                    break;
                case SKEncodedOrigin.BottomRight:
                    canvas.RotateDegrees(180, width / 2f, height / 2f);
                    break;
                case SKEncodedOrigin.BottomLeft:
                    canvas.Scale(1, -1, 0, height / 2f);
                    break;
                case SKEncodedOrigin.LeftTop: // transpose: (x, y) -> (y, x)
                    canvas.RotateDegrees(90);
                    canvas.Scale(1, -1);
                    break;
                case SKEncodedOrigin.RightTop: // 90° clockwise
                    canvas.Translate(width, 0);
                    canvas.RotateDegrees(90);
                    break;
                case SKEncodedOrigin.RightBottom: // transverse: (x, y) -> (w - y, h - x)
                    canvas.Translate(width, height);
                    canvas.Scale(1, -1);
                    canvas.RotateDegrees(90);
                    break;
                case SKEncodedOrigin.LeftBottom:
                    canvas.Translate(0, height);
                    canvas.RotateDegrees(-90);
                    break;
            }

            canvas.DrawBitmap(source, 0, 0);
            return result;
        }

        private static SKBitmap ResizeToFit(SKBitmap source)
        {
            var longest = Math.Max(source.Width, source.Height);
            if (longest <= MaxSide)
            {
                return source.Copy();
            }

            var scale = MaxSide / (double)longest;
            var info = new SKImageInfo(
                Math.Max(1, (int)Math.Round(source.Width * scale)),
                Math.Max(1, (int)Math.Round(source.Height * scale)));

            return source.Resize(info, new SKSamplingOptions(SKCubicResampler.Mitchell));
        }
    }
}
