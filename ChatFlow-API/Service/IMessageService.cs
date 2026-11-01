using ChatFlow.API.Models.DTOs;

namespace ChatFlow.API.Services;

public sealed record MessagePage(List<MessageDTO> Messages, bool HasMore);

public interface IMessageService
{
    Task<MessageDTO> SaveMessageAsync(
        string senderId,
        string content,
        string? recipientId,
        int? roomId,
        string? attachmentUrl,
        string? attachmentType);

    Task<MessagePage?> GetMessagesAsync(string userId, string? recipientId, int? roomId, int skip, int take);

    Task<List<MessageDTO>?> SearchAsync(string userId, string term, string? recipientId, int? roomId);

    Task<List<ConversationDTO>> GetConversationsAsync(string userId);

    Task<List<string>?> SoftDeleteAsync(int messageId, string userId);
}