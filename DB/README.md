# CrystalsDB schema

The database is managed with plain SQL scripts. This is the only schema
process; the app uses EF Core for queries, but EF migrations are not used.

| Path | What it is |
|---|---|
| `Schema/CrystalsDB.sql` | The complete baseline schema (tables, keys, indexes, checks, foreign keys), scripted from the live database on 2026-10-14. |
| `Migrations/YYYY-MM-DD_name.sql` | Changes made after the baseline. Each one is idempotent and run in name order. |
| `Seed/sample_data.sql` | Categories, zodiac signs and four sample products for a new, empty database. No user accounts. |
| `Migrations/Archive/` | The older one-off scripts. Their changes are already in the baseline. Never run them. |

## New database

1. Create an empty database and connect to it.
2. Run `Schema/CrystalsDB.sql`.
3. Run every file in `Migrations/` (not `Archive/`) in name order.
4. Optionally run `Seed/sample_data.sql`.
5. Register an account in the app, then set its `Users.Role` to `Admin`.

## Existing database (CrystalsDB)

Run only the files in `Migrations/` that haven't been applied yet, in name
order. They are safe to re-run. A script that adds a CHECK constraint first
looks for rows that would break it, and stops with an error naming them
instead of changing anything, so the data can be reviewed.

## Making a schema change

1. Add a new `Migrations/YYYY-MM-DD_short_name.sql`. Guard every change
   (`IF OBJECT_ID(...) IS NULL`, `IF COL_LENGTH(...) IS NULL`, and so on) so the
   script can be re-run.
2. Update the matching EF model in `Zodiac Crystal/Data/CrystalsDbContext.cs`.
3. Run the test suite. `SchemaScriptTests` builds a fresh database from these
   scripts and checks that every EF entity can be queried against it.
