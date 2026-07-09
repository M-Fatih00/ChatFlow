using ChatFlow.API.Data;
using ChatFlow.API.Models.DTOs;
using ChatFlow.API.Models.Entities;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace ChatFlow.API.Services;

public class MessageService : IMessageService
{
    private readonly AppDbContext _context;
    public MessageService(AppDbContext context)
    {
        _context = context;
    }


    // MessageService.cs - GetMessagesAsync (pagination ekli)
    public async Task<(List<MessageDTO> Messages, bool HasMore)> GetMessagesAsync(
        string senderId, string? recipientId, int? roomId, int skip = 0, int take = 10)
    {
        var query = _context.Messages.AsQueryable();

        if (roomId.HasValue)
        {
            query = query.Where(m => m.RoomId == roomId);
        }
        else
        {
            query = query.Where(m =>
                (m.SenderId == senderId && m.RecipientId == recipientId) ||
                (m.SenderId == recipientId && m.RecipientId == senderId));

            // Gizleme tarihi varsa o tarihten önceki mesajları gösterme
            var hiddenAt = await _context.HiddenConversations
                .Where(h => h.UserId == senderId && h.OtherUserId == recipientId)
                .Select(h => (DateTime?)h.HiddenAt)
                .FirstOrDefaultAsync();

            if (hiddenAt.HasValue)
                query = query.Where(m => m.CreatedAt > hiddenAt.Value);
        }

        // Toplam sayı (hasMore için)
        var totalCount = await query.CountAsync();

        // Son 10 mesaj önce azalan sırala, skip+take al, sonra artan sıraya çevir
        var messages = await query
            .OrderByDescending(m => m.CreatedAt)
            .Skip(skip)
            .Take(take)
            .OrderBy(m => m.CreatedAt)
            .ToListAsync();

        var hasMore = (skip + take) < totalCount;

        var messageIds = messages.Select(m => m.Id).ToList();
        var senderIds = messages.Select(m => m.SenderId).Distinct().ToList();

        var statuses = await _context.MessageStatuses
            .Where(ms => messageIds.Contains(ms.MessageId))
            .ToListAsync();

        var senders = await _context.Users
            .Where(u => senderIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u);

        var reactions = await _context.Reactions
            .Where(r => messageIds.Contains(r.MessageId))
            .ToListAsync();

        int totalRecipients = 0;
        if (roomId.HasValue)
        {
            totalRecipients = await _context.RoomMembers
                .CountAsync(rm => rm.RoomId == roomId) - 1;
        }

        var result = messages.Select(m => new MessageDTO
        {
            Id = m.Id,
            Content = m.Content,
            CreatedAt = m.CreatedAt,
            SenderId = m.SenderId,
            SenderName = senders.TryGetValue(m.SenderId, out var s) ? s.FullName : null,
            SenderAvatar = senders.TryGetValue(m.SenderId, out var s2) ? s2.Avatar : null,
            RecipientId = m.RecipientId,
            RoomId = m.RoomId,
            IsDelivered = statuses.Any(st => st.MessageId == m.Id
                && st.MessageStatusType == Models.Enums.MessageStatusType.Delivered),
            IsRead = statuses.Any(st => st.MessageId == m.Id
                && st.MessageStatusType == Models.Enums.MessageStatusType.Read),
            IsDeleted = m.IsDeleted,
            AttachmentUrl = m.AttachmentUrl,
            AttachmentType = m.AttachmentType,
            Reactions = reactions
                .Where(r => r.MessageId == m.Id)
                .Select(r => new ReactionDTO { UserId = r.UserId, Emoji = r.Emoji })
                .ToList(),
            ReadCount = roomId.HasValue
                ? statuses.Count(st => st.MessageId == m.Id
                    && st.MessageStatusType == Models.Enums.MessageStatusType.Read)
                : 0,
            DeliveredCount = roomId.HasValue
                ? statuses.Count(st => st.MessageId == m.Id
                    && st.MessageStatusType == Models.Enums.MessageStatusType.Delivered)
                : 0,
            TotalRecipients = totalRecipients,
        }).ToList();

        return (result, hasMore);
    }

    public Task MarkAsReadAsync(int messageId, string userId)
    {
        throw new NotImplementedException();
    }

    public async Task<MessageDTO> SaveMessageAsync(string senderId, string content, string? recipientId, int? roomId, string? attachmentUrl = null, string? attachmentType = null)
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

        var sender = await _context.Users.FindAsync(senderId);

        // Grup mesajıysa: gönderen hariç toplam alıcı sayısı (tik hesabı için)
        int totalRecipients = 0;
        if (roomId.HasValue)
        {
            totalRecipients = await _context.RoomMembers
                .CountAsync(rm => rm.RoomId == roomId) - 1;
        }

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
            IsDelivered = false,
            IsRead = false,
            IsDeleted = false,
        };
    }
}
