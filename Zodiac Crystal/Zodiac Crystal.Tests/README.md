# Zodiac Crystal.Tests

xUnit tests for the backend. Database tests run against a real SQL Server
(Testcontainers, `mcr.microsoft.com/mssql/server:2022-latest`) because the code
relies on T-SQL lock hints, Serializable transactions and `ExecuteUpdate`.

## Prerequisites

- .NET 10 SDK
- Docker Desktop running (Linux containers). The first run pulls the SQL Server
  image (~1.5 GB).

## Running

```
cd "Zodiac Crystal"
dotnet test
```

One container is started for the whole run. Each test builds its own fresh
database from `DB/Schema/CrystalsDB.sql` + `DB/Migrations/*.sql` (name order,
split on `GO` lines), so tests don't share data. The scripts are found by
walking up from the test output folder to the folder containing `DB/`.

## What's covered

| File | Covers |
|---|---|
| `SchemaScriptTests` | Baseline + migrations apply to an empty DB; migrations re-run twice; baseline re-runs; every EF entity's table/columns exist; the idempotency index name matches `CheckoutSafety`. |
| `StockUpdatesTests` | `TryReserveAsync` at the boundary (exact stock ok, one over fails and changes nothing, unknown product); `RestoreAsync` adds back. |
| `CouponValidationServiceTests` | Pure unit tests: null, inactive, not started, expired, usage limit, per-user limit, minimum order, rounding, fixed-amount cap. |
| `OrdersControllerTests` | COD checkout reserves stock and creates the order; insufficient stock -> 400 with stock unchanged; coupon at usage limit rejected; coupon applied and counted; per-user coupon limit; idempotency replay (same order id, one row, stock taken once); cancel restores stock; double cancel; cancelling another customer's order. |
| `CardCheckoutTests` | Card checkout with a faked Braintree gateway: success; declined card rolls back order/stock/coupon; charge ok but save fails -> refund attempted; refund failure -> `PaymentFailures` row. |
| `MysteryBoxControllerTests` | COD box creates one order with one of each seeded item reserved; card box charges the box price once and marks it paid; catalog below the minimum value, or fewer than 3 in-stock products -> 400 with nothing written; idempotency replay (same order id, one row, stock and charge once); declined card rolls back; charge ok but save fails -> refund, no `PaymentFailures` row; refund failure -> `PaymentFailures` row (transaction id, user, 1499). Built by `Infrastructure/MysteryBoxHarness`. |

`OrdersController` and `MysteryBoxController` are constructed directly with fakes (email, SignalR,
offline India Post lookup), not through the HTTP pipeline, so auth, rate
limiting and model validation attributes are not exercised.

`BraintreePaymentService` has no interface and non-virtual methods, so the
card tests replace its private `_gateway` field by reflection
(`Infrastructure/FakeBraintree`). Renaming that field breaks those tests
loudly. Extracting an `IPaymentService` interface would remove the need.

Not covered: the concurrent duplicate-idempotency-key race path (both
controllers), the stock-race `Conflict` in the mystery box, and the random
sampling itself (tests seed exactly 3 products so the selection is fixed).
