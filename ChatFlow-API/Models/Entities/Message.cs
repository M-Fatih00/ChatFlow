namespace ChatFlow.API.Models.Entities;

public class Message
{
    public int Id { get; set; }
    public string Content { get; set; } = null!;
    public DateTime CreatedAt { get; set; }
    public string SenderId { get; set; } = null!;
    public User Sender { get; set; } = null!;
    public int? RoomId { get; set; }
    public Room? Room { get; set; }
    public string? RecipientId { get; set; }
    public User? Recipient { get; set; }
    public bool IsDeleted { get; set; } = false;
    public string? AttachmentUrl { get; set; }
    public string? AttachmentType { get; set; }

}