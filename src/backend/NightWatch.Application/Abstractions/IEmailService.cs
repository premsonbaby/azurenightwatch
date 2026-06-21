namespace NightWatch.Application.Abstractions;

public interface IEmailService
{
    bool IsConfigured { get; }

    Task<bool> SendReportAsync(
        IReadOnlyList<string> recipients,
        string subject,
        string htmlBody,
        byte[] pdfAttachment,
        string attachmentFilename,
        CancellationToken cancellationToken);

    Task<bool> SendAlertEmailAsync(
        IReadOnlyList<string> recipients,
        string subject,
        string htmlBody,
        CancellationToken cancellationToken);
}
