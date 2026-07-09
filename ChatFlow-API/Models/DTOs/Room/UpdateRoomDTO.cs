namespace ChatFlow.API.Models.DTOs;

public class UpdateRoomDTO
{
    public string Name { get; set; } = null!;
    public string? Description { get; set; }
}