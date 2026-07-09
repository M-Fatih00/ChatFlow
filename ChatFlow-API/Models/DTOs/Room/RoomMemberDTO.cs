namespace ChatFlow.API.Models.DTOs;

public class RoomMemberDTO
{
    public string UserId { get; set; } = null!;
    public string FullName { get; set; } = null!;
    public string? Avatar { get; set; }
    public bool IsAdmin { get; set; }
}