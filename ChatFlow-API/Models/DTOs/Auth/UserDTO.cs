namespace ChatFlow.API.Models.DTOs;

public class UserDTO
{
    public string Id { get; set; } = null!;
    public string FullName { get; set; } = null!;
    public string UserName { get; set; } = null!;
    public string? Email { get; set; }
    public string? Avatar { get; set; }
    public string? Bio { get; set; }
    public string? Token { get; set; }
    public DateTime? LastSeen { get; set; }
    public bool IsOnline { get; set; }
    public DateTime CreatedAt { get; set; }

}