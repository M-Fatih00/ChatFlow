using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using ChatFlow.API.Models.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.IdentityModel.Tokens;

namespace ChatFlow.API.Service;

public class TokenService
{
    public const string CookieName = "jwt";
    public const string SecurityStampClaim = "sst";
    public const string RememberMeClaim = "rm";
    public const string DefaultIssuer = "chatflow-api";
    public const string DefaultAudience = "chatflow-client";

    private readonly UserManager<User> _userManager;
    private readonly IConfiguration _config;
    private readonly IWebHostEnvironment _env;
    private readonly IMemoryCache _cache;

    public TokenService(UserManager<User> userManager, IConfiguration config, IWebHostEnvironment env, IMemoryCache cache)
    {
        _userManager = userManager;
        _config = config;
        _env = env;
        _cache = cache;
    }

    public static string StampCacheKey(string userId) => $"security-stamp:{userId}";

    public void ForgetSecurityStamp(string userId) => _cache.Remove(StampCacheKey(userId));

    public async Task IssueAuthCookieAsync(HttpResponse response, User user, bool rememberMe)
    {
        ForgetSecurityStamp(user.Id);

        var lifetime = rememberMe
            ? TimeSpan.FromDays(_config.GetValue("Jwt:RememberMeLifetimeDays", 15))
            : TimeSpan.FromHours(_config.GetValue("Jwt:SessionLifetimeHours", 8));

        var token = await GenerateToken(user, lifetime, rememberMe);

        response.Cookies.Append(CookieName, token, BuildCookieOptions(DateTimeOffset.UtcNow.Add(lifetime)));
    }

    public void ClearAuthCookie(HttpResponse response)
    {
        response.Cookies.Delete(CookieName, BuildCookieOptions(null));
    }

    private async Task<string> GenerateToken(User user, TimeSpan lifetime, bool rememberMe)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id),
            new(ClaimTypes.Name, user.UserName!),
            new(SecurityStampClaim, user.SecurityStamp ?? string.Empty),
            new(RememberMeClaim, rememberMe ? "1" : "0")
        };

        var roles = await _userManager.GetRolesAsync(user);
        claims.AddRange(roles.Select(role => new Claim(ClaimTypes.Role, role)));

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["AppSettings:Secret"]!));

        var descriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Expires = DateTime.UtcNow.Add(lifetime),
            SigningCredentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256Signature),
            Issuer = _config["Jwt:Issuer"] ?? DefaultIssuer,
            Audience = _config["Jwt:Audience"] ?? DefaultAudience
        };

        var handler = new JwtSecurityTokenHandler();
        return handler.WriteToken(handler.CreateToken(descriptor));
    }

    private CookieOptions BuildCookieOptions(DateTimeOffset? expires) => new()
    {
        HttpOnly = true,
        Secure = !_env.IsDevelopment(),
        SameSite = SameSiteMode.Strict,
        Path = "/",
        IsEssential = true,
        Expires = expires
    };
}