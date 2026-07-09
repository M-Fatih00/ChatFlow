namespace ChatFlow.API.Models.Entities;

public class Reaction
{
    public int MessageId { get; set; }
    public Message Message { get; set; } = null!;
    public string UserId { get; set; } = null!;
    public User User { get; set; } = null!;
    public string Emoji { get; set; } = null!;
    public DateTime CreatedAt { get; set; }
}