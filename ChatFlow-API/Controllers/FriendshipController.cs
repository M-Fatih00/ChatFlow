using System.Security.Claims;
using ChatFlow.API.Data;
using ChatFlow.API.Hubs;
using ChatFlow.API.Models.Entities;
using ChatFlow.API.Models.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace ChatFlow.API.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class FriendshipController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IHubContext<ChatHub> _hubContext;

    public FriendshipController(AppDbContext context, IHubContext<ChatHub> hubContext)
    {
        _context = context;
        _hubContext = hubContext;
    }

    // Arkadaşlık isteği gönder
    [HttpPost("request/{userId}")]
    public async Task<IActionResult> SendRequest(string userId)
    {
        var myId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value!;

        if (myId == userId)
            return BadRequest(new { message = "Kendinize istek gönderemezsiniz." });

        // Aralarında engel varsa istek gönderilemez
        var blocked = await _context.Blocks.AnyAsync(b =>
            (b.BlockerId == myId && b.BlockedId == userId) ||
            (b.BlockerId == userId && b.BlockedId == myId));

        if (blocked)
            return BadRequest(new { message = "Bu kullanıcıyla arkadaş olamazsınız." });

        // İki yönde de mevcut bir ilişki var mı?
        var existing = await _context.Friendships.FirstOrDefaultAsync(f =>
            (f.RequesterId == myId && f.AddresseeId == userId) ||
            (f.RequesterId == userId && f.AddresseeId == myId));

        if (existing != null)
        {
            if (existing.Status == FriendshipStatus.Accepted)
                return BadRequest(new { message = "Zaten arkadaşsınız." });
            return BadRequest(new { message = "Zaten bekleyen bir istek var." });
        }

        _context.Friendships.Add(new Friendship
        {
            RequesterId = myId,
            AddresseeId = userId,
            Status = FriendshipStatus.Pending,
            CreatedAt = DateTime.UtcNow
        });
        await _context.SaveChangesAsync();

        // İstek alan kişiye anlık bildir
        await _hubContext.Clients.User(userId).SendAsync("FriendRequestReceived");

        return Ok();
    }

    // Gelen isteği kabul et
    [HttpPost("accept/{userId}")]
    public async Task<IActionResult> Accept(string userId)
    {
        var myId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value!;

        var blocked = await _context.Blocks.AnyAsync(b =>
    (b.BlockerId == myId && b.BlockedId == userId) ||
    (b.BlockerId == userId && b.BlockedId == myId));

        if (blocked)
            return BadRequest(new { message = "Bu kullanıcıyla arkadaş olamazsınız." });

        // userId bana istek göndermiş olmalı
        var request = await _context.Friendships.FirstOrDefaultAsync(f =>
            f.RequesterId == userId &&
            f.AddresseeId == myId &&
            f.Status == FriendshipStatus.Pending);

        if (request == null)
            return NotFound(new { message = "İstek bulunamadı." });

        request.Status = FriendshipStatus.Accepted;
        await _context.SaveChangesAsync();

        // İsteği gönderen kişiye "kabul edildi" bildir
        await _hubContext.Clients.User(userId).SendAsync("FriendRequestAccepted");

        return Ok();
    }

    // Gelen isteği reddet (kaydı sil)
    [HttpDelete("reject/{userId}")]
    public async Task<IActionResult> Reject(string userId)
    {
        var myId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value!;

        var request = await _context.Friendships.FirstOrDefaultAsync(f =>
            f.RequesterId == userId &&
            f.AddresseeId == myId &&
            f.Status == FriendshipStatus.Pending);

        if (request == null)
            return NotFound(new { message = "İstek bulunamadı." });

        _context.Friendships.Remove(request);
        await _context.SaveChangesAsync();

        // İsteği gönderen kişiye "durum değişti" bildir (gönderildi butonu sıfırlansın)
        await _hubContext.Clients.User(userId).SendAsync("FriendRequestAccepted");

        return NoContent();
    }

    // Arkadaşlıktan çıkar (iki yönde de olabilir)
    [HttpDelete("remove/{userId}")]
    public async Task<IActionResult> Remove(string userId)
    {
        var myId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value!;

        var friendship = await _context.Friendships.FirstOrDefaultAsync(f =>
            ((f.RequesterId == myId && f.AddresseeId == userId) ||
             (f.RequesterId == userId && f.AddresseeId == myId)) &&
            f.Status == FriendshipStatus.Accepted);

        if (friendship == null)
            return NotFound(new { message = "Arkadaşlık bulunamadı." });

        _context.Friendships.Remove(friendship);
        await _context.SaveChangesAsync();

        // Karşı tarafa anlık bildir (listesinden gitsin)
        await _hubContext.Clients.User(userId).SendAsync("FriendRemoved");

        return NoContent();
    }

    // Arkadaşlarım (kabul edilmiş)
    [HttpGet("friends")]
    public async Task<IActionResult> GetFriends()
    {
        var myId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value!;

        var friends = await _context.Friendships
            .Where(f => f.Status == FriendshipStatus.Accepted &&
                (f.RequesterId == myId || f.AddresseeId == myId))
            .Select(f => f.RequesterId == myId ? f.Addressee : f.Requester)
            .Select(u => new
            {
                id = u.Id,
                fullName = u.FullName,
                userName = u.UserName,
                avatar = u.Avatar,
                bio = u.Bio
            })
            .ToListAsync();

        return Ok(friends);
    }

    // Bana gelen bekleyen istekler
    [HttpGet("requests")]
    public async Task<IActionResult> GetRequests()
    {
        var myId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value!;

        var requests = await _context.Friendships
            .Where(f => f.AddresseeId == myId && f.Status == FriendshipStatus.Pending)
            .Select(f => new
            {
                id = f.Requester.Id,
                fullName = f.Requester.FullName,
                userName = f.Requester.UserName,
                avatar = f.Requester.Avatar
            })
            .ToListAsync();

        return Ok(requests);
    }

    // Bu kişiyle durumum
    [HttpGet("status/{userId}")]
    public async Task<IActionResult> GetStatus(string userId)
    {
        var myId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value!;

        var friendship = await _context.Friendships.FirstOrDefaultAsync(f =>
            (f.RequesterId == myId && f.AddresseeId == userId) ||
            (f.RequesterId == userId && f.AddresseeId == myId));

        // none | friends | request_sent | request_received
        string status = "none";
        if (friendship != null)
        {
            if (friendship.Status == FriendshipStatus.Accepted)
                status = "friends";
            else if (friendship.RequesterId == myId)
                status = "request_sent";
            else
                status = "request_received";
        }

        return Ok(new { status });
    }

    // Gönderdiğim bekleyen isteklerin id'leri
    [HttpGet("sent")]
    public async Task<IActionResult> GetSent()
    {
        var myId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value!;

        var sentIds = await _context.Friendships
            .Where(f => f.RequesterId == myId && f.Status == FriendshipStatus.Pending)
            .Select(f => f.AddresseeId)
            .ToListAsync();

        return Ok(sentIds);
    }


    // Gönderdiğim isteği iptal et
    [HttpDelete("cancel/{userId}")]
    public async Task<IActionResult> Cancel(string userId)
    {
        var myId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value!;

        var request = await _context.Friendships.FirstOrDefaultAsync(f =>
            f.RequesterId == myId &&
            f.AddresseeId == userId &&
            f.Status == FriendshipStatus.Pending);

        if (request == null)
            return NotFound(new { message = "İstek bulunamadı." });

        _context.Friendships.Remove(request);
        await _context.SaveChangesAsync();

        // İstek gönderilen kişiye anlık bildir (badge güncellensin)
        await _hubContext.Clients.User(userId).SendAsync("FriendRequestReceived");

        return NoContent();
    }
}