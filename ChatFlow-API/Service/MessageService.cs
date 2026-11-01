using ChatFlow.API.Data;
using ChatFlow.API.Models.DTOs;
using ChatFlow.API.Models.Entities;
using ChatFlow.API.Models.Enums;
using Microsoft.EntityFrameworkCore;

namespace ChatFlow.API.Services;

public class MessageService : IMessageService
{
    private const int MaxSearchResults = 50;

    private readonly AppDbContext _context;

    public MessageService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<MessageDTO> SaveMessageAsync(
        string senderId,
        string content,
        string? recipientId,
        int? roomId,
        string? attachmentUrl,
        string? attachmentType)
    {
        var message = new Message
        {
            Content = content,
            SenderId = senderId,
            RoomId = roomId,
            RecipientId = recipientId,
            AttachmentUrl = attachmentUrl,
            AttachmentType = attachmentType,
            CreatedAt = DateTime.UtcNow
        };

        _context.Messages.Add(message);
        await _context.SaveChangesAsync();

        var sender = await _context.Users
            .AsNoTracking()
            .Where(u => u.Id == senderId)
            .Select(u => new { u.FullName, u.Avatar })
            .FirstOrDefaultAsync();

        var totalRecipients = roomId.HasValue
            ? Math.Max(0, await _context.RoomMembers.CountAsync(rm => rm.RoomId == roomId.Value) - 1)
            : 0;

        return new MessageDTO
        {
            Id = message.Id,
            Content = message.Content,
            CreatedAt = message.CreatedAt,
            SenderId = message.SenderId,
            SenderName = sender?.FullName,
            SenderAvatar = sender?.Avatar,
            RecipientId = message.RecipientId,
            RoomId = message.RoomId,
            AttachmentUrl = message.AttachmentUrl,
            AttachmentType = message.AttachmentType,
            TotalRecipients = totalRecipients
        };
    }

    public async Task<MessagePage?> GetMessagesAsync(string userId, string? recipientId, int? roomId, int skip, int take)
    {
        IQueryable<Message> query;
        var totalRecipients = 0;

        if (roomId.HasValue)
        {
            var memberCount = await _context.RoomMembers
                .Where(rm => rm.RoomId == roomId.Value && rm.UserId == userId)
                .Select(rm => (int?)_context.RoomMembers.Count(x => x.RoomId == rm.RoomId))
                .FirstOrDefaultAsync();

            if (memberCount == null)
                return null;

            totalRecipients = Math.Max(0, memberCount.Value - 1);
            query = _context.Messages.Where(m => m.RoomId == roomId.Value);
        }
        else
        {
            if (string.IsNullOrEmpty(recipientId))
                return null;

            query = DirectConversation(userId, recipientId);
        }

        var messages = await query
            .AsNoTracking()
            .OrderByDescending(m => m.CreatedAt)
            .ThenByDescending(m => m.Id)
            .Skip(skip)
            .Take(take + 1)
            .Select(m => new MessageDTO
            {
                Id = m.Id,
                Content = m.IsDeleted ? string.Empty : m.Content,
                CreatedAt = m.CreatedAt,
                SenderId = m.SenderId,
                SenderName = m.Sender.FullName,
                SenderAvatar = m.Sender.Avatar,
                RecipientId = m.RecipientId,
                RoomId = m.RoomId,
                IsDeleted = m.IsDeleted,
                AttachmentUrl = m.IsDeleted ? null : m.AttachmentUrl,
                AttachmentType = m.IsDeleted ? null : m.AttachmentType,
                ReadCount = _context.MessageStatuses.Count(ms =>
                    ms.MessageId == m.Id && ms.MessageStatusType == MessageStatusType.Read),
                DeliveredCount = _context.MessageStatuses.Count(ms =>
                    ms.MessageId == m.Id && ms.MessageStatusType == MessageStatusType.Delivered),
                Reactions = _context.Reactions
                    .Where(r => r.MessageId == m.Id)
                    .Select(r => new ReactionDTO { UserId = r.UserId, Emoji = r.Emoji })
                    .ToList()
            })
            .ToListAsync();

        var hasMore = messages.Count > take;
        if (hasMore)
            messages.RemoveAt(messages.Count - 1);

        messages.Reverse();

        foreach (var message in messages)
        {
            message.IsRead = message.ReadCount > 0;
            message.IsDelivered = message.DeliveredCount > 0;
            message.TotalRecipients = totalRecipients;

            if (!roomId.HasValue)
            {
                message.ReadCount = 0;
                message.DeliveredCount = 0;
            }

            if (message.IsDeleted)
                message.Reactions = new List<ReactionDTO>();
        }

        return new MessagePage(messages, hasMore);
    }

