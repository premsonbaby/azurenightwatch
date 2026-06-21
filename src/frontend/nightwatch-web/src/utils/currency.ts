export function currencySymbol(code?: string | null): string {
  switch ((code ?? 'EUR').toUpperCase()) {
    case 'USD': return '$';
    case 'GBP': return '£';
    case 'JPY': return '¥';
    case 'CHF': return 'CHF ';
    case 'CAD': return 'CA$';
    case 'AUD': return 'A$';
    case 'SEK': case 'NOK': case 'DKK': return 'kr ';
    default: return '€';
  }
}

export function fmtCurrency(amount: number, currency?: string | null, decimals = 0): string {
  const sym = currencySymbol(currency);
  return `${sym}${amount.toLocaleString('en', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}
