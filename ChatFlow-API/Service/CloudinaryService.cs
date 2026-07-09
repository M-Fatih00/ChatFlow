using CloudinaryDotNet;
using CloudinaryDotNet.Actions;

namespace ChatFlow.API.Services;

public class CloudinaryService
{
    private readonly Cloudinary _cloudinary;

    public CloudinaryService(IConfiguration config)
    {
        var account = new Account(
            config["Cloudinary:CloudName"],
            config["Cloudinary:ApiKey"],
            config["Cloudinary:ApiSecret"]
        );
        _cloudinary = new Cloudinary(account);
        _cloudinary.Api.Secure = true;
    }

    // Resim yükle (avatar, resim ekleri) → güvenli URL döndürür
    public async Task<string?> UploadImageAsync(IFormFile file, string folder)
    {
        if (file == null || file.Length == 0) return null;

        await using var stream = file.OpenReadStream();

        var uploadParams = new ImageUploadParams
        {
            File = new FileDescription(file.FileName, stream),
            Folder = folder,
        };

        var result = await _cloudinary.UploadAsync(uploadParams);

        if (result.Error != null)
            throw new Exception(result.Error.Message);

        return result.SecureUrl?.ToString();
    }

    // Genel dosya yükle (pdf, docx vb. mesaj ekleri) → güvenli URL döndürür
    public async Task<string?> UploadRawAsync(IFormFile file, string folder)
    {
        if (file == null || file.Length == 0) return null;

        await using var stream = file.OpenReadStream();

        var uploadParams = new RawUploadParams
        {
            File = new FileDescription(file.FileName, stream),
            Folder = folder,
        };

        var result = await _cloudinary.UploadAsync(uploadParams);

        if (result.Error != null)
            throw new Exception(result.Error.Message);

        return result.SecureUrl?.ToString();
    }
}