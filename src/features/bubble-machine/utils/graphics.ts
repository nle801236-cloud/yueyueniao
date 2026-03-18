import { SHAPE_STYLE_CONFIG } from '../constants';
import type {
  Bounds,
  ContactMode,
  ContactOverlap,
  ContactSeam,
  ContactSettings,
  CurveSeg,
  ElementItem,
  LiquidProfile,
  LiquidSettings,
  Point,
  Segment,
  ShapeStyle,
  TextItem,
  ReferenceImageItem,
} from '../types';
import { hexToRgb } from './color';
import { clamp01, distanceBetweenPoints, seededUnit } from './math';

const parsedPathCache = new Map<string, Segment[]>();
const morphedPathCache = new Map<string, string>();

export const cloneSegments = (segments: Segment[]) => segments.map((segment) => ({ ...segment }));

export const syncOutgoingHandles = (segments: Segment[]) => {
  for (let index = 0; index < segments.length; index += 1) {
    const seg = segments[index];
    if (seg.type === 'C') {
      delete seg.outX;
      delete seg.outY;
    }
  }
  for (let index = 0; index < segments.length - 1; index += 1) {
    const seg = segments[index];
    const next = segments[index + 1];
    if (seg.type === 'C' && next.type === 'C') {
      seg.outX = next.x1;
      seg.outY = next.y1;
    }
  }
  return segments;
};

const hasClosedSubpath = (segments: Segment[]) => segments.some((segment) => segment.type === 'Z');

const getPreviousDrawableIndex = (segments: Segment[], fromIndex: number) => {
  for (let index = fromIndex - 1; index >= 0; index -= 1) {
    if (segments[index].type !== 'Z') return index;
  }
  if (!hasClosedSubpath(segments)) return null;
  for (let index = segments.length - 1; index > fromIndex; index -= 1) {
    if (segments[index].type !== 'Z') return index;
  }
  return null;
};

const getNextDrawableIndex = (segments: Segment[], fromIndex: number) => {
  for (let index = fromIndex + 1; index < segments.length; index += 1) {
    if (segments[index].type !== 'Z') return index;
  }
  if (!hasClosedSubpath(segments)) return null;
  for (let index = 0; index < fromIndex; index += 1) {
    if (segments[index].type !== 'Z') return index;
  }
  return null;
};

export const getIncomingCurveIndex = (segments: Segment[], anchorIndex: number) => {
  const current = segments[anchorIndex];
  if (!current || current.type === 'Z') return null;
  if (current.type === 'C') return anchorIndex;
  const previousIndex = getPreviousDrawableIndex(segments, anchorIndex);
  if (previousIndex === null) return null;
  return segments[previousIndex].type === 'C' ? previousIndex : null;
};

export const getOutgoingCurveIndex = (segments: Segment[], anchorIndex: number) => {
  const nextIndex = getNextDrawableIndex(segments, anchorIndex);
  if (nextIndex === null) return null;
  return segments[nextIndex].type === 'C' ? nextIndex : null;
};

export const getAnchorHandles = (segments: Segment[], anchorIndex: number) => {
  const incomingCurveIndex = getIncomingCurveIndex(segments, anchorIndex);
  const outgoingCurveIndex = getOutgoingCurveIndex(segments, anchorIndex);
  const incomingCurve = incomingCurveIndex === null ? null : segments[incomingCurveIndex];
  const outgoingCurve = outgoingCurveIndex === null ? null : segments[outgoingCurveIndex];

  return {
    incomingCurveIndex,
    outgoingCurveIndex,
    incomingHandle: incomingCurve && incomingCurve.type === 'C' ? { x: incomingCurve.x2, y: incomingCurve.y2 } : null,
    outgoingHandle: outgoingCurve && outgoingCurve.type === 'C' ? { x: outgoingCurve.x1, y: outgoingCurve.y1 } : null,
  };
};

export const getSegmentsBounds = (segments: Segment[]): Bounds => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let hasPoints = false;

  segments.forEach((segment) => {
    const points: Point[] = [];
    if ('x' in segment && Number.isFinite(segment.x) && Number.isFinite(segment.y)) points.push({ x: segment.x, y: segment.y });
    if ('x1' in segment && Number.isFinite(segment.x1) && Number.isFinite(segment.y1)) points.push({ x: segment.x1, y: segment.y1 });
    if ('x2' in segment && Number.isFinite(segment.x2) && Number.isFinite(segment.y2)) points.push({ x: segment.x2, y: segment.y2 });
    if ('outX' in segment && Number.isFinite(segment.outX) && Number.isFinite(segment.outY)) points.push({ x: segment.outX, y: segment.outY });

    points.forEach((p) => {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
      hasPoints = true;
    });
  });

  if (!hasPoints) return { minX: -50, minY: -50, maxX: 50, maxY: 50, width: 100, height: 100, centerX: 0, centerY: 0 };

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
};

