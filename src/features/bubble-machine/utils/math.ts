import type { Point } from '../types';

const MM_PER_PIXEL = 0.2645833333;
const PIXELS_PER_MM = 1 / MM_PER_PIXEL;

export const deepClone = <T,>(value: T): T => {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
};

export const seededUnit = (seed: number) => {
  const x = Math.sin(seed * 127.1) * 43758.5453123;
  return x - Math.floor(x);
};

export const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export const distanceBetweenPoints = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export const pixelsToMillimeters = (pixels: number) => pixels * MM_PER_PIXEL;
export const pixelsToCentimeters = (pixels: number) => pixelsToMillimeters(pixels) / 10;
export const millimetersToPixels = (millimeters: number) => millimeters * PIXELS_PER_MM;
export const centimetersToPixels = (centimeters: number) => millimetersToPixels(centimeters * 10);

export const getMetricSizeLabel = (pixels: number) => {
  const mm = pixelsToMillimeters(pixels);
  const cm = pixelsToCentimeters(pixels);
  return `${mm.toFixed(1)}mm · ${cm.toFixed(2)}cm`;
};
