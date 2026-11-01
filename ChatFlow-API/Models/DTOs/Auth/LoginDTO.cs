using System.ComponentModel.DataAnnotations;

namespace ChatFlow.API.Models.DTOs;

public class LoginDTO
{
    [Required(ErrorMessage = "Kullanıcı adı zorunludur.")]
    [StringLength(64)]
    public string UserName { get; set; } = null!;

    [Required(ErrorMessage = "Şifre zorunludur.")]
    [StringLength(128)]
    public string Password { get; set; } = null!;

    public bool RememberMe { get; set; }
}
