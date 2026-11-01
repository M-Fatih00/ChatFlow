using System.ComponentModel.DataAnnotations;

namespace ChatFlow.API.Models.DTOs;

public class UpdateProfileDTO
{
    [Required(ErrorMessage = "Ad soyad zorunludur.")]
    [StringLength(60, MinimumLength = 2, ErrorMessage = "Ad soyad 2-60 karakter arasında olmalıdır.")]
    public string FullName { get; set; } = null!;

    [Required(ErrorMessage = "Kullanıcı adı zorunludur.")]
    [StringLength(30, MinimumLength = 3, ErrorMessage = "Kullanıcı adı 3-30 karakter arasında olmalıdır.")]
    [RegularExpression("^[a-zA-Z0-9._-]+$", ErrorMessage = "Kullanıcı adı yalnızca harf, rakam, nokta, alt çizgi ve tire içerebilir.")]
    public string UserName { get; set; } = null!;

    [EmailAddress(ErrorMessage = "Geçerli bir e-posta adresi girin.")]
    [StringLength(254)]
    public string? Email { get; set; }

    [StringLength(140, ErrorMessage = "Hakkında alanı en fazla 140 karakter olabilir.")]
    public string? Bio { get; set; }

    [StringLength(128)]
    public string? CurrentPassword { get; set; }
}
