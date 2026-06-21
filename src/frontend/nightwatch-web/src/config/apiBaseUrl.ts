function inferApiOriginFromWindow(): string {
  if (typeof window === 'undefined') {
    return 'http://localhost:5200';
  }

  try {
    const url = new URL(window.location.origin);
    if (url.hostname.includes('-nightwatch-web.')) {
      url.hostname = url.hostname.replace('-nightwatch-web.', '-nightwatch-api.');
      return url.origin;
    }

    return window.location.origin;
  } catch {
    return window.location.origin;
  }
}

export function resolveApiBaseUrl(configuredApiBaseUrl?: string): string {
  const configured = configuredApiBaseUrl?.trim();
  if (configured) {
    return configured.replace(/\/+$/, '');
  }

  return inferApiOriginFromWindow().replace(/\/+$/, '');
}
