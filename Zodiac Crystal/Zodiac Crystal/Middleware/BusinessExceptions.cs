namespace Zodiac_Crystal.Middleware
{
    // Errors whose message is written for the customer and safe to return as-is.
    // GlobalExceptionHandler maps only these to 4xx; every other exception -
    // including framework ones such as InvalidOperationException from EF - is
    // treated as a server fault and answered with a generic 500.
    public abstract class BusinessException : Exception
    {
        protected BusinessException(string message) : base(message) { }

        public abstract int StatusCode { get; }
    }

    public class BadRequestException : BusinessException
    {
        public BadRequestException(string message) : base(message) { }
        public override int StatusCode => StatusCodes.Status400BadRequest;
    }

    public class NotFoundException : BusinessException
    {
        public NotFoundException(string message) : base(message) { }
        public override int StatusCode => StatusCodes.Status404NotFound;
    }

    public class ConflictException : BusinessException
    {
        public ConflictException(string message) : base(message) { }
        public override int StatusCode => StatusCodes.Status409Conflict;
    }
}
