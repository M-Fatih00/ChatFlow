using System.Reflection.Metadata;
using System.Security.Claims;
using ChatFlow.API.Hubs;
using ChatFlow.API.Models.DTOs;
using ChatFlow.API.Models.Entities;
using ChatFlow.API.Services;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;


namespace ChatFlow.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class UserController : ControllerBase
{
    private readonly UserManager<User> _userManager;
    private readonly IHubContext<ChatHub> _hubContext;
    private readonly CloudinaryService _cloudinaryService;

    public UserController(UserManager<User> userManager, IHubContext<ChatHub> hubContext, CloudinaryService cloudinaryService)
    {
        _userManager = userManager;
        _hubContext = hubContext;
        _cloudinaryService = cloudinaryService;
    }


    [HttpGet]
    public async Task<IActionResult> GetUsers()
    {
        var users = await _userManager.Users.Select(u => new UserDTO
        {
            Id = u.Id,
            FullName = u.FullName,
            UserName = u.UserName!,
            Email = u.Email,
            Avatar = u.Avatar,
            Bio = u.Bio,
            LastSeen = u.LastSeen,
            IsOnline = u.IsOnline
        }).ToListAsync();

        return Ok(users);
    }


    [HttpGet("{username}")]
    public async Task<IActionResult> GetUser(string username)
    {
        var user = await _userManager.FindByNameAsync(username);

        if (user == null)
            return NotFound(new { message = "Kullanıcı bulunamadı." });

        return Ok(new UserDTO
        {
            Id = user.Id,
            FullName = user.FullName,
            UserName = user.UserName!,
            Avatar = user.Avatar,
            Bio = user.Bio
        });
    }


    [HttpPut("profile")]
    public async Task<IActionResult> UpdateProfile(UpdateProfileDTO dto)
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value!;
        if (userId == null)
            return Unauthorized();

        var user = await _userManager.FindByIdAsync(userId);

        if (user == null)
            return NotFound(new { message = "Kullanıcı bulunamadı." });

        user.FullName = dto.FullName;
        user.UserName = dto.UserName;
        user.Avatar = dto.Avatar;
        user.Bio = dto.Bio;

        await _userManager.UpdateAsync(user);

        return Ok(new UserDTO
        {
            Id = user.Id,
            FullName = user.FullName,
            UserName = user.UserName!,
            Avatar = user.Avatar,
            Bio = user.Bio
        });
    }


    [HttpPut("avatar")]
    public async Task<IActionResult> UpdateAvatar(IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new { message = "Dosya seçilmedi." });

        if (file.Length > 2 * 1024 * 1024)
            return BadRequest(new { message = "Dosya boyutu 2MB'dan büyük olamaz." });

        var allowedTypes = new[] { "image/jpeg", "image/png", "image/webp" };
        if (!allowedTypes.Contains(file.ContentType))
            return BadRequest(new { message = "Sadece jpg, png, webp dosyaları kabul edilir." });

        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value!;

        var user = await _userManager.FindByIdAsync(userId);

        if (user == null)
            return NotFound();

        var url = await _cloudinaryService.UploadImageAsync(file, "avatars");
        if (url == null)
            return BadRequest(new { message = "Fotoğraf yüklenemedi." });

        user.Avatar = url;

        await _userManager.UpdateAsync(user);
        await _hubContext.Clients.All.SendAsync("AvatarUpdated", new { userId = user.Id, avatar = user.Avatar });

        return Ok(new { avatar = user.Avatar });
    }
}