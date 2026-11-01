using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using ChatFlow.API.Data;
using ChatFlow.API.Hubs;
using ChatFlow.API.Models.DTOs;
using ChatFlow.API.Models.Entities;
using ChatFlow.API.Service;
using ChatFlow.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace ChatFlow.API.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class UserController : ControllerBase
{
    private const int MinSearchLength = 2;
    private const int MaxSearchResults = 20;

    private readonly UserManager<User> _userManager;
    private readonly AppDbContext _context;
    private readonly IHubContext<ChatHub> _hubContext;
    private readonly CloudinaryService _cloudinaryService;
    private readonly TokenService _tokenService;
    private readonly IConfiguration _config;

    public UserController(
        UserManager<User> userManager,
        AppDbContext context,
        IHubContext<ChatHub> hubContext,
        CloudinaryService cloudinaryService,
        TokenService tokenService,
        IConfiguration config)
    {
        _userManager = userManager;
        _context = context;
        _hubContext = hubContext;
        _cloudinaryService = cloudinaryService;
        _tokenService = tokenService;
        _config = config;
    }

    [HttpGet]
    public async Task<IActionResult> SearchUsers([FromQuery, StringLength(50)] string? q)
    {
        var term = q?.Trim() ?? string.Empty;
        if (term.Length < MinSearchLength)
            return Ok(new List<UserSummaryDTO>());

        var myId = GetUserId();
        var blockedIds = await GetBlockedEitherWayIdsAsync(myId);
        var pattern = $"%{EscapeLikePattern(term)}%";

        var users = await _context.Users
            .AsNoTracking()
            .Where(u => u.Id != myId && !blockedIds.Contains(u.Id))
            .Where(u =>
                EF.Functions.ILike(u.UserName!, pattern, "\\") ||
                EF.Functions.ILike(u.FullName, pattern, "\\"))
            .OrderBy(u => u.FullName)
            .Take(MaxSearchResults)
            .Select(u => new UserSummaryDTO
            {
                Id = u.Id,
                FullName = u.FullName,
                UserName = u.UserName!,
                Avatar = u.Avatar,
                Bio = u.Bio
            })
            .ToListAsync();

        return Ok(users);
    }

    [HttpGet("{username}")]
    public async Task<IActionResult> GetUser([StringLength(64)] string username)
    {
        var myId = GetUserId();
        var user = await _userManager.FindByNameAsync(username);

        if (user == null)
            return NotFound(new { message = "Kullanıcı bulunamadı." });

        if (user.Id != myId)
        {
            var blockedIds = await GetBlockedEitherWayIdsAsync(myId);
            if (blockedIds.Contains(user.Id))
                return NotFound(new { message = "Kullanıcı bulunamadı." });
        }

        return Ok(new UserSummaryDTO
        {
            Id = user.Id,
            FullName = user.FullName,
            UserName = user.UserName!,
            Avatar = user.Avatar,
            Bio = user.Bio
        });
    }


    [HttpGet("by-id/{id}")]
    public async Task<IActionResult> GetUserById([StringLength(64)] string id)
    {
        var myId = GetUserId();

        var user = await _context.Users
            .AsNoTracking()
            .Where(u => u.Id == id)
            .Select(u => new ChatPartnerDTO
            {
                Id = u.Id,
                FullName = u.FullName,
                UserName = u.UserName!,
                Avatar = u.Avatar,
                Bio = u.Bio,
                LastSeen = u.LastSeen
            })
            .FirstOrDefaultAsync();

        if (user == null)
            return NotFound(new { message = "Kullanıcı bulunamadı." });

        if (user.Id != myId)
        {
            var blockedIds = await GetBlockedEitherWayIdsAsync(myId);
            if (blockedIds.Contains(user.Id))
                user.LastSeen = null;
        }

        return Ok(user);
    }


    [HttpPut("profile")]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> UpdateProfile(UpdateProfileDTO dto)
    {
        var user = await _userManager.FindByIdAsync(GetUserId());
        if (user == null)
            return Unauthorized();

        var newUserName = dto.UserName.Trim();
        var newEmail = dto.Email?.Trim();

        var userNameChanged = !string.Equals(newUserName, user.UserName, StringComparison.OrdinalIgnoreCase);
        var emailChanged = !string.IsNullOrEmpty(newEmail) &&
            !string.Equals(newEmail, user.Email, StringComparison.OrdinalIgnoreCase);

        if ((userNameChanged || emailChanged) && IsDemoAccount(user))
            return BadRequest(new { message = "Demo hesaplarında kullanıcı adı ve e-posta değiştirilemez." });

        if (emailChanged)
        {
            if (string.IsNullOrEmpty(dto.CurrentPassword) ||
                !await _userManager.CheckPasswordAsync(user, dto.CurrentPassword))
                return BadRequest(new { message = "E-posta değiştirmek için mevcut şifrenizi doğru girmelisiniz." });

            var existing = await _userManager.FindByEmailAsync(newEmail!);
            if (existing != null && existing.Id != user.Id)
                return BadRequest(new { message = "Bu e-posta adresi kullanılamıyor." });

            var emailResult = await _userManager.SetEmailAsync(user, newEmail);
            if (!emailResult.Succeeded)
                return BadRequest(new { message = "E-posta güncellenemedi." });
        }

        if (userNameChanged)
        {
            var existing = await _userManager.FindByNameAsync(newUserName);
            if (existing != null && existing.Id != user.Id)
                return BadRequest(new { message = "Bu kullanıcı adı zaten kullanılıyor." });

            var nameResult = await _userManager.SetUserNameAsync(user, newUserName);
            if (!nameResult.Succeeded)
                return BadRequest(new { message = "Kullanıcı adı güncellenemedi." });
        }

        user.FullName = dto.FullName.Trim();
        user.Bio = string.IsNullOrWhiteSpace(dto.Bio) ? null : dto.Bio.Trim();

        var updateResult = await _userManager.UpdateAsync(user);
        if (!updateResult.Succeeded)
            return BadRequest(new { message = "Profil güncellenemedi." });

        if (userNameChanged || emailChanged)
        {
            var rememberMe = User.FindFirstValue(TokenService.RememberMeClaim) == "1";
            await _tokenService.IssueAuthCookieAsync(Response, user, rememberMe);
        }

        return Ok(new UserDTO
        {
            Id = user.Id,
            FullName = user.FullName,
            UserName = user.UserName!,
            Email = user.Email,
            Avatar = user.Avatar,
            Bio = user.Bio,
            CreatedAt = user.CreatedAt
        });
    }

    [HttpPut("avatar")]
    [EnableRateLimiting("upload")]
    [RequestSizeLimit(CloudinaryService.MaxAvatarBytes + 512 * 1024)]
    public async Task<IActionResult> UpdateAvatar(IFormFile? file)
    {
        var error = await CloudinaryService.ValidateImageAsync(file, CloudinaryService.MaxAvatarBytes);
        if (error != null)
            return BadRequest(new { message = error });

        var user = await _userManager.FindByIdAsync(GetUserId());
        if (user == null)
            return Unauthorized();

        var url = await _cloudinaryService.UploadImageAsync(file!, "avatars");
        if (url == null)
            return BadRequest(new { message = "Fotoğraf yüklenemedi." });

        user.Avatar = url;
        await _userManager.UpdateAsync(user);

        await _hubContext.Clients.All.SendAsync("AvatarUpdated", new { userId = user.Id, avatar = user.Avatar });

        return Ok(new { avatar = user.Avatar });
    }

    private string GetUserId() =>
        User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? throw new InvalidOperationException("Kullanıcı kimliği bulunamadı.");

    private Task<List<string>> GetBlockedEitherWayIdsAsync(string userId) =>
        _context.Blocks
            .Where(b => b.BlockerId == userId || b.BlockedId == userId)
            .Select(b => b.BlockerId == userId ? b.BlockedId : b.BlockerId)
            .Distinct()
            .ToListAsync();

    private bool IsDemoAccount(User user)
    {
        var demoUserNames = _config.GetSection("DemoAccounts:UserNames").Get<string[]>() ?? Array.Empty<string>();
        return demoUserNames.Contains(user.UserName, StringComparer.OrdinalIgnoreCase);
    }

    private static string EscapeLikePattern(string value) =>
        value.Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_");
}