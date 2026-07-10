using ChatFlow.API.Data;
using ChatFlow.API.Models.DTOs;
using ChatFlow.API.Models.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using Microsoft.AspNetCore.SignalR;
using ChatFlow.API.Hubs;
using ChatFlow.API.Services;


namespace ChatFlow.API.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public class RoomController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly UserManager<User> _userManager;
    private readonly IHubContext<ChatHub> _hubContext;
    private readonly IWebHostEnvironment _env;
    private readonly CloudinaryService _cloudinaryService;

    public RoomController(AppDbContext context, UserManager<User> userManager, IHubContext<ChatHub> hubContext, IWebHostEnvironment env, CloudinaryService cloudinaryService)
    {
        _context = context;
        _userManager = userManager;
        _hubContext = hubContext;
        _env = env;
        _cloudinaryService = cloudinaryService;
    }


    [HttpGet]
    public async Task<IActionResult> GetRooms()
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value!;

        var rooms = await _context.RoomMembers
            .Where(rm => rm.UserId == userId)
            .Select(rm => new RoomDTO
            {
                Id = rm.Room.Id,
                Name = rm.Room.Name,
                CreatedAt = rm.Room.CreatedAt,
                CreatedBy = rm.Room.CreatedBy,
                Avatar = rm.Room.Avatar,
                Description = rm.Room.Description
            })
            .ToListAsync();

        return Ok(rooms);
    }


    [HttpGet("{id}")]
    public async Task<IActionResult> GetRoom(int id)
    {
        var room = await _context.Rooms.FindAsync(id);

        if (room == null)
            return NotFound("Oda bulunamadı.");

        var result = new RoomDTO
        {
            Id = room.Id,
            Name = room.Name,
            CreatedAt = room.CreatedAt,
            CreatedBy = room.CreatedBy,
            Avatar = room.Avatar,
            Description = room.Description
        };

        return Ok(result);
    }


    [HttpPost]
    public async Task<IActionResult> CreateRoom(CreateRoomDTO dto)
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value!;

        var room = new Room
        {
            Name = dto.Name,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = userId
        };

        _context.Rooms.Add(room);
        await _context.SaveChangesAsync();

        var memberIds = new HashSet<string>(dto.MemberIds) { userId };

        foreach (var memberId in memberIds)
        {
            _context.RoomMembers.Add(new RoomMember
            {
                RoomId = room.Id,
                UserId = memberId,
                IsAdmin = memberId == userId,
                JoinedAt = DateTime.UtcNow
            });
        }

        await _context.SaveChangesAsync();

        // Üyelere "yeni gruba eklendin" bildirimi gönder (grubu kuran hariç)
        foreach (var memberId in memberIds)
        {
            if (memberId == userId) continue; // grubu kuran hariç
            await _hubContext.Clients.User(memberId).SendAsync("AddedToRoom", room.Id);
        }

        return Ok(new RoomDTO
        {
            Id = room.Id,
            Name = room.Name,
            CreatedAt = room.CreatedAt
        });
    }


    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteRoom(int id)
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value!;

        var room = await _context.Rooms.FindAsync(id);

        if (room == null)
            return NotFound("Silmek istediğiniz oda bulunamadı.");

        if (room.CreatedBy != userId)
            return Forbid();

        // Üyelere bildirim yollamak için listeyi önce alalım
        var memberIds = await _context.RoomMembers
            .Where(rm => rm.RoomId == id)
            .Select(rm => rm.UserId)
            .ToListAsync();

        // Bağlı kayıtları önce sil (foreign key engelini aşmak için)
        var roomMessages = await _context.Messages
            .Where(m => m.RoomId == id)
            .ToListAsync();
        var messageIds = roomMessages.Select(m => m.Id).ToList();

        var statuses = await _context.MessageStatuses
            .Where(ms => messageIds.Contains(ms.MessageId))
            .ToListAsync();
        _context.MessageStatuses.RemoveRange(statuses);

        _context.Messages.RemoveRange(roomMessages);

        var roomMembers = await _context.RoomMembers
            .Where(rm => rm.RoomId == id)
            .ToListAsync();
        _context.RoomMembers.RemoveRange(roomMembers);

        await _context.SaveChangesAsync();

        _context.Rooms.Remove(room);
        await _context.SaveChangesAsync();

        foreach (var memberId in memberIds)
        {
            await _hubContext.Clients.User(memberId).SendAsync("RemovedFromRoom", id);
        }

        return NoContent();
    }



    [HttpGet("{id}/members")]
    public async Task<IActionResult> GetMembers(int id)
    {
        var members = await _context.RoomMembers
            .Where(rm => rm.RoomId == id)
            .Select(rm => new RoomMemberDTO
            {
                UserId = rm.UserId,
                FullName = rm.User.FullName,
                Avatar = rm.User.Avatar,
                IsAdmin = rm.IsAdmin
            })
            .ToListAsync();

        return Ok(members);
    }


    [HttpPost("{id}/members")]
    public async Task<IActionResult> AddMember(int id, [FromBody] AddMemberDTO dto)
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value!;
        var memberId = dto.MemberId;

        var isMember = await _context.RoomMembers
            .AnyAsync(rm => rm.RoomId == id && rm.UserId == userId);

        if (!isMember)
            return Forbid();

        var alreadyMember = await _context.RoomMembers
            .AnyAsync(rm => rm.RoomId == id && rm.UserId == memberId);

        if (alreadyMember)
            return BadRequest(new { message = "Kullanıcı zaten üye." });

        _context.RoomMembers.Add(new RoomMember
        {
            RoomId = id,
            UserId = memberId,
            IsAdmin = false,
            JoinedAt = DateTime.UtcNow
        });

        await _context.SaveChangesAsync();

        // Eklenen kişiye bildirim yolla
        await _hubContext.Clients.User(memberId).SendAsync("AddedToRoom", id);

        return Ok();
    }


    [HttpDelete("{id}/members/{memberId}")]
    public async Task<IActionResult> RemoveMember(int id, string memberId)
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value!;

        var room = await _context.Rooms.FindAsync(id);
        if (room == null)
            return NotFound();

        var isAdmin = await _context.RoomMembers
            .AnyAsync(rm => rm.RoomId == id && rm.UserId == userId && rm.IsAdmin);

        if (!isAdmin)
            return Forbid();

        var member = await _context.RoomMembers
            .FirstOrDefaultAsync(rm => rm.RoomId == id && rm.UserId == memberId);

        if (member == null)
            return NotFound();

        if (member.IsAdmin && room.CreatedBy != userId)
            return BadRequest(new { message = "Sadece grubun kurucusu yöneticileri çıkarabilir." });

        if (member.IsAdmin && member.UserId == room.CreatedBy)
            return BadRequest(new { message = "Grup kurucusu çıkarılamaz." });

        _context.RoomMembers.Remove(member);
        await _context.SaveChangesAsync();

        // Çıkarılan kişiye bildirim yolla
        await _hubContext.Clients.User(memberId).SendAsync("RemovedFromRoom", id);

        return NoContent();
    }


    [HttpPut("{id}/members/{memberId}/admin")]
    public async Task<IActionResult> MakeAdmin(int id, string memberId)
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value!;

        var isAdmin = await _context.RoomMembers
            .AnyAsync(rm => rm.RoomId == id && rm.UserId == userId && rm.IsAdmin);

        if (!isAdmin)
            return Forbid();

        var member = await _context.RoomMembers
            .FirstOrDefaultAsync(rm => rm.RoomId == id && rm.UserId == memberId);

        if (member == null)
            return NotFound();

        member.IsAdmin = true;
        await _context.SaveChangesAsync();

        return Ok();
    }


    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateRoom(int id, [FromBody] UpdateRoomDTO dto)
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value!;

        var room = await _context.Rooms.FindAsync(id);
        if (room == null)
            return NotFound();

        var isAdmin = await _context.RoomMembers
            .AnyAsync(rm => rm.RoomId == id && rm.UserId == userId && rm.IsAdmin);

        if (!isAdmin)
            return Forbid();

        room.Name = dto.Name;
        room.Description = dto.Description;
        await _context.SaveChangesAsync();

        // Grup üyelerine anlık bildir
        var memberIds = await _context.RoomMembers
            .Where(rm => rm.RoomId == id)
            .Select(rm => rm.UserId)
            .ToListAsync();

        foreach (var mid in memberIds)
        {
            await _hubContext.Clients.User(mid).SendAsync("RoomUpdated", new
            {
                id = room.Id,
                name = room.Name,
                description = room.Description,
                avatar = room.Avatar
            });
        }

        return Ok(new RoomDTO
        {
            Id = room.Id,
            Name = room.Name,
            CreatedAt = room.CreatedAt,
            CreatedBy = room.CreatedBy,
            Avatar = room.Avatar,
            Description = room.Description
        });
    }


    [HttpPut("{id}/avatar")]
    public async Task<IActionResult> UpdateRoomAvatar(int id, IFormFile file)
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value!;

        var room = await _context.Rooms.FindAsync(id);
        if (room == null)
            return NotFound();

        var isAdmin = await _context.RoomMembers
            .AnyAsync(rm => rm.RoomId == id && rm.UserId == userId && rm.IsAdmin);

        if (!isAdmin)
            return Forbid();

        if (file == null || file.Length == 0)
            return BadRequest(new { message = "Dosya seçilmedi." });

        if (file.Length > 2 * 1024 * 1024)
            return BadRequest(new { message = "Dosya boyutu 2MB'dan büyük olamaz." });

        var allowedTypes = new[] { "image/jpeg", "image/png", "image/webp" };
        if (!allowedTypes.Contains(file.ContentType))
            return BadRequest(new { message = "Sadece jpg, png, webp dosyaları kabul edilir." });

        var url = await _cloudinaryService.UploadImageAsync(file, "rooms");

        if (url == null)
            return BadRequest(new { message = "Fotoğraf yüklenemedi." });

        room.Avatar = url;

        await _context.SaveChangesAsync();

        var memberIds = await _context.RoomMembers
            .Where(rm => rm.RoomId == id)
            .Select(rm => rm.UserId)
            .ToListAsync();

        foreach (var mid in memberIds)
        {
            await _hubContext.Clients.User(mid).SendAsync("RoomUpdated", new
            {
                id = room.Id,
                name = room.Name,
                description = room.Description,
                avatar = room.Avatar
            });
        }

        return Ok(new { avatar = room.Avatar });
    }
}