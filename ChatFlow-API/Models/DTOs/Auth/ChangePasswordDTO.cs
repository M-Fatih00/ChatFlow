using System.ComponentModel.DataAnnotations;

namespace ChatFlow.API.Models.DTOs;

public class ChangePasswordDTO
{
    [Required(ErrorMessage = "Mevcut şifre zorunludur.")]
    [StringLength(128)]
    public string CurrentPassword { get; set; } = null!;

    [Required(ErrorMessage = "Yeni şifre zorunludur.")]
    [StringLength(128, MinimumLength = 8, ErrorMessage = "Yeni şifre en az 8 karakter olmalıdır.")]
    public string NewPassword { get; set; } = null!;
}
