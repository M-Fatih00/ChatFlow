using ChatFlow.API.Models.Entities;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace ChatFlow.API.Data;

public class AppDbContext(DbContextOptions options) : IdentityDbContext<User>(options)
{
    public DbSet<Message> Messages => Set<Message>();
    public DbSet<MessageStatus> MessageStatuses => Set<MessageStatus>();
    public DbSet<Reaction> Reactions => Set<Reaction>();
    public DbSet<Room> Rooms => Set<Room>();
    public DbSet<RoomMember> RoomMembers => Set<RoomMember>();
    public DbSet<Block> Blocks { get; set; }
    public DbSet<Friendship> Friendships { get; set; }
    public DbSet<HiddenConversation> HiddenConversations { get; set; }




    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<MessageStatus>()
            .HasKey(ms => new { ms.MessageId, ms.UserId, ms.MessageStatusType });

        modelBuilder.Entity<Reaction>()
            .HasKey(ms => new { ms.MessageId, ms.UserId, ms.Emoji });

        // RoomMember composite key: RoomId + UserId
        modelBuilder.Entity<RoomMember>()
            .HasKey(rm => new { rm.RoomId, rm.UserId });

        modelBuilder.Entity<Block>()
            .HasOne(b => b.Blocker)
            .WithMany()
            .HasForeignKey(b => b.BlockerId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Block>()
            .HasOne(b => b.Blocked)
            .WithMany()
            .HasForeignKey(b => b.BlockedId)
            .OnDelete(DeleteBehavior.Restrict);

        // Aynı kişiyi iki kez engellemeyi önle
        modelBuilder.Entity<Block>()
            .HasIndex(b => new { b.BlockerId, b.BlockedId })
            .IsUnique();


        modelBuilder.Entity<Friendship>()
            .HasOne(f => f.Requester)
            .WithMany()
            .HasForeignKey(f => f.RequesterId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Friendship>()
            .HasOne(f => f.Addressee)
            .WithMany()
            .HasForeignKey(f => f.AddresseeId)
            .OnDelete(DeleteBehavior.Restrict);

        // Aynı çift arasında birden fazla kayıt olmasın
        modelBuilder.Entity<Friendship>()
            .HasIndex(f => new { f.RequesterId, f.AddresseeId })
            .IsUnique();

        modelBuilder.Entity<HiddenConversation>()
            .HasIndex(h => new { h.UserId, h.OtherUserId })
            .IsUnique();
    }
}