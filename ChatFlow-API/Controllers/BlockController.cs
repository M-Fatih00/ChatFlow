using System.Security.Claims;
using ChatFlow.API.Data;
using ChatFlow.API.Hubs;
using ChatFlow.API.Models.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace ChatFlow.API.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class BlockController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IHubContext<ChatHub> _hubContext;

    public BlockController(AppDbContext context, IHubContext<ChatHub> hubContext)
    {
        _context = context;
        _hubContext = hubContext;
    }

    // Bir kullanıcıyı engelle
    [HttpPost("{userId}")]
    public async Task<IActionResult> Block(string userId)
    {
        var myId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value!;

        if (myId == userId)
            return BadRequest(new { message = "Kendinizi engelleyemezsiniz." });

        var already = await _context.Blocks
            .AnyAsync(b => b.BlockerId == myId && b.BlockedId == userId);

        if (already)
            return BadRequest(new { message = "Bu kullanıcı zaten engelli." });

        _context.Blocks.Add(new Block
        {
            BlockerId = myId,
            BlockedId = userId,
            CreatedAt = DateTime.UtcNow
        });
        await _context.SaveChangesAsync();

        // Engellenince varsa arkadaşlığı da sil
        var friendship = await _context.Friendships.FirstOrDefaultAsync(f =>
            (f.RequesterId == myId && f.AddresseeId == userId) ||
            (f.RequesterId == userId && f.AddresseeId == myId));

        if (friendship != null)
        {
            _context.Friendships.Remove(friendship);
            await _context.SaveChangesAsync();
        }

        // Engellenen kişiye anlık bildir
        await _hubContext.Clients.User(userId).SendAsync("BlockStatusChanged", myId);

        return Ok();
    }

    // Engeli kaldır
    [HttpDelete("{userId}")]
    public async Task<IActionResult> Unblock(string userId)
    {
        var myId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value!;

        var block = await _context.Blocks
            .FirstOrDefaultAsync(b => b.BlockerId == myId && b.BlockedId == userId);

        if (block == null)
            return NotFound();

        _context.Blocks.Remove(block);
        await _context.SaveChangesAsync();

        await _hubContext.Clients.User(userId).SendAsync("BlockStatusChanged", myId);

        return NoContent();
    }

    // Benim engellediklerim (id listesi)
    [HttpGet]
    public async Task<IActionResult> GetBlocked()
    {
        var myId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value!;

        // Hem benim engellediklerim hem beni engelleyenler
        var blockedIds = await _context.Blocks
            .Where(b => b.BlockerId == myId || b.BlockedId == myId)
            .Select(b => b.BlockerId == myId ? b.BlockedId : b.BlockerId)
            .Distinct()
            .ToListAsync();

        return Ok(blockedIds);
    }

    // Bu kişiyle aramda engel durumu (iki yönlü)
    [HttpGet("status/{userId}")]
    public async Task<IActionResult> GetStatus(string userId)
    {
        var myId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value!;

        var iBlocked = await _context.Blocks
            .AnyAsync(b => b.BlockerId == myId && b.BlockedId == userId);

        var blockedByThem = await _context.Blocks
            .AnyAsync(b => b.BlockerId == userId && b.BlockedId == myId);

        return Ok(new
        {
            iBlocked,          // ben onu engelledim
            blockedByThem,     // o beni engelledi
            isBlocked = iBlocked || blockedByThem  // herhangi bir yönde engel var mı
        });
    }

    // Benim engellediğim kullanıcıların detayı (liste ekranı için)
    [HttpGet("list")]
    public async Task<IActionResult> GetBlockedUsers()
    {
        var myId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value!;

        var users = await _context.Blocks
            .Where(b => b.BlockerId == myId)
            .Select(b => new
            {
                id = b.Blocked.Id,
                fullName = b.Blocked.FullName,
                userName = b.Blocked.UserName,
                avatar = b.Blocked.Avatar
            })
            .ToListAsync();

        return Ok(users);
    }
}