using System;
using System.Collections.Generic;
using System.Linq;

namespace Zodiac_Crystal.Services
{
    public class EmailValidationResult
    {
        public bool IsValid { get; set; }
        public string? Reason { get; set; }

        public static EmailValidationResult Success() => new() { IsValid = true };
        public static EmailValidationResult Fail(string reason) => new() { IsValid = false, Reason = reason };
    }

    /// <summary>
    /// Validates subscriber emails to prevent spam bots, placeholder dummy emails,
    /// disposable burner domains, and impossible free webmail configurations.
    /// </summary>
    public static class NewsletterEmailValidator
    {
        // Common disposable / burner email domains
        private static readonly HashSet<string> DisposableDomains = new(StringComparer.OrdinalIgnoreCase)
        {
            "mailinator.com", "tempmail.com", "10minutemail.com", "guerrillamail.com",
            "trashmail.com", "sharklasers.com", "yopmail.com", "dispostable.com",
            "throwawaymail.com", "getairmail.com", "mytemp.email", "temp-mail.org",
            "fakeinbox.com", "crazymailing.com", "burnermail.io", "nada.ltd",
            "maildrop.cc", "inboxkitten.com", "mohmal.com", "tempail.com"
        };

        // Obvious dummy or test domains
        private static readonly HashSet<string> DummyDomains = new(StringComparer.OrdinalIgnoreCase)
        {
            "test.com", "example.com", "example.org", "example.net",
            "fake.com", "dummy.com", "sample.com", "invalid.com", "domain.com",
            "site.com", "none.com", "asdf.com", "xyz.com", "abc.com"
        };

        // Common domain typo corrections
        private static readonly Dictionary<string, string> TypoSuggestions = new(StringComparer.OrdinalIgnoreCase)
        {
            { "gmaill.com", "gmail.com" },
            { "gamil.com", "gmail.com" },
            { "gmai.com", "gmail.com" },
            { "gmial.com", "gmail.com" },
            { "yaho.com", "yahoo.com" },
            { "yahooo.com", "yahoo.com" },
            { "hotmial.com", "hotmail.com" },
            { "outlok.com", "outlook.com" }
        };

        // Obvious dummy / placeholder usernames
        private static readonly HashSet<string> DummyUsernames = new(StringComparer.OrdinalIgnoreCase)
        {
            "test", "testing", "temp", "fake", "dummy", "sample", "example",
            "admin", "root", "user", "noreply", "no-reply", "spam", "trash",
            "asdf", "qwerty", "qwer", "zxcv", "123", "1234", "12345", "123456",
            "abc", "abcd", "xyz", "def", "aaa", "bbb", "ccc", "xxx", "foo", "bar"
        };

        public static EmailValidationResult Validate(string? email, string? honeypot = null)
        {
            // Honeypot bot trap check
            if (!string.IsNullOrWhiteSpace(honeypot))
            {
                return EmailValidationResult.Fail("Bot submission rejected.");
            }

            if (string.IsNullOrWhiteSpace(email))
            {
                return EmailValidationResult.Fail("Please enter an email address.");
            }

            var normalized = email.Trim().ToLowerInvariant();
            var parts = normalized.Split('@');

            if (parts.Length != 2)
            {
                return EmailValidationResult.Fail("Please enter a valid email address with an '@' symbol.");
            }

            var local = parts[0];
            var domain = parts[1];

            if (string.IsNullOrWhiteSpace(local) || string.IsNullOrWhiteSpace(domain) || !domain.Contains('.'))
            {
                return EmailValidationResult.Fail("Please enter a complete email address (e.g. yourname@domain.com).");
            }

            // 1. Check known typo domains
            if (TypoSuggestions.TryGetValue(domain, out var suggestion))
            {
                return EmailValidationResult.Fail($"Did you mean {local}@{suggestion}?");
            }

            // 2. Reject disposable burner email providers
            if (DisposableDomains.Contains(domain))
            {
                return EmailValidationResult.Fail("Temporary or disposable email addresses are not accepted.");
            }

            // 3. Reject dummy/reserved domains
            if (DummyDomains.Contains(domain))
            {
                return EmailValidationResult.Fail("Please provide an active, authentic email address.");
            }

            // 4. Reject obvious test placeholders (def, abc, asdf, test, etc.)
            if (DummyUsernames.Contains(local))
            {
                return EmailValidationResult.Fail("Please enter a personal or business email address, not a placeholder.");
            }

            // 5. Gmail username constraints: Google strictly requires 6 to 30 characters
            if ((domain == "gmail.com" || domain == "googlemail.com") && local.Length < 6)
            {
                return EmailValidationResult.Fail("Gmail addresses require at least 6 characters before the @ symbol.");
            }

            // 6. Check repeated identical characters (e.g. aaaaa@, 11111@)
            if (local.Length >= 4 && local.Distinct().Count() == 1)
            {
                return EmailValidationResult.Fail("Repeated-character email addresses are not allowed.");
            }

            return EmailValidationResult.Success();
        }
    }
}
