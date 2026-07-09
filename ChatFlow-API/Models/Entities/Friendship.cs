using ChatFlow.API.Models.Enums;

namespace ChatFlow.API.Models.Entities;

public class Friendship
{
    public int Id { get; set; }

    public string RequesterId { get; set; } = null!;  // isteği gönderen
    public User Requester { get; set; } = null!;

    public string AddresseeId { get; set; } = null!;  // isteği alan
    public User Addressee { get; set; } = null!;

    public FriendshipStatus Status { get; set; }
    public DateTime CreatedAt { get; set; }
}