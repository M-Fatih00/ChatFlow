using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using ChatFlow.API.Models.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.IdentityModel.Tokens;

namespace ChatFlow.API.Service;

public class TokenService
{
    private readonly UserManager<User> _user;
    private readonly IConfiguration _config;

    public TokenService(UserManager<User> user, IConfiguration config)
    {
        _user = user;
        _config = config;
    }


    public async Task<string> GenerateToken(User user)
    {
        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.Email, user.Email!),
            new Claim(ClaimTypes.NameIdentifier, user.Id!),
            new Claim(ClaimTypes.Name, user.UserName!),
        };

        var roles = await _user.GetRolesAsync(user);

        foreach(var role in roles)
        {
            claims.Add(new Claim(ClaimTypes.Role, role));
        }

        var tokenHandler = new JwtSecurityTokenHandler();
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["AppSettings:Secret"]!));

        var tokenSettings = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Expires = DateTime.UtcNow.AddDays(7),
            SigningCredentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256Signature),
            Issuer = "fatihcanibek.com",
            Audience= "firmaAdi"
        };

        var token = tokenHandler.CreateToken(tokenSettings);
        Console.WriteLine(token);
        return tokenHandler.WriteToken(token);
    }

}