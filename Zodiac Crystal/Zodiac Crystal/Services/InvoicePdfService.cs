using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using Zodiac_Crystal.Models;

namespace Zodiac_Crystal.Services
{
    /// <summary>
    /// Renders an order as a PDF invoice, generated on the fly from the order's own
    /// stored values (never recalculated from current product prices/current coupon
    /// state), so a historical invoice always matches what the customer actually paid.
    /// Nothing is persisted - the PDF is regenerated fresh on every request.
    /// </summary>
    public class InvoicePdfService
    {
        // Same palette as the storefront: forest green brand, warm stone neutrals.
        private const string BrandGreen = "#2f4a3a";
        private const string BrandGreenDark = "#243a2d";
        private const string StoneTint = "#f3efe7";
        private const string StoneLine = "#e3dccd";
        private const string Ink = "#1d1b18";

        private static byte[]? _logoBytes;
        private static byte[]? GetLogoBytes()
        {
            if (_logoBytes != null) return _logoBytes;
            string[] files = ["logo-invoice.png", "logo.png"];
            foreach (var f in files)
            {
                try
                {
                    var p1 = Path.Combine(AppContext.BaseDirectory, "Assets", f);
                    if (File.Exists(p1)) return _logoBytes = File.ReadAllBytes(p1);
                    var p2 = Path.Combine(Directory.GetCurrentDirectory(), "Assets", f);
                    if (File.Exists(p2)) return _logoBytes = File.ReadAllBytes(p2);
                    var p3 = Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "Assets", f);
                    if (File.Exists(p3)) return _logoBytes = File.ReadAllBytes(p3);
                }
                catch { }
            }
            return null;
        }

