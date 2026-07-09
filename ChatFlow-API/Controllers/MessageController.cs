using System.Security.Claims;
using ChatFlow.API.Data;
using ChatFlow.API.Models.DTOs;
using ChatFlow.API.Models.Entities;
using ChatFlow.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ChatFlow.API.Controllers;


[Authorize]
[ApiController]
[Route("api/[controller]")]
public class MessageController : ControllerBase
{
    private readonly UserManager<User> _userManager;
    private readonly AppDbContext _context;
    private readonly IMessageService _messageService;
    private readonly CloudinaryService _cloudinaryService;
    public MessageController(UserManager<User> userManager, AppDbContext context, IMessageService messageService, CloudinaryService cloudinaryService)
    {
        _userManager = userManager;
        _context = context;
        _messageService = messageService;
        _cloudinaryService = cloudinaryService;
    }


    [HttpGet]
    public async Task<IActionResult> GetMessages(
    [FromQuery] string? recipientId,
    [FromQuery] int? roomId,
    [FromQuery] int skip = 0)
    {
        var senderId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value!;

        if (roomId.HasValue)
        {
            var isMember = await _context.RoomMembers
                .AnyAsync(rm => rm.RoomId == roomId && rm.UserId == senderId);

            if (!isMember)
                return Forbid();
        }

        var (messages, hasMore) = await _messageService.GetMessagesAsync(
            senderId, recipientId, roomId, skip, take: 20);

        return Ok(new { messages, hasMore });
    }



    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteMessage(int id)
    {
        var senderId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value!;
        var message = await _context.Messages.FindAsync(id);

        if (message!.SenderId != senderId)
            return Forbid();

        _context.Messages.Remove(message);
        await _context.SaveChangesAsync();
        return NoContent();
    }


    [HttpGet("search")]
    public async Task<IActionResult> SearchMessage([FromQuery] string q, [FromQuery] string? recipientId, [FromQuery] int? roomId)
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value!;

        if (string.IsNullOrWhiteSpace(q))
            return Ok(new List<object>());

        var query = _context.Messages.Where(m => m.Content.Contains(q) && !m.IsDeleted);

        if (roomId.HasValue)
        {
            // Grup içinde ara — üyelik kontrolü
            var isMember = await _context.RoomMembers
                .AnyAsync(rm => rm.RoomId == roomId && rm.UserId == userId);

            if (!isMember)
                return Forbid();

            query = query.Where(m => m.RoomId == roomId);
        }
        else if (!string.IsNullOrEmpty(recipientId))
        {
            // Bireysel sohbette ara — sadece kendi konuşman
            query = query.Where(m =>
                (m.SenderId == userId && m.RecipientId == recipientId) ||
                (m.SenderId == recipientId && m.RecipientId == userId));
        }
        else
        {
            return Ok(new List<object>());
        }

        var messages = await query.OrderBy(m => m.CreatedAt).ToListAsync();

        var result = messages.Select(m => new MessageDTO
        {
            Id = m.Id,
            Content = m.Content,
            CreatedAt = m.CreatedAt,
            SenderId = m.SenderId,
            RecipientId = m.RecipientId,
            RoomId = m.RoomId,
        }).ToList();

