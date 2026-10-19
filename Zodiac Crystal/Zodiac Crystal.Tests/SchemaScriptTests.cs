using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Zodiac_Crystal.Tests.Infrastructure;

namespace Zodiac_Crystal.Tests;

// The checks DB/README.md promises: a fresh database builds from the scripts,
// they're re-runnable, and every EF entity maps onto real columns.
[Collection(SqlServerCollection.Name)]
public class SchemaScriptTests(SqlServerFixture db)
{
    [Fact]
    public async Task Baseline_and_migrations_apply_to_an_empty_database()
    {
        var cs = await db.CreateEmptyDatabaseAsync();
        await SqlScripts.ApplyAllAsync(cs);

        Assert.True(await TableExistsAsync(cs, "Orders"));
        Assert.True(await TableExistsAsync(cs, "PaymentFailures"));
    }

    [Fact]
    public async Task Migrations_are_rerunnable()
    {
        var cs = await db.CreateDatabaseAsync();

        await SqlScripts.ApplyMigrationsAsync(cs);
        await SqlScripts.ApplyMigrationsAsync(cs);
    }

    [Fact]
    public async Task Baseline_is_rerunnable_on_a_migrated_database()
    {
        var cs = await db.CreateDatabaseAsync();

        await SqlScripts.ApplyFileAsync(cs, SqlScripts.BaselinePath);
        await SqlScripts.ApplyMigrationsAsync(cs);
    }

    [Fact]
    public async Task Every_ef_entity_maps_to_existing_table_and_columns()
    {
        var cs = await db.CreateDatabaseAsync();
        await using var ctx = SqlServerFixture.CreateContext(cs);

        var failures = new List<string>();
        foreach (var entity in ctx.Model.GetEntityTypes())
        {
            var table = entity.GetTableName();
            if (table == null)
            {
                continue;
            }
            var schema = entity.GetSchema() ?? "dbo";
            var store = StoreObjectIdentifier.Table(table, entity.GetSchema());
            var columns = entity.GetProperties()
                .Select(p => p.GetColumnName(store))
                .Where(c => c != null)
                .Distinct()
                .Select(c => $"[{c}]");

            var sql = $"SELECT TOP 0 {string.Join(", ", columns)} FROM [{schema}].[{table}]";
            try
            {
                await ctx.Database.ExecuteSqlRawAsync(sql);
            }
            catch (SqlException ex)
            {
                failures.Add($"{entity.DisplayName()}: {ex.Message}");
            }
        }

        Assert.True(failures.Count == 0, string.Join(Environment.NewLine, failures));
    }

    [Fact]
    public async Task Idempotency_index_name_matches_CheckoutSafety()
    {
        var cs = await db.CreateDatabaseAsync();
        await using var conn = new SqlConnection(cs);
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT COUNT(*) FROM sys.indexes WHERE name = @n AND is_unique = 1";
        cmd.Parameters.AddWithValue("@n", Zodiac_Crystal.Services.CheckoutSafety.IdempotencyIndexName);
        Assert.Equal(1, (int)(await cmd.ExecuteScalarAsync())!);
    }

    private static async Task<bool> TableExistsAsync(string cs, string table)
    {
        await using var conn = new SqlConnection(cs);
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT OBJECT_ID(@t, N'U')";
        cmd.Parameters.AddWithValue("@t", "dbo." + table);
        return await cmd.ExecuteScalarAsync() is not (null or DBNull);
    }
}