export const parsePathToSegments = (d: string): Segment[] => {
  const normalizedPath = d.trim();
  if (!normalizedPath) return [];

  const cached = parsedPathCache.get(normalizedPath);
  if (cached) return cloneSegments(cached);

  const tokens = normalizedPath.match(/[a-df-z]|[+-]?\d*\.?\d+(?:e[+-]?\d+)?/gi) || [];
  const segments: Segment[] = [];
  let lastX = 0;
  let lastY = 0;
  let lastC2X = 0;
  let lastC2Y = 0;
  let startX = 0;
  let startY = 0;
  let activeCmd = '';
  let i = 0;

  const isNum = (token?: string) => token !== undefined && !Number.isNaN(Number(token));
  const lineAsCurve = (fromX: number, fromY: number, toX: number, toY: number): CurveSeg => ({
    type: 'C',
    x1: fromX,
    y1: fromY,
    x2: toX,
    y2: toY,
    x: toX,
    y: toY,
  });

  while (i < tokens.length) {
    const token = tokens[i];
    if (!isNum(token)) {
      activeCmd = token;
      i += 1;
    }
    if (!activeCmd) break;
    const cmd = activeCmd.toUpperCase();
    const isRelative = activeCmd !== cmd;

    switch (cmd) {
      case 'M': {
        if (!isNum(tokens[i]) || !isNum(tokens[i + 1])) break;
        const x = isRelative ? lastX + Number(tokens[i]) : Number(tokens[i]);
        const y = isRelative ? lastY + Number(tokens[i + 1]) : Number(tokens[i + 1]);
        segments.push({ type: 'M', x, y });
        lastX = x;
        lastY = y;
        startX = x;
        startY = y;
        i += 2;
        activeCmd = isRelative ? 'l' : 'L';
        break;
      }
      case 'L': {
        while (isNum(tokens[i]) && isNum(tokens[i + 1])) {
          const x = isRelative ? lastX + Number(tokens[i]) : Number(tokens[i]);
          const y = isRelative ? lastY + Number(tokens[i + 1]) : Number(tokens[i + 1]);
          segments.push(lineAsCurve(lastX, lastY, x, y));
          lastX = x;
          lastY = y;
          i += 2;
        }
        break;
      }
      case 'H': {
        while (isNum(tokens[i])) {
          const x = isRelative ? lastX + Number(tokens[i]) : Number(tokens[i]);
          segments.push(lineAsCurve(lastX, lastY, x, lastY));
          lastX = x;
          i += 1;
        }
        break;
      }
      case 'V': {
        while (isNum(tokens[i])) {
          const y = isRelative ? lastY + Number(tokens[i]) : Number(tokens[i]);
          segments.push(lineAsCurve(lastX, lastY, lastX, y));
          lastY = y;
          i += 1;
        }
        break;
      }
      case 'C': {
        while (isNum(tokens[i]) && isNum(tokens[i + 5])) {
          const x1 = isRelative ? lastX + Number(tokens[i]) : Number(tokens[i]);
          const y1 = isRelative ? lastY + Number(tokens[i + 1]) : Number(tokens[i + 1]);
          const x2 = isRelative ? lastX + Number(tokens[i + 2]) : Number(tokens[i + 2]);
          const y2 = isRelative ? lastY + Number(tokens[i + 3]) : Number(tokens[i + 3]);
          const x = isRelative ? lastX + Number(tokens[i + 4]) : Number(tokens[i + 4]);
          const y = isRelative ? lastY + Number(tokens[i + 5]) : Number(tokens[i + 5]);
          segments.push({ type: 'C', x1, y1, x2, y2, x, y });
          lastX = x;
          lastY = y;
          lastC2X = x2;
          lastC2Y = y2;
          i += 6;
        }
        break;
      }
      case 'S': {
        while (isNum(tokens[i]) && isNum(tokens[i + 3])) {
          const prev = segments[segments.length - 1];
          const x1 = prev && prev.type === 'C' ? lastX + (lastX - lastC2X) : lastX;
          const y1 = prev && prev.type === 'C' ? lastY + (lastY - lastC2Y) : lastY;
          const x2 = isRelative ? lastX + Number(tokens[i]) : Number(tokens[i]);
          const y2 = isRelative ? lastY + Number(tokens[i + 1]) : Number(tokens[i + 1]);
          const x = isRelative ? lastX + Number(tokens[i + 2]) : Number(tokens[i + 2]);
          const y = isRelative ? lastY + Number(tokens[i + 3]) : Number(tokens[i + 3]);
          segments.push({ type: 'C', x1, y1, x2, y2, x, y });
          lastX = x;
          lastY = y;
          lastC2X = x2;
          lastC2Y = y2;
          i += 4;
        }
        break;
      }
      case 'Q': {
        while (isNum(tokens[i]) && isNum(tokens[i + 3])) {
          const qx1 = isRelative ? lastX + Number(tokens[i]) : Number(tokens[i]);
          const qy1 = isRelative ? lastY + Number(tokens[i + 1]) : Number(tokens[i + 1]);
          const x = isRelative ? lastX + Number(tokens[i + 2]) : Number(tokens[i + 2]);
          const y = isRelative ? lastY + Number(tokens[i + 3]) : Number(tokens[i + 3]);
          const x1 = lastX + (2 / 3) * (qx1 - lastX);
          const y1 = lastY + (2 / 3) * (qy1 - lastY);
          const x2 = x + (2 / 3) * (qx1 - x);
          const y2 = y + (2 / 3) * (qy1 - y);
          segments.push({ type: 'C', x1, y1, x2, y2, x, y });
          lastX = x;
          lastY = y;
          lastC2X = x2;
          lastC2Y = y2;
          i += 4;
        }
        break;
      }
      case 'Z': {
        segments.push({ type: 'Z' });
        lastX = startX;
        lastY = startY;
        break;
      }
      default:
        i += 1;
    }
  }

  syncOutgoingHandles(segments);
  parsedPathCache.set(normalizedPath, cloneSegments(segments));
  return segments;
};

export const segmentsToPath = (segments: Segment[]) => segments.map((segment) => {
  if (segment.type === 'M') return `M${segment.x},${segment.y}`;
  if (segment.type === 'C') return `C${segment.x1},${segment.y1} ${segment.x2},${segment.y2} ${segment.x},${segment.y}`;
  return 'Z';
}).join(' ');

export const createRandomLiquidProfile = (seed: number): LiquidProfile => {
  const a = Math.abs(Math.sin(seed * 12.9898) * 43758.5453) % 1;
  const b = Math.abs(Math.sin((seed + 17) * 78.233) * 12345.6789) % 1;
  const c = Math.abs(Math.sin((seed + 31) * 45.164) * 98765.4321) % 1;
  const d = Math.abs(Math.sin((seed + 53) * 91.713) * 24680.1357) % 1;
  const e = Math.abs(Math.sin((seed + 71) * 63.7264) * 19283.7465) % 1;
  const f = Math.abs(Math.sin((seed + 97) * 28.4191) * 56473.1298) % 1;
  const g = Math.abs(Math.sin((seed + 119) * 18.1357) * 35324.2211) % 1;
  const h = Math.abs(Math.sin((seed + 149) * 11.7281) * 77584.9931) % 1;
  const i = Math.abs(Math.sin((seed + 173) * 6.1234) * 14925.3377) % 1;

  return {
    waveFactor: 0.82 + a * 0.42,
    viscosityFactor: 0.9 + b * 0.18,
    phaseOffset: c * Math.PI * 2,
    freqXOffset: (d - 0.5) * 0.0016,
    freqYOffset: (e - 0.5) * 0.0016,
    amplitudeFactor: 0.88 + f * 0.28,
    glossFactor: 0.92 + g * 0.2,
    driftAngle: h * Math.PI * 2,
    driftStrength: 0.7 + i * 0.45,
    swirlMix: 0.35 + a * 0.35,
    pulseBias: 0.75 + b * 0.4,
    stretchBias: 0.7 + c * 0.45,
    wobbleBias: 0.65 + d * 0.45,
    directionBias: (e - 0.5) * 1.2,
  };
};

export const getClientCanvasPoint = (e: { clientX: number; clientY: number }, rect: DOMRect, viewOffset: Point, zoom: number): Point => ({
  x: (e.clientX - rect.left - viewOffset.x) / zoom,
  y: (e.clientY - rect.top - viewOffset.y) / zoom,
});

