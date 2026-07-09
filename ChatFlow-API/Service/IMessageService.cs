using ChatFlow.API.Models.DTOs;
 
namespace ChatFlow.API.Services;
 
public interface IMessageService
{
    Task<MessageDTO> SaveMessageAsync(
        string senderId,
        string content,
        string? recipientId,
        int? roomId,
        string? attachmentUrl,
        string? attachmentType);
 
    Task<(List<MessageDTO> Messages, bool HasMore)> GetMessagesAsync(
        string senderId,
        string? recipientId,
        int? roomId,
        int skip = 0,
        int take = 10);
}
 