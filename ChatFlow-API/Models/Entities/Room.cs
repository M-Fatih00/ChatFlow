namespace ChatFlow.API.Models.Entities;

public class Room
{
    public int Id { get; set; }
    public string Name { get; set; } = null!;
    public DateTime CreatedAt { get; set; }
    public string CreatedBy { get; set; } = null!;
    public string? Avatar { get; set; }
    public string? Description { get; set; }
    public List<Message> Messages { get; set; } = new();
}