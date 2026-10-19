using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Zodiac_Crystal.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [AllowAnonymous]
    public class ConfigController : ControllerBase
    {
        private readonly IConfiguration _configuration;

        public ConfigController(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        // GET: api/config/maps
        // The Google Maps browser key. It is public by design (the map script sends it from the
        // browser); it is kept in appsettings so it can be changed without rebuilding the frontend.
        // Protect it with website and API restrictions in Google Cloud.
        [HttpGet("maps")]
        public ActionResult<object> GetMapsConfig()                           
        {
            return Ok(new { googleMapsKey = _configuration["GoogleMaps:BrowserKey"] ?? "" });
        }
    }
}