export const getTextApproxWidth = (textItem: TextItem) => {
  const charWeight = /[\u4e00-\u9fff]/.test(textItem.text) ? 0.92 : 0.62;
  return Math.max(textItem.fontSize * textItem.scale * 1.2, textItem.text.length * textItem.fontSize * textItem.scale * charWeight);
};

export const getTextApproxHeight = (textItem: TextItem) => textItem.fontSize * textItem.scale * 1.2;
export const getTextLensScale = (range: number) => 1.08 + clamp01(range) * 0.98;
export const getTextLensBlur = (range: number) => 0.18 + clamp01(range) * 2.2;
export const getTextLensDisplacement = (range: number) => 2 + clamp01(range) * 16;
export const getTextStrokeWidth = (textItem: TextItem) => textItem.fontSize * 0.0045;
const textEffectBitmapCache = new Map<string, {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  imageData: ImageData;
  logicalWidth: number;
  logicalHeight: number;
  pixelRatio: number;
}>();
const textGrainBitmapCache = new Map<string, HTMLCanvasElement>();

const getRawTextWidth = (textItem: TextItem) => {
  const charWeight = /[\u4e00-\u9fff]/.test(textItem.text) ? 0.92 : 0.62;
  return Math.max(textItem.fontSize * 1.2, textItem.text.length * textItem.fontSize * charWeight);
};

const quantizeSampleScale = (value: number) => Math.round(value * 4) / 4;

export const getTextEffectSettings = (morphAmount: number, blurAmount: number, adhesionAmount: number, time = 0) => {
  const safeAmount = Math.pow(clamp01(morphAmount), 0.92);
  const safeBlur = clamp01(blurAmount);
  const safeAdhesion = Math.pow(clamp01(adhesionAmount), 1.08);
  return {
    baseFrequencyX: 0.0038 + safeAmount * 0.019 + Math.sin(time * 0.65) * safeAmount * 0.0022,
    baseFrequencyY: 0.0072 + safeAmount * 0.026 + Math.cos(time * 0.5) * safeAmount * 0.0025,
    displacementScale: 4 + safeAmount * 80,
    blur: safeBlur * 1.6,
    adhesionBlur: 0.02 + safeAdhesion * 0.42,
    adhesionAlphaSlope: 6.4 + safeAdhesion * 5.1,
    adhesionAlphaIntercept: -1.9 - safeAdhesion * 1.65,
  };
};

const createTextEffectBitmap = (textItem: TextItem, options?: { blur?: number; adhesion?: number; supersample?: number; blurTexture?: number }) => {
  if (typeof document === 'undefined') return null;
  const blur = options?.blur ?? 0;
  const adhesion = Math.pow(clamp01(options?.adhesion ?? 0), 1.08);
  const blurTexture = clamp01(options?.blurTexture ?? 0);
  const supersample = Math.max(1.1, Math.min(2.1, quantizeSampleScale(options?.supersample ?? 1)));
  const cacheKey = [
    textItem.text,
    textItem.fontFamily,
    textItem.fontWeight,
    textItem.fontSize,
    textItem.color,
    blur.toFixed(2),
    adhesion.toFixed(3),
    blurTexture.toFixed(3),
    supersample.toFixed(2),
  ].join('|');
  const cached = textEffectBitmapCache.get(cacheKey);
  if (cached) return cached;
  const rawWidth = getRawTextWidth(textItem);
  const rawHeight = textItem.fontSize * 1.55;
  const padding = Math.max(36, textItem.fontSize * (0.74 + adhesion * 1.18));
  const logicalWidth = Math.ceil(rawWidth + padding * 2);
  const logicalHeight = Math.ceil(rawHeight + padding * 2);
  const width = Math.ceil(logicalWidth * supersample);
  const height = Math.ceil(logicalHeight * supersample);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  const centerX = width / 2;
  const centerY = height / 2;
  const baseCanvas = document.createElement('canvas');
  baseCanvas.width = width;
  baseCanvas.height = height;
  const baseCtx = baseCanvas.getContext('2d', { willReadFrequently: true });
  if (!baseCtx) return null;

  baseCtx.font = `${textItem.fontWeight} ${textItem.fontSize * supersample}px ${textItem.fontFamily}`;
  baseCtx.textAlign = 'center';
  baseCtx.textBaseline = 'middle';
  baseCtx.fillStyle = textItem.color;
  baseCtx.strokeStyle = textItem.color;
  baseCtx.lineWidth = getTextStrokeWidth(textItem) * supersample;
  baseCtx.lineJoin = 'round';
  baseCtx.lineCap = 'round';
  baseCtx.strokeText(textItem.text, centerX, centerY);
  baseCtx.fillText(textItem.text, centerX, centerY);
  const baseImage = baseCtx.getImageData(0, 0, width, height);

  const softenedCanvas = document.createElement('canvas');
  softenedCanvas.width = width;
  softenedCanvas.height = height;
  const softenedCtx = softenedCanvas.getContext('2d', { willReadFrequently: true });
  if (!softenedCtx) return null;

  const adhesionBlur = adhesion > 0.001 ? textItem.fontSize * (0.004 + adhesion * 0.016) * supersample : 0;
  softenedCtx.filter = adhesionBlur > 0.001 ? `blur(${adhesionBlur}px)` : 'none';
  softenedCtx.drawImage(baseCanvas, 0, 0);

  let sourceImage = softenedCtx.getImageData(0, 0, width, height);
  if (adhesion > 0.001) {
    const threshold = 24 + adhesion * 26;
    const softness = 86 - adhesion * 18;
    const keepBase = 0.66 - adhesion * 0.06;
    const adhesionBoost = 0.34 + adhesion * 0.5;
    const minimumInk = 0.2 + adhesion * 0.05;
    const data = sourceImage.data;
    for (let index = 0; index < data.length; index += 4) {
      const alpha = data[index + 3];
      const baseAlpha = baseImage.data[index + 3] / 255;
      const mapped = clamp01((alpha - threshold) / Math.max(18, softness));
      const shaped = Math.pow(mapped, 0.82 + adhesion * 0.08);
      const fusedAlpha = Math.max(baseAlpha * keepBase + shaped * adhesionBoost, baseAlpha * minimumInk);
      const tightened = clamp01((fusedAlpha - (0.03 + adhesion * 0.02)) / (0.92 - adhesion * 0.08));
      data[index + 3] = Math.round(tightened * 255);
    }
    softenedCtx.putImageData(sourceImage, 0, 0);
  }

  ctx.clearRect(0, 0, width, height);
  ctx.filter = blur > 0.001 ? `blur(${blur * supersample}px)` : 'none';
  ctx.drawImage(softenedCanvas, 0, 0);
  const imageData = ctx.getImageData(0, 0, width, height);
  if (blurTexture > 0.04) {
    const data = imageData.data;
    const textureStrength = Math.pow(blurTexture, 0.72);
    for (let index = 0; index < data.length; index += 4) {
      const alpha = data[index + 3];
      if (alpha <= 2) continue;
      const noiseA = seededUnit(index * 0.013 + width * 0.041 + height * 0.017);
      const noiseB = seededUnit(index * 0.0061 + width * 0.019 + 13.7);
      const noiseC = seededUnit(index * 0.0027 + width * 0.11 + height * 0.029);
      const mist = ((noiseA - 0.5) * 0.6 + (noiseB - 0.5) * 0.4);
      const edgeFactor = Math.pow(alpha / 255, 0.82);
      const darkDust = noiseC > 0.72 - textureStrength * 0.22 ? 1 : 0;
      const liftDust = noiseC < 0.08 + textureStrength * 0.06 ? 1 : 0;
      const tonalShift = mist * textureStrength * 24 * edgeFactor - darkDust * textureStrength * 34 * edgeFactor;
      const alphaShift =
        mist * textureStrength * 22 * edgeFactor
        - darkDust * textureStrength * 54 * edgeFactor
        + liftDust * textureStrength * 16 * edgeFactor;
      data[index] = Math.max(0, Math.min(255, Math.round(data[index] + tonalShift)));
      data[index + 1] = Math.max(0, Math.min(255, Math.round(data[index + 1] + tonalShift)));
      data[index + 2] = Math.max(0, Math.min(255, Math.round(data[index + 2] + tonalShift)));
      data[index + 3] = Math.max(0, Math.min(255, Math.round(alpha + alphaShift)));
    }
    ctx.putImageData(imageData, 0, 0);
  }

  const result = { canvas, width, height, imageData, logicalWidth, logicalHeight, pixelRatio: supersample };
  textEffectBitmapCache.set(cacheKey, result);
  if (textEffectBitmapCache.size > 120) {
    const oldestKey = textEffectBitmapCache.keys().next().value;
    if (oldestKey) textEffectBitmapCache.delete(oldestKey);
  }
  return result;
};