    public async Task<List<MessageDTO>?> SearchAsync(string userId, string term, string? recipientId, int? roomId)
    {
        term = term.Trim();
        if (term.Length == 0)
            return new List<MessageDTO>();

        IQueryable<Message> query;

        if (roomId.HasValue)
        {
            var isMember = await _context.RoomMembers
                .AnyAsync(rm => rm.RoomId == roomId.Value && rm.UserId == userId);

            if (!isMember)
                return null;

            query = _context.Messages.Where(m => m.RoomId == roomId.Value);
        }
        else if (!string.IsNullOrEmpty(recipientId))
        {
            query = DirectConversation(userId, recipientId);
        }
        else
        {
            return null;
        }

        var pattern = $"%{EscapeLikePattern(term)}%";

        var results = await query
            .AsNoTracking()
            .Where(m => !m.IsDeleted && EF.Functions.ILike(m.Content, pattern, "\\"))
            .OrderByDescending(m => m.CreatedAt)
            .Take(MaxSearchResults)
            .Select(m => new MessageDTO
            {
                Id = m.Id,
                Content = m.Content,
                CreatedAt = m.CreatedAt,
                SenderId = m.SenderId,
                RecipientId = m.RecipientId,
                RoomId = m.RoomId
            })
            .ToListAsync();

        results.Reverse();
        return results;
    }

    public async Task<List<ConversationDTO>> GetConversationsAsync(string userId)
    {
        var partners = await _context.Messages
            .Where(m => m.RoomId == null && m.RecipientId != null &&
                (m.SenderId == userId || m.RecipientId == userId))
            .GroupBy(m => m.SenderId == userId ? m.RecipientId! : m.SenderId)
            .Select(g => new { UserId = g.Key, LastMessageAt = g.Max(m => m.CreatedAt) })
            .ToListAsync();

        var hidden = await _context.HiddenConversations
            .Where(h => h.UserId == userId)
            .Select(h => new { h.OtherUserId, h.HiddenAt })
            .ToListAsync();

        var hiddenAt = hidden
            .GroupBy(h => h.OtherUserId)
            .ToDictionary(g => g.Key, g => g.Max(h => h.HiddenAt));

        var lastById = partners
            .Where(p => p.UserId != userId)
            .Where(p => !hiddenAt.TryGetValue(p.UserId, out var at) || p.LastMessageAt > at)
            .ToDictionary(p => p.UserId, p => p.LastMessageAt);

        if (lastById.Count == 0)
            return new List<ConversationDTO>();

        var ids = lastById.Keys.ToList();

        var users = await _context.Users
            .AsNoTracking()
            .Where(u => ids.Contains(u.Id))
            .Select(u => new
            {
                u.Id,
                u.FullName,
                UserName = u.UserName!,
                u.Avatar,
                u.LastSeen,
                IsBlocked = _context.Blocks.Any(b =>
                    (b.BlockerId == userId && b.BlockedId == u.Id) ||
                    (b.BlockerId == u.Id && b.BlockedId == userId))
            })
            .ToListAsync();

        return users
            .Select(u => new ConversationDTO
            {
                Id = u.Id,
                FullName = u.FullName,
                UserName = u.UserName,
                Avatar = u.Avatar,
                LastSeen = u.IsBlocked ? null : (DateTime?)u.LastSeen,
                LastMessageAt = lastById[u.Id]
            })
            .OrderByDescending(c => c.LastMessageAt)
            .ToList();
    }

    public async Task<List<string>?> SoftDeleteAsync(int messageId, string userId)
    {
        var message = await _context.Messages.FirstOrDefaultAsync(m => m.Id == messageId);

        if (message == null || message.SenderId != userId)
            return null;

        if (!message.IsDeleted)
        {
            message.IsDeleted = true;
            message.Content = string.Empty;
            message.AttachmentUrl = null;
            message.AttachmentType = null;

            await _context.Reactions.Where(r => r.MessageId == messageId).ExecuteDeleteAsync();
            await _context.SaveChangesAsync();
        }

        if (message.RoomId.HasValue)
        {
            return await _context.RoomMembers
                .Where(rm => rm.RoomId == message.RoomId.Value)
                .Select(rm => rm.UserId)
                .ToListAsync();
        }

        var audience = new List<string> { message.SenderId };
        if (!string.IsNullOrEmpty(message.RecipientId))
            audience.Add(message.RecipientId);

        return audience;
    }

    private IQueryable<Message> DirectConversation(string userId, string otherId) =>
        _context.Messages.Where(m =>
            m.RoomId == null &&
            ((m.SenderId == userId && m.RecipientId == otherId) ||
             (m.SenderId == otherId && m.RecipientId == userId)) &&
            !_context.HiddenConversations.Any(h =>
                h.UserId == userId && h.OtherUserId == otherId && m.CreatedAt <= h.HiddenAt));

    private static string EscapeLikePattern(string value) =>
        value.Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_");
}