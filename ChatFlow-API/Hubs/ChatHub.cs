using ChatFlow.API.Data;
using ChatFlow.API.Models.Entities;
using ChatFlow.API.Models.Enums;
using ChatFlow.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace ChatFlow.API.Hubs;

[Authorize]
public class ChatHub : Hub
{
    private readonly UserManager<User> _userManager;
    private readonly AppDbContext _context;
    private readonly IMessageService _messageService;
    public ChatHub(UserManager<User> userManager, AppDbContext context, IMessageService messageService)
    {
        _userManager = userManager;
        _context = context;
        _messageService = messageService;
    }

    public async Task SendMessage(string content, string? recipientId, int? roomId, string? attachmentUrl, string? attachmentType)
    {
        try
        {
            var senderId = Context.UserIdentifier!;

            if (roomId.HasValue)
            {
                var isMember = await _context.RoomMembers
                    .AnyAsync(rm => rm.RoomId == roomId && rm.UserId == senderId);

                if (!isMember) return;
            }
            else if (recipientId != null)
            {
                // Bireysel: iki taraftan biri diğerini engellediyse mesaj gitmesin
                var blocked = await _context.Blocks.AnyAsync(b =>
                    (b.BlockerId == senderId && b.BlockedId == recipientId) ||
                    (b.BlockerId == recipientId && b.BlockedId == senderId));

                if (blocked)
                {
                    await Clients.Caller.SendAsync("MessageBlocked", recipientId);
                    return;
                }

            }

            var message = await _messageService.SaveMessageAsync(senderId, content, recipientId, roomId, attachmentUrl, attachmentType);

            if (roomId.HasValue)
            {
                await Clients.Group($"room_{roomId}").SendAsync("ReceiveMessage", message);
            }
            else
            {
                await Clients.User(recipientId!).SendAsync("ReceiveMessage", message);
                await Clients.Caller.SendAsync("ReceiveMessage", message);
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"SendMessage hatası: {ex.Message}");
            throw;
        }
    }


    public async Task GetOnlineUsers()
    {
        var onlineUsers = await _userManager.Users
            .Where(u => u.IsOnline)
            .Select(u => u.Id)
            .ToListAsync();

        await Clients.Caller.SendAsync("OnlineUsersList", onlineUsers);
    }


