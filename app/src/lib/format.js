// Formatting helpers (Indian number system)

export const inr = (n, dec = 0) =>
  '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec });

export const num = (n) => Number(n || 0).toLocaleString('en-IN');

export const todayISO = () => new Date().toISOString().slice(0, 10);

export const dmy = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}-${m}-${y}`;
};

export const dmon = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen',
  'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const two = (n) => (n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : ''));

// 103070 → "One Lakh, Three Thousand And Seventy" (same output as amount_in_words_inr() in the database)
export function amountInWords(amount) {
  let n = Math.floor(Number(amount) || 0);
  if (n === 0) return 'Zero';
  const crore = Math.floor(n / 1e7); n %= 1e7;
  const lakh = Math.floor(n / 1e5); n %= 1e5;
  const thou = Math.floor(n / 1e3); n %= 1e3;
  const hund = Math.floor(n / 100); const rest = n % 100;
  const parts = [];
  if (crore) parts.push(amountInWords(crore) + ' Crore');
  if (lakh) parts.push(two(lakh) + ' Lakh');
  if (thou) parts.push(two(thou) + ' Thousand');
  if (hund) parts.push(ONES[hund] + ' Hundred');
  const tail = rest ? two(rest) : '';
  return parts.join(', ') + (tail ? (parts.length ? ' And ' : '') + tail : '');
}

export const uid = (() => { let i = 1000; return (p = '') => p + (++i); })();

// Seeded random so the demo data is the same on every device
export function rng(seed = 7) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

export const initials = (name = '') => name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

export const roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
