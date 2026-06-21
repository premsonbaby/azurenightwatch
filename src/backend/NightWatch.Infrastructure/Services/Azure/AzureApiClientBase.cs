using Azure.Core;
using Microsoft.Extensions.Logging;
using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;

namespace NightWatch.Infrastructure.Services.Azure;

public abstract class AzureApiClientBase(HttpClient httpClient, TokenCredential credential, ILogger logger)
{
    private static readonly TimeSpan[] BackoffSchedule = [
        TimeSpan.FromMilliseconds(250),
        TimeSpan.FromMilliseconds(750),
        TimeSpan.FromSeconds(2)
    ];

    protected HttpClient HttpClient { get; } = httpClient;

    protected async Task<JsonDocument> SendWithRetryAsync(
        Func<HttpRequestMessage> requestFactory,
        TokenRequestContext tokenRequestContext,
        CancellationToken cancellationToken)
    {
        for (var attempt = 0; attempt < BackoffSchedule.Length + 1; attempt++)
        {
            using var request = requestFactory();
            var token = await credential.GetTokenAsync(tokenRequestContext, cancellationToken);
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token.Token);

            using var response = await HttpClient.SendAsync(request, cancellationToken);
            if (response.IsSuccessStatusCode)
            {
                await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
                return await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);
            }

            var shouldRetry = response.StatusCode == HttpStatusCode.TooManyRequests || (int)response.StatusCode >= 500;
            if (!shouldRetry || attempt >= BackoffSchedule.Length)
            {
                var body = await response.Content.ReadAsStringAsync(cancellationToken);
                throw new HttpRequestException($"Azure API call failed with {(int)response.StatusCode}: {body}", null, response.StatusCode);
            }

            logger.LogWarning("Transient Azure API error {StatusCode}. Retrying in {DelayMs}ms.", (int)response.StatusCode, BackoffSchedule[attempt].TotalMilliseconds);
            await Task.Delay(BackoffSchedule[attempt], cancellationToken);
        }

        throw new InvalidOperationException("Azure API call exhausted retry attempts.");
    }
}
