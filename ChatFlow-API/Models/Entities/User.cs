using Microsoft.AspNetCore.Identity;

namespace ChatFlow.API.Models.Entities;

public class User : IdentityUser
{
    public string FullName { get; set; } = null!;
    public string? Avatar { get; set; }
    public string? Bio { get; set; }
    public bool IsOnline { get; set; }
    public DateTime LastSeen { get; set; }
    public DateTime CreatedAt { get; set; }
}