        return Ok(result);
    }



    [HttpPost("upload")]
    public async Task<IActionResult> UploadAttachment(IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new { message = "Dosya seçilmedi." });

        if (file.Length > 10 * 1024 * 1024)
            return BadRequest(new { message = "Dosya boyutu 10MB'dan büyük olamaz." });

        // Resim mi, başka dosya mı?
        var isImage = file.ContentType.StartsWith("image/");
        var attachmentType = isImage ? "image" : "file";

        // Resimler image upload, diğerleri raw upload
        var url = isImage
            ? await _cloudinaryService.UploadImageAsync(file, "attachments")
            : await _cloudinaryService.UploadRawAsync(file, "attachments");

        if (url == null)
            return BadRequest(new { message = "Dosya yüklenemedi." });

        return Ok(new
        {
            url,
            type = attachmentType,
            name = file.FileName
        });
    }


    [HttpGet("{id}/statuses")]
    public async Task<IActionResult> GetMessageStatuses(int id)
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value!;

        var message = await _context.Messages.FindAsync(id);
        if (message == null)
            return NotFound();

        // Sadece mesajın sahibi görebilir + grup mesajı olmalı
        if (message.SenderId != userId || !message.RoomId.HasValue)
            return Forbid();

        // Gruptaki tüm üyeler (gönderen hariç)
        var members = await _context.RoomMembers
            .Where(rm => rm.RoomId == message.RoomId && rm.UserId != message.SenderId)
            .Select(rm => new
            {
                rm.UserId,
                rm.User.FullName,
                rm.User.Avatar,
            })
            .ToListAsync();

        // Bu mesajın statüleri
        var statuses = await _context.MessageStatuses
            .Where(ms => ms.MessageId == id)
            .ToListAsync();

        var result = members.Select(m => new
        {
            userId = m.UserId,
            fullName = m.FullName,
            avatar = m.Avatar,
            isRead = statuses.Any(s => s.UserId == m.UserId
                && s.MessageStatusType == Models.Enums.MessageStatusType.Read),
            isDelivered = statuses.Any(s => s.UserId == m.UserId
                && s.MessageStatusType == Models.Enums.MessageStatusType.Delivered),
        }).ToList();

        return Ok(result);
    }


    [HttpGet("conversations")]
    public async Task<IActionResult> GetConversations()
    {
        var myId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value!;

        // Bireysel mesajlarda karşı taraf olan kullanıcı id'leri
        var userIds = await _context.Messages
            .Where(m => m.RoomId == null &&
                (m.SenderId == myId || m.RecipientId == myId))
            .Select(m => m.SenderId == myId ? m.RecipientId! : m.SenderId)
            .Distinct()
            .ToListAsync();

        // Gizlenen sohbetleri çek
        var hiddenConvs = await _context.HiddenConversations
            .Where(h => h.UserId == myId)
            .ToListAsync();

        // Gizleme tarihi sonrasında yeni mesaj yoksa gizle, varsa listede göster
        var hiddenIds = new List<string>();
        foreach (var h in hiddenConvs)
        {
            var hasNewMsg = await _context.Messages.AnyAsync(m =>
                m.RoomId == null &&
                ((m.SenderId == myId && m.RecipientId == h.OtherUserId) ||
                 (m.SenderId == h.OtherUserId && m.RecipientId == myId)) &&
                m.CreatedAt > h.HiddenAt);

            if (!hasNewMsg)
                hiddenIds.Add(h.OtherUserId);
        }

        // Gizlenenleri hariç tutarak kullanıcı bilgilerini getir
        var users = await _context.Users
            .Where(u => userIds.Contains(u.Id) && !hiddenIds.Contains(u.Id))
            .Select(u => new
            {
                id = u.Id,
                fullName = u.FullName,
                userName = u.UserName,
                avatar = u.Avatar,
                bio = u.Bio,
                lastSeen = u.LastSeen
            })
            .ToListAsync();

        return Ok(users);
    }


    // Sohbeti benim için gizle/sil
    [HttpDelete("conversation/{otherUserId}")]
    public async Task<IActionResult> HideConversation(string otherUserId)
    {
        var myId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value!;

        // Zaten gizlenmişse tekrar ekleme
        var already = await _context.HiddenConversations
            .AnyAsync(h => h.UserId == myId && h.OtherUserId == otherUserId);

        if (!already)
        {
            _context.HiddenConversations.Add(new HiddenConversation
            {
                UserId = myId,
                OtherUserId = otherUserId,
                HiddenAt = DateTime.UtcNow
            });
            await _context.SaveChangesAsync();
        }

        return NoContent();
    }

}