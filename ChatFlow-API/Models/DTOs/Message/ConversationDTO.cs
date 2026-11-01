namespace ChatFlow.API.Models.DTOs;

public class ConversationDTO
{
    public string Id { get; set; } = null!;
    public string FullName { get; set; } = null!;
    public string UserName { get; set; } = null!;
    public string? Avatar { get; set; }
    public DateTime? LastSeen { get; set; }
    public DateTime LastMessageAt { get; set; }
}