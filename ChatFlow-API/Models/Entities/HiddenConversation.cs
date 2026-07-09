namespace ChatFlow.API.Models.Entities;

public class HiddenConversation
{
    public int Id { get; set; }
    public string UserId { get; set; } = null!;// gizleyen
    public User User { get; set; } = null!;
    public string OtherUserId { get; set; } = null!; // gizlenen sohbet karşı tarafı
    public DateTime HiddenAt { get; set; }
}