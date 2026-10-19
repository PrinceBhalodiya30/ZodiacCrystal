using System.Text.RegularExpressions;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Testcontainers.MsSql;
using Zodiac_Crystal.Data;

namespace Zodiac_Crystal.Tests.Infrastructure;

// One SQL Server container for the whole test run (Docker must be running).
// Every test gets its own freshly built database, so tests never share rows.
public sealed class SqlServerFixture : IAsyncLifetime
{
    private readonly MsSqlContainer _container = new MsSqlBuilder()
        .WithImage("mcr.microsoft.com/mssql/server:2022-latest")
        .Build();

    public Task InitializeAsync() => _container.StartAsync();

    public Task DisposeAsync() => _container.DisposeAsync().AsTask();

    // Creates an empty database and returns a connection string to it.
    public async Task<string> CreateEmptyDatabaseAsync()
    {
        var name = "zc_" + Guid.NewGuid().ToString("N");
        await using (var master = new SqlConnection(_container.GetConnectionString()))
        {
            await master.OpenAsync();
            await using var cmd = master.CreateCommand();
            cmd.CommandText = $"CREATE DATABASE [{name}]";
            await cmd.ExecuteNonQueryAsync();
        }

        return new SqlConnectionStringBuilder(_container.GetConnectionString())
        {
            InitialCatalog = name,
            TrustServerCertificate = true
        }.ConnectionString;
    }

    // A database built exactly as DB/README.md describes: baseline, then migrations.
    public async Task<string> CreateDatabaseAsync()
    {
        var cs = await CreateEmptyDatabaseAsync();
        await SqlScripts.ApplyAllAsync(cs);
        return cs;
    }

    public static CrystalsDbContext CreateContext(string connectionString) =>
        new(new DbContextOptionsBuilder<CrystalsDbContext>()
            .UseSqlServer(connectionString)
            .Options);
}

[CollectionDefinition(Name)]
public sealed class SqlServerCollection : ICollectionFixture<SqlServerFixture>
{
    public const string Name = "SqlServer";
}

public static class SqlScripts
{
    private static readonly Regex GoLine = new(@"^\s*GO\s*;?\s*(--.*)?$",
        RegexOptions.Multiline | RegexOptions.IgnoreCase | RegexOptions.Compiled);

    public static string DbFolder { get; } = FindDbFolder();

    public static string BaselinePath => Path.Combine(DbFolder, "Schema", "CrystalsDB.sql");

    // Migrations/*.sql in name order (Archive/ is never run).
    public static IReadOnlyList<string> MigrationPaths =>
        Directory.GetFiles(Path.Combine(DbFolder, "Migrations"), "*.sql", SearchOption.TopDirectoryOnly)
            .OrderBy(p => Path.GetFileName(p), StringComparer.Ordinal)
            .ToList();

    public static async Task ApplyAllAsync(string connectionString)
    {
        await ApplyFileAsync(connectionString, BaselinePath);
        await ApplyMigrationsAsync(connectionString);
    }

    public static async Task ApplyMigrationsAsync(string connectionString)
    {
        foreach (var path in MigrationPaths)
        {
            await ApplyFileAsync(connectionString, path);
        }
    }

    public static async Task ApplyFileAsync(string connectionString, string path)
    {
        var sql = await File.ReadAllTextAsync(path);
        await using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync();

        var batchNumber = 0;
        foreach (var batch in GoLine.Split(sql))
        {
            batchNumber++;
            if (string.IsNullOrWhiteSpace(batch) || batch.TrimStart().StartsWith("--") && IsOnlyComments(batch))
            {
                continue;
            }

            await using var cmd = connection.CreateCommand();
            cmd.CommandText = batch;
            cmd.CommandTimeout = 120;
            try
            {
                await cmd.ExecuteNonQueryAsync();
            }
            catch (SqlException ex)
            {
                throw new InvalidOperationException(
                    $"{Path.GetFileName(path)} batch {batchNumber} failed: {ex.Message}", ex);
            }
        }
    }

    private static bool IsOnlyComments(string batch) =>
        batch.Split('\n').All(l => string.IsNullOrWhiteSpace(l) || l.TrimStart().StartsWith("--"));

    // Walks up from the test output folder to the repo root that holds DB/Schema.
    private static string FindDbFolder()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir != null)
        {
            var candidate = Path.Combine(dir.FullName, "DB", "Schema", "CrystalsDB.sql");
            if (File.Exists(candidate))
            {
                return Path.Combine(dir.FullName, "DB");
            }
            dir = dir.Parent;
        }
        throw new DirectoryNotFoundException("Could not find DB/Schema/CrystalsDB.sql above " + AppContext.BaseDirectory);
    }
}
