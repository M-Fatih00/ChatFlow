namespace ChatFlow.API.Models.Entities;

public class RoomMember
{
    public int RoomId { get; set; }
    public Room Room { get; set; } = null!;

    public string UserId { get; set; } = null!;
    public User User { get; set; } = null!;

    public bool IsAdmin { get; set; }
    public DateTime JoinedAt { get; set; }
}
