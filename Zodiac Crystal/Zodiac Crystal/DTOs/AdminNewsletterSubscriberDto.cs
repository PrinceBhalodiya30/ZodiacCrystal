namespace Zodiac_Crystal.DTOs
{
    public class AdminNewsletterSubscriberDto
    {
        public int NewsletterSubscriberId { get; set; }

        public string Email { get; set; } = null!;

        public DateTime SubscribedAt { get; set; }

        public bool IsActive { get; set; }

        public DateTime? UnsubscribedAt { get; set; }

        // True when the email also belongs to a (non-deleted) customer account.
        public bool IsCustomer { get; set; }
    }

    public class NewsletterStatsDto
    {
        public int Active { get; set; }

        public int NewThisMonth { get; set; }

        public int UnsubscribedThisMonth { get; set; }
    }

    public class UnsubscribeNewsletterDto
    {
        public string Token { get; set; } = null!;
    }
}
