const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export const normalizeHex = (value: string) => {
  if (!/^#([\da-f]{3}|[\da-f]{6})$/i.test(value)) return '#000000';
  if (value.length === 4) {
    return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`.toLowerCase();
  }
  return value.toLowerCase();
};

export const hexToRgb = (value: string) => {
  const hex = normalizeHex(value).slice(1);
  const numeric = Number.parseInt(hex, 16);
  return {
    r: (numeric >> 16) & 255,
    g: (numeric >> 8) & 255,
    b: numeric & 255,
  };
};

export const rgbToHex = ({ r, g, b }: { r: number; g: number; b: number }) => {
  const toHex = (channel: number) => Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

export const rgbToCmyk = ({ r, g, b }: { r: number; g: number; b: number }) => {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const key = 1 - Math.max(red, green, blue);

  if (key >= 0.9999) {
    return { c: 0, m: 0, y: 0, k: 100 };
  }

  return {
    c: Math.round(((1 - red - key) / (1 - key)) * 100),
    m: Math.round(((1 - green - key) / (1 - key)) * 100),
    y: Math.round(((1 - blue - key) / (1 - key)) * 100),
    k: Math.round(key * 100),
  };
};

export const cmykToRgb = ({ c, m, y, k }: { c: number; m: number; y: number; k: number }) => {
  const cyan = Math.max(0, Math.min(100, c)) / 100;
  const magenta = Math.max(0, Math.min(100, m)) / 100;
  const yellow = Math.max(0, Math.min(100, y)) / 100;
  const key = Math.max(0, Math.min(100, k)) / 100;

  return {
    r: 255 * (1 - cyan) * (1 - key),
    g: 255 * (1 - magenta) * (1 - key),
    b: 255 * (1 - yellow) * (1 - key),
  };
};

export const hexToCmyk = (value: string) => rgbToCmyk(hexToRgb(value));
export const cmykToHex = ({ c, m, y, k }: { c: number; m: number; y: number; k: number }) => rgbToHex(cmykToRgb({ c, m, y, k }));

export const mixHex = (source: string, target: string, amount: number) => {
  const clampedAmount = clamp01(amount);
  const a = hexToRgb(source);
  const b = hexToRgb(target);
  return rgbToHex({
    r: a.r + (b.r - a.r) * clampedAmount,
    g: a.g + (b.g - a.g) * clampedAmount,
    b: a.b + (b.b - a.b) * clampedAmount,
  });
};