        // returnRequest: the order's return, if any, so a refunded return is explained on the invoice.
        public byte[] GenerateInvoice(Order order, ReturnRequest? returnRequest = null)
        {
            // Order.TotalAmount already equals (item subtotal - discount + shipping), per
            // how OrdersController.CreateOrder stores it, so the pre-discount subtotal is
            // reconstructed from stored values rather than re-summing current prices.
            var subtotal = order.OrderItems.Sum(oi => oi.Subtotal);

            var document = Document.Create(container =>
            {
                container.Page(page =>
                {
                    page.Size(PageSizes.A4);
                    page.Margin(40);
                    // Arial is used explicitly (rather than leaving the font unset) because
                    // the ₹ (rupee) glyph must render correctly, and Arial has included it
                    // since Windows 8 - the app's Windows hosting environment has it available.
                    page.DefaultTextStyle(x => x.FontSize(10).FontFamily("Arial"));

                    page.Header().Column(column =>
                    {
                        // Clean letterhead displaying the official Crystal Studio logo and order metadata
                        column.Item().BorderBottom(2).BorderColor(BrandGreen).PaddingBottom(14).Row(row =>
                        {
                            var logoBytes = GetLogoBytes();
                            if (logoBytes != null && logoBytes.Length > 0)
                            {
                                row.AutoItem().Height(44).Image(logoBytes);
                            }
                            else
                            {
                                row.RelativeItem().Column(c =>
                                {
                                    c.Item().Text("Crystal Studio").FontSize(22).Bold().FontColor(BrandGreen);
                                    c.Item().Text("Hand-picked crystals for every zodiac sign").FontSize(9).FontColor(Colors.Grey.Medium);
                                });
                            }

                            row.ConstantItem(210).Column(c =>
                            {
                                c.Item().AlignRight().Text("INVOICE").FontSize(16).Bold().FontColor(BrandGreen);
                                c.Item().AlignRight().Text($"Invoice #: INV-{order.OrderId:D6}").FontSize(9).FontColor(Colors.Grey.Darken2);
                                c.Item().AlignRight().Text($"Order #: {order.OrderId}").FontSize(9).FontColor(Colors.Grey.Darken2);
                                c.Item().AlignRight().Text($"Date: {order.OrderDate:dd MMM yyyy}").FontSize(9).FontColor(Colors.Grey.Darken2);
                                c.Item().AlignRight().Text($"Status: {order.Status}").FontSize(9).Bold().FontColor(BrandGreen);
                            });
                        });
                    });

                    page.Content().PaddingTop(20).Column(column =>
                    {
                        column.Item().Row(row =>
                        {
                            row.RelativeItem().Column(c =>
                            {
                                c.Item().Text("Bill To").Bold().FontColor(BrandGreen);
                                c.Item().Text(order.ShippingName);
                                c.Item().Text(order.ShippingEmail);
                                c.Item().Text(order.Phone);
                            });

                            row.RelativeItem().Column(c =>
                            {
                                c.Item().Text("Shipping Address").Bold().FontColor(BrandGreen);
                                c.Item().Text(order.ShippingAddress);
                                c.Item().Text($"{order.City}, {order.State} {order.PostalCode}");

                                if (!string.IsNullOrEmpty(order.DeliveryInstructions))
                                {
                                    c.Item().PaddingTop(3).Text(t =>
                                    {
                                        t.Span("Note: ").Bold().FontSize(8.5f).FontColor(Colors.Grey.Darken2);
                                        t.Span(order.DeliveryInstructions).Italic().FontSize(8.5f).FontColor(Ink);
                                    });
                                }
                            });

                            row.RelativeItem().Column(c =>
                            {
                                c.Item().Text("Payment").Bold().FontColor(BrandGreen);
                                c.Item().Text(PaymentLabels.Method(order.PaymentMethod));
                                c.Item().Text(PaymentLabels.Describe(order)).FontColor(PaymentStatusColor(order.PaymentStatus)).Bold();

                                if (order.PaidAt != null)
                                {
                                    c.Item().Text($"Paid on: {order.PaidAt:dd MMM yyyy}");
                                }

                                if (!string.IsNullOrEmpty(order.PaymentTransactionId))
                                {
                                    c.Item().Text($"Transaction ID: {order.PaymentTransactionId}").FontSize(8).FontColor(Colors.Grey.Darken1);
                                }

                                if (!string.IsNullOrEmpty(order.TrackingNumber))
                                {
                                    c.Item().PaddingTop(6).Text("Shipment").Bold().FontColor(BrandGreen);
                                    c.Item().Text($"Courier: {order.CourierName}");
                                    c.Item().Text($"Tracking #: {order.TrackingNumber}");
                                }
                            });
                        });

                        // A cancelled order's invoice must never read like a normal bill.
                        if (order.Status == "Cancelled")
                        {
                            var cancelNote = order.PaymentStatus == PaymentStatuses.Refunded
                                ? order.PaymentMethod == PaymentMethods.Card
                                    ? $"This order was cancelled. The card payment of ₹{order.TotalAmount:0.00} has been refunded."
                                    : $"This order was cancelled. The payment of ₹{order.TotalAmount:0.00} has been refunded."
                                : "This order was cancelled. No payment was collected.";

                            if (!string.IsNullOrEmpty(order.CancellationReason))
                            {
                                cancelNote += $" Reason: {order.CancellationReason}.";
                            }

                            column.Item().PaddingTop(14).Background(Colors.Red.Lighten5).Border(1).BorderColor(Colors.Red.Lighten2)
                                .Padding(8).Text(text =>
                                {
                                    text.Span("CANCELLED  ").Bold().FontColor(Colors.Red.Darken2);
                                    text.Span(cancelNote).FontColor(Colors.Red.Darken2);
                                });
                        }

                        // A delivered order that came back: say so, instead of a bare "Refunded".
                        if (returnRequest != null && returnRequest.Status == ReturnStatuses.Refunded)
                        {
                            var returnNote = $"Items from this order were returned ({ReturnReasons.Label(returnRequest.Reason)})" +
                                (returnRequest.ResolvedAt != null ? $" and ₹{order.TotalAmount:0.00} was refunded on {returnRequest.ResolvedAt:dd MMM yyyy}." : $" and ₹{order.TotalAmount:0.00} was refunded.");

                            column.Item().PaddingTop(14).Background(Colors.Blue.Lighten5).Border(1).BorderColor(Colors.Blue.Lighten2)
                                .Padding(8).Text(text =>
                                {
                                    text.Span("RETURNED  ").Bold().FontColor(Colors.Blue.Darken2);
                                    text.Span(returnNote).FontColor(Colors.Blue.Darken2);
                                });
                        }

                        if (order.IsGiftWrap)
                        {
                            var giftFee = order.GiftFee > 0 ? order.GiftFee : 99m;
                            column.Item().PaddingTop(12).Background("#faf7f0").Border(1).BorderColor("#dfc79b")
                                .Padding(10).Column(gc =>
                                {
                                    gc.Item().Row(gr =>
                                    {
                                        gr.RelativeItem().Text(text =>
                                        {
                                            text.Span("LUXURY GIFT PACKAGING & HANDWRITTEN ZODIAC NOTE").Bold().FontSize(9).FontColor("#8c6721");
                                            if (!string.IsNullOrEmpty(order.GiftRecipient))
                                            {
                                                text.Span($"  •  To: {order.GiftRecipient}").Bold().FontSize(9).FontColor(Ink);
                                            }
                                        });
                                        gr.ConstantItem(80).AlignRight().Text($"₹{giftFee:0.00}").Bold().FontSize(9).FontColor("#8c6721");
                                    });

                                    if (!string.IsNullOrEmpty(order.GiftMessage))
                                    {
                                        gc.Item().PaddingTop(4).Text(text =>
                                        {
                                            text.Span("Handwritten Note: ").SemiBold().FontSize(8.5f).FontColor(Colors.Grey.Darken2);
                                            text.Span($"“{order.GiftMessage}”").Italic().FontSize(8.5f).FontColor(Ink);
                                        });
                                    }
                                });
                        }

                        column.Item().PaddingTop(20).Table(table =>
                        {
                            table.ColumnsDefinition(columns =>
                            {
                                columns.RelativeColumn(3);
                                columns.RelativeColumn(1.3f);
                                columns.RelativeColumn(1);
                                columns.RelativeColumn(1.3f);
                                columns.RelativeColumn(1.3f);
                            });

                            table.Header(header =>
                            {
                                header.Cell().Element(HeaderCell).Text("Product");
                                header.Cell().Element(HeaderCell).Text("SKU");
                                header.Cell().Element(HeaderCell).AlignRight().Text("Qty");
                                header.Cell().Element(HeaderCell).AlignRight().Text("Unit Price");
                                header.Cell().Element(HeaderCell).AlignRight().Text("Line Total");

                                IContainer HeaderCell(IContainer c) =>
                                    c.BorderBottom(1.5f).BorderColor(BrandGreen)
                                     .DefaultTextStyle(x => x.Bold().FontColor(Ink))
                                     .PaddingVertical(6).PaddingHorizontal(4);
                            });

                            var rowIndex = 0;

                            foreach (var item in order.OrderItems)
                            {
                                // Zebra striping keeps long item lists easy to scan across rows.
                                var isEvenRow = rowIndex % 2 == 0;
                                rowIndex++;

                                table.Cell().Element(c => BodyCell(c, isEvenRow)).Text(item.Product?.Name ?? $"Item #{item.ProductId}");
                                table.Cell().Element(c => BodyCell(c, isEvenRow)).Text(item.Product?.Sku ?? "-");
                                table.Cell().Element(c => BodyCell(c, isEvenRow)).AlignRight().Text(item.Quantity.ToString());
                                table.Cell().Element(c => BodyCell(c, isEvenRow)).AlignRight().Text($"₹{item.UnitPrice:0.00}");
                                table.Cell().Element(c => BodyCell(c, isEvenRow)).AlignRight().Text($"₹{item.Subtotal:0.00}");

                                static IContainer BodyCell(IContainer c, bool isEvenRow) =>
                                    c.Background(isEvenRow ? Colors.White : StoneTint).BorderBottom(0.5f).BorderColor(StoneLine)
                                     .PaddingVertical(6).PaddingHorizontal(4);
                            }
                        });

                        column.Item().PaddingTop(15).AlignRight().Width(240).Background(StoneTint).Border(1).BorderColor(StoneLine).Padding(12).Column(c =>
                        {
                            c.Item().Row(r =>
                            {
                                r.RelativeItem().Text("Subtotal");
                                r.ConstantItem(100).AlignRight().Text($"₹{subtotal:0.00}");
                            });

                            if (!string.IsNullOrEmpty(order.CouponCode) && order.DiscountAmount > 0)
                            {
                                var label = order.CouponCode == "MYSTERY-BOX"
                                    ? "Mystery Crystal Box savings"
                                    : $"Coupon ({order.CouponCode})";

                                c.Item().Row(r =>
                                {
                                    r.RelativeItem().Text(label).FontColor(Colors.Green.Darken2);
                                    r.ConstantItem(100).AlignRight().Text($"- ₹{order.DiscountAmount:0.00}").FontColor(Colors.Green.Darken2);
                                });
                            }

                            c.Item().Row(r =>
                            {
                                r.RelativeItem().Text("Shipping");
                                if (order.ShippingFee > 0)
                                {
                                    r.ConstantItem(100).AlignRight().Text($"₹{order.ShippingFee:0.00}");
                                }
                                else
                                {
                                    r.ConstantItem(100).AlignRight().Text("FREE").FontColor(Colors.Green.Darken2).Bold();
                                }
                            });

                            if (order.IsGiftWrap)
                            {
                                var giftFee = order.GiftFee > 0 ? order.GiftFee : 99m;
                                c.Item().Row(r =>
                                {
                                    r.RelativeItem().Text("Luxury Gift Wrap & Zodiac Note");
                                    r.ConstantItem(100).AlignRight().Text($"₹{giftFee:0.00}");
                                });
                            }

                            c.Item().PaddingTop(6).BorderTop(1).BorderColor(BrandGreen);

                            c.Item().PaddingTop(6).Row(r =>
                            {
                                r.RelativeItem().Text("Total").Bold().FontSize(13).FontColor(BrandGreen);
                                r.ConstantItem(100).AlignRight().Text($"₹{order.TotalAmount:0.00}").Bold().FontSize(13).FontColor(BrandGreen);
                            });

                            // What actually happened to that total.
                            var (settleLabel, settleAmount, settleColor) = order.PaymentStatus switch
                            {
                                PaymentStatuses.Paid => ("Amount paid", $"₹{order.TotalAmount:0.00}", Colors.Green.Darken2),
                                PaymentStatuses.Refunded => ("Refunded", $"- ₹{order.TotalAmount:0.00}", Colors.Blue.Darken2),
                                PaymentStatuses.Pending when order.PaymentMethod == PaymentMethods.CashOnDelivery
                                    => ("Due on delivery", $"₹{order.TotalAmount:0.00}", Colors.Orange.Darken3),
                                _ => ((string?)null, "", Colors.Black)
                            };

                            if (settleLabel != null)
                            {
                                c.Item().PaddingTop(4).Row(r =>
                                {
                                    r.RelativeItem().Text(settleLabel).FontColor(settleColor);
                                    r.ConstantItem(100).AlignRight().Text(settleAmount).FontColor(settleColor).Bold();
                                });
                            }
                        });
                    });

                    page.Footer().PaddingTop(10).Column(column =>
                    {
                        column.Item().LineHorizontal(1).LineColor(StoneLine);

                        column.Item().PaddingTop(8).Row(row =>
                        {
                            row.RelativeItem().Text(text =>
                            {
                                text.Span("Questions about this order? ").FontSize(8).FontColor(Colors.Grey.Darken1);
                                text.Span("support@crystalstudio.com").FontSize(8).FontColor(BrandGreen);
                            });

                            row.RelativeItem().AlignRight().Text(t =>
                                t.CurrentPageNumber().FontSize(8).FontColor(Colors.Grey.Darken1));
                        });

                        column.Item().PaddingTop(4).AlignCenter().Text("Thank you for shopping with Crystal Studio.")
                            .FontSize(9).FontColor(BrandGreen).Bold();
                    });
                });
            });

            return document.GeneratePdf();
        }

        private static string PaymentStatusColor(string paymentStatus) => paymentStatus switch
        {
            PaymentStatuses.Paid => Colors.Green.Darken2,
            PaymentStatuses.Refunded => Colors.Blue.Darken2,
            PaymentStatuses.Pending => Colors.Orange.Darken3,
            _ => Colors.Grey.Darken1
        };
    }
}
