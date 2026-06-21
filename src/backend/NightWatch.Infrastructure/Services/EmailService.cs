using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using NightWatch.Application.Abstractions;
using NightWatch.Infrastructure.Options;
using System.Net;
using System.Net.Mail;
using System.Net.Mime;

namespace NightWatch.Infrastructure.Services;

public sealed class EmailService(
    IOptions<EmailSmtpOptions> options,
    ILogger<EmailService> logger) : IEmailService
{
    private readonly EmailSmtpOptions _opts = options.Value;

    public bool IsConfigured => _opts.IsConfigured;

    public async Task<bool> SendReportAsync(
        IReadOnlyList<string> recipients,
        string subject,
        string htmlBody,
        byte[] pdfAttachment,
        string attachmentFilename,
        CancellationToken cancellationToken)
    {
        if (!_opts.IsConfigured)
        {
            logger.LogWarning("Email send skipped — SMTP not configured.");
            return false;
        }

        if (recipients.Count == 0)
        {
            logger.LogWarning("Email send skipped — no recipients.");
            return false;
        }

        try
        {
            using var client = new SmtpClient(_opts.Host, _opts.Port)
            {
                EnableSsl = _opts.UseSsl,
                Credentials = new NetworkCredential(_opts.Username, _opts.Password),
                DeliveryMethod = SmtpDeliveryMethod.Network,
                Timeout = 30_000,
            };

            using var message = new MailMessage
            {
                From = new MailAddress(_opts.FromAddress, _opts.FromName),
                Subject = subject,
                IsBodyHtml = true,
                Body = htmlBody,
            };

            foreach (var r in recipients)
            {
                if (!string.IsNullOrWhiteSpace(r))
                    message.To.Add(r.Trim());
            }

            if (pdfAttachment.Length > 0)
            {
                var stream = new MemoryStream(pdfAttachment);
                var attachment = new Attachment(stream, attachmentFilename, MediaTypeNames.Application.Pdf);
                message.Attachments.Add(attachment);
            }

            await client.SendMailAsync(message, cancellationToken);
            logger.LogInformation("Report email sent to {Count} recipient(s): {Subject}", recipients.Count, subject);
            return true;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to send report email: {Subject}", subject);
            return false;
        }
    }

    public async Task<bool> SendAlertEmailAsync(
        IReadOnlyList<string> recipients,
        string subject,
        string htmlBody,
        CancellationToken cancellationToken)
        => await SendReportAsync(recipients, subject, htmlBody, [], string.Empty, cancellationToken);
}
