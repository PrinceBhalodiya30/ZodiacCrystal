using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Http;

namespace Zodiac_Crystal.DTOs
{
    public class UploadProductImageDto
    {
        [Required]
        public IFormFile File { get; set; } = null!;

        [Range(1, int.MaxValue, ErrorMessage = "ProductId must be a valid id")]
        public int ProductId { get; set; }

        public bool IsPrimary { get; set; }
    }
}
