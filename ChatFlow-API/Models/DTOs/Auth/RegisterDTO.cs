using System.ComponentModel.DataAnnotations;

namespace ChatFlow.API.Models.DTOs;

public class RegisterDTO
{
    [Required(ErrorMessage = "Ad soyad zorunludur.")]
    [StringLength(60, MinimumLength = 2, ErrorMessage = "Ad soyad 2-60 karakter arasında olmalıdır.")]
    public string FullName { get; set; } = null!;

    [Required(ErrorMessage = "Kullanıcı adı zorunludur.")]
    [StringLength(30, MinimumLength = 3, ErrorMessage = "Kullanıcı adı 3-30 karakter arasında olmalıdır.")]
    [RegularExpression("^[a-zA-Z0-9._-]+$", ErrorMessage = "Kullanıcı adı yalnızca harf, rakam, nokta, alt çizgi ve tire içerebilir.")]
    public string UserName { get; set; } = null!;

    [Required(ErrorMessage = "E-posta zorunludur.")]
    [EmailAddress(ErrorMessage = "Geçerli bir e-posta adresi girin.")]
    [StringLength(254)]
    public string Email { get; set; } = null!;

    [Required(ErrorMessage = "Şifre zorunludur.")]
    [StringLength(128, MinimumLength = 8, ErrorMessage = "Şifre en az 8 karakter olmalıdır.")]
    public string Password { get; set; } = null!;

    [Required(ErrorMessage = "Şifre tekrarı zorunludur.")]
    [Compare(nameof(Password), ErrorMessage = "Şifreler eşleşmiyor.")]
    public string ConfirmPassword { get; set; } = null!;
}
