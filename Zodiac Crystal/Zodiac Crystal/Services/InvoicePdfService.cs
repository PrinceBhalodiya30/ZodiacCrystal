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
    public static class InvoicePdfService
    {
        // Same palette as the storefront: forest green brand, warm stone neutrals.
        private const string BrandGreen = "#2f4a3a";
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
                catch (Exception)
                {
                    // Ignore file read/access errors and fall back to next location or text logo
                }
            }
            return null;
        }

        // returnRequest: the order's return, if any, so a refunded return is explained on the invoice.
        public static byte[] GenerateInvoice(Order order, ReturnRequest? returnRequest = null)
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

                    page.Header().Column(column => ComposeHeader(column, order));
                    page.Content().PaddingTop(20).Column(column => ComposeContent(column, order, returnRequest, subtotal));
                    page.Footer().PaddingTop(10).Column(ComposeFooter);
                });
            });

            return document.GeneratePdf();
        }

        private static void ComposeHeader(ColumnDescriptor column, Order order)
        {
            // Clean letterhead displaying the brand logo and order metadata
            column.Item().BorderBottom(2).BorderColor(BrandGreen).PaddingBottom(14).Row(row =>
            {
                var logoBytes = GetLogoBytes();
                row.RelativeItem().Column(c =>
                {
                    if (logoBytes != null && logoBytes.Length > 0)
                    {
                        c.Item().Height(40).Image(logoBytes);
                    }
                    else
                    {
                        c.Item().Text("Zodiac Crystal").FontSize(20).Bold().FontColor(BrandGreen);
                    }
                    c.Item().PaddingTop(2).Text("Zodiac Crystal").FontSize(10).Bold().FontColor(Ink);
                    c.Item().Text("Curated Healing Crystals & Astrological Gemstones").FontSize(8).FontColor(Colors.Grey.Darken2);
                    c.Item().Text("Web: www.zodiaccrystal.com  |  Email: support@zodiaccrystal.com").FontSize(8).FontColor(Colors.Grey.Darken2);
                    c.Item().Text("Origin: India").FontSize(8).FontColor(Colors.Grey.Darken2);
                });

                row.ConstantItem(220).Column(c =>
                {
                    c.Item().AlignRight().Text("TAX INVOICE").FontSize(16).Bold().FontColor(BrandGreen);
                    c.Item().AlignRight().Text($"Invoice #: INV/2026-27/{order.OrderId:D5}").FontSize(9).FontColor(Colors.Grey.Darken2);
                    c.Item().AlignRight().Text($"Order #: {order.OrderId}").FontSize(9).FontColor(Colors.Grey.Darken2);
                    c.Item().AlignRight().Text($"Date: {order.OrderDate:dd MMM yyyy}").FontSize(9).FontColor(Colors.Grey.Darken2);
                    c.Item().AlignRight().Text($"Status: {order.Status}").FontSize(9).Bold().FontColor(BrandGreen);
                });
            });
        }

        private static void ComposeContent(ColumnDescriptor column, Order order, ReturnRequest? returnRequest, decimal subtotal)
        {
            ComposeAddressesAndPayment(column, order);
            ComposeOrderBanners(column, order, returnRequest);
            ComposeItemsTable(column, order);
            ComposeTotals(column, order, subtotal);
        }

        private static void ComposeAddressesAndPayment(ColumnDescriptor column, Order order)
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
        }

        private static void ComposeOrderBanners(ColumnDescriptor column, Order order, ReturnRequest? returnRequest)
        {
            ComposeCancellationBanner(column, order);
            ComposeReturnBanner(column, order, returnRequest);
            ComposeGiftWrapBox(column, order);
        }

        private static void ComposeCancellationBanner(ColumnDescriptor column, Order order)
        {
            // A cancelled order's invoice must never read like a normal bill.
            if (order.Status != "Cancelled") return;

            var cancelNote = GetCancellationNote(order);

            column.Item().PaddingTop(14).Background(Colors.Red.Lighten5).Border(1).BorderColor(Colors.Red.Lighten2)
                .Padding(8).Text(text =>
                {
                    text.Span("CANCELLED  ").Bold().FontColor(Colors.Red.Darken2);
                    text.Span(cancelNote).FontColor(Colors.Red.Darken2);
                });
        }

        private static string GetCancellationNote(Order order)
        {
            var baseNote = order.PaymentStatus switch
            {
                PaymentStatuses.Refunded when order.PaymentMethod == PaymentMethods.Card
                    => $"This order was cancelled. The card payment of ₹{order.TotalAmount:0.00} has been refunded.",
                PaymentStatuses.Refunded
                    => $"This order was cancelled. The payment of ₹{order.TotalAmount:0.00} has been refunded.",
                _ => "This order was cancelled. No payment was collected."
            };

            if (!string.IsNullOrEmpty(order.CancellationReason))
            {
                return $"{baseNote} Reason: {order.CancellationReason}.";
            }

            return baseNote;
        }

        private static void ComposeReturnBanner(ColumnDescriptor column, Order order, ReturnRequest? returnRequest)
        {
            // A delivered order that came back: say so, instead of a bare "Refunded".
            if (returnRequest == null || returnRequest.Status != ReturnStatuses.Refunded) return;

            var refundDetail = returnRequest.ResolvedAt != null
                ? $" and ₹{order.TotalAmount:0.00} was refunded on {returnRequest.ResolvedAt:dd MMM yyyy}."
                : $" and ₹{order.TotalAmount:0.00} was refunded.";

            var returnNote = $"Items from this order were returned ({ReturnReasons.Label(returnRequest.Reason)}){refundDetail}";

            column.Item().PaddingTop(14).Background(Colors.Blue.Lighten5).Border(1).BorderColor(Colors.Blue.Lighten2)
                .Padding(8).Text(text =>
                {
                    text.Span("RETURNED  ").Bold().FontColor(Colors.Blue.Darken2);
                    text.Span(returnNote).FontColor(Colors.Blue.Darken2);
                });
        }

        private static void ComposeGiftWrapBox(ColumnDescriptor column, Order order)
        {
            if (!order.IsGiftWrap) return;

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

        private static void ComposeItemsTable(ColumnDescriptor column, Order order)
        {
            column.Item().PaddingTop(20).Table(table =>
            {
                table.ColumnsDefinition(columns =>
                {
                    columns.RelativeColumn(3);
                    columns.RelativeColumn(1.2f);
                    columns.RelativeColumn(0.9f);
                    columns.RelativeColumn(0.8f);
                    columns.RelativeColumn(1.2f);
                    columns.RelativeColumn(1.2f);
                });

                table.Header(header =>
                {
                    header.Cell().Element(HeaderCell).Text("Product");
                    header.Cell().Element(HeaderCell).Text("SKU");
                    header.Cell().Element(HeaderCell).Text("HSN");
                    header.Cell().Element(HeaderCell).AlignRight().Text("Qty");
                    header.Cell().Element(HeaderCell).AlignRight().Text("Unit Price");
                    header.Cell().Element(HeaderCell).AlignRight().Text("Line Total");
                });

                var rowIndex = 0;
                foreach (var item in order.OrderItems)
                {
                    // Zebra striping keeps long item lists easy to scan across rows.
                    var isEvenRow = rowIndex % 2 == 0;
                    rowIndex++;

                    table.Cell().Element(c => BodyCell(c, isEvenRow)).Text(item.Product?.Name ?? $"Item #{item.ProductId}");
                    table.Cell().Element(c => BodyCell(c, isEvenRow)).Text(item.Product?.Sku ?? "-");
                    table.Cell().Element(c => BodyCell(c, isEvenRow)).Text("7103");
                    table.Cell().Element(c => BodyCell(c, isEvenRow)).AlignRight().Text(item.Quantity.ToString());
                    table.Cell().Element(c => BodyCell(c, isEvenRow)).AlignRight().Text($"₹{item.UnitPrice:0.00}");
                    table.Cell().Element(c => BodyCell(c, isEvenRow)).AlignRight().Text($"₹{item.Subtotal:0.00}");
                }
            });
        }

        private static IContainer HeaderCell(IContainer c) =>
            c.BorderBottom(1.5f).BorderColor(BrandGreen)
             .DefaultTextStyle(x => x.Bold().FontColor(Ink))
             .PaddingVertical(6).PaddingHorizontal(4);

        private static IContainer BodyCell(IContainer c, bool isEvenRow) =>
            c.Background(isEvenRow ? Colors.White : StoneTint).BorderBottom(0.5f).BorderColor(StoneLine)
             .PaddingVertical(6).PaddingHorizontal(4);

        private static void ComposeTotals(ColumnDescriptor column, Order order, decimal subtotal)
        {
            // Compute GST breakdown from inclusive total (standard 3% GST rate for gemstones/crystals, HSN 7103)
            var taxableAmount = Math.Round(order.TotalAmount / 1.03m, 2);
            var totalGst = order.TotalAmount - taxableAmount;

            var state = (order.State ?? "").Trim();
            var isDelhi = state.Equals("Delhi", StringComparison.OrdinalIgnoreCase) ||
                          state.Equals("DL", StringComparison.OrdinalIgnoreCase) ||
                          state.Equals("New Delhi", StringComparison.OrdinalIgnoreCase);

            decimal cgst = 0, sgst = 0, igst = 0;
            if (isDelhi)
            {
                cgst = Math.Round(totalGst / 2m, 2);
                sgst = totalGst - cgst;
            }
            else
            {
                igst = totalGst;
            }

            column.Item().PaddingTop(15).AlignRight().Width(260).Background(StoneTint).Border(1).BorderColor(StoneLine).Padding(12).Column(c =>
            {
                c.Item().Row(r =>
                {
                    r.RelativeItem().Text("Subtotal");
                    r.ConstantItem(100).AlignRight().Text($"₹{subtotal:0.00}");
                });

                RenderDiscountRow(c, order);
                RenderShippingRow(c, order);
                RenderGiftWrapRow(c, order);

                c.Item().PaddingVertical(4).LineHorizontal(0.5f).LineColor(StoneLine);

                c.Item().Row(r =>
                {
                    r.RelativeItem().Text("Taxable Value").FontSize(8.5f).FontColor(Colors.Grey.Darken2);
                    r.ConstantItem(100).AlignRight().Text($"₹{taxableAmount:0.00}").FontSize(8.5f).FontColor(Colors.Grey.Darken2);
                });

                if (isDelhi)
                {
                    c.Item().Row(r =>
                    {
                        r.RelativeItem().Text("CGST (1.5%)").FontSize(8.5f).FontColor(Colors.Grey.Darken2);
                        r.ConstantItem(100).AlignRight().Text($"₹{cgst:0.00}").FontSize(8.5f).FontColor(Colors.Grey.Darken2);
                    });
                    c.Item().Row(r =>
                    {
                        r.RelativeItem().Text("SGST (1.5%)").FontSize(8.5f).FontColor(Colors.Grey.Darken2);
                        r.ConstantItem(100).AlignRight().Text($"₹{sgst:0.00}").FontSize(8.5f).FontColor(Colors.Grey.Darken2);
                    });
                }
                else
                {
                    c.Item().Row(r =>
                    {
                        r.RelativeItem().Text("IGST (3.0%)").FontSize(8.5f).FontColor(Colors.Grey.Darken2);
                        r.ConstantItem(100).AlignRight().Text($"₹{igst:0.00}").FontSize(8.5f).FontColor(Colors.Grey.Darken2);
                    });
                }

                c.Item().PaddingTop(4).BorderTop(1).BorderColor(BrandGreen);

                c.Item().PaddingTop(4).Row(r =>
                {
                    r.RelativeItem().Column(rc =>
                    {
                        rc.Item().Text("Total").Bold().FontSize(13).FontColor(BrandGreen);
                        rc.Item().Text("(Inclusive of all taxes)").FontSize(7.5f).FontColor(Colors.Grey.Darken1);
                    });
                    r.ConstantItem(100).AlignRight().Text($"₹{order.TotalAmount:0.00}").Bold().FontSize(13).FontColor(BrandGreen);
                });

                RenderSettlementRow(c, order);
            });
        }

        private static void RenderDiscountRow(ColumnDescriptor c, Order order)
        {
            if (string.IsNullOrEmpty(order.CouponCode) || order.DiscountAmount <= 0) return;

            var label = order.CouponCode == "MYSTERY-BOX"
                ? "Mystery Crystal Box savings"
                : $"Coupon ({order.CouponCode})";

            c.Item().Row(r =>
            {
                r.RelativeItem().Text(label).FontColor(Colors.Green.Darken2);
                r.ConstantItem(100).AlignRight().Text($"- ₹{order.DiscountAmount:0.00}").FontColor(Colors.Green.Darken2);
            });
        }

        private static void RenderShippingRow(ColumnDescriptor c, Order order)
        {
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
        }

        private static void RenderGiftWrapRow(ColumnDescriptor c, Order order)
        {
            if (!order.IsGiftWrap) return;

            var giftFee = order.GiftFee > 0 ? order.GiftFee : 99m;
            c.Item().Row(r =>
            {
                r.RelativeItem().Text("Luxury Gift Wrap & Zodiac Note");
                r.ConstantItem(100).AlignRight().Text($"₹{giftFee:0.00}");
            });
        }

        private static void RenderSettlementRow(ColumnDescriptor c, Order order)
        {
            var (settleLabel, settleAmount, settleColor) = GetSettlementInfo(order);
            if (settleLabel == null) return;

            c.Item().PaddingTop(4).Row(r =>
            {
                r.RelativeItem().Text(settleLabel).FontColor(settleColor);
                r.ConstantItem(100).AlignRight().Text(settleAmount).FontColor(settleColor).Bold();
            });
        }

        private static (string? Label, string Amount, string Color) GetSettlementInfo(Order order) => order.PaymentStatus switch
        {
            PaymentStatuses.Paid => ("Amount paid", $"₹{order.TotalAmount:0.00}", Colors.Green.Darken2),
            PaymentStatuses.Refunded => ("Refunded", $"- ₹{order.TotalAmount:0.00}", Colors.Blue.Darken2),
            PaymentStatuses.Pending when order.PaymentMethod == PaymentMethods.CashOnDelivery
                => ("Due on delivery", $"₹{order.TotalAmount:0.00}", Colors.Orange.Darken3),
            _ => (null, "", Colors.Black)
        };

        private static void ComposeFooter(ColumnDescriptor column)
        {
            column.Item().LineHorizontal(1).LineColor(StoneLine);

            column.Item().PaddingTop(6).AlignCenter()
                .Text("This is a computer-generated tax invoice and requires no physical signature.")
                .FontSize(7.5f).Italic().FontColor(Colors.Grey.Darken1);

            column.Item().PaddingTop(6).Row(row =>
            {
                row.RelativeItem().Text(text =>
                {
                    text.Span("Questions about this order? ").FontSize(8).FontColor(Colors.Grey.Darken1);
                    text.Span("support@zodiaccrystal.com").FontSize(8).FontColor(BrandGreen);
                });

                row.RelativeItem().AlignRight().Text(t =>
                    t.CurrentPageNumber().FontSize(8).FontColor(Colors.Grey.Darken1));
            });

            column.Item().PaddingTop(4).AlignCenter().Text("Thank you for shopping with Zodiac Crystal.")
                .FontSize(9).FontColor(BrandGreen).Bold();
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
