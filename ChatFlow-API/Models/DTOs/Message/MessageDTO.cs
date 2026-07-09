namespace ChatFlow.API.Models.DTOs;

public class MessageDTO
{
    public int Id { get; set; }
    public string Content { get; set; } = null!;
    public DateTime CreatedAt { get; set; }
    public string SenderId { get; set; } = null!;
    public string? RecipientId { get; set; }
    public int? RoomId { get; set; }
    public bool IsDelivered { get; set; }
    public bool IsRead { get; set; }
    public bool IsDeleted { get; set; }
    public string? AttachmentUrl { get; set; }
    public string? AttachmentType { get; set; }
    public string? SenderName { get; set; }
    public string? SenderAvatar { get; set; }
    public List<ReactionDTO> Reactions { get; set; } = new();


    // Grup mesajları için tik bilgisi (sadece gönderen görür)
    public int ReadCount { get; set; }
    public int DeliveredCount { get; set; }
    public int TotalRecipients { get; set; }

}