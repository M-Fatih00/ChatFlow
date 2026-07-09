using System.ComponentModel.DataAnnotations;

namespace ChatFlow.API.Models.DTOs;

public class LoginDTO
{
    [Required]
    [Display(Name = "Kullanıcı Adı")]
    public string UserName { get; set; } = null!;

    [Required]
    [Display(Name = "Parola")]
    public string Password { get; set; } = null!;

    public bool RememberMe { get; set; }

}