    public override async Task OnConnectedAsync()
    {
        var userId = Context.UserIdentifier;
        var user = await _userManager.FindByIdAsync(userId!);

        if (user == null) return;

        user.IsOnline = true;
        await _userManager.UpdateAsync(user);
        await Clients.Others.SendAsync("UserOnline", user.Id);

        // Üye olduğu tüm gruplara otomatik katıl (arka planda mesaj alabilsin)
        var roomIds = await _context.RoomMembers
            .Where(rm => rm.UserId == userId)
            .Select(rm => rm.RoomId)
            .ToListAsync();

        foreach (var roomId in roomIds)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"room_{roomId}");
        }

        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var userId = Context.UserIdentifier;
        var user = await _userManager.FindByIdAsync(userId!);

        if (user == null) return;

        user.IsOnline = false;
        user.LastSeen = DateTime.UtcNow;

        await _userManager.UpdateAsync(user);
        await Clients.Others.SendAsync("UserOffline", user.Id);

        await base.OnDisconnectedAsync(exception);
    }



    public async Task JoinRoom(int roomId)
    {
        var userId = Context.UserIdentifier!;

        var isMember = await _context.RoomMembers
            .AnyAsync(rm => rm.RoomId == roomId && rm.UserId == userId);

        if (!isMember) return; // üye değilse gruba eklenemez

        await Groups.AddToGroupAsync(Context.ConnectionId, $"room_{roomId}");
    }


    public async Task LeaveRoom(int roomId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"room_{roomId}");
    }


    public async Task StartTyping(string? recipientId, int? roomId)
    {
        if (roomId.HasValue)
        {
            await Clients.Group($"room_{roomId}").SendAsync("UserTyping", Context.UserIdentifier, roomId);
        }
        else if (recipientId != null)
        {
            var senderId = Context.UserIdentifier!;
            var blocked = await _context.Blocks.AnyAsync(b =>
                (b.BlockerId == senderId && b.BlockedId == recipientId) ||
                (b.BlockerId == recipientId && b.BlockedId == senderId));

            if (blocked) return;

            await Clients.User(recipientId).SendAsync("UserTyping", Context.UserIdentifier, (int?)null);
        }
    }


    public async Task StopTyping(string? recipientId, int? roomId)
    {
        if (roomId.HasValue)
        {
            await Clients.Group($"room_{roomId}").SendAsync("UserStoppedTyping", Context.UserIdentifier, roomId);
        }
        else
        {
            await Clients.User(recipientId!).SendAsync("UserStoppedTyping", Context.UserIdentifier, (int?)null);
        }
    }


    public async Task MarkAsRead(int messageId, string senderId)
    {
        var userId = Context.UserIdentifier!;

        var exists = await _context.MessageStatuses
            .AnyAsync(ms => ms.MessageId == messageId
                && ms.UserId == userId
                && ms.MessageStatusType == MessageStatusType.Read);

        if (exists) return;

        try
        {
            var status = new MessageStatus
            {
                MessageId = messageId,
                UserId = userId,
                MessageStatusType = MessageStatusType.Read,
                UpdateAt = DateTime.UtcNow
            };

            _context.MessageStatuses.Add(status);
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            // Aynı kayıt paralel eklendiyse (UNIQUE) yok say
            _context.ChangeTracker.Clear();
        }

        var message = await _context.Messages.FindAsync(messageId);
        if (message == null) return;

        if (message.RoomId.HasValue)
        {
            var readCount = await _context.MessageStatuses
                .CountAsync(ms => ms.MessageId == messageId
                    && ms.MessageStatusType == MessageStatusType.Read);

            var totalRecipients = await _context.RoomMembers
                .CountAsync(rm => rm.RoomId == message.RoomId) - 1;

            await Clients.User(senderId).SendAsync("GroupMessageStatus", new
            {
                messageId,
                readCount,
                totalRecipients,
            });
        }
        else
        {
            await Clients.User(senderId).SendAsync("MessageRead", messageId);
        }
    }

    public async Task MarkAsDelivered(int messageId, string senderId)
    {
        var userId = Context.UserIdentifier!;

        // Zaten delivered kaydı varsa tekrar ekleme
        var exists = await _context.MessageStatuses
            .AnyAsync(ms => ms.MessageId == messageId && ms.UserId == userId
                && ms.MessageStatusType == MessageStatusType.Delivered);

        if (exists) return;

        try
        {
            var status = new MessageStatus
            {
                MessageId = messageId,
                UserId = userId,
                MessageStatusType = MessageStatusType.Delivered,
                UpdateAt = DateTime.UtcNow
            };

            _context.MessageStatuses.Add(status);
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            _context.ChangeTracker.Clear();
        }

        var message = await _context.Messages.FindAsync(messageId);
        if (message == null) return;

        if (message.RoomId.HasValue)
        {
            var deliveredCount = await _context.MessageStatuses
                .CountAsync(ms => ms.MessageId == messageId
                    && ms.MessageStatusType == MessageStatusType.Delivered);

            var totalRecipients = await _context.RoomMembers
                .CountAsync(rm => rm.RoomId == message.RoomId) - 1;

            await Clients.User(senderId).SendAsync("GroupMessageStatus", new
            {
                messageId,
                deliveredCount,
                totalRecipients,
            });
        }
        else
        {
            await Clients.User(senderId).SendAsync("MessageDelivered", messageId);
        }
    }

    public async Task MarkAllAsDelivered()
    {
        var userId = Context.UserIdentifier!;

        // 1) Bireysel: bana gelen, henüz delivered olmayan mesajlar
        var directMessages = await _context.Messages
            .Where(m => m.RecipientId == userId)
            .Where(m => !_context.MessageStatuses.Any(ms =>
                ms.MessageId == m.Id &&
                ms.UserId == userId &&
                ms.MessageStatusType == MessageStatusType.Delivered))
            .ToListAsync();

        // 2) Grup: üye olduğum gruplardaki, başkasının gönderdiği,
        //    henüz delivered olmayan mesajlar
        var myRoomIds = await _context.RoomMembers
            .Where(rm => rm.UserId == userId)
            .Select(rm => rm.RoomId)
            .ToListAsync();

        var groupMessages = await _context.Messages
            .Where(m => m.RoomId != null
                && myRoomIds.Contains(m.RoomId.Value)
                && m.SenderId != userId
                && !m.IsDeleted)
            .Where(m => !_context.MessageStatuses.Any(ms =>
                ms.MessageId == m.Id &&
                ms.UserId == userId &&
                ms.MessageStatusType == MessageStatusType.Delivered))
            .ToListAsync();

        var allMessages = directMessages.Concat(groupMessages).ToList();

        foreach (var message in allMessages)
        {
            _context.MessageStatuses.Add(new MessageStatus
            {
                MessageId = message.Id,
                UserId = userId,
                MessageStatusType = MessageStatusType.Delivered,
                UpdateAt = DateTime.UtcNow
            });
        }

        await _context.SaveChangesAsync();

        // Gönderenlere haber ver
        foreach (var message in allMessages)
        {
            if (message.RoomId.HasValue)
            {
                var deliveredCount = await _context.MessageStatuses
                    .CountAsync(ms => ms.MessageId == message.Id
                        && ms.MessageStatusType == MessageStatusType.Delivered);

                var totalRecipients = await _context.RoomMembers
                    .CountAsync(rm => rm.RoomId == message.RoomId) - 1;

                await Clients.User(message.SenderId).SendAsync("GroupMessageStatus", new
                {
                    messageId = message.Id,
                    deliveredCount,
                    totalRecipients,
                });
            }
            else
            {
                await Clients.User(message.SenderId).SendAsync("MessageDelivered", message.Id);
            }
        }
    }


    public async Task DeleteMessage(int messageId)
    {
        var userId = Context.UserIdentifier!;

        var message = await _context.Messages.FindAsync(messageId);
        if (message == null) return;

        // Sadece kendi mesajını silebilir
        if (message.SenderId != userId) return;

        message.IsDeleted = true;
        await _context.SaveChangesAsync();

        // İlgili taraflara haber ver
        if (message.RoomId.HasValue)
        {
            await Clients.Group($"room_{message.RoomId}").SendAsync("MessageDeleted", messageId);
        }
        else
        {
            await Clients.User(message.RecipientId!).SendAsync("MessageDeleted", messageId);
            await Clients.Caller.SendAsync("MessageDeleted", messageId);
        }
    }


    public async Task ToggleReaction(int messageId, string emoji)
    {
        var userId = Context.UserIdentifier!;

        var message = await _context.Messages.FindAsync(messageId);
        if (message == null) return;

        var existing = await _context.Reactions
            .FirstOrDefaultAsync(r => r.MessageId == messageId && r.UserId == userId);

        if (existing != null)
            _context.Reactions.Remove(existing);

        if (existing == null || existing.Emoji != emoji)
        {
            _context.Reactions.Add(new Reaction
            {
                MessageId = messageId,
                UserId = userId,
                Emoji = emoji,
                CreatedAt = DateTime.UtcNow
            });
        }

        await _context.SaveChangesAsync();

        var reactions = await _context.Reactions
            .Where(r => r.MessageId == messageId)
            .Select(r => new { r.UserId, r.Emoji })
            .ToListAsync();

        if (message.RoomId.HasValue)
        {
            var isMember = await _context.RoomMembers
                .AnyAsync(rm => rm.RoomId == message.RoomId && rm.UserId == userId);
            if (!isMember) return;

            await Clients.Group($"room_{message.RoomId}").SendAsync("ReactionUpdated", messageId, reactions);
        }
        else
        {
            await Clients.User(message.SenderId).SendAsync("ReactionUpdated", messageId, reactions);
            await Clients.User(message.RecipientId!).SendAsync("ReactionUpdated", messageId, reactions);
        }
    }

}