const createTextGrainBitmap = () => null;
const mergeTextAndGrainCanvas = (textCanvas: HTMLCanvasElement) => textCanvas;

const sampleCanvasBilinear = (imageData: ImageData, x: number, y: number) => {
  const { width, height, data } = imageData;
  const clampedX = Math.max(0, Math.min(width - 1, x));
  const clampedY = Math.max(0, Math.min(height - 1, y));
  const x0 = Math.floor(clampedX);
  const y0 = Math.floor(clampedY);
  const x1 = Math.min(width - 1, x0 + 1);
  const y1 = Math.min(height - 1, y0 + 1);
  const tx = clampedX - x0;
  const ty = clampedY - y0;
  const i00 = (y0 * width + x0) * 4;
  const i10 = (y0 * width + x1) * 4;
  const i01 = (y1 * width + x0) * 4;
  const i11 = (y1 * width + x1) * 4;
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  const rgba = [0, 0, 0, 0];
  for (let channel = 0; channel < 4; channel += 1) {
    const top = lerp(data[i00 + channel], data[i10 + channel], tx);
    const bottom = lerp(data[i01 + channel], data[i11 + channel], tx);
    rgba[channel] = lerp(top, bottom, ty);
  }
  return rgba as [number, number, number, number];
};

const distortTextBitmap = (sourceCanvas: HTMLCanvasElement, textItem: TextItem, lensStrength: number, morphAmount: number) => {
  if (typeof document === 'undefined') return sourceCanvas;
  const width = sourceCanvas.width;
  const height = sourceCanvas.height;
  const sourceCtx = sourceCanvas.getContext('2d', { willReadFrequently: true });
  if (!sourceCtx) return sourceCanvas;
  const sourceImage = sourceCtx.getImageData(0, 0, width, height);
  const outCanvas = document.createElement('canvas');
  outCanvas.width = width;
  outCanvas.height = height;
  const outCtx = outCanvas.getContext('2d', { willReadFrequently: true });
  if (!outCtx) return sourceCanvas;
  const outImage = outCtx.createImageData(width, height);
  const cx = width / 2;
  const cy = height / 2;
  const morphStrength = Math.pow(clamp01(morphAmount), 0.88);
  const phaseA = textItem.id * 0.071;
  const phaseB = textItem.id * 0.113;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const nx = (x - cx) / Math.max(1, cx);
      const ny = (y - cy) / Math.max(1, cy);
      const radial = Math.sqrt(nx * nx * 0.82 + ny * ny * 1.12);
      const focus = Math.max(0, 1 - radial);
      const bulgeX = 1 + lensStrength * 0.38 * focus * focus;
      const bulgeY = 1 + lensStrength * 0.22 * focus;
      const waveX =
        Math.sin(ny * 5.9 + phaseA) * morphStrength * textItem.fontSize * 0.34 * focus +
        Math.sin(ny * 12.8 + phaseB) * morphStrength * textItem.fontSize * 0.18 * focus;
      const waveY =
        Math.sin(nx * 4.7 + phaseB) * morphStrength * textItem.fontSize * 0.19 * focus +
        Math.cos(nx * 9.6 + phaseA) * morphStrength * textItem.fontSize * 0.08 * focus;
      const shear = Math.sin((nx + ny) * 6.5 + phaseA * 0.7) * morphStrength * textItem.fontSize * 0.07 * focus * focus;

      const srcX = cx + (x - cx) / bulgeX - waveX + shear;
      const srcY = cy + (y - cy) / bulgeY - waveY - shear * 0.55;
      const [r, g, b, a] = sampleCanvasBilinear(sourceImage, srcX, srcY);
      const outIndex = (y * width + x) * 4;
      outImage.data[outIndex] = Math.round(r);
      outImage.data[outIndex + 1] = Math.round(g);
      outImage.data[outIndex + 2] = Math.round(b);
      outImage.data[outIndex + 3] = Math.round(a);
    }
  }

  outCtx.putImageData(outImage, 0, 0);
  return outCanvas;
};

export const getOrderedSceneItems = (elements: ElementItem[], textItems: TextItem[], referenceImages: ReferenceImageItem[] = []) => (
  [
    ...referenceImages.map((item) => ({ kind: 'referenceImage' as const, id: item.id, layerOrder: item.layerOrder })),
    ...elements.map((item) => ({ kind: 'element' as const, id: item.id, layerOrder: item.layerOrder })),
    ...textItems.map((item) => ({ kind: 'text' as const, id: item.id, layerOrder: item.layerOrder })),
  ].sort((a, b) => a.layerOrder - b.layerOrder || (a.kind === b.kind ? a.id - b.id : a.kind === 'referenceImage' ? -1 : a.kind === 'element' && b.kind === 'text' ? -1 : 1))
);

