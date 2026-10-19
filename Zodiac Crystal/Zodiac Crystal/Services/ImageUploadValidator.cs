using SkiaSharp;

namespace Zodiac_Crystal.Services
{
    // Checks an uploaded file is really the image its name says it is, by reading
    // its header with SkiaSharp (already used for the WebP variants) rather than
    // trusting the client's extension and Content-Type.
    public static class ImageUploadValidator
    {
        // Larger than any real product photo; stops "decompression bombs" - tiny
        // files that claim enormous dimensions - before variants are generated.
        public const int MaxDimension = 8000;

        private static readonly Dictionary<string, SKEncodedImageFormat> FormatByExtension = new()
        {
            [".jpg"] = SKEncodedImageFormat.Jpeg,
            [".jpeg"] = SKEncodedImageFormat.Jpeg,
            [".png"] = SKEncodedImageFormat.Png,
            [".webp"] = SKEncodedImageFormat.Webp
        };

        // Null when the content is a valid image of the expected format, otherwise
        // a message for the admin.
        public static string? Validate(Stream content, string extension)
        {
            if (!FormatByExtension.TryGetValue(extension, out var expected))
            {
                return "Only JPG, PNG, or WEBP images are allowed";
            }

            // SKCodec.Create(Stream) takes ownership of the stream and closes it;
            // callers still need it afterwards to save the file, so wrap it
            // without handing over ownership.
            using var skStream = new SKManagedStream(content, disposeManagedStream: false);
            using var codec = SKCodec.Create(skStream);

            if (codec == null)
            {
                return "This file isn't a readable image.";
            }

            if (codec.EncodedFormat != expected)
            {
                return $"This file is a {codec.EncodedFormat} image but is named {extension}. Please upload a real JPG, PNG or WEBP.";
            }

            if (codec.Info.Width <= 0 || codec.Info.Height <= 0 ||
                codec.Info.Width > MaxDimension || codec.Info.Height > MaxDimension)
            {
                return $"Images must be at most {MaxDimension} x {MaxDimension} pixels.";
            }

            return null;
        }
    }
}
