using System.Security.Claims;
using ChatFlow.API.Models.DTOs;
using ChatFlow.API.Models.Entities;
using ChatFlow.API.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace ChatFlow.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private const string InvalidCredentialsMessage = "Kullanıcı adı veya şifre hatalı.";

    private readonly UserManager<User> _userManager;
    private readonly SignInManager<User> _signInManager;
    private readonly TokenService _tokenService;
    private readonly IConfiguration _config;

    public AuthController(
        UserManager<User> userManager,
        SignInManager<User> signInManager,
        TokenService tokenService,
        IConfiguration config)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _tokenService = tokenService;
        _config = config;
    }

    [HttpPost("register")]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> Register(RegisterDTO dto)
    {
        var user = new User
        {
            FullName = dto.FullName.Trim(),
            UserName = dto.UserName.Trim(),
            Email = dto.Email.Trim(),
            CreatedAt = DateTime.UtcNow
        };

        var result = await _userManager.CreateAsync(user, dto.Password);

        if (result.Succeeded)
            return Ok(new { message = "Kayıt başarılı! Şimdi giriş yapabilirsiniz." });

        if (result.Errors.Any(e => e.Code.StartsWith("Password", StringComparison.Ordinal)))
            return BadRequest(new { message = "Şifre en az 8 karakter olmalı, en az bir küçük harf ve bir rakam içermelidir." });

        return BadRequest(new { message = "Kayıt oluşturulamadı. Kullanıcı adı veya e-posta kullanımda olabilir." });
    }

    [HttpPost("login")]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> Login(LoginDTO dto)
    {
        var user = await _userManager.FindByNameAsync(dto.UserName.Trim());

        if (user == null)
        {
            _userManager.PasswordHasher.HashPassword(new User { FullName = string.Empty }, dto.Password);
            return BadRequest(new { message = InvalidCredentialsMessage });
        }

        var result = await _signInManager.CheckPasswordSignInAsync(user, dto.Password, lockoutOnFailure: true);

        if (result.IsLockedOut)
            return BadRequest(new { message = "Çok fazla hatalı deneme yapıldı. Lütfen 5 dakika sonra tekrar deneyin." });

        if (!result.Succeeded)
            return BadRequest(new { message = InvalidCredentialsMessage });

        if (string.IsNullOrEmpty(user.SecurityStamp))
            await _userManager.UpdateSecurityStampAsync(user);

        await _tokenService.IssueAuthCookieAsync(Response, user, dto.RememberMe);

        return Ok(ToUserDto(user));
    }

    [HttpPost("logout")]
    public IActionResult Logout()
    {
        _tokenService.ClearAuthCookie(Response);
        return Ok();
    }

    [Authorize]
    [HttpPost("logout-all")]
    public async Task<IActionResult> LogoutAll()
    {
        var user = await GetCurrentUserAsync();
        if (user == null)
            return Unauthorized();

        await _userManager.UpdateSecurityStampAsync(user);
        _tokenService.ForgetSecurityStamp(user.Id);
        _tokenService.ClearAuthCookie(Response);

        return Ok(new { message = "Tüm cihazlardaki oturumlar kapatıldı." });
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<IActionResult> GetCurrentUser()
    {
        var user = await GetCurrentUserAsync();
        if (user == null)
            return Unauthorized();

        return Ok(ToUserDto(user));
    }

    [Authorize]
    [HttpPost("change-password")]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> ChangePassword(ChangePasswordDTO dto)
    {
        var user = await GetCurrentUserAsync();
        if (user == null)
            return Unauthorized();

        if (IsDemoAccount(user))
            return BadRequest(new { message = "Demo hesaplarında şifre değiştirilemez." });

        if (dto.CurrentPassword == dto.NewPassword)
            return BadRequest(new { message = "Yeni şifre mevcut şifreyle aynı olamaz." });

        var result = await _userManager.ChangePasswordAsync(user, dto.CurrentPassword, dto.NewPassword);

        if (!result.Succeeded)
            return BadRequest(new { message = "Mevcut şifre hatalı veya yeni şifre kurallara uymuyor." });

        var rememberMe = User.FindFirstValue(TokenService.RememberMeClaim) == "1";
        await _tokenService.IssueAuthCookieAsync(Response, user, rememberMe);

        return Ok(new { message = "Şifre değiştirildi. Diğer cihazlardaki oturumlar kapatıldı." });
    }

    private async Task<User?> GetCurrentUserAsync()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return userId == null ? null : await _userManager.FindByIdAsync(userId);
    }

    private bool IsDemoAccount(User user)
    {
        var demoUserNames = _config.GetSection("DemoAccounts:UserNames").Get<string[]>() ?? Array.Empty<string>();
        return demoUserNames.Contains(user.UserName, StringComparer.OrdinalIgnoreCase);
    }

    private static UserDTO ToUserDto(User user) => new()
    {
        Id = user.Id,
        FullName = user.FullName,
        UserName = user.UserName!,
        Email = user.Email,
        Avatar = user.Avatar,
        Bio = user.Bio,
        CreatedAt = user.CreatedAt
    };
}