export const getNextSceneLayerOrder = (elements: ElementItem[], textItems: TextItem[], referenceImages: ReferenceImageItem[] = []) => {
  const allOrders = [...referenceImages.map((item) => item.layerOrder), ...elements.map((item) => item.layerOrder), ...textItems.map((item) => item.layerOrder)];
  return (allOrders.length ? Math.max(...allOrders) : 0) + 1;
};

export const getElementLocalBounds = (el: ElementItem) => getSegmentsBounds(el.segments);

export const getElementEllipseRadiusAlongDirection = (el: ElementItem, direction: Point) => {
  const bounds = getElementLocalBounds(el);
  const rx = Math.max(1, (bounds.width * el.scale) / 2);
  const ry = Math.max(1, (bounds.height * el.scale) / 2);
  const rad = -el.rotation * (Math.PI / 180);
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const localX = direction.x * cos - direction.y * sin;
  const localY = direction.x * sin + direction.y * cos;
  const denom = (localX * localX) / (rx * rx) + (localY * localY) / (ry * ry);
  return denom <= 0 ? Math.max(rx, ry) : 1 / Math.sqrt(denom);
};

export const getPotentialOverlapPairs = (elements: ElementItem[]): ContactOverlap[] => {
  const overlaps: ContactOverlap[] = [];
  for (let i = 0; i < elements.length; i += 1) {
    for (let j = i + 1; j < elements.length; j += 1) {
      const a = elements[i];
      const b = elements[j];
      const aBounds = getElementLocalBounds(a);
      const bBounds = getElementLocalBounds(b);
      const aRadius = (Math.max(aBounds.width, aBounds.height) * a.scale) / 2;
      const bRadius = (Math.max(bBounds.width, bBounds.height) * b.scale) / 2;
      const distance = Math.hypot(b.x - a.x, b.y - a.y);
      if (distance < aRadius + bRadius) overlaps.push({ id: `${a.id}-${b.id}`, a, b });
    }
  }
  return overlaps;
};

