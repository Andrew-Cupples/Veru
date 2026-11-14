using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using PromptLedger.Core.Domain;

namespace PromptLedger.Core.Data;

public sealed class LedgerDbContext(DbContextOptions<LedgerDbContext> options) : DbContext(options)
{
    public DbSet<Session> Sessions => Set<Session>();
    public DbSet<Prompt> Prompts => Set<Prompt>();
    public DbSet<Tag> Tags => Set<Tag>();
    public DbSet<ManualChange> ManualChanges => Set<ManualChange>();
    public DbSet<Setting> Settings => Set<Setting>();

    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        // SQLite cannot order or compare DateTimeOffset natively. Store unix milliseconds
        // so sorting and range filters run in SQL rather than in memory.
        configurationBuilder.Properties<DateTimeOffset>().HaveConversion<UnixMsConverter>();
        configurationBuilder.Properties<Enum>().HaveConversion<string>().HaveMaxLength(32);
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Session>(e =>
        {
            e.Property(x => x.Id).HasMaxLength(64);
            e.HasMany(x => x.Prompts).WithOne(x => x.Session).HasForeignKey(x => x.SessionId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Prompt>(e =>
        {
            e.HasIndex(x => new { x.SessionId, x.Sequence });
            e.HasIndex(x => x.TranscriptUuid).IsUnique();
            e.HasIndex(x => x.SubmittedAt);
            e.HasIndex(x => x.HumanReviewed);
            e.HasMany(x => x.Tags).WithMany(x => x.Prompts).UsingEntity("PromptTags");
        });

        modelBuilder.Entity<Tag>(e =>
        {
            e.Property(x => x.Name).HasMaxLength(50);
            e.HasIndex(x => x.Name).IsUnique();
            e.Property(x => x.Color).HasMaxLength(64);
        });

        modelBuilder.Entity<ManualChange>(e =>
        {
            e.HasOne(x => x.RelatedPrompt).WithMany().HasForeignKey(x => x.RelatedPromptId).OnDelete(DeleteBehavior.SetNull);
            e.Property(x => x.CommitSha).HasMaxLength(64);
        });

        modelBuilder.Entity<Setting>(e =>
        {
            e.HasKey(x => x.Key);
            e.Property(x => x.Key).HasMaxLength(100);
        });
    }

    public override int SaveChanges(bool acceptAllChangesOnSuccess)
    {
        StampTimes();
        return base.SaveChanges(acceptAllChangesOnSuccess);
    }

    public override Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
    {
        StampTimes();
        return base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
    }

    private void StampTimes()
    {
        var now = DateTimeOffset.UtcNow;
        foreach (var entry in ChangeTracker.Entries())
        {
            if (entry.State is not (EntityState.Added or EntityState.Modified))
            {
                continue;
            }

            var added = entry.State == EntityState.Added;
            switch (entry.Entity)
            {
                case Prompt p:
                    if (added && p.CreatedAt == default) p.CreatedAt = now;
                    p.UpdatedAt = now;
                    break;
                case ManualChange m:
                    if (added && m.CreatedAt == default) m.CreatedAt = now;
                    m.UpdatedAt = now;
                    break;
                case Tag t when added && t.CreatedAt == default:
                    t.CreatedAt = now;
                    break;
                case Setting s:
                    s.UpdatedAt = now;
                    break;
            }
        }
    }

    private sealed class UnixMsConverter() : ValueConverter<DateTimeOffset, long>(
        v => v.ToUnixTimeMilliseconds(),
        v => DateTimeOffset.FromUnixTimeMilliseconds(v));
}
