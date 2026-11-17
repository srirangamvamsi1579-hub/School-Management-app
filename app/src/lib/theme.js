// Same contrast rules as hex_luminance / contrast_ratio / accessible_shade in the database.
const ch = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const rgb = (hex) => { const h = hex.replace('#', ''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
export const lum = (hex) => { const [r, g, b] = rgb(hex).map(ch); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const toHex = (a) => '#' + a.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('').toUpperCase();
export function accessible(hex, against = '#FFFFFF', target = 4.5) {
  let c = rgb(hex), out = toHex(c), i = 0;
  while (contrast(out, against) < target && i++ < 40) { c = c.map((v) => v * 0.94); out = toHex(c); }
  return out;
}
export const tint = (hex, p) => toHex(rgb(hex).map((v) => v + (255 - v) * p));

export const PRESETS = [['#2147C7', 'Royal blue'], ['#0F766E', 'Teal'], ['#7C3AED', 'Violet'], ['#B42318', 'Crimson'], ['#C2410C', 'Saffron'], ['#15803D', 'Green'], ['#0E7490', 'Ocean'], ['#334155', 'Slate']];
export const TEMPLATES = [['CLASSIC', 'Classic — dark sidebar'], ['BRIGHT', 'Bright — light sidebar'], ['BRANDED', 'Branded — colour sidebar'], ['TOPNAV', 'Top navigation'], ['COMPACT', 'Compact — dense tables']];

export function applyTheme(theme) {
  const root = document.documentElement;
  const brand = accessible(theme.color);
  root.style.setProperty('--brand', brand);
  root.style.setProperty('--brand-soft', theme.mode === 'DARK' ? '#1C2540' : tint(brand, 0.9));
  root.style.setProperty('--radius', theme.radius + 'px');
  root.style.setProperty('--font', `${theme.font}, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`);
  const side = theme.template === 'BRIGHT' ? 'LIGHT' : theme.template === 'BRANDED' ? 'BRAND' : 'DARK';
  root.dataset.side = side;
  root.dataset.mode = theme.mode;
  root.dataset.density = theme.template === 'COMPACT' ? 'COMPACT' : theme.density;
  return { brand, adjusted: brand !== theme.color.toUpperCase() };
}
