using ChatFlow.API.Models.Enums;

namespace ChatFlow.API.Models.Entities;

public class MessageStatus
{
    public int MessageId { get; set; }
    public Message Message { get; set; } = null!;
    public string UserId { get; set; } = null!;
    public User User { get; set; } = null!;
    public MessageStatusType MessageStatusType { get; set; }
    public DateTime UpdateAt { get; set; }
}