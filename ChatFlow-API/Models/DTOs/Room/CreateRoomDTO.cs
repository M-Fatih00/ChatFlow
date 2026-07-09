namespace ChatFlow.API.Models.DTOs;

public class CreateRoomDTO
{
    public string Name { get; set; } = null!;
    public List<string> MemberIds { get; set; } = new();
}