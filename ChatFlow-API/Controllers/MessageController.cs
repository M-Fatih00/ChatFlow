using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using ChatFlow.API.Data;
using ChatFlow.API.Hubs;
using ChatFlow.API.Models.Entities;
using ChatFlow.API.Models.Enums;
using ChatFlow.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace ChatFlow.API.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class MessageController : ControllerBase
{
    private const int PageSize = 20;

    private readonly AppDbContext _context;
    private readonly IMessageService _messageService;
    private readonly CloudinaryService _cloudinaryService;
    private readonly IHubContext<ChatHub> _hubContext;

    public MessageController(
        AppDbContext context,
        IMessageService messageService,
        CloudinaryService cloudinaryService,
        IHubContext<ChatHub> hubContext)
    {
        _context = context;
        _messageService = messageService;
        _cloudinaryService = cloudinaryService;
        _hubContext = hubContext;
    }

    [HttpGet]
    public async Task<IActionResult> GetMessages(
        [FromQuery, StringLength(64)] string? recipientId,
        [FromQuery] int? roomId,
        [FromQuery, Range(0, 100_000)] int skip = 0)
    {
        if (roomId.HasValue == !string.IsNullOrEmpty(recipientId))
            return BadRequest(new { message = "Sohbet bilgisi geçersiz." });

        var page = await _messageService.GetMessagesAsync(GetUserId(), recipientId, roomId, skip, PageSize);
        if (page == null)
            return Forbid();

        return Ok(new { messages = page.Messages, hasMore = page.HasMore });
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeleteMessage(int id)
    {
        var audience = await _messageService.SoftDeleteAsync(id, GetUserId());
        if (audience == null)
            return Forbid();

        await _hubContext.Clients.Users(audience).SendAsync("MessageDeleted", id);
        return NoContent();
    }

    [HttpGet("search")]
    public async Task<IActionResult> SearchMessage(
        [FromQuery, StringLength(100)] string? q,
        [FromQuery, StringLength(64)] string? recipientId,
        [FromQuery] int? roomId)
    {
        if (string.IsNullOrWhiteSpace(q))
            return Ok(Array.Empty<object>());

        var results = await _messageService.SearchAsync(GetUserId(), q, recipientId, roomId);
        if (results == null)
            return Forbid();

        return Ok(results);
    }

    [HttpPost("upload")]
    [EnableRateLimiting("upload")]
    [RequestSizeLimit(CloudinaryService.MaxAttachmentBytes + 1024 * 1024)]
    public async Task<IActionResult> UploadAttachment(IFormFile? file)
    {
        var (error, isImage) = await CloudinaryService.ValidateAttachmentAsync(file);
        if (error != null)
            return BadRequest(new { message = error });

        var url = isImage
            ? await _cloudinaryService.UploadImageAsync(file!, "attachments")
            : await _cloudinaryService.UploadRawAsync(file!, "attachments");

        if (url == null)
            return BadRequest(new { message = "Dosya yüklenemedi." });

        return Ok(new
        {
            url,
            type = isImage ? "image" : "file",
            name = CloudinaryService.SafeFileName(file!.FileName)
        });
    }

    [HttpGet("{id:int}/statuses")]
    public async Task<IActionResult> GetMessageStatuses(int id)
    {
        var userId = GetUserId();

        var message = await _context.Messages
            .AsNoTracking()
            .Where(m => m.Id == id)
            .Select(m => new { m.SenderId, m.RoomId })
            .FirstOrDefaultAsync();

        if (message == null || message.SenderId != userId || !message.RoomId.HasValue)
            return Forbid();

        var members = await _context.RoomMembers
            .Where(rm => rm.RoomId == message.RoomId && rm.UserId != userId)
            .Select(rm => new
            {
                userId = rm.UserId,
                fullName = rm.User.FullName,
                avatar = rm.User.Avatar,
                isRead = _context.MessageStatuses.Any(ms =>
                    ms.MessageId == id && ms.UserId == rm.UserId && ms.MessageStatusType == MessageStatusType.Read),
                isDelivered = _context.MessageStatuses.Any(ms =>
                    ms.MessageId == id && ms.UserId == rm.UserId && ms.MessageStatusType == MessageStatusType.Delivered)
            })
            .ToListAsync();

        return Ok(members);
    }

    [HttpGet("conversations")]
    public async Task<IActionResult> GetConversations()
    {
        return Ok(await _messageService.GetConversationsAsync(GetUserId()));
    }

    [HttpDelete("conversation/{otherUserId}")]
    public async Task<IActionResult> HideConversation([StringLength(64)] string otherUserId)
    {
        var myId = GetUserId();

        var hidden = await _context.HiddenConversations
            .FirstOrDefaultAsync(h => h.UserId == myId && h.OtherUserId == otherUserId);

        if (hidden == null)
        {
            _context.HiddenConversations.Add(new HiddenConversation
            {
                UserId = myId,
                OtherUserId = otherUserId,
                HiddenAt = DateTime.UtcNow
            });
        }
        else
        {
            hidden.HiddenAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();
        return NoContent();
    }

    private string GetUserId() =>
        User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? throw new InvalidOperationException("Kullanıcı kimliği bulunamadı.");
}