const getNegativeNoiseCanvas = () => {
  if (typeof document === 'undefined') return null;
  const cacheKey = '__bubble_negative_noise_canvas__';
  const globalScope = window as typeof window & { [cacheKey]?: HTMLCanvasElement };
  if (globalScope[cacheKey]) return globalScope[cacheKey] || null;
  const canvas = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const imageData = ctx.createImageData(canvas.width, canvas.height);
  for (let i = 0; i < imageData.data.length; i += 4) {
    const grain = 210 + Math.floor(Math.random() * 45);
    imageData.data[i] = grain;
    imageData.data[i + 1] = grain;
    imageData.data[i + 2] = grain;
    imageData.data[i + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);
  globalScope[cacheKey] = canvas;
  return canvas;
};

export const getContactRenderPath = (el: ElementItem, contactMode: ContactMode, contactSettings: ContactSettings) => {
  if (contactMode !== 'negative' || contactSettings.negativeRoundness <= 0.001) return el.path;
  return morphPathByStyle(el.path, 'smooth', el.id + 4096, contactSettings.negativeRoundness * 0.55);
};

const getNegativeModeLocalMatrix = (el: ElementItem, sampleTime: number, liquidSettings: LiquidSettings) => {
  if (!liquidSettings.enabled) return new DOMMatrix();
  const profile = el.liquidProfile;
  const animatedTime = sampleTime * liquidSettings.speed * (0.82 + profile.viscosityFactor * 0.18);
  const waveEnergy = liquidSettings.waveScale * profile.amplitudeFactor;
  const breathe = Math.sin(animatedTime + profile.phaseOffset);
  const sway = Math.cos(animatedTime * 0.74 + profile.phaseOffset * 0.82);
  const twist = Math.sin(animatedTime * 0.46 + profile.phaseOffset * 1.14);
  const stretchBase = liquidSettings.mode === 'bubble' ? 0.032 : liquidSettings.mode === 'squash' ? 0.05 : 0.026;
  const scaleX = 1 + sway * waveEnergy * stretchBase + breathe * 0.015;
  const scaleY = 1 - sway * waveEnergy * stretchBase * 0.78 + breathe * 0.02;
  const driftStrength = el.size * waveEnergy * 0.028;
  const offsetX = Math.cos(profile.driftAngle) * driftStrength * sway;
  const offsetY = Math.sin(profile.driftAngle) * driftStrength * breathe;
  const rotation = (profile.directionBias * 4 + twist * 3.5) * waveEnergy * 0.65;
  return new DOMMatrix().translateSelf(offsetX, offsetY).rotateSelf(rotation).scaleSelf(scaleX, scaleY);
};

export const harmonizeLiquidProfile = (profile: LiquidProfile, baseline: { waveFactor: number; viscosityFactor: number; amplitudeFactor: number } | null, strength: number): LiquidProfile => {
  const mix = clamp01(strength);
  const target = baseline ?? { waveFactor: 1, viscosityFactor: 1, amplitudeFactor: 1 };
  return {
    ...profile,
    waveFactor: profile.waveFactor * (1 - mix) + target.waveFactor * mix,
    viscosityFactor: profile.viscosityFactor * (1 - mix) + target.viscosityFactor * mix,
    amplitudeFactor: profile.amplitudeFactor * (1 - mix) + target.amplitudeFactor * mix,
    freqXOffset: profile.freqXOffset * (1 - mix * 0.82),
    freqYOffset: profile.freqYOffset * (1 - mix * 0.82),
    driftStrength: profile.driftStrength * (1 - mix * 0.35) + 0.9 * mix * 0.35,
    swirlMix: profile.swirlMix * (1 - mix * 0.55) + 0.46 * mix * 0.55,
    pulseBias: profile.pulseBias * (1 - mix * 0.45) + 0.94 * mix * 0.45,
    stretchBias: profile.stretchBias * (1 - mix * 0.42) + 0.9 * mix * 0.42,
    wobbleBias: profile.wobbleBias * (1 - mix * 0.5) + 0.88 * mix * 0.5,
    directionBias: profile.directionBias * (1 - mix * 0.78),
  };
};

export const drawNegativeContactScene = ({ ctx, width, height, elements, overlapCutouts, grain, sampleTime, liquidSettings, contactSettings, getMatrix, backgroundFill }: {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  elements: ElementItem[];
  overlapCutouts: ContactOverlap[];
  grain: number;
  sampleTime: number;
  liquidSettings: LiquidSettings;
  contactSettings: ContactSettings;
  getMatrix: (el: ElementItem) => DOMMatrix;
  backgroundFill?: string | null;
}) => {
  ctx.clearRect(0, 0, width, height);
  if (backgroundFill) {
    ctx.fillStyle = backgroundFill;
    ctx.fillRect(0, 0, width, height);
  }
  const noiseCanvas = grain > 0 ? getNegativeNoiseCanvas() : null;
  const pathMap = new Map<number, Path2D>();
  elements.forEach((el) => {
    const renderPath = getContactRenderPath(el, 'negative', contactSettings);
    const transformedPath = new Path2D();
    transformedPath.addPath(new Path2D(renderPath), getMatrix(el).multiply(getNegativeModeLocalMatrix(el, sampleTime, liquidSettings)));
    pathMap.set(el.id, transformedPath);
    ctx.save();
    ctx.fillStyle = el.color;
    ctx.fill(transformedPath);
    if (noiseCanvas && grain > 0) {
      ctx.clip(transformedPath);
      ctx.globalAlpha = Math.min(0.25, grain * 0.32);
      ctx.drawImage(noiseCanvas, 0, 0, width, height);
    }
    ctx.restore();
  });
  ctx.save();
  ctx.fillStyle = '#ffffff';
  overlapCutouts.forEach((overlap) => {
    const pathA = pathMap.get(overlap.a.id);
    const pathB = pathMap.get(overlap.b.id);
    if (!pathA || !pathB) return;
    ctx.save();
    ctx.clip(pathA);
    ctx.fill(pathB);
    ctx.restore();
  });
  ctx.restore();
};

export const drawTextLensScene = ({ ctx, textItems, elements, lensRange, getTextPoint, getTextScale, getMatrix, getVisibleElementsForText, clipToVisibleElements = true }: {
  ctx: CanvasRenderingContext2D;
  textItems: TextItem[];
  elements: ElementItem[];
  lensRange: number;
  getTextPoint: (textItem: TextItem) => Point;
  getTextScale?: (textItem: TextItem) => number;
  getMatrix: (el: ElementItem) => DOMMatrix;
  getVisibleElementsForText: (textItem: TextItem) => ElementItem[];
  clipToVisibleElements?: boolean;
}) => {
  const lensStrength = clamp01(lensRange);
  const lensScale = getTextLensScale(lensStrength);
  const lensBlur = getTextLensBlur(lensStrength);
  textItems.forEach((textItem) => {
    const point = getTextPoint(textItem);
    const visibleElements = getVisibleElementsForText(textItem);
    if (!visibleElements.length) return;
    const clipPath = new Path2D();
    visibleElements.forEach((el) => {
      clipPath.addPath(new Path2D(el.path), getMatrix(el));
    });
    const morphAmount = clamp01(textItem.morphAmount ?? 0);
    const blurAmount = clamp01(textItem.roundnessAmount ?? 0);
    const adhesionAmount = clamp01(textItem.adhesionAmount ?? 0);
    const textScale = getTextScale ? getTextScale(textItem) : textItem.scale;
    const contentBlur = 0.14 + lensBlur * 0.32 + blurAmount * 7.4;
    const textBitmapScale = Math.max(1.15, Math.min(1.8, textScale * lensScale * 0.92));
    const textBitmap = createTextEffectBitmap(textItem, {
      blur: contentBlur,
      adhesion: adhesionAmount,
      supersample: textBitmapScale,
      blurTexture: blurAmount,
    });
    if (!textBitmap) return;
    const warpedTextCanvas = distortTextBitmap(textBitmap.canvas, textItem, lensStrength, morphAmount);
    const mergedTextCanvas = mergeTextAndGrainCanvas(warpedTextCanvas);
    ctx.save();
    if (clipToVisibleElements) ctx.clip(clipPath);
    ctx.save();
    ctx.globalAlpha = 0.98;
    ctx.filter = `blur(${Math.max(0.2, lensBlur * 0.52 + blurAmount * 1.45)}px)`;
    ctx.imageSmoothingEnabled = true;
    ctx.translate(point.x, point.y);
    ctx.rotate(textItem.rotation * (Math.PI / 180));
    ctx.scale(textScale * lensScale, textScale * lensScale);
    ctx.drawImage(
      mergedTextCanvas,
      -textBitmap.logicalWidth / 2,
      -textBitmap.logicalHeight / 2,
      textBitmap.logicalWidth,
      textBitmap.logicalHeight,
    );
    ctx.restore();
    ctx.restore();
  });
};

const buildTangencySeamPath = (center: Point, tangent: Point, normal: Point, halfLength: number, halfWidth: number) => {
  const top = { x: center.x + tangent.x * halfLength, y: center.y + tangent.y * halfLength };
  const bottom = { x: center.x - tangent.x * halfLength, y: center.y - tangent.y * halfLength };
  const upperRight = { x: center.x + tangent.x * (halfLength * 0.14) + normal.x * halfWidth, y: center.y + tangent.y * (halfLength * 0.14) + normal.y * halfWidth };
  const lowerRight = { x: center.x - tangent.x * (halfLength * 0.14) + normal.x * halfWidth, y: center.y - tangent.y * (halfLength * 0.14) + normal.y * halfWidth };
  const upperLeft = { x: center.x + tangent.x * (halfLength * 0.14) - normal.x * halfWidth, y: center.y + tangent.y * (halfLength * 0.14) - normal.y * halfWidth };
  const lowerLeft = { x: center.x - tangent.x * (halfLength * 0.14) - normal.x * halfWidth, y: center.y - tangent.y * (halfLength * 0.14) - normal.y * halfWidth };
  const tipControl = halfLength * 0.42;
  const sideControl = halfLength * 0.16;
  const widthControl = halfWidth * 0.9;
  return [
    `M${top.x},${top.y}`,
    `C${top.x + normal.x * widthControl},${top.y + normal.y * widthControl} ${upperRight.x + tangent.x * sideControl},${upperRight.y + tangent.y * tipControl} ${upperRight.x},${upperRight.y}`,
    `C${lowerRight.x + tangent.x * sideControl},${lowerRight.y - tangent.y * sideControl} ${bottom.x + normal.x * widthControl},${bottom.y + normal.y * widthControl} ${bottom.x},${bottom.y}`,
    `C${bottom.x - normal.x * widthControl},${bottom.y - normal.y * widthControl} ${lowerLeft.x - tangent.x * sideControl},${lowerLeft.y - tangent.y * tipControl} ${lowerLeft.x},${lowerLeft.y}`,
    `C${upperLeft.x - tangent.x * sideControl},${upperLeft.y + tangent.y * sideControl} ${top.x - normal.x * widthControl},${top.y - normal.y * widthControl} ${top.x},${top.y}`,
    'Z',
  ].join(' ');
};

export const getNegativeContactSeams = (elements: ElementItem[]): ContactSeam[] => {
  const seams: ContactSeam[] = [];
  for (let i = 0; i < elements.length; i += 1) {
    for (let j = i + 1; j < elements.length; j += 1) {
      const a = elements[i];
      const b = elements[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distance = Math.hypot(dx, dy);
      if (distance < 0.001) continue;
      const normal = { x: dx / distance, y: dy / distance };
      const tangent = { x: -normal.y, y: normal.x };
      const aNormalRadius = getElementEllipseRadiusAlongDirection(a, normal);
      const bNormalRadius = getElementEllipseRadiusAlongDirection(b, { x: -normal.x, y: -normal.y });
      const aTangentRadius = getElementEllipseRadiusAlongDirection(a, tangent);
      const bTangentRadius = getElementEllipseRadiusAlongDirection(b, { x: -tangent.x, y: -tangent.y });
      const minNormalRadius = Math.min(aNormalRadius, bNormalRadius);
      const contactDelta = distance - (aNormalRadius + bNormalRadius);
      const nearGapLimit = Math.max(10, minNormalRadius * 0.2);
      const overlapLimit = Math.max(12, minNormalRadius * 0.28);
      if (contactDelta > nearGapLimit || contactDelta < -overlapLimit) continue;
      const proximityStrength = contactDelta >= 0 ? 1 - clamp01(contactDelta / nearGapLimit) : 1 - clamp01(Math.abs(contactDelta) / overlapLimit);
      const closeness = proximityStrength * proximityStrength;
      if (closeness <= 0.08) continue;
      const halfLength = Math.min(aTangentRadius, bTangentRadius) * (0.1 + closeness * 0.18);
      const halfWidth = Math.max(1.1, Math.min(4.2, minNormalRadius * (0.008 + closeness * 0.012)));
      if (halfLength <= halfWidth * 2.8) continue;
      const aSurface = { x: a.x + normal.x * aNormalRadius, y: a.y + normal.y * aNormalRadius };
      const bSurface = { x: b.x - normal.x * bNormalRadius, y: b.y - normal.y * bNormalRadius };
      const center = { x: (aSurface.x + bSurface.x) / 2, y: (aSurface.y + bSurface.y) / 2 };
      seams.push({ path: buildTangencySeamPath(center, tangent, normal, halfLength, halfWidth), shadowOpacity: 0.05 + closeness * 0.09 });
    }
  }
  return seams;
};

export const simplifyPolyline = (points: Point[], tolerance: number) => {
  if (points.length <= 2) return points.slice();
  const sqTolerance = tolerance * tolerance;
  const getSqSegDist = (point: Point, start: Point, end: Point) => {
    let x = start.x;
    let y = start.y;
    let dx = end.x - x;
    let dy = end.y - y;
    if (dx !== 0 || dy !== 0) {
      const t = ((point.x - x) * dx + (point.y - y) * dy) / (dx * dx + dy * dy);
      if (t > 1) { x = end.x; y = end.y; } else if (t > 0) { x += dx * t; y += dy * t; }
    }
    dx = point.x - x;
    dy = point.y - y;
    return dx * dx + dy * dy;
  };
  const simplifyDPStep = (pts: Point[], first: number, last: number, simplified: Point[]) => {
    let maxSqDist = sqTolerance;
    let index = -1;
    for (let i = first + 1; i < last; i += 1) {
      const sqDist = getSqSegDist(pts[i], pts[first], pts[last]);
      if (sqDist > maxSqDist) { index = i; maxSqDist = sqDist; }
    }
    if (index !== -1) {
      if (index - first > 1) simplifyDPStep(pts, first, index, simplified);
      simplified.push(pts[index]);
      if (last - index > 1) simplifyDPStep(pts, index, last, simplified);
    }
  };
  const simplified = [points[0]];
  simplifyDPStep(points, 0, points.length - 1, simplified);
  simplified.push(points[points.length - 1]);
  return simplified;
};

export const reducePointsToTarget = (points: Point[], targetCount: number) => {
  if (points.length <= targetCount) return points.slice();
  if (targetCount <= 3) return points.slice(0, 3);
  const result: Point[] = [];
  const lastIndex = points.length - 1;
  for (let i = 0; i < targetCount; i += 1) {
    const sampleIndex = Math.round((i / (targetCount - 1)) * lastIndex);
    const point = points[sampleIndex];
    const prev = result[result.length - 1];
    if (!prev || distanceBetweenPoints(prev, point) > 0.001) result.push(point);
  }
  return result;
};

export const reducePointsToTargetPreservingIndices = (points: Point[], targetCount: number, preserveIndexes: number[]) => {
  if (points.length <= targetCount) return points.slice();
  const required = Array.from(new Set([0, points.length - 1, ...preserveIndexes.filter((index) => index > 0 && index < points.length - 1)])).sort((a, b) => a - b);
  if (required.length >= targetCount) return required.slice(0, targetCount).map((index) => points[index]);
  const resultIndexes = new Set<number>(required);
  const remaining = targetCount - resultIndexes.size;
  for (let i = 0; i < remaining; i += 1) {
    const sampleIndex = Math.round(((i + 1) / (remaining + 1)) * (points.length - 1));
    resultIndexes.add(sampleIndex);
  }
  return Array.from(resultIndexes).sort((a, b) => a - b).slice(0, targetCount).map((index) => points[index]);
};

export const chaikinSmoothClosed = (points: Point[], iterations: number) => {
  let current = points.slice();
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    if (current.length < 3) return current;
    const next: Point[] = [];
    for (let i = 0; i < current.length; i += 1) {
      const a = current[i];
      const b = current[(i + 1) % current.length];
      next.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 });
      next.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
    }
    current = next;
  }
  return current;
};

