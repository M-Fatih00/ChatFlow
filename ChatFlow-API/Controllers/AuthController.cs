using System.Security.Claims;
using ChatFlow.API.Models.DTOs;
using ChatFlow.API.Models.Entities;
using ChatFlow.API.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace ChatFlow.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{

    private readonly UserManager<User> _userManager;
    private readonly TokenService _tokenService;
    private readonly IWebHostEnvironment _env;
    public AuthController(UserManager<User> userManager, TokenService tokenService, IWebHostEnvironment env)
    {
        _userManager = userManager;
        _tokenService = tokenService;
        _env = env;
    }


    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterDTO dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var user = new User
        {
            FullName = dto.FullName,
            UserName = dto.UserName,
            Email = dto.Email,
            CreatedAt = DateTime.UtcNow,
        };

        var result = await _userManager.CreateAsync(user, dto.Password);

        if (!result.Succeeded)
            return BadRequest(new { message = "Kullanıcı Oluşturulamadı." });

        return Ok(new { message = "Kayıt başarılı!" });

    }


    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginDTO dto)
    {
        var user = await _userManager.FindByNameAsync(dto.UserName);

        var result = user != null && await _userManager.CheckPasswordAsync(user, dto.Password);

        if (!result)
            return BadRequest(new { message = "Kullanıcı adı veya Şifre hatalı." });

        var token = await _tokenService.GenerateToken(user!);

        Response.Cookies.Append("jwt", token, new CookieOptions
        {
            HttpOnly = true,
            SameSite = _env.IsDevelopment() ? SameSiteMode.Lax : SameSiteMode.None,
            Secure = !_env.IsDevelopment(),
            Expires = dto.RememberMe
        ? DateTimeOffset.UtcNow.AddDays(15)
        : DateTimeOffset.UtcNow.AddHours(8) // remember me yoksa 8 saat
        });

        return Ok(new UserDTO
        {
            Id = user!.Id,
            FullName = user!.FullName,
            UserName = user.UserName!,
            Email = user.Email,
            Avatar = user.Avatar,
            Bio = user.Bio,
            Token = token
        });
    }


    [HttpPost("logout")]
    public IActionResult Logout()
    {
        Response.Cookies.Delete("jwt", new CookieOptions
        {
            HttpOnly = true,
            Secure = !_env.IsDevelopment(),
            SameSite = _env.IsDevelopment() ? SameSiteMode.Lax : SameSiteMode.None,
        });

        return Ok();
    }


    [Authorize]
    [HttpGet("me")]
    public async Task<IActionResult> GetCurrentUser()
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value!;
        var user = await _userManager.FindByIdAsync(userId);

        if (user == null)
            return Unauthorized();

        var token = await _tokenService.GenerateToken(user);

        return Ok(new UserDTO
        {
            Id = user.Id,
            FullName = user.FullName,
            UserName = user.UserName!,
            Email = user.Email,
            Avatar = user.Avatar,
            Bio = user.Bio,
            CreatedAt = user.CreatedAt,
            Token = token
        });
    }


    [Authorize]
    [HttpPost("change-password")]
    public async Task<IActionResult> ChangePassword(ChangePasswordDTO dto)
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value!;
        var user = await _userManager.FindByIdAsync(userId);

        if (user == null)
            return Unauthorized();

        var result = await _userManager.ChangePasswordAsync(
            user,
            dto.CurrentPassword,
            dto.NewPassword
        );

        if (!result.Succeeded)
            return BadRequest(new { message = "Mevcut şifre hatalı veya yeni şifre geçersiz." });

        return Ok(new { message = "Şifre başarıyla değiştirildi." });
    }
}