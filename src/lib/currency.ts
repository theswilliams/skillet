export const DEFAULT_CURRENCY = "CAD";

const SYMBOLS: Record<string, string> = {
  CAD: "$",
  USD: "$",
  EUR: "€",
  GBP: "£",
  AUD: "$",
};

export function formatMoney(amount: number, currency = DEFAULT_CURRENCY): string {
  const symbol = SYMBOLS[currency] ?? "";
  const value = Math.abs(amount) < 10 ? amount.toFixed(2) : amount.toFixed(2);
  return `${amount < 0 ? "-" : ""}${symbol}${Math.abs(Number(value)).toFixed(2)}`;
}

export function formatMoneyShort(amount: number, currency = DEFAULT_CURRENCY): string {
  const symbol = SYMBOLS[currency] ?? "";
  return `${symbol}${Math.round(amount)}`;
}
