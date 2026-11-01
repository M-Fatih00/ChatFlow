using CloudinaryDotNet;
using CloudinaryDotNet.Actions;

namespace ChatFlow.API.Services;

public class CloudinaryService
{
    public const long MaxAvatarBytes = 2 * 1024 * 1024;
    public const long MaxAttachmentBytes = 10 * 1024 * 1024;

    private const int MaxFileNameLength = 100;

    private static readonly byte[] JpegSignature = [0xFF, 0xD8, 0xFF];
    private static readonly byte[] PngSignature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    private static readonly byte[] GifSignature = [0x47, 0x49, 0x46, 0x38];
    private static readonly byte[] RiffSignature = [0x52, 0x49, 0x46, 0x46];
    private static readonly byte[] WebpSignature = [0x57, 0x45, 0x42, 0x50];
    private static readonly byte[] PdfSignature = [0x25, 0x50, 0x44, 0x46];
    private static readonly byte[] ZipSignature = [0x50, 0x4B, 0x03, 0x04];

    private static readonly HashSet<string> AllowedImageExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".jpg", ".jpeg", ".png", ".webp"
    };

    private static readonly HashSet<string> AllowedAttachmentExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".jpg", ".jpeg", ".png", ".webp", ".gif", ".pdf", ".docx", ".xlsx", ".pptx", ".txt", ".csv"
    };

    private readonly Cloudinary _cloudinary;
    private readonly ILogger<CloudinaryService> _logger;

    public CloudinaryService(IConfiguration config, ILogger<CloudinaryService> logger)
    {
        var account = new Account(
            config["Cloudinary:CloudName"],
            config["Cloudinary:ApiKey"],
            config["Cloudinary:ApiSecret"]
        );

        _cloudinary = new Cloudinary(account);
        _cloudinary.Api.Secure = true;
        _logger = logger;
    }

    public async Task<string?> UploadImageAsync(IFormFile file, string folder)
    {
        if (file == null || file.Length == 0)
            return null;

        try
        {
            await using var stream = file.OpenReadStream();

            var uploadParams = new ImageUploadParams
            {
                File = new FileDescription(SafeFileName(file.FileName), stream),
                Folder = folder
            };

            var result = await _cloudinary.UploadAsync(uploadParams);

            if (result.Error != null)
            {
                _logger.LogWarning("Cloudinary görsel yükleme hatası: {Error}", result.Error.Message);
                return null;
            }

            return result.SecureUrl?.ToString();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Cloudinary görsel yükleme sırasında hata oluştu.");
            return null;
        }
    }

    public async Task<string?> UploadRawAsync(IFormFile file, string folder)
    {
        if (file == null || file.Length == 0)
            return null;

        try
        {
            await using var stream = file.OpenReadStream();

            var uploadParams = new RawUploadParams
            {
                File = new FileDescription(SafeFileName(file.FileName), stream),
                Folder = folder
            };

            var result = await _cloudinary.UploadAsync(uploadParams);

            if (result.Error != null)
            {
                _logger.LogWarning("Cloudinary dosya yükleme hatası: {Error}", result.Error.Message);
                return null;
            }

            return result.SecureUrl?.ToString();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Cloudinary dosya yükleme sırasında hata oluştu.");
            return null;
        }
    }

    public static async Task<string?> ValidateImageAsync(IFormFile? file, long maxBytes)
    {
        if (file == null || file.Length == 0)
            return "Dosya seçilmedi.";

        if (file.Length > maxBytes)
            return $"Dosya boyutu {maxBytes / (1024 * 1024)}MB'dan büyük olamaz.";

        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!AllowedImageExtensions.Contains(extension))
            return "Sadece jpg, png ve webp dosyaları kabul edilir.";

        var (header, read) = await ReadHeaderAsync(file, 12);

        var isValid = extension switch
        {
            ".jpg" or ".jpeg" => HasSignature(header, read, JpegSignature),
            ".png" => HasSignature(header, read, PngSignature),
            ".webp" => IsWebp(header, read),
            _ => false
        };

        return isValid ? null : "Dosya içeriği uzantısıyla uyuşmuyor.";
    }

    public static async Task<(string? Error, bool IsImage)> ValidateAttachmentAsync(IFormFile? file)
    {
        if (file == null || file.Length == 0)
            return ("Dosya seçilmedi.", false);

        if (file.Length > MaxAttachmentBytes)
            return ("Dosya boyutu 10MB'dan büyük olamaz.", false);

        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!AllowedAttachmentExtensions.Contains(extension))
            return ("Bu dosya türü desteklenmiyor.", false);

        var (header, read) = await ReadHeaderAsync(file, 512);

        var (isValid, isImage) = extension switch
        {
            ".jpg" or ".jpeg" => (HasSignature(header, read, JpegSignature), true),
            ".png" => (HasSignature(header, read, PngSignature), true),
            ".gif" => (HasSignature(header, read, GifSignature), true),
            ".webp" => (IsWebp(header, read), true),
            ".pdf" => (HasSignature(header, read, PdfSignature), false),
            ".docx" or ".xlsx" or ".pptx" => (HasSignature(header, read, ZipSignature), false),
            ".txt" or ".csv" => (read > 0 && !header.AsSpan(0, read).Contains((byte)0), false),
            _ => (false, false)
        };

        return isValid ? (null, isImage) : ("Dosya içeriği uzantısıyla uyuşmuyor.", false);
    }

    public static string SafeFileName(string? fileName)
    {
        var name = Path.GetFileName(fileName ?? string.Empty);
        var invalid = Path.GetInvalidFileNameChars();

        var cleaned = new string(name
            .Where(c => !char.IsControl(c) && !invalid.Contains(c) && c != '<' && c != '>' && c != '"')
            .ToArray())
            .Trim();

        if (cleaned.Length == 0)
            return "dosya";

        if (cleaned.Length <= MaxFileNameLength)
            return cleaned;

        var extension = Path.GetExtension(cleaned);
        var stem = Path.GetFileNameWithoutExtension(cleaned);
        var keep = Math.Max(1, MaxFileNameLength - extension.Length);

        return stem[..Math.Min(stem.Length, keep)] + extension;
    }

    private static async Task<(byte[] Header, int Read)> ReadHeaderAsync(IFormFile file, int count)
    {
        var header = new byte[count];
        await using var stream = file.OpenReadStream();
        var read = await stream.ReadAtLeastAsync(header, count, throwOnEndOfStream: false);
        return (header, read);
    }

    private static bool HasSignature(byte[] data, int length, byte[] signature) =>
        length >= signature.Length && data.AsSpan(0, signature.Length).SequenceEqual(signature);

    private static bool IsWebp(byte[] data, int length) =>
        HasSignature(data, length, RiffSignature) &&
        length >= 12 &&
        data.AsSpan(8, 4).SequenceEqual(WebpSignature);
}