namespace ChatFlow.API.Models.Entities;

public class Block
{
    public int Id { get; set; }
    public string BlockerId { get; set; } = null!;  // engelleyen
    public User Blocker { get; set; } = null!;
    public string BlockedId { get; set; } = null!;   // engellenen
    public User Blocked { get; set; } = null!;
    public DateTime CreatedAt { get; set; }
}