using System.Threading.Channels;

namespace Zodiac_Crystal.Services
{
    // Wakes ProductAlertService as soon as stock or a product changes, instead
    // of waiting for its next scheduled check. Requests made while a wake-up is
    // already pending collapse into one, so a burst of changes runs the job once.
    public class ProductAlertTrigger
    {
        private readonly Channel<bool> _signal = Channel.CreateBounded<bool>(
            new BoundedChannelOptions(1) { FullMode = BoundedChannelFullMode.DropWrite });

        public void Request() => _signal.Writer.TryWrite(true);

        internal async Task WaitAsync(CancellationToken ct) => await _signal.Reader.ReadAsync(ct);
    }
}