export const simplifyBrushPoints = (points: Point[], referenceSize: number) => {
  if (points.length <= 6) return points.slice();
  const baseTolerance = Math.max(2.5, Math.min(10, referenceSize * 0.018));
  const targetCount = Math.max(8, Math.min(14, Math.round(referenceSize / 110) + 6));
  let tolerance = baseTolerance;
  let simplified = simplifyPolyline(points, tolerance);
  let guard = 0;
  while (simplified.length > targetCount && guard < 8) {
    tolerance *= 1.2;
    simplified = simplifyPolyline(points, tolerance);
    guard += 1;
  }
  if (simplified.length > targetCount) simplified = reducePointsToTarget(simplified, targetCount);
  return simplified.length >= 4 ? simplified : points.slice();
};

export const getBrushAnchorTarget = (referenceSize: number) => Math.max(8, Math.min(14, Math.round(referenceSize / 110) + 6));

export const getBrushAngularity = (points: Point[]) => {
  if (points.length < 3) return 0;
  let totalCornerness = 0;
  let maxCornerness = 0;
  let sampleCount = 0;
  for (let i = 0; i < points.length; i += 1) {
    const prev = points[(i - 1 + points.length) % points.length];
    const current = points[i];
    const next = points[(i + 1) % points.length];
    const v1x = current.x - prev.x;
    const v1y = current.y - prev.y;
    const v2x = next.x - current.x;
    const v2y = next.y - current.y;
    const len1 = Math.hypot(v1x, v1y);
    const len2 = Math.hypot(v2x, v2y);
    if (len1 < 0.001 || len2 < 0.001) continue;
    const dot = (v1x * v2x + v1y * v2y) / (len1 * len2);
    const cornerness = 1 - Math.max(-1, Math.min(1, dot));
    totalCornerness += cornerness;
    maxCornerness = Math.max(maxCornerness, cornerness);
    sampleCount += 1;
  }
  if (sampleCount === 0) return 0;
  return totalCornerness / sampleCount * 0.65 + maxCornerness * 0.35;
};

