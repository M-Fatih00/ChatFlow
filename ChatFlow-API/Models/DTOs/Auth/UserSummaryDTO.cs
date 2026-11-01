namespace ChatFlow.API.Models.DTOs;

public class UserSummaryDTO
{
    public string Id { get; set; } = null!;
    public string FullName { get; set; } = null!;
    public string UserName { get; set; } = null!;
    public string? Avatar { get; set; }
    public string? Bio { get; set; }
}
