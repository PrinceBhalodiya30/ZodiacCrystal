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
        private static byte[] GetLogoBytes()
        {
            if (_logoBytes != null) return _logoBytes;
            try
            {
                var path = Path.Combine(AppContext.BaseDirectory, "Assets", "logo.png");
                if (File.Exists(path)) return _logoBytes = File.ReadAllBytes(path);
            }
            catch { }
            try
            {
                var path = Path.Combine(Directory.GetCurrentDirectory(), "Assets", "logo.png");
                if (File.Exists(path)) return _logoBytes = File.ReadAllBytes(path);
            }
            catch { }
            return _logoBytes = Convert.FromBase64String("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");
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
                        // A colored band behind the header gives the invoice a real letterhead
                        // instead of plain text-on-white, and makes it instantly recognizable
                        // as a Crystal Studio document even on page 2+ of a multi-page order.
                        column.Item().Background(BrandGreenDark).Padding(16).Row(row =>
                        {
                            var logoBytes = GetLogoBytes();
                            if (logoBytes != null && logoBytes.Length > 0)
                            {
                                row.AutoItem().Width(34).Height(34).Image(logoBytes);
                            }

                            row.RelativeItem().PaddingLeft(10).Column(c =>
                            {
                                c.Item().Text("Crystal Studio").FontSize(20).Bold().FontColor(Colors.White);
                                c.Item().Text("Hand-picked crystals for every zodiac sign").FontSize(9).FontColor(Colors.Grey.Lighten3);
                            });

                            row.ConstantItem(190).Column(c =>
                            {
                                c.Item().AlignRight().Text("INVOICE").FontSize(14).Bold().FontColor(Colors.White);
                                c.Item().AlignRight().Text($"Invoice #: INV-{order.OrderId:D6}").FontColor(Colors.White);
                                c.Item().AlignRight().Text($"Order #: {order.OrderId}").FontColor(Colors.White);
                                c.Item().AlignRight().Text($"Date: {order.OrderDate:dd MMM yyyy}").FontColor(Colors.White);
                                c.Item().AlignRight().Text($"Status: {order.Status}").FontColor(Colors.White);
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
