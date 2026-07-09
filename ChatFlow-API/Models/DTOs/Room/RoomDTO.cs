namespace ChatFlow.API.Models.DTOs;

public class RoomDTO
{
    public int Id { get; set; }
    public string Name { get; set; } = null!;
    public DateTime CreatedAt { get; set; }
    public string CreatedBy { get; set; } = null!;
    public string? Avatar { get; set; }
    public string? Description { get; set; }
}