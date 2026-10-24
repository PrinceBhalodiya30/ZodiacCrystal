using Xunit;
using Zodiac_Crystal.Services;

namespace Zodiac_Crystal.Tests
{
    public class NewsletterEmailValidatorTests
    {
        [Theory]
        [InlineData("def@gmail.com")]
        [InlineData("abc@gmail.com")]
        [InlineData("xyz@gmail.com")]
        [InlineData("asdf@gmail.com")]
        [InlineData("test@gmail.com")]
        [InlineData("fake@gmail.com")]
        [InlineData("user@gmail.com")]
        [InlineData("admin@gmail.com")]
        public void Rejects_Obvious_Dummy_Usernames(string email)
        {
            var result = NewsletterEmailValidator.Validate(email);
            Assert.False(result.IsValid);
            Assert.NotEmpty(result.Reason!);
        }

        [Theory]
        [InlineData("ab@gmail.com")]
        [InlineData("xyz12@gmail.com")]
        [InlineData("alex1@gmail.com")]
        public void Rejects_Gmail_With_Fewer_Than_Six_Characters(string email)
        {
            var result = NewsletterEmailValidator.Validate(email);
            Assert.False(result.IsValid);
            Assert.Contains("at least 6 characters", result.Reason);
        }

        [Theory]
        [InlineData("realuser@tempmail.com")]
        [InlineData("customer@mailinator.com")]
        [InlineData("crystal@10minutemail.com")]
        [InlineData("someone@guerrillamail.com")]
        public void Rejects_Disposable_Burner_Domains(string email)
        {
            var result = NewsletterEmailValidator.Validate(email);
            Assert.False(result.IsValid);
            Assert.Contains("disposable", result.Reason, System.StringComparison.OrdinalIgnoreCase);
        }

        [Theory]
        [InlineData("someone@test.com")]
        [InlineData("buyer@example.com")]
        [InlineData("test@fake.com")]
        [InlineData("user@sample.com")]
        public void Rejects_Dummy_Domains(string email)
        {
            var result = NewsletterEmailValidator.Validate(email);
            Assert.False(result.IsValid);
            Assert.NotEmpty(result.Reason!);
        }

        [Theory]
        [InlineData("customer@gmaill.com", "gmail.com")]
        [InlineData("crystal@yaho.com", "yahoo.com")]
        [InlineData("zodiac@hotmial.com", "hotmail.com")]
        public void Suggests_Correction_For_Common_Domain_Typos(string email, string expectedDomain)
        {
            var result = NewsletterEmailValidator.Validate(email);
            Assert.False(result.IsValid);
            Assert.Contains($"Did you mean", result.Reason);
            Assert.Contains(expectedDomain, result.Reason);
        }

        [Fact]
        public void Rejects_When_Honeypot_Is_Filled_By_Bot()
        {
            var result = NewsletterEmailValidator.Validate("valid.person@gmail.com", honeypot: "https://spam-bot.ru");
            Assert.False(result.IsValid);
            Assert.Contains("Bot", result.Reason);
        }

        [Theory]
        [InlineData("crystal.lover@gmail.com")]
        [InlineData("prince.bhalodiya@gmail.com")]
        [InlineData("sarah_connor99@yahoo.com")]
        [InlineData("contact@crystalstudio.in")]
        [InlineData("alexander.smith@outlook.com")]
        public void Accepts_Authentic_Emails(string email)
        {
            var result = NewsletterEmailValidator.Validate(email);
            Assert.True(result.IsValid);
            Assert.Null(result.Reason);
        }
    }
}
