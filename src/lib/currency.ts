type SupportedCurrency = "EUR" | "GBP";

const rateCache = new Map<string, { rate: number; expiresAt: number }>();

async function getRate(from: SupportedCurrency, to: SupportedCurrency) {
  if (from === to) return 1;
  const key = `${from}-${to}`;
  const cached = rateCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.rate;

  const response = await fetch(`https://api.frankfurter.dev/v2/rate/${from.toLowerCase()}/${to.toLowerCase()}`, {
    next: { revalidate: 3600 },
  });
  if (!response.ok) throw new Error(`Currency conversion failed: ${from} to ${to}`);
  const payload = (await response.json()) as { rate?: number };
  if (!payload.rate || !Number.isFinite(payload.rate)) throw new Error(`Invalid currency rate: ${from} to ${to}`);
  rateCache.set(key, { rate: payload.rate, expiresAt: Date.now() + 60 * 60 * 1000 });
  return payload.rate;
}

export async function convertMinorUnits(amount: number, from: string, to: string) {
  if (from === to) return amount;
  if (!["EUR", "GBP"].includes(from) || !["EUR", "GBP"].includes(to)) return amount;
  const rate = await getRate(from as SupportedCurrency, to as SupportedCurrency);
  return Math.round(amount * rate);
}
