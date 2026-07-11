namespace ChatFlow.API.Models.DTOs;

public class UpdateProfileDTO
{
    public string FullName { get; set; } = null!;
    public string UserName { get; set; } = null!;
    public string? Email { get; set; }
    public string? Avatar { get; set; }
    public string? Bio { get; set; }
}