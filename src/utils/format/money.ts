/**
 * Render an amount held in MINOR units (satang) as baht.
 *
 * The wire carries integers so money never rides on a float: `10000` is
 * ฿100.00. Only the display end divides, and it divides here rather than in
 * each component, so no screen can quietly drop the hundredths.
 */
export function formatMinor(amountMinor: number | undefined | null): string {
  if (amountMinor === undefined || amountMinor === null || isNaN(amountMinor)) return "฿0.00";

  return new Intl.NumberFormat('th-TH',
    {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amountMinor / 100);
}

export function formatThaiBaht(amount: string | number): string {
  const num = typeof amount === 'string' ? Number(amount) : amount;

  if (isNaN(num)) return '฿0';

  return new Intl.NumberFormat('th-TH',
    {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
}

export const formatBudgetCompact = (value: number | undefined): string => {
    if (!value || value === 0) return "—";

    const absValue = Math.abs(value);
    if (absValue >= 1_000_000) {
        const formatted = (value / 1_000_000).toFixed(2).replace(/\.00$/, "");
        return `${formatted}M`;
    }
    if (absValue >= 100_000) {
        // For 100K–999K: show as 123.4K
        return `${(value / 1000).toFixed(1).replace(/\.0$/, "")}K`;
    }
    if (absValue >= 1_000) {
        // For 1,000–99,999: show as 12.3K
        return `${(value / 1000).toFixed(1).replace(/\.0$/, "")}K`;
    }

    return value.toLocaleString(); // Below 1,000 → normal format
};

export const formatBudget = (budget: string | number | null | undefined): string => {
    if (!budget) return "-";
    try {
        const amount = parseFloat(String(budget));
        return isNaN(amount) ? "-" : amount.toLocaleString();
    } catch {
        return "-";
    }
};