export const getBrushCornerIndexes = (points: Point[]) => {
  if (points.length < 5) return [] as number[];
  const corners: number[] = [];
  for (let i = 0; i < points.length; i += 1) {
    const prev = points[(i - 1 + points.length) % points.length];
    const current = points[i];
    const next = points[(i + 1) % points.length];
    const v1x = current.x - prev.x;
    const v1y = current.y - prev.y;
    const v2x = next.x - current.x;
    const v2y = next.y - current.y;
    const len1 = Math.hypot(v1x, v1y);
    const len2 = Math.hypot(v2x, v2y);
    if (len1 < 0.001 || len2 < 0.001) continue;
    const dot = (v1x * v2x + v1y * v2y) / (len1 * len2);
    const cornerness = 1 - Math.max(-1, Math.min(1, dot));
    if (cornerness > 0.22) corners.push(i);
  }
  return corners;
};

export const stabilizeBrushLiquidProfile = (profile: LiquidProfile): LiquidProfile => ({
  ...profile,
  waveFactor: 0.92 + (profile.waveFactor - 0.92) * 0.35,
  viscosityFactor: 0.98 + (profile.viscosityFactor - 0.98) * 0.45,
  amplitudeFactor: 0.9 + (profile.amplitudeFactor - 0.9) * 0.3,
  freqXOffset: profile.freqXOffset * 0.3,
  freqYOffset: profile.freqYOffset * 0.3,
  driftStrength: 0.8 + (profile.driftStrength - 0.8) * 0.35,
  swirlMix: 0.4 + (profile.swirlMix - 0.4) * 0.3,
  pulseBias: 0.9 + (profile.pulseBias - 0.9) * 0.35,
  stretchBias: 0.88 + (profile.stretchBias - 0.88) * 0.25,
  wobbleBias: 0.84 + (profile.wobbleBias - 0.84) * 0.2,
  directionBias: profile.directionBias * 0.25,
});

export const buildSmoothClosedPath = (points: Point[], tension = 0.18) => {
  if (points.length < 2) return '';
  if (points.length === 2) return `M${points[0].x},${points[0].y} L${points[1].x},${points[1].y} Z`;
  if (points.length === 3) return `M${points[0].x},${points[0].y} L${points[1].x},${points[1].y} L${points[2].x},${points[2].y} Z`;
  const safeTension = Math.max(0.05, Math.min(0.35, tension));
  let path = `M${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    const previous = points[(i - 1 + points.length) % points.length];
    const afterNext = points[(i + 2) % points.length];
    const cp1x = current.x + (next.x - previous.x) * safeTension;
    const cp1y = current.y + (next.y - previous.y) * safeTension;
    const cp2x = next.x - (afterNext.x - current.x) * safeTension;
    const cp2y = next.y - (afterNext.y - current.y) * safeTension;
    path += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${next.x},${next.y}`;
  }
  return `${path} Z`;
};

export const morphPathByStyle = (path: string, style: ShapeStyle, seedOffset = 0, intensity = 1) => {
  const normalizedIntensity = clamp01(intensity);
  if (style === 'smooth' && normalizedIntensity <= 0.001) return path;
  const cacheKey = `${style}::${seedOffset}::${normalizedIntensity.toFixed(4)}::${path}`;
  const cached = morphedPathCache.get(cacheKey);
  if (cached) return cached;
  const config = SHAPE_STYLE_CONFIG[style];
  const segments = parsePathToSegments(path).map((seg) => ({ ...seg })) as Segment[];
  const drawableIndexes = segments.reduce<number[]>((acc, seg, index) => {
    if (seg.type !== 'Z') acc.push(index);
    return acc;
  }, []);
  drawableIndexes.forEach((segIndex, order) => {
    const seg = segments[segIndex];
    if (seg.type === 'Z') return;
    const noiseA = seededUnit(segIndex * 19.73 + order * 3.17 + seedOffset + 1);
    const noiseB = seededUnit(segIndex * 7.31 + order * 11.91 + seedOffset + 2);
    const angle = (order / Math.max(1, drawableIndexes.length)) * Math.PI * 2;
    const radialX = Math.cos(angle);
    const radialY = Math.sin(angle);
    const offsetScale = 8 + config.cornerBias * 14;
    const offsetX = ((noiseA - 0.5) * config.jitter * offsetScale + radialX * config.cornerBias * 1.5) * normalizedIntensity;
    const offsetY = ((noiseB - 0.5) * config.jitter * offsetScale + radialY * config.cornerBias * 1.5) * normalizedIntensity;
    seg.x += offsetX;
    seg.y += offsetY;
    if (seg.type === 'C') {
      const styleHandleBlend = clamp01(1 - config.smoothness * 1.6);
      const handleBlend = 1 - (1 - styleHandleBlend) * normalizedIntensity;
      seg.x1 = seg.x + (seg.x1 - seg.x) * handleBlend;
      seg.y1 = seg.y + (seg.y1 - seg.y) * handleBlend;
      seg.x2 = seg.x + (seg.x2 - seg.x) * handleBlend;
      seg.y2 = seg.y + (seg.y2 - seg.y) * handleBlend;
    }
  });
  syncOutgoingHandles(segments);
  const morphedPath = segmentsToPath(segments);
  morphedPathCache.set(cacheKey, morphedPath);
  return morphedPath;
};
