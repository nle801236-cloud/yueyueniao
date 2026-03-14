import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import GIF from 'gif.js.optimized';
import gifWorkerUrl from 'gif.js.optimized/dist/gif.worker.js?url';
import {
  Trash2,
  Plus,
  Sparkles,
  Palette,
  Sliders,
  Sun,
  Waves,
  Target,
  Hand,
  ZoomIn,
  Maximize2,
  Link2,
  User,
  Pencil,
  Undo2,
  ChevronRight,
  Settings2,
  LayoutGrid,
  Info,
  FileCode,
  Droplets,
  Wind,
  Zap,
  PanelLeftClose,
  PanelLeftOpen,
  Download,
  Layers3,
  Wand2,
} from 'lucide-react';

type Point = { x: number; y: number };
type Bounds = { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number; centerX: number; centerY: number };
type MoveSeg = { type: 'M'; x: number; y: number };
type CurveSeg = {
  type: 'C';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  x: number;
  y: number;
  outX?: number;
  outY?: number;
};
type CloseSeg = { type: 'Z' };
type Segment = MoveSeg | CurveSeg | CloseSeg;

type MotionMode = 'classic' | 'liquid' | 'bubble' | 'squash';
type ContactMode = 'fusion' | 'overlay' | 'negative';
type ShapeStyle = 'smooth' | 'organic' | 'polygon';
type SectionKey = 'quick' | 'physics' | 'color' | 'motion' | 'style' | 'artboard' | 'library';

type LiquidProfile = {
  waveFactor: number;
  viscosityFactor: number;
  phaseOffset: number;
  freqXOffset: number;
  freqYOffset: number;
  amplitudeFactor: number;
  glossFactor: number;
  driftAngle: number;
  driftStrength: number;
  swirlMix: number;
  pulseBias: number;
  stretchBias: number;
  wobbleBias: number;
  directionBias: number;
};

type ElementItem = {
  id: number;
  name: string;
  path: string;
  basePath: string;
  segments: Segment[];
  x: number;
  y: number;
  rotation: number;
  scale: number;
  color: string;
  size: number;
  liquidProfile: LiquidProfile;
};

type GlowSettings = {
  contactSuction: number;
  individualSuction: number;
  glowDepth: number;
  gradientShade: number;
  edgeThickness: number;
  innerSoftness: number;
  intensity: number;
  grain: number;
  lineJitter: number;
};

type ContactSettings = {
  negativeRoundness: number;
  negativeGrain: number;
  overlayBlur: number;
  overlayBlurOpacity: number;
};

type ImportAmplitudeMode = 'natural' | 'strict';

type LiquidSettings = {
  enabled: boolean;
  speed: number;
  viscosity: number;
  glossiness: number;
  waveScale: number;
  mode: MotionMode;
  importAmplitudeMode: ImportAmplitudeMode;
};

type ArtboardSettings = {
  width: number;
  height: number;
  clipContent: boolean;
};

type ActivePointState = {
  elId: number;
  segIndex: number;
  prop: 'main' | 'in' | 'out';
  screenStartX: number;
  screenStartY: number;
  initialRotation: number;
  initialScale: number;
  initialZoom: number;
  origPointX?: number;
  origPointY?: number;
  origX1?: number;
  origY1?: number;
  origX2?: number;
  origY2?: number;
  origOutX?: number;
  origOutY?: number;
  origNextX1?: number;
  origNextY1?: number;
};

type MarqueeState = {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
};

type PresetItem = {
  name: string;
  path: string;
};

type LiquidFilterFrame = { id: number; baseFrequency: string; displacementScale: number; glossiness: number };
type ScaleHandle = 'corner' | 'top' | 'right' | 'bottom' | 'left';
type ContactSeam = { path: string; shadowOpacity: number };
type ContactOverlap = { id: string; a: ElementItem; b: ElementItem };

type SidebarProps = {
  activeColor: string;
  palette: { name: string; value: string }[];
  selectedIds: number[];
  selectedIdSet: Set<number>;
  elements: ElementItem[];
  contactMode: ContactMode;
  setContactMode: React.Dispatch<React.SetStateAction<ContactMode>>;
  contactSettings: ContactSettings;
  setContactSettings: React.Dispatch<React.SetStateAction<ContactSettings>>;
  glowSettings: GlowSettings;
  setGlowSettings: React.Dispatch<React.SetStateAction<GlowSettings>>;
  liquidSettings: LiquidSettings;
  setLiquidSettings: React.Dispatch<React.SetStateAction<LiquidSettings>>;
  rerandomizeLiquidProfiles: () => void;
  artboard: ArtboardSettings;
  setArtboard: React.Dispatch<React.SetStateAction<ArtboardSettings>>;
  fitViewToArtboard: () => void;
  shapeStyle: ShapeStyle;
  shapeStyleIntensity: number;
  setShapeStyleIntensity: React.Dispatch<React.SetStateAction<number>>;
  applyShapeStyleToArtboard: (style: ShapeStyle, options?: { silent?: boolean }) => void;
  setActiveColor: React.Dispatch<React.SetStateAction<string>>;
  commitElements: (next: ElementItem[], options?: { saveHistory?: boolean }) => void;
  addElement: (pathData: string, name?: string, options?: { alignAmplitudeToArtboard?: boolean }) => void;
  sectionOpen: Record<SectionKey, boolean>;
  toggleSection: (key: SectionKey) => void;
  collapsedSidebar: boolean;
  setCollapsedSidebar: React.Dispatch<React.SetStateAction<boolean>>;
};

type ToolbarProps = {
  historyIndex: number;
  fillCanvas: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isBrushMode: boolean;
  setIsBrushMode: React.Dispatch<React.SetStateAction<boolean>>;
  isEditMode: boolean;
  setIsEditMode: React.Dispatch<React.SetStateAction<boolean>>;
  setBrushPoints: React.Dispatch<React.SetStateAction<Point[]>>;
  setIsDrawingBrush: React.Dispatch<React.SetStateAction<boolean>>;
  selectedIds: number[];
  moveSelectedBackward: () => void;
  moveSelectedForward: () => void;
  deleteSelectedElements: () => void;
  downloadPNG: () => void;
  downloadTransparentGif: () => void;
  isExportingGif: boolean;
  pngExportScale: number;
  setPngExportScale: React.Dispatch<React.SetStateAction<number>>;
  pngOutputWidth: number;
  pngOutputHeight: number;
  gifExportScale: number;
  setGifExportScale: React.Dispatch<React.SetStateAction<number>>;
  gifFrameCount: number;
  setGifFrameCount: React.Dispatch<React.SetStateAction<number>>;
  gifOutputWidth: number;
  gifOutputHeight: number;
  undo: () => void;
  setSelectedIds: React.Dispatch<React.SetStateAction<number[]>>;
};

type StageProps = {
  canvasRef: React.RefObject<HTMLDivElement | null>;
  isDraggingOver: boolean;
  setIsDraggingOver: React.Dispatch<React.SetStateAction<boolean>>;
  onDrop: (e: React.DragEvent) => void;
  handlePointerDown: (
    e: React.PointerEvent,
    id: number | null,
    mode?: 'drag' | 'rotate' | 'scale' | 'groupScale' | 'groupRotate' | 'point',
    extra?: Partial<ActivePointState> & { elId?: number; segIndex?: number; prop?: 'main' | 'in' | 'out'; scaleHandle?: ScaleHandle },
  ) => void;
  handlePointerMove: (e: React.PointerEvent) => void;
  handlePointerUp: () => void;
  handleWheel: (e: React.WheelEvent) => void;
  isPanning: boolean;
  isBrushMode: boolean;
  isEditMode: boolean;
  marquee: MarqueeState | null;
  scalingGroup: boolean;
  viewOffset: Point;
  zoom: number;
  liquidFilters: LiquidFilterFrame[];
  contactMode: ContactMode;
  contactSettings: ContactSettings;
  glowSettings: GlowSettings;
  artboard: ArtboardSettings;
  artboardRect: { x: number; y: number; width: number; height: number };
  elements: ElementItem[];
  selectedIdSet: Set<number>;
  liquidSettings: LiquidSettings;
  brushPoints: Point[];
  isDrawingBrush: boolean;
  activeColor: string;
  time: number;
  selectedSingle: ElementItem | null;
  selectedPointIdx: number | null;
  groupBounds: { minX: number; minY: number; maxX: number; maxY: number } | null;
  fitViewToArtboard: () => void;
};

const PRESET_DATA: PresetItem[] = [
  { name: '福桃', path: 'M0,-45 C0,-45 45,-35 45,5 C45,40 15,55 0,40 C-15,55 -45,40 -45,5 C-45,-35 0,-45 0,-45 Z' },
  { name: '宝葫芦', path: 'M0,-55 C5,-55 8,-52 8,-48 C8,-44 5,-41 5,-41 C15,-41 25,-35 25,-20 C25,-10 15,-5 10,-5 C25,0 35,15 35,35 C35,55 20,65 0,65 C-20,65 -35,55 -35,35 C-35,15 -25,0 -10,-5 C-15,-5 -25,-10 -25,-20 C-25,-35 -15,-41 -5,-41 C-5,-41 -8,-44 -8,-48 C-8,-52 -5,-55 0,-55 Z' },
  { name: '金元宝', path: 'M-65,10 C-65,40 -35,55 0,55 C35,55 65,40 65,10 C65,-10 55,-20 45,-20 C35,-20 30,-10 20,-10 C15,-10 20,-45 0,-45 C-20,-45 -15,-10 -20,-10 C-30,-10 -35,-20 -45,-20 C-55,-20 -65,-10 -65,10 Z' },
  { name: '古铜钱', path: 'M0,-50 C27.6,-50 50,-27.6 50,0 C50,27.6 27.6,50 0,50 C-27.6,50 -50,27.6 -50,0 C-50,-27.6 -27.6,-50 0,-50 Z M-15,-15 C-18,-15 -18,-15 -18,-12 L-18,12 C-18,15 -18,15 -15,15 L15,15 C18,15 18,15 18,12 L18,-12 C18,-15 18,-15 15,-15 Z' },
  { name: '海棠花', path: 'M-22,-38 C-22,-58 22,-58 22,-38 C42,-38 58,-22 58,0 C58,22 42,38 22,38 C22,58 -22,58 -22,38 C-42,38 -58,22 -58,0 C-58,-22 -42,-38 -22,-38 Z' },
  { name: '稚拙小石', path: 'M-35,10 C-35,-15 -15,-35 10,-32 C35,-29 42,-5 38,15 C34,35 5,42 -20,38 C-35,34 -35,25 -35,10 Z' },
  { name: '有机气泡', path: 'M-42,0 C-42,-28 -22,-42 5,-40 C32,-38 45,-18 40,8 C35,34 10,45 -15,40 C-40,35 -42,20 -42,0 Z' },
  { name: '流体水滴', path: 'M-5,-48 C15,-48 35,-25 32,10 C29,45 -5,52 -25,45 C-45,38 -45,10 -35,-20 C-25,-45 -15,-48 -5,-48 Z' },
  { name: '原始岩块', path: 'M-45,-20 C-40,-45 -10,-48 25,-40 C60,-32 55,10 40,35 C25,60 -25,55 -45,30 C-65,5 -50,5 -45,-20 Z' },
  { name: '软萌豆子', path: 'M-30,-35 C-10,-45 25,-35 45,-10 C65,15 45,45 15,40 C-15,35 -10,10 -25,5 C-40,0 -50,-25 -30,-35 Z' },
  { name: '不规则卵石', path: 'M-55,5 C-55,-15 -25,-35 20,-32 C65,-29 55,15 35,35 C15,55 -35,50 -55,25 C-65,10 -55,15 -55,5 Z' },
  { name: '呼吸气泡', path: 'M-38,-5 C-38,-30 -15,-45 12,-38 C39,-31 48,-8 42,18 C36,44 10,52 -18,45 C-46,38 -38,20 -38,-5 Z' },
  { name: '沉睡之石', path: 'M-60,10 C-60,-10 -30,-30 20,-28 C70,-26 65,20 40,40 C15,60 -40,55 -60,30 C-70,15 -60,20 -60,10 Z' },
  { name: '稚气蛋形', path: 'M-25,-42 C0,-42 35,-30 38,5 C41,40 15,55 -15,52 C-45,49 -48,15 -42,-15 C-36,-45 -25,-42 -25,-42 Z' },
  { name: '融化冰石', path: 'M-40,-25 C-40,-45 -10,-50 20,-42 C50,-34 45,10 35,35 C25,60 -25,65 -45,40 C-65,15 -40,-5 -40,-25 Z' },
  { name: '云朵碎片', path: 'M-45,-10 C-45,-35 -20,-45 10,-35 C40,-25 55,-10 45,20 C35,50 0,55 -30,45 C-60,35 -45,15 -45,-10 Z' },
  { name: '自然结晶', path: 'M-35,-35 C-10,-50 30,-40 45,-15 C60,10 40,45 10,48 C-20,51 -50,30 -48,0 C-46,-30 -35,-35 -35,-35 Z' },
  { name: '跳动之心', path: 'M0,-35 C25,-55 55,-25 45,10 C35,45 0,60 -30,40 C-60,20 -45,-20 -25,-45 C-15,-55 0,-35 0,-35 Z' },
  { name: '河床基石', path: 'M-50,20 C-50,0 -30,-35 15,-32 C60,-29 65,10 50,35 C35,60 -30,65 -50,45 C-60,35 -50,30 -50,20 Z' },
  { name: '梦幻泡泡', path: 'M-40,-15 C-40,-40 -10,-55 25,-45 C60,-35 65,0 50,30 C35,60 -15,55 -45,35 C-65,15 -40,10 -40,-15 Z' },
];

const INITIAL_COLORS = [
  { name: '亮橙', value: '#ff4d00' },
  { name: '荧光红', value: '#ff1744' },
  { name: '电光蓝', value: '#00e5ff' },
  { name: '如意金', value: '#ffc107' },
  { name: '翡翠绿', value: '#00c853' },
  { name: '魅惑紫', value: '#aa00ff' },
];

const DEFAULT_GLOW_SETTINGS: GlowSettings = {
  contactSuction: 5,
  individualSuction: 1,
  glowDepth: 40,
  gradientShade: 80,
  edgeThickness: 2.5,
  innerSoftness: 10,
  intensity: 1.4,
  grain: 0.1,
  lineJitter: 3,
};

const DEFAULT_CONTACT_SETTINGS: ContactSettings = {
  negativeRoundness: 0.35,
  negativeGrain: 0.08,
  overlayBlur: 7,
  overlayBlurOpacity: 0.42,
};

const DEFAULT_LIQUID_SETTINGS: LiquidSettings = {
  enabled: false,
  speed: 0.5,
  viscosity: 0.4,
  glossiness: 0,
  waveScale: 0.5,
  mode: 'liquid',
  importAmplitudeMode: 'natural',
};

const DEFAULT_ARTBOARD_SETTINGS: ArtboardSettings = {
  width: 1200,
  height: 900,
  clipContent: true,
};

const MOTION_MODE_CONFIG: Record<MotionMode, { label: string; hint: string }> = {
  classic: { label: '经典', hint: '回到更简洁的旧版液体节奏，连续、顺滑，像材质在自然呼吸。' },
  liquid: { label: '液体', hint: '更像流场推进的连续流动，方向会自然游走' },
  bubble: { label: '气泡', hint: '更轻盈、更上浮，带有鼓胀呼吸和柔软弹性感' },
  squash: { label: '挤压', hint: '统一节奏下更明显的拉伸与受压回弹' },
};

const CONTACT_MODE_CONFIG: Record<ContactMode, { label: string; hint: string }> = {
  fusion: { label: '融合', hint: '接触时会自然吸附并连成一体，像胶质或液体相互牵连。' },
  overlay: { label: '叠加', hint: '保留上下层叠压关系，后层在交叠处会出现更像真实泡泡的模糊透视。' },
  negative: { label: '负形', hint: '切换为纯填充块面，两个图形交叠的区域会直接变成空白负形。' },
};

const IMPORT_AMPLITUDE_MODE_CONFIG: Record<ImportAmplitudeMode, { label: string; hint: string }> = {
  natural: { label: '自然接近', hint: '导入素材会向画板现有动态靠拢，但保留一部分自身动态特征。' },
  strict: { label: '严格统一', hint: '导入素材会尽量贴合画板当前动态幅度，整体观感更一致。' },
};

const SHAPE_STYLE_CONFIG: Record<ShapeStyle, { label: string; smoothness: number; jitter: number; cornerBias: number }> = {
  smooth: { label: '液体', smoothness: 0.34, jitter: 0.04, cornerBias: 0.08 },
  organic: { label: '有机', smoothness: 0.2, jitter: 0.12, cornerBias: 0.2 },
  polygon: { label: '硬边', smoothness: 0.08, jitter: 0.16, cornerBias: 0.32 },
};

const QUICK_SECTIONS: SectionKey[] = ['quick', 'physics', 'color', 'motion', 'style', 'artboard', 'library'];

const SECTION_ICONS: Record<SectionKey, React.ComponentType<{ className?: string }>> = {
  quick: Wand2,
  physics: Settings2,
  color: Palette,
  motion: Droplets,
  style: LayoutGrid,
  artboard: Layers3,
  library: LayoutGrid,
};

const deepClone = <T,>(value: T): T => {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
};

const cloneSegments = (segments: Segment[]) => segments.map((segment) => ({ ...segment }));
const parsedPathCache = new Map<string, Segment[]>();
const morphedPathCache = new Map<string, string>();

const escapeXml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

const normalizeHex = (value: string) => {
  if (!/^#([\da-f]{3}|[\da-f]{6})$/i.test(value)) return '#000000';
  if (value.length === 4) {
    return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`.toLowerCase();
  }
  return value.toLowerCase();
};

const hexToRgb = (value: string) => {
  const hex = normalizeHex(value).slice(1);
  const numeric = Number.parseInt(hex, 16);
  return {
    r: (numeric >> 16) & 255,
    g: (numeric >> 8) & 255,
    b: numeric & 255,
  };
};

const rgbToHex = ({ r, g, b }: { r: number; g: number; b: number }) => {
  const toHex = (channel: number) => Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const mixHex = (source: string, target: string, amount: number) => {
  const clampedAmount = clamp01(amount);
  const a = hexToRgb(source);
  const b = hexToRgb(target);
  return rgbToHex({
    r: a.r + (b.r - a.r) * clampedAmount,
    g: a.g + (b.g - a.g) * clampedAmount,
    b: a.b + (b.b - a.b) * clampedAmount,
  });
};

const getSegmentsBounds = (segments: Segment[]): Bounds => {
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

  if (!hasPoints) {
    return { minX: -50, minY: -50, maxX: 50, maxY: 50, width: 100, height: 100, centerX: 0, centerY: 0 };
  }

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

const parsePathToSegments = (d: string): Segment[] => {
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
      default: {
        i += 1;
      }
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

  parsedPathCache.set(normalizedPath, cloneSegments(segments));
  return segments;
};

const segmentsToPath = (segments: Segment[]) => segments.map((segment) => {
  if (segment.type === 'M') return `M${segment.x},${segment.y}`;
  if (segment.type === 'C') return `C${segment.x1},${segment.y1} ${segment.x2},${segment.y2} ${segment.x},${segment.y}`;
  return 'Z';
}).join(' ');

const createRandomLiquidProfile = (seed: number): LiquidProfile => {
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

const getClientCanvasPoint = (e: { clientX: number; clientY: number }, rect: DOMRect, viewOffset: Point, zoom: number): Point => ({
  x: (e.clientX - rect.left - viewOffset.x) / zoom,
  y: (e.clientY - rect.top - viewOffset.y) / zoom,
});

const getElementEllipseRadiusAlongDirection = (el: ElementItem, direction: Point) => {
  const bounds = getElementLocalBounds(el);
  const rx = Math.max(1, bounds.width * el.scale / 2);
  const ry = Math.max(1, bounds.height * el.scale / 2);
  const rad = -el.rotation * (Math.PI / 180);
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const localX = direction.x * cos - direction.y * sin;
  const localY = direction.x * sin + direction.y * cos;
  const denom = (localX * localX) / (rx * rx) + (localY * localY) / (ry * ry);
  return denom <= 0 ? Math.max(rx, ry) : 1 / Math.sqrt(denom);
};

const getPotentialOverlapPairs = (elements: ElementItem[]): ContactOverlap[] => {
  const overlaps: ContactOverlap[] = [];

  for (let i = 0; i < elements.length; i += 1) {
    for (let j = i + 1; j < elements.length; j += 1) {
      const a = elements[i];
      const b = elements[j];
      const aBounds = getElementLocalBounds(a);
      const bBounds = getElementLocalBounds(b);
      const aRadius = Math.max(aBounds.width, aBounds.height) * a.scale / 2;
      const bRadius = Math.max(bBounds.width, bBounds.height) * b.scale / 2;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distance = Math.hypot(dx, dy);

      if (distance < aRadius + bRadius) {
        overlaps.push({ id: `${a.id}-${b.id}`, a, b });
      }
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

const getContactRenderPath = (el: ElementItem, contactMode: ContactMode, contactSettings: ContactSettings) => {
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

  return new DOMMatrix()
    .translateSelf(offsetX, offsetY)
    .rotateSelf(rotation)
    .scaleSelf(scaleX, scaleY);
};

const harmonizeLiquidProfile = (
  profile: LiquidProfile,
  baseline: { waveFactor: number; viscosityFactor: number; amplitudeFactor: number } | null,
  strength: number,
): LiquidProfile => {
  const mix = clamp01(strength);
  const target = baseline ?? {
    waveFactor: 1,
    viscosityFactor: 1,
    amplitudeFactor: 1,
  };

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

const drawNegativeContactScene = ({
  ctx,
  width,
  height,
  elements,
  overlapCutouts,
  grain,
  sampleTime,
  liquidSettings,
  contactSettings,
  getMatrix,
  backgroundFill,
}: {
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
    transformedPath.addPath(
      new Path2D(renderPath),
      getMatrix(el).multiply(getNegativeModeLocalMatrix(el, sampleTime, liquidSettings)),
    );
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

const buildTangencySeamPath = (center: Point, tangent: Point, normal: Point, halfLength: number, halfWidth: number) => {
  const top = { x: center.x + tangent.x * halfLength, y: center.y + tangent.y * halfLength };
  const bottom = { x: center.x - tangent.x * halfLength, y: center.y - tangent.y * halfLength };
  const upperRight = {
    x: center.x + tangent.x * (halfLength * 0.14) + normal.x * halfWidth,
    y: center.y + tangent.y * (halfLength * 0.14) + normal.y * halfWidth,
  };
  const lowerRight = {
    x: center.x - tangent.x * (halfLength * 0.14) + normal.x * halfWidth,
    y: center.y - tangent.y * (halfLength * 0.14) + normal.y * halfWidth,
  };
  const upperLeft = {
    x: center.x + tangent.x * (halfLength * 0.14) - normal.x * halfWidth,
    y: center.y + tangent.y * (halfLength * 0.14) - normal.y * halfWidth,
  };
  const lowerLeft = {
    x: center.x - tangent.x * (halfLength * 0.14) - normal.x * halfWidth,
    y: center.y - tangent.y * (halfLength * 0.14) - normal.y * halfWidth,
  };
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

const getNegativeContactSeams = (elements: ElementItem[]): ContactSeam[] => {
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

      const proximityStrength = contactDelta >= 0
        ? 1 - clamp01(contactDelta / nearGapLimit)
        : 1 - clamp01(Math.abs(contactDelta) / overlapLimit);
      const closeness = proximityStrength * proximityStrength;
      if (closeness <= 0.08) continue;

      const halfLength = Math.min(aTangentRadius, bTangentRadius) * (0.1 + closeness * 0.18);
      const halfWidth = Math.max(1.1, Math.min(4.2, minNormalRadius * (0.008 + closeness * 0.012)));
      if (halfLength <= halfWidth * 2.8) continue;

      const aSurface = { x: a.x + normal.x * aNormalRadius, y: a.y + normal.y * aNormalRadius };
      const bSurface = { x: b.x - normal.x * bNormalRadius, y: b.y - normal.y * bNormalRadius };
      const center = { x: (aSurface.x + bSurface.x) / 2, y: (aSurface.y + bSurface.y) / 2 };

      seams.push({
        path: buildTangencySeamPath(center, tangent, normal, halfLength, halfWidth),
        shadowOpacity: 0.05 + closeness * 0.09,
      });
    }
  }

  return seams;
};

const seededUnit = (seed: number) => {
  const x = Math.sin(seed * 127.1) * 43758.5453123;
  return x - Math.floor(x);
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const distanceBetweenPoints = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

const simplifyPolyline = (points: Point[], tolerance: number) => {
  if (points.length <= 2) return points.slice();

  const sqTolerance = tolerance * tolerance;
  const getSqSegDist = (point: Point, start: Point, end: Point) => {
    let x = start.x;
    let y = start.y;
    let dx = end.x - x;
    let dy = end.y - y;

    if (dx !== 0 || dy !== 0) {
      const t = ((point.x - x) * dx + (point.y - y) * dy) / (dx * dx + dy * dy);
      if (t > 1) {
        x = end.x;
        y = end.y;
      } else if (t > 0) {
        x += dx * t;
        y += dy * t;
      }
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
      if (sqDist > maxSqDist) {
        index = i;
        maxSqDist = sqDist;
      }
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

const reducePointsToTarget = (points: Point[], targetCount: number) => {
  if (points.length <= targetCount) return points.slice();
  if (targetCount <= 3) return points.slice(0, 3);

  const result: Point[] = [];
  const lastIndex = points.length - 1;

  for (let i = 0; i < targetCount; i += 1) {
    const sampleIndex = Math.round((i / (targetCount - 1)) * lastIndex);
    const point = points[sampleIndex];
    const prev = result[result.length - 1];
    if (!prev || distanceBetweenPoints(prev, point) > 0.001) {
      result.push(point);
    }
  }

  return result;
};

const chaikinSmoothClosed = (points: Point[], iterations: number) => {
  let current = points.slice();
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    if (current.length < 3) return current;
    const next: Point[] = [];
    for (let i = 0; i < current.length; i += 1) {
      const a = current[i];
      const b = current[(i + 1) % current.length];
      next.push({
        x: a.x * 0.75 + b.x * 0.25,
        y: a.y * 0.75 + b.y * 0.25,
      });
      next.push({
        x: a.x * 0.25 + b.x * 0.75,
        y: a.y * 0.25 + b.y * 0.75,
      });
    }
    current = next;
  }
  return current;
};

const simplifyBrushPoints = (points: Point[], referenceSize: number) => {
  if (points.length <= 6) return points.slice();

  const baseTolerance = Math.max(4, Math.min(16, referenceSize * 0.03));
  const targetCount = Math.max(6, Math.min(10, Math.round(referenceSize / 140) + 5));
  let tolerance = baseTolerance;
  let simplified = simplifyPolyline(points, tolerance);
  let guard = 0;

  while (simplified.length > targetCount && guard < 8) {
    tolerance *= 1.35;
    simplified = simplifyPolyline(points, tolerance);
    guard += 1;
  }

  if (simplified.length > targetCount) {
    simplified = reducePointsToTarget(simplified, targetCount);
  }

  return simplified.length >= 4 ? simplified : points.slice();
};

const getBrushAnchorTarget = (referenceSize: number) => (
  Math.max(6, Math.min(10, Math.round(referenceSize / 140) + 5))
);

const getBrushAngularity = (points: Point[]) => {
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

const stabilizeBrushLiquidProfile = (profile: LiquidProfile): LiquidProfile => ({
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

const buildSmoothClosedPath = (points: Point[], tension = 0.18) => {
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

const morphPathByStyle = (path: string, style: ShapeStyle, seedOffset = 0, intensity = 1) => {
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
    const angle = order / Math.max(1, drawableIndexes.length) * Math.PI * 2;
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

  for (let i = 0; i < segments.length; i += 1) {
    const seg = segments[i];
    if (seg.type === 'C') {
      delete seg.outX;
      delete seg.outY;
    }
  }
  for (let i = 0; i < segments.length - 1; i += 1) {
    const seg = segments[i];
    const next = segments[i + 1];
    if (seg.type === 'C' && next.type === 'C') {
      seg.outX = next.x1;
      seg.outY = next.y1;
    }
  }

  const morphedPath = segmentsToPath(segments);
  morphedPathCache.set(cacheKey, morphedPath);
  return morphedPath;
};

const useAnimationTime = (enabled: boolean, fps = 30) => {
  const [time, setTime] = useState(0);
  useEffect(() => {
    if (!enabled) return undefined;
    let frame = 0;
    let last = 0;
    const minDelta = 1000 / fps;
    const loop = (t: number) => {
      if (t - last >= minDelta) {
        setTime(t / 1000);
        last = t;
      }
      frame = window.requestAnimationFrame(loop);
    };
    frame = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(frame);
  }, [enabled, fps]);
  return time;
};

const getElementLocalBounds = (el: ElementItem) => getSegmentsBounds(el.segments);

const Section = memo(function Section({
  title,
  icon: Icon,
  open,
  onToggle,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <button onClick={onToggle} className="w-full flex items-center justify-between gap-2 text-slate-500 hover:text-slate-900 transition-colors">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4" />
          <h3 className="text-[10px] font-black uppercase tracking-widest">{title}</h3>
        </div>
        <ChevronRight className={`w-4 h-4 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && children}
    </section>
  );
});

const Sidebar = memo(function Sidebar({
  activeColor,
  palette,
  selectedIds,
  selectedIdSet,
  elements,
  contactMode,
  setContactMode,
  contactSettings,
  setContactSettings,
  glowSettings,
  setGlowSettings,
  liquidSettings,
  setLiquidSettings,
  rerandomizeLiquidProfiles,
  artboard,
  setArtboard,
  fitViewToArtboard,
  shapeStyle,
  shapeStyleIntensity,
  setShapeStyleIntensity,
  applyShapeStyleToArtboard,
  setActiveColor,
  commitElements,
  addElement,
  sectionOpen,
  toggleSection,
  collapsedSidebar,
  setCollapsedSidebar,
}: SidebarProps) {
  const presetPreviewPaths = useMemo(() => (
    PRESET_DATA.reduce<Record<string, string>>((acc, shape) => {
      acc[shape.name] = morphPathByStyle(shape.path, shapeStyle, shape.name.length * 97, shapeStyleIntensity);
      return acc;
    }, {})
  ), [shapeStyle, shapeStyleIntensity]);

  return (
    <aside className={`${collapsedSidebar ? 'w-[72px]' : 'w-80'} h-full bg-white border-r border-slate-200 z-30 flex flex-col shadow-sm overflow-y-auto transition-all duration-200`}>
      <div className={`p-4 border-b border-slate-100 flex items-center ${collapsedSidebar ? 'justify-center' : 'gap-4'}`}>
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg" style={{ backgroundColor: activeColor }}>
          <Sparkles className="text-white w-6 h-6" />
        </div>
        {!collapsedSidebar && (
          <>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-black tracking-tight text-slate-900 leading-none mb-1">融合工坊</h1>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded-full">Studio v2.1</span>
            </div>
            <button onClick={() => setCollapsedSidebar(true)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500"><PanelLeftClose className="w-4 h-4" /></button>
          </>
        )}
        {collapsedSidebar && <button onClick={() => setCollapsedSidebar(false)} className="absolute top-4 left-16 p-2 rounded-xl bg-white border border-slate-200 shadow-sm text-slate-500"><PanelLeftOpen className="w-4 h-4" /></button>}
      </div>

      {collapsedSidebar ? (
        <div className="p-3 flex flex-col items-center gap-2">
          {QUICK_SECTIONS.map((key) => {
            const Icon = SECTION_ICONS[key];
            return (
              <button key={key} onClick={() => { setCollapsedSidebar(false); toggleSection(key); }} className="w-11 h-11 rounded-2xl border border-slate-200 hover:bg-slate-100 text-slate-600 flex items-center justify-center">
                <Icon className="w-4 h-4" />
              </button>
            );
          })}
        </div>
      ) : (
        <div className="p-5 space-y-6 flex-1">
          <Section title="快捷操作" icon={Wand2} open={sectionOpen.quick} onToggle={() => toggleSection('quick')}>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={fitViewToArtboard} className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-slate-900 text-white shadow-sm hover:bg-slate-800">
                <Target className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">适配画板</span>
              </button>
              <button onClick={rerandomizeLiquidProfiles} className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-white text-slate-700 border border-slate-200 shadow-sm hover:bg-slate-50">
                <Zap className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">液体随机</span>
              </button>
            </div>
            <div className="text-[10px] leading-relaxed font-bold text-slate-500 bg-slate-50 border border-slate-100 rounded-2xl p-3">
              当前共有 <span className="text-slate-900">{elements.length}</span> 个元素，已选择 <span className="text-slate-900">{selectedIds.length}</span> 个。
            </div>
          </Section>

          <Section title="物理特性调节" icon={Settings2} open={sectionOpen.physics} onToggle={() => toggleSection('physics')}>
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-5">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  <Link2 className="w-3.5 h-3.5 opacity-70" />
                  <span>接触模式</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(CONTACT_MODE_CONFIG) as ContactMode[]).map((modeKey) => (
                    <button
                      key={modeKey}
                      onClick={() => setContactMode(modeKey)}
                      className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${contactMode === modeKey ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                    >
                      {CONTACT_MODE_CONFIG[modeKey].label}
                    </button>
                  ))}
                </div>
                <div className="text-[10px] font-bold text-slate-500 leading-relaxed">{CONTACT_MODE_CONFIG[contactMode].hint}</div>
              </div>
              {contactMode === 'negative' && (
                <>
                  {[
                    { label: '轮廓圆润', icon: Waves, key: 'negativeRoundness', min: 0, max: 1, step: 0.01 },
                    { label: '块面颗粒', icon: Sparkles, key: 'negativeGrain', min: 0, max: 1, step: 0.01 },
                  ].map((item) => (
                    <div key={item.key} className="space-y-2">
                      <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase">
                        <span className="flex items-center gap-2"><item.icon className="w-3 h-3 opacity-60" /> {item.label}</span>
                        <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200">
                          {Math.round((contactSettings[item.key as keyof ContactSettings] as number) * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={item.min}
                        max={item.max}
                        step={item.step}
                        value={contactSettings[item.key as keyof ContactSettings] as number}
                        onChange={(e) => setContactSettings((prev) => ({ ...prev, [item.key]: parseFloat(e.target.value) }))}
                        className="w-full h-1.5 rounded-full bg-slate-200 appearance-none cursor-pointer"
                      />
                    </div>
                  ))}
                </>
              )}
              {contactMode === 'overlay' && (
                <>
                  {[
                    { label: '叠压模糊', icon: Waves, key: 'overlayBlur', min: 0, max: 24, step: 0.5, format: (value: number) => value.toFixed(1).replace(/\.0$/, '') },
                    { label: '模糊强度', icon: Sun, key: 'overlayBlurOpacity', min: 0, max: 1, step: 0.01, format: (value: number) => `${Math.round(value * 100)}%` },
                  ].map((item) => (
                    <div key={item.key} className="space-y-2">
                      <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase">
                        <span className="flex items-center gap-2"><item.icon className="w-3 h-3 opacity-60" /> {item.label}</span>
                        <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200">
                          {item.format(contactSettings[item.key as keyof ContactSettings] as number)}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={item.min}
                        max={item.max}
                        step={item.step}
                        value={contactSettings[item.key as keyof ContactSettings] as number}
                        onChange={(e) => setContactSettings((prev) => ({ ...prev, [item.key]: parseFloat(e.target.value) }))}
                        className="w-full h-1.5 rounded-full bg-slate-200 appearance-none cursor-pointer"
                      />
                    </div>
                  ))}
                </>
              )}
              {[
                { label: '接触吸附', icon: Link2, key: 'contactSuction', min: 1, max: 45, step: 1 },
                { label: '单体吸附', icon: User, key: 'individualSuction', min: 0, max: 25, step: 1 },
                { label: '渐变深度', icon: Sliders, key: 'glowDepth', min: 1, max: 100, step: 1 },
                { label: '渐变强度', icon: Sun, key: 'gradientShade', min: 0, max: 100, step: 1 },
                { label: '边沿厚度', icon: Sliders, key: 'edgeThickness', min: 0.5, max: 15, step: 0.5 },
                { label: '内部柔化', icon: Waves, key: 'innerSoftness', min: 0, max: 30, step: 0.5 },
                { label: '线条抖动', icon: Waves, key: 'lineJitter', min: 0, max: 8, step: 0.1 },
                { label: '整体强度', icon: Sparkles, key: 'intensity', min: 0.5, max: 3, step: 0.05 },
                { label: '质感颗粒', icon: Waves, key: 'grain', min: 0, max: 1, step: 0.01 },
              ].map((item) => (
                <div key={item.key} className="space-y-2">
                  <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase">
                    <span className="flex items-center gap-2"><item.icon className="w-3 h-3 opacity-60" /> {item.label}</span>
                    <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200">{typeof glowSettings[item.key as keyof GlowSettings] === 'number' ? Number(glowSettings[item.key as keyof GlowSettings]).toFixed(item.key === 'grain' ? 2 : 1).replace(/\.0$/, '') : ''}</span>
                  </div>
                  <input
                    type="range"
                    min={item.min}
                    max={item.max}
                    step={item.step}
                    value={glowSettings[item.key as keyof GlowSettings] as number}
                    onChange={(e) => setGlowSettings((prev) => ({ ...prev, [item.key]: parseFloat(e.target.value) }))}
                    className="w-full h-1.5 rounded-full bg-slate-200 appearance-none cursor-pointer"
                  />
                </div>
              ))}
            </div>
          </Section>

          <Section title="灵感配色" icon={Palette} open={sectionOpen.color} onToggle={() => toggleSection('color')}>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">当前活动色</div>
                <div className="relative group">
                  <input
                    type="color"
                    value={activeColor}
                    onChange={(e) => {
                      const color = e.target.value;
                      setActiveColor(color);
                      if (selectedIds.length > 0) {
                        const next = elements.map((el) => selectedIdSet.has(el.id) ? { ...el, color } : el);
                        commitElements(next);
                      }
                    }}
                    className="w-8 h-8 rounded-lg opacity-0 absolute inset-0 cursor-pointer z-10"
                  />
                  <div className="w-8 h-8 rounded-xl border-2 border-white shadow-sm flex items-center justify-center" style={{ backgroundColor: activeColor }}>
                    <Plus className="w-3 h-3 text-white" />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-6 gap-2">
                {palette.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => {
                      setActiveColor(color.value);
                      if (selectedIds.length > 0) {
                        const next = elements.map((el) => selectedIdSet.has(el.id) ? { ...el, color: color.value } : el);
                        commitElements(next);
                      }
                    }}
                    className={`h-8 rounded-xl transition-all ${activeColor === color.value ? 'ring-2 ring-slate-900 ring-offset-2' : 'shadow-sm'}`}
                    style={{ backgroundColor: color.value }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>
          </Section>

          <Section title="全局液体动态" icon={Droplets} open={sectionOpen.motion} onToggle={() => toggleSection('motion')}>
            <div className="space-y-3">
              <button onClick={() => setLiquidSettings((prev) => ({ ...prev, enabled: !prev.enabled }))} className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border transition-all ${liquidSettings.enabled ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-200'}`}>
                <span className="text-[10px] font-black uppercase tracking-widest">液体动画</span>
                <span className="text-[10px] font-black uppercase tracking-widest">{liquidSettings.enabled ? '开启' : '关闭'}</span>
              </button>
              {liquidSettings.enabled && (
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-5">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                      <Zap className="w-3.5 h-3.5 opacity-70" />
                      <span>动态模式</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {(Object.keys(MOTION_MODE_CONFIG) as MotionMode[]).map((modeKey) => (
                        <button
                          key={modeKey}
                          onClick={() => setLiquidSettings((prev) => ({ ...prev, mode: modeKey }))}
                          className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${liquidSettings.mode === modeKey ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                        >
                          {MOTION_MODE_CONFIG[modeKey].label}
                        </button>
                      ))}
                    </div>
                    <div className="text-[10px] font-bold text-slate-500 leading-relaxed">{MOTION_MODE_CONFIG[liquidSettings.mode].hint}</div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                      <Layers3 className="w-3.5 h-3.5 opacity-70" />
                      <span>导入幅度对齐</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {(Object.keys(IMPORT_AMPLITUDE_MODE_CONFIG) as ImportAmplitudeMode[]).map((modeKey) => (
                        <button
                          key={modeKey}
                          onClick={() => setLiquidSettings((prev) => ({ ...prev, importAmplitudeMode: modeKey }))}
                          className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${liquidSettings.importAmplitudeMode === modeKey ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                        >
                          {IMPORT_AMPLITUDE_MODE_CONFIG[modeKey].label}
                        </button>
                      ))}
                    </div>
                    <div className="text-[10px] font-bold text-slate-500 leading-relaxed">{IMPORT_AMPLITUDE_MODE_CONFIG[liquidSettings.importAmplitudeMode].hint}</div>
                  </div>
                  {[
                    { label: '流动速度', icon: Wind, key: 'speed', min: 0.1, max: 5, step: 0.1 },
                    { label: '粘稠程度', icon: Zap, key: 'viscosity', min: 0.1, max: 1, step: 0.05 },
                    { label: '光泽强度', icon: Sparkles, key: 'glossiness', min: 0, max: 1, step: 0.05 },
                    { label: '波动幅度', icon: Waves, key: 'waveScale', min: 0.1, max: 2, step: 0.1 },
                  ].map((item) => (
                    <div key={item.key} className="space-y-2">
                      <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase">
                        <span className="flex items-center gap-2"><item.icon className="w-3 h-3 opacity-60" /> {item.label}</span>
                        <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200">{((liquidSettings[item.key as keyof LiquidSettings] as number) * 100).toFixed(0)}%</span>
                      </div>
                      <input type="range" min={item.min} max={item.max} step={item.step} value={liquidSettings[item.key as keyof LiquidSettings] as number} onChange={(e) => setLiquidSettings((prev) => ({ ...prev, [item.key]: parseFloat(e.target.value) }))} className="w-full h-1.5 rounded-full bg-slate-200 appearance-none cursor-pointer" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Section>

          <Section title="素材形态风格" icon={LayoutGrid} open={sectionOpen.style} onToggle={() => toggleSection('style')}>
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-4">
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(SHAPE_STYLE_CONFIG) as ShapeStyle[]).map((styleKey) => (
                  <button
                    key={styleKey}
                    onClick={() => applyShapeStyleToArtboard(styleKey)}
                    className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${shapeStyle === styleKey ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                  >
                    {SHAPE_STYLE_CONFIG[styleKey].label}
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase">
                  <span>效果幅度</span>
                  <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200">{Math.round(shapeStyleIntensity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={shapeStyleIntensity}
                  onChange={(e) => setShapeStyleIntensity(parseFloat(e.target.value))}
                  className="w-full h-1.5 rounded-full bg-slate-200 appearance-none cursor-pointer"
                />
              </div>
              <div className="text-[10px] font-bold text-slate-500 leading-relaxed">
                当前画板元素 / 新建素材风格：<span className="text-slate-900">{SHAPE_STYLE_CONFIG[shapeStyle].label}</span>
                <span className="text-slate-400"> · 幅度 {Math.round(shapeStyleIntensity * 100)}%</span>
              </div>
            </div>
          </Section>

          <Section title="画板边界" icon={Layers3} open={sectionOpen.artboard} onToggle={() => toggleSection('artboard')}>
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-4">
              <button onClick={() => setArtboard((prev) => ({ ...prev, clipContent: !prev.clipContent }))} className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all ${artboard.clipContent ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200'}`}>
                <span className="text-[10px] font-black uppercase tracking-widest">超出画板裁切</span>
                <span className="text-[10px] font-black uppercase tracking-widest">{artboard.clipContent ? '开启' : '关闭'}</span>
              </button>
              {[
                { key: 'width', label: '宽度', min: 400, max: 4000 },
                { key: 'height', label: '高度', min: 400, max: 4000 },
              ].map((item) => (
                <div key={item.key} className="space-y-2">
                  <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase">
                    <span>{item.label}</span>
                    <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200">{artboard[item.key as keyof ArtboardSettings]}px</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="range" min={item.min} max={item.max} step={10} value={artboard[item.key as keyof ArtboardSettings] as number} onChange={(e) => setArtboard((prev) => ({ ...prev, [item.key]: parseInt(e.target.value, 10) || item.min }))} className="flex-1 h-1.5 rounded-full bg-slate-200 appearance-none cursor-pointer" />
                    <input type="number" min={item.min} max={item.max} step={10} value={artboard[item.key as keyof ArtboardSettings] as number} onChange={(e) => setArtboard((prev) => ({ ...prev, [item.key]: Math.min(item.max, Math.max(item.min, parseInt(e.target.value || '0', 10) || item.min)) }))} className="w-24 px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-[11px] font-bold text-slate-700" />
                  </div>
                </div>
              ))}
              <button onClick={fitViewToArtboard} className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-sm transition-all">
                <Target className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">适配到画板</span>
              </button>
            </div>
          </Section>

          <Section title="气泡预设" icon={LayoutGrid} open={sectionOpen.library} onToggle={() => toggleSection('library')}>
            <div className="grid grid-cols-1 gap-2 pb-6">
              {PRESET_DATA.map((shape) => (
                <button key={shape.name} onClick={() => addElement(shape.path, shape.name)} className="group flex items-center justify-between p-3 rounded-xl hover:bg-slate-900 hover:text-white transition-all border border-slate-100 bg-white">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center">
                      <svg viewBox="-50 -50 100 100" className="w-5 h-5"><path d={presetPreviewPaths[shape.name] || shape.path} fill={activeColor} stroke="none" /></svg>
                    </div>
                    <span className="text-xs font-bold tracking-tight">{shape.name}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-40 transition-opacity" />
                </button>
              ))}
            </div>
          </Section>
        </div>
      )}
    </aside>
  );
});

const Toolbar = memo(function Toolbar({
  historyIndex,
  fillCanvas,
  fileInputRef,
  handleFileUpload,
  isBrushMode,
  setIsBrushMode,
  isEditMode,
  setIsEditMode,
  setBrushPoints,
  setIsDrawingBrush,
  selectedIds,
  moveSelectedBackward,
  moveSelectedForward,
  deleteSelectedElements,
  downloadPNG,
  downloadTransparentGif,
  isExportingGif,
  pngExportScale,
  setPngExportScale,
  pngOutputWidth,
  pngOutputHeight,
  gifExportScale,
  setGifExportScale,
  gifFrameCount,
  setGifFrameCount,
  gifOutputWidth,
  gifOutputHeight,
  undo,
  setSelectedIds,
}: ToolbarProps) {
  return (
    <header className="h-16 bg-white border-b border-slate-200 px-5 md:px-8 flex justify-between items-center z-20 gap-4">
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={undo} disabled={historyIndex === 0} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-900 transition-all disabled:opacity-20" title="撤销 (Ctrl+Z)">
          <Undo2 className="w-5 h-5" />
        </button>
        <div className="w-px h-5 bg-slate-200 mx-1" />
        <button onClick={fillCanvas} className="flex items-center gap-2 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl transition-all border border-indigo-100 shadow-sm group" title="一键填充">
          <Sparkles className="w-4 h-4" />
          <span className="text-[10px] font-black uppercase tracking-widest">一键填充</span>
        </button>
        <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-3 py-2 bg-white hover:bg-slate-50 text-slate-600 rounded-xl transition-all border border-slate-200 shadow-sm">
          <FileCode className="w-4 h-4" />
          <span className="text-[10px] font-black uppercase tracking-widest">导入 SVG</span>
        </button>
        <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".svg" className="hidden" />
      </div>

      <div className="flex items-center gap-3 flex-wrap justify-end">
        <button onClick={() => { setIsBrushMode((prev) => !prev); setIsEditMode(false); setBrushPoints([]); setIsDrawingBrush(false); }} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${isBrushMode ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-200' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}>
          <Pencil className="w-4 h-4" />
          {isBrushMode ? '绘图中...' : '画笔工具'}
        </button>
        <button onClick={() => { setIsEditMode((prev) => !prev); setIsBrushMode(false); setIsDrawingBrush(false); setBrushPoints([]); if (!isEditMode) setSelectedIds((prev) => prev.slice(0, 1)); }} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${isEditMode ? 'bg-red-500 text-white border-red-500 shadow-lg shadow-red-200' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}>
          <Maximize2 className="w-4 h-4" />
          {isEditMode ? '退出编辑' : '曲率编辑'}
        </button>
        <button onClick={moveSelectedBackward} disabled={selectedIds.length === 0} className="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border bg-white text-slate-600 border-slate-200 hover:border-slate-400 disabled:opacity-30">
          下移
        </button>
        <button onClick={moveSelectedForward} disabled={selectedIds.length === 0} className="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border bg-white text-slate-600 border-slate-200 hover:border-slate-400 disabled:opacity-30">
          上移
        </button>
        <button onClick={deleteSelectedElements} disabled={selectedIds.length === 0} className="p-2 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all disabled:opacity-20" title="删除">
          <Trash2 className="w-5 h-5" />
        </button>
        <div className="flex bg-slate-900 rounded-xl p-1 shadow-md items-center gap-1">
          <button onClick={downloadPNG} className="flex items-center gap-2 px-3 py-1.5 text-white/90 text-[9px] font-black uppercase tracking-widest hover:text-white">
            <Download className="w-3 h-3" />
            PNG
          </button>
          <select
            value={pngExportScale}
            onChange={(e) => setPngExportScale(parseFloat(e.target.value))}
            className="px-2 py-1 rounded-lg border border-white/10 bg-white/10 text-[10px] font-black text-white/90"
            title="PNG 倍率"
          >
            {[1, 1.5, 2, 3, 4, 6].map((scale) => (
              <option key={scale} value={scale}>{scale}x</option>
            ))}
          </select>
          <div className="px-2 text-[9px] font-black uppercase tracking-widest text-white/45 whitespace-nowrap border-r border-white/10">
            {pngOutputWidth} x {pngOutputHeight}
          </div>
          <button onClick={downloadTransparentGif} disabled={isExportingGif} className="flex items-center gap-2 px-3 py-1.5 text-white/90 text-[9px] font-black uppercase tracking-widest hover:text-white disabled:opacity-50">
            GIF
          </button>
          <select
            value={gifExportScale}
            onChange={(e) => setGifExportScale(parseFloat(e.target.value))}
            className="px-2 py-1 rounded-lg border border-white/10 bg-white/10 text-[10px] font-black text-white/90"
            title="GIF 倍率"
          >
            {[1, 1.5, 2, 3].map((scale) => (
              <option key={scale} value={scale}>{scale}x</option>
            ))}
          </select>
          <select
            value={gifFrameCount}
            onChange={(e) => setGifFrameCount(parseInt(e.target.value, 10))}
            className="px-2 py-1 rounded-lg border border-white/10 bg-white/10 text-[10px] font-black text-white/90"
            title="GIF 帧数"
          >
            {[12, 18, 24, 32, 40].map((frames) => (
              <option key={frames} value={frames}>{frames} 帧</option>
            ))}
          </select>
          <div className="px-2 text-[9px] font-black uppercase tracking-widest text-white/45 whitespace-nowrap">
            {gifOutputWidth} x {gifOutputHeight}
          </div>
        </div>
      </div>
    </header>
  );
});

const Stage = memo(function Stage({
  canvasRef,
  isDraggingOver,
  setIsDraggingOver,
  onDrop,
  handlePointerDown,
  handlePointerMove,
  handlePointerUp,
  handleWheel,
  isPanning,
  isBrushMode,
  isEditMode,
  marquee,
  scalingGroup,
  viewOffset,
  zoom,
  liquidFilters,
  contactMode,
  contactSettings,
  glowSettings,
  artboard,
  artboardRect,
  elements,
  selectedIdSet,
  liquidSettings,
  brushPoints,
  isDrawingBrush,
  activeColor,
  time,
  selectedSingle,
  selectedPointIdx,
  groupBounds,
  fitViewToArtboard,
}: StageProps) {
  const overlapCutouts = useMemo(() => (contactMode === 'fusion' ? [] : getPotentialOverlapPairs(elements)), [contactMode, elements]);
  const [negativeSceneHref, setNegativeSceneHref] = useState<string | null>(null);
  const viewportWidth = canvasRef.current?.clientWidth ?? 1;
  const viewportHeight = canvasRef.current?.clientHeight ?? 1;

  useEffect(() => {
    if (contactMode !== 'negative') {
      setNegativeSceneHref(null);
      return;
    }
    if (viewportWidth <= 1 || viewportHeight <= 1) return;

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(viewportWidth));
    canvas.height = Math.max(1, Math.round(viewportHeight));
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    drawNegativeContactScene({
      ctx,
      width: canvas.width,
      height: canvas.height,
      elements,
      overlapCutouts,
      grain: contactSettings.negativeGrain,
      sampleTime: time,
      liquidSettings,
      contactSettings,
      getMatrix: (el) => new DOMMatrix()
        .translateSelf(viewOffset.x + el.x * zoom, viewOffset.y + el.y * zoom)
        .rotateSelf(el.rotation)
        .scaleSelf(el.scale * zoom),
      backgroundFill: null,
    });

    setNegativeSceneHref(canvas.toDataURL('image/png'));
  }, [contactMode, contactSettings, elements, liquidSettings, overlapCutouts, time, viewOffset.x, viewOffset.y, viewportHeight, viewportWidth, zoom]);

  return (
    <div className={`flex-1 relative ${isDraggingOver ? 'bg-slate-100/50' : ''}`} style={{ touchAction: 'none', cursor: isPanning ? 'grabbing' : isBrushMode || isEditMode || marquee ? 'crosshair' : scalingGroup ? 'nwse-resize' : 'default' }} onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }} onDragLeave={() => setIsDraggingOver(false)} onDrop={onDrop} onPointerDown={(e) => handlePointerDown(e, null)} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp} onWheel={handleWheel} onContextMenu={(e) => e.preventDefault()} ref={canvasRef}>
      <svg className="w-full h-full pointer-events-none" style={{ touchAction: 'none' }}>
        <defs>
          {liquidFilters.map((item) => (
            <filter key={`liquid-flow-${item.id}`} id={`liquid-flow-${item.id}`} x="-150%" y="-150%" width="400%" height="400%">
              <feTurbulence type="fractalNoise" baseFrequency={item.baseFrequency} numOctaves="2" seed={item.id % 1000} result="noise" />
              <feDisplacementMap in="SourceGraphic" in2="noise" scale={item.displacementScale} result="displaced" />
              <feGaussianBlur in="displaced" stdDeviation={1} result="blur" />
              <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 60 -28" result="gooey" />
              <feSpecularLighting in="gooey" surfaceScale={15} specularConstant={2 * item.glossiness} specularExponent={60 - 50 * item.glossiness} lightingColor="#ffffff" result="spec">
                <feDistantLight azimuth={45} elevation={55} />
              </feSpecularLighting>
              <feComposite in="spec" in2="gooey" operator="in" result="specOut" />
              <feBlend in="gooey" in2="specOut" mode="screen" />
            </filter>
          ))}
          <filter id="clean-fusion" filterUnits="userSpaceOnUse" x="-10000" y="-10000" width="20000" height="20000" colorInterpolationFilters="sRGB">
            <feTurbulence type="turbulence" baseFrequency="0.04" numOctaves="2" result="tremorNoise" />
            <feDisplacementMap in="SourceGraphic" in2="tremorNoise" scale={glowSettings.lineJitter} xChannelSelector="R" yChannelSelector="G" result="jitteredSource" />
            <feMorphology in="jitteredSource" operator="dilate" radius={glowSettings.individualSuction} result="expanded" />
            <feGaussianBlur in="expanded" stdDeviation={glowSettings.contactSuction} result="blur" />
            <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 35 -15" result="blob" />
            <feMorphology in="blob" operator="erode" radius={glowSettings.glowDepth / 2.5} result="eroded_inner" />
            <feComposite in="blob" in2="eroded_inner" operator="out" result="inner_rim" />
            <feGaussianBlur in="inner_rim" stdDeviation={glowSettings.innerSoftness} result="raw_grad" />
            <feComponentTransfer in="raw_grad" result="shaded_grad"><feFuncA type="linear" slope={glowSettings.gradientShade / 100 * 2} /></feComponentTransfer>
            <feTurbulence type="fractalNoise" baseFrequency="0.95" numOctaves="4" seed="42" result="grain_noise" />
            <feColorMatrix in="grain_noise" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -1 1" result="grain_mask" />
            <feComponentTransfer in="grain_mask" result="adj_grain"><feFuncA type="linear" slope={glowSettings.grain * 25} intercept={1 - glowSettings.grain * 12.5} /></feComponentTransfer>
            <feComposite in="shaded_grad" in2="adj_grain" operator="in" result="textured_grad" />
            <feMorphology in="blob" operator="erode" radius={glowSettings.edgeThickness} result="eroded_border" />
            <feComposite in="blob" in2="eroded_border" operator="out" result="sharp_border" />
            <feMerge result="combined"><feMergeNode in="textured_grad" /><feMergeNode in="sharp_border" /></feMerge>
            <feComposite in="combined" in2="blob" operator="in" result="final" />
            <feColorMatrix in="final" type="matrix" values={`1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 ${glowSettings.intensity} 0`} />
          </filter>
          <filter id="negative-seam-shadow" x="-200%" y="-200%" width="500%" height="500%">
            <feGaussianBlur stdDeviation={Math.max(0.6, glowSettings.innerSoftness * 0.12)} />
          </filter>
          <pattern id="dotGrid" width={40 * zoom} height={40 * zoom} patternUnits="userSpaceOnUse" x={viewOffset.x} y={viewOffset.y}>
            <circle cx={2 * zoom} cy={2 * zoom} r={0.8 * zoom} fill="#E5E7EB" />
          </pattern>
        </defs>

        <rect width="100%" height="100%" fill="#F8F9FA" />

        <g transform={`translate(${viewOffset.x}, ${viewOffset.y}) scale(${zoom})`} className="pointer-events-auto">
          <defs>
            <clipPath id="workspace-artboard-clip">
              <rect x={artboardRect.x} y={artboardRect.y} width={artboardRect.width} height={artboardRect.height} />
            </clipPath>
            {overlapCutouts.map((overlap) => (
              <clipPath key={`negative-overlap-${overlap.id}-a`} id={`negative-overlap-${overlap.id}-a`} clipPathUnits="userSpaceOnUse">
                <g transform={`translate(${overlap.a.x}, ${overlap.a.y}) rotate(${overlap.a.rotation}) scale(${overlap.a.scale})`}>
                  <path d={overlap.a.path} />
                </g>
              </clipPath>
            ))}
            {overlapCutouts.map((overlap) => (
              <clipPath key={`negative-overlap-${overlap.id}-b`} id={`negative-overlap-${overlap.id}-b`} clipPathUnits="userSpaceOnUse">
                <g transform={`translate(${overlap.b.x}, ${overlap.b.y}) rotate(${overlap.b.rotation}) scale(${overlap.b.scale})`}>
                  <path d={overlap.b.path} />
                </g>
              </clipPath>
            ))}
            <filter id="negative-solid-texture" x="-200%" y="-200%" width="500%" height="500%">
              <feTurbulence type="fractalNoise" baseFrequency="0.95" numOctaves="3" seed="42" result="grainNoise" />
              <feColorMatrix in="grainNoise" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -1 1" result="grainMask" />
              <feComponentTransfer in="grainMask" result="grainAlpha">
                <feFuncA type="linear" slope={Math.max(0, contactSettings.negativeGrain * 10)} intercept={1 - contactSettings.negativeGrain * 5} />
              </feComponentTransfer>
              <feComposite in="SourceGraphic" in2="grainAlpha" operator="in" result="grainTexture" />
              <feBlend in="SourceGraphic" in2="grainTexture" mode="multiply" />
            </filter>
            <filter id="overlay-back-blur" x="-200%" y="-200%" width="500%" height="500%">
              <feGaussianBlur stdDeviation={contactSettings.overlayBlur} />
            </filter>
          </defs>
          <g data-ui="true" pointerEvents="none">
            <rect x={-100000} y={-100000} width={200000} height={artboardRect.y + 100000} fill="#E2E8F0" fillOpacity={0.7} />
            <rect x={-100000} y={artboardRect.y + artboardRect.height} width={200000} height={100000 - artboardRect.y - artboardRect.height} fill="#E2E8F0" fillOpacity={0.7} />
            <rect x={-100000} y={artboardRect.y} width={100000 + artboardRect.x} height={artboardRect.height} fill="#E2E8F0" fillOpacity={0.7} />
            <rect x={artboardRect.x + artboardRect.width} y={artboardRect.y} width={100000 - artboardRect.x - artboardRect.width} height={artboardRect.height} fill="#E2E8F0" fillOpacity={0.7} />
            <rect x={artboardRect.x} y={artboardRect.y} width={artboardRect.width} height={artboardRect.height} fill="#ffffff" fillOpacity={0.96} stroke="#94a3b8" strokeWidth={1 / zoom} strokeDasharray={`${6 / zoom} ${6 / zoom}`} />
          </g>

          {contactMode === 'negative' ? (
            <g clipPath={artboard.clipContent ? 'url(#workspace-artboard-clip)' : undefined}>
              {negativeSceneHref && (
                <image
                  href={negativeSceneHref}
                  x={-viewOffset.x / zoom}
                  y={-viewOffset.y / zoom}
                  width={viewportWidth / zoom}
                  height={viewportHeight / zoom}
                  preserveAspectRatio="none"
                  pointerEvents="none"
                />
              )}
              {elements.map((el) => (
                <g key={el.id} transform={`translate(${el.x}, ${el.y}) rotate(${el.rotation}) scale(${el.scale})`} onPointerDown={(e) => handlePointerDown(e, el.id, 'drag')}>
                  <path d={el.path} fill="transparent" stroke="none" />
                </g>
              ))}
            </g>
          ) : contactMode === 'overlay' ? (
            <g clipPath={artboard.clipContent ? 'url(#workspace-artboard-clip)' : undefined}>
              {elements.map((el) => (
                <g key={el.id} filter="url(#clean-fusion)">
                  <g transform={`translate(${el.x}, ${el.y}) rotate(${el.rotation}) scale(${el.scale})`} onPointerDown={(e) => handlePointerDown(e, el.id, 'drag')}>
                    <path d={el.path} fill={el.color} stroke="none" opacity={selectedIdSet.has(el.id) ? 1 : 0.9} filter={liquidSettings.enabled ? `url(#liquid-flow-${el.id})` : 'none'} />
                  </g>
                </g>
              ))}
              <g data-ui="true" pointerEvents="none">
                {overlapCutouts.map((overlap) => (
                  <g
                    key={`overlay-blur-${overlap.id}`}
                    transform={`translate(${overlap.a.x}, ${overlap.a.y}) rotate(${overlap.a.rotation}) scale(${overlap.a.scale})`}
                    clipPath={`url(#negative-overlap-${overlap.id}-b)`}
                    filter="url(#overlay-back-blur)"
                    opacity={contactSettings.overlayBlurOpacity}
                  >
                    <path d={overlap.a.path} fill={overlap.a.color} />
                  </g>
                ))}
              </g>
            </g>
          ) : (
            <g filter="url(#clean-fusion)" clipPath={artboard.clipContent ? 'url(#workspace-artboard-clip)' : undefined}>
              {elements.map((el) => (
                <g key={el.id} transform={`translate(${el.x}, ${el.y}) rotate(${el.rotation}) scale(${el.scale})`} onPointerDown={(e) => handlePointerDown(e, el.id, 'drag')}>
                  <path d={el.path} fill={el.color} stroke="none" opacity={selectedIdSet.has(el.id) ? 1 : 0.9} filter={liquidSettings.enabled ? `url(#liquid-flow-${el.id})` : 'none'} />
                </g>
              ))}
            </g>
          )}

          {isBrushMode && isDrawingBrush && brushPoints.length > 1 && (
            <g data-ui="true" className="pointer-events-none">
              <path d={`M${brushPoints[0].x},${brushPoints[0].y} ${brushPoints.slice(1).map((p) => `L${p.x},${p.y}`).join(' ')} Z`} fill={activeColor} fillOpacity={0.1} />
              <path d={`M${brushPoints[0].x},${brushPoints[0].y} ${brushPoints.slice(1).map((p) => `L${p.x},${p.y}`).join(' ')}`} fill="none" stroke={activeColor} strokeWidth={3 / zoom} strokeLinecap="round" strokeLinejoin="round" />
              <line x1={brushPoints[brushPoints.length - 1].x} y1={brushPoints[brushPoints.length - 1].y} x2={brushPoints[0].x} y2={brushPoints[0].y} stroke={activeColor} strokeWidth={1 / zoom} strokeDasharray={`${4 / zoom} ${4 / zoom}`} opacity={0.5} />
              <circle cx={brushPoints[0].x} cy={brushPoints[0].y} r={4 / zoom} fill={activeColor} />
            </g>
          )}

          {isEditMode && selectedSingle && (
            <g data-ui="true" transform={`translate(${selectedSingle.x}, ${selectedSingle.y}) rotate(${selectedSingle.rotation}) scale(${selectedSingle.scale})`}>
              {selectedSingle.segments.map((seg, idx) => {
                if (seg.type === 'Z') return null;
                const isSelected = selectedPointIdx === idx;
                const localHandleScale = Math.max(0.0001, selectedSingle.scale);
                const hStroke = 1 / (zoom * localHandleScale);
                const hRad = 5 / (zoom * localHandleScale);
                const hitRad = 9 / (zoom * localHandleScale);
                return (
                  <g key={`edit-${selectedSingle.id}-${idx}`}>
                    {isSelected && seg.type === 'C' && (
                      <>
                        <line x1={seg.x} y1={seg.y} x2={seg.x2} y2={seg.y2} stroke="#6366f1" strokeWidth={hStroke} strokeDasharray="2 2" />
                        <circle cx={seg.x2} cy={seg.y2} r={hitRad} fill="transparent" className="pointer-events-auto" style={{ touchAction: 'none' }} onPointerDown={(e) => handlePointerDown(e, selectedSingle.id, 'point', { elId: selectedSingle.id, segIndex: idx, prop: 'in' })} />
                        <circle cx={seg.x2} cy={seg.y2} r={hRad * 0.85} fill="white" stroke="#6366f1" strokeWidth={hStroke} className="pointer-events-none" />
                        {typeof seg.outX === 'number' && typeof seg.outY === 'number' && (
                          <>
                            <line x1={seg.x} y1={seg.y} x2={seg.outX} y2={seg.outY} stroke="#6366f1" strokeWidth={hStroke} strokeDasharray="2 2" />
                            <circle cx={seg.outX} cy={seg.outY} r={hitRad} fill="transparent" className="pointer-events-auto" style={{ touchAction: 'none' }} onPointerDown={(e) => handlePointerDown(e, selectedSingle.id, 'point', { elId: selectedSingle.id, segIndex: idx, prop: 'out' })} />
                            <circle cx={seg.outX} cy={seg.outY} r={hRad * 0.85} fill="white" stroke="#6366f1" strokeWidth={hStroke} className="pointer-events-none" />
                          </>
                        )}
                      </>
                    )}
                    <rect x={seg.x - hitRad} y={seg.y - hitRad} width={hitRad * 2} height={hitRad * 2} fill="transparent" className="pointer-events-auto" style={{ touchAction: 'none' }} onPointerDown={(e) => handlePointerDown(e, selectedSingle.id, 'point', { elId: selectedSingle.id, segIndex: idx, prop: 'main' })} />
                    <rect x={seg.x - hRad} y={seg.y - hRad} width={hRad * 2} height={hRad * 2} fill={isSelected ? '#6366f1' : 'white'} stroke="#6366f1" strokeWidth={hStroke * 1.35} className="pointer-events-none" />
                  </g>
                );
              })}
            </g>
          )}

          {!isEditMode && selectedSingle && (() => {
            const localBounds = getElementLocalBounds(selectedSingle);
            const scaledBounds = {
              minX: localBounds.minX * selectedSingle.scale,
              minY: localBounds.minY * selectedSingle.scale,
              maxX: localBounds.maxX * selectedSingle.scale,
              maxY: localBounds.maxY * selectedSingle.scale,
              width: localBounds.width * selectedSingle.scale,
              height: localBounds.height * selectedSingle.scale,
              centerX: localBounds.centerX * selectedSingle.scale,
              centerY: localBounds.centerY * selectedSingle.scale,
            };
            const handleRadius = 6 / zoom;
            const handleStroke = 1.5 / zoom;
            const centerKnobOuterRadius = 9 / zoom;
            const centerKnobInnerRadius = 3 / zoom;
            return (
              <g data-ui="true" transform={`translate(${selectedSingle.x}, ${selectedSingle.y}) rotate(${selectedSingle.rotation})`}>
                <rect x={scaledBounds.minX} y={scaledBounds.minY} width={scaledBounds.width} height={scaledBounds.height} fill="none" stroke="#3b82f6" strokeWidth={0.8 / zoom} strokeDasharray={`${4 / zoom} ${4 / zoom}`} opacity={0.35} />
                <circle cx={scaledBounds.centerX} cy={scaledBounds.centerY} r={centerKnobOuterRadius} fill="white" stroke="#3b82f6" strokeWidth={handleStroke} className="pointer-events-auto" style={{ touchAction: 'none' }} onPointerDown={(e) => handlePointerDown(e, selectedSingle.id, 'rotate')} />
                <circle cx={scaledBounds.centerX} cy={scaledBounds.centerY} r={centerKnobInnerRadius} fill="#3b82f6" className="pointer-events-none" />
                <circle cx={scaledBounds.centerX} cy={scaledBounds.minY} r={handleRadius} fill="white" stroke="#3b82f6" strokeWidth={handleStroke} className="pointer-events-auto" style={{ touchAction: 'none' }} onPointerDown={(e) => handlePointerDown(e, selectedSingle.id, 'scale', { scaleHandle: 'top' })} />
                <circle cx={scaledBounds.maxX} cy={scaledBounds.centerY} r={handleRadius} fill="white" stroke="#3b82f6" strokeWidth={handleStroke} className="pointer-events-auto" style={{ touchAction: 'none' }} onPointerDown={(e) => handlePointerDown(e, selectedSingle.id, 'scale', { scaleHandle: 'right' })} />
                <circle cx={scaledBounds.centerX} cy={scaledBounds.maxY} r={handleRadius} fill="white" stroke="#3b82f6" strokeWidth={handleStroke} className="pointer-events-auto" style={{ touchAction: 'none' }} onPointerDown={(e) => handlePointerDown(e, selectedSingle.id, 'scale', { scaleHandle: 'bottom' })} />
                <circle cx={scaledBounds.minX} cy={scaledBounds.centerY} r={handleRadius} fill="white" stroke="#3b82f6" strokeWidth={handleStroke} className="pointer-events-auto" style={{ touchAction: 'none' }} onPointerDown={(e) => handlePointerDown(e, selectedSingle.id, 'scale', { scaleHandle: 'left' })} />
              </g>
            );
          })()}

          {!isEditMode && groupBounds && (
            <g data-ui="true">
              <rect x={groupBounds.minX} y={groupBounds.minY} width={groupBounds.maxX - groupBounds.minX} height={groupBounds.maxY - groupBounds.minY} fill="rgba(59,130,246,0.05)" stroke="#3b82f6" strokeWidth={0.6 / zoom} strokeDasharray={`${6 / zoom} ${6 / zoom}`} pointerEvents="none" />
              <line x1={(groupBounds.minX + groupBounds.maxX) / 2} y1={groupBounds.minY} x2={(groupBounds.minX + groupBounds.maxX) / 2} y2={groupBounds.minY - 30 / zoom} stroke="#3b82f6" strokeWidth={1.2 / zoom} strokeDasharray={`${2 / zoom} ${2 / zoom}`} pointerEvents="none" />
              <circle cx={(groupBounds.minX + groupBounds.maxX) / 2} cy={groupBounds.minY - 30 / zoom} r={5 / zoom} fill="white" stroke="#3b82f6" strokeWidth={1.2 / zoom} className="pointer-events-auto" onPointerDown={(e) => handlePointerDown(e, null, 'groupRotate')} />
              <circle cx={groupBounds.maxX} cy={groupBounds.maxY} r={5 / zoom} fill="white" stroke="#3b82f6" strokeWidth={1.2 / zoom} className="pointer-events-auto" onPointerDown={(e) => handlePointerDown(e, null, 'groupScale')} />
            </g>
          )}

          {marquee && <rect data-ui="true" x={Math.min(marquee.startX, marquee.currentX)} y={Math.min(marquee.startY, marquee.currentY)} width={Math.abs(marquee.currentX - marquee.startX)} height={Math.abs(marquee.currentY - marquee.startY)} fill="rgba(59,130,246,0.08)" stroke="#3b82f6" strokeWidth={1 / zoom} strokeDasharray={`${4 / zoom} ${4 / zoom}`} />}
        </g>
      </svg>

      {isDraggingOver && (
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center pointer-events-none z-40 p-8">
          <div className="w-full max-w-lg h-64 border-4 border-dashed border-white/60 rounded-[3rem] flex flex-col items-center justify-center gap-4 text-white">
            <div className="p-6 bg-white/20 rounded-full backdrop-blur-md">
              <FileCode className="w-12 h-12" />
            </div>
            <p className="text-2xl font-black uppercase tracking-widest drop-shadow-lg">释放导入 SVG 路径</p>
          </div>
        </div>
      )}

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-6 px-6 py-3 bg-slate-900/90 backdrop-blur-xl text-white rounded-full shadow-2xl z-20 border border-white/10 max-w-[95%] overflow-x-auto">
        <div className="flex items-center gap-2 pointer-events-none shrink-0"><FileCode className="w-3 h-3 text-indigo-400" /><span className="text-[9px] font-black uppercase tracking-[0.2em]">拖入 SVG</span></div>
        <div className="w-px h-3 bg-white/20 pointer-events-none shrink-0" />
        <div className="flex items-center gap-2 pointer-events-none shrink-0"><ZoomIn className="w-3 h-3 text-yellow-400" /><span className="text-[9px] font-black uppercase tracking-[0.2em]">滚轮缩放</span></div>
        <div className="w-px h-3 bg-white/20 pointer-events-none shrink-0" />
        <div className="flex items-center gap-2 pointer-events-none shrink-0"><Hand className="w-3 h-3 text-green-400" /><span className="text-[9px] font-black uppercase tracking-[0.2em]">右键平移</span></div>
        <div className="w-px h-3 bg-white/20 pointer-events-none shrink-0" />
        <button onClick={fitViewToArtboard} className="flex items-center gap-2 group shrink-0" title="适配到画板"><Target className="w-3 h-3 text-red-400" /><span className="text-[9px] font-black uppercase tracking-[0.2em]">适配到画板</span></button>
      </div>

      {isBrushMode && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 bg-indigo-600 text-white px-5 py-2.5 rounded-2xl text-[9px] font-black flex items-center gap-5 shadow-xl z-30 pointer-events-none uppercase tracking-widest">
          <span className="flex items-center gap-2"><Pencil className="w-3.5 h-3.5" /> 画笔模式</span>
          <div className="w-px h-3 bg-white/20" />
          <span>自由绘制线条 | 松开鼠标自动闭合路径</span>
        </div>
      )}

      {isEditMode && selectedSingle && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 bg-white border border-slate-200 px-5 py-2.5 rounded-2xl text-[9px] font-black flex items-center gap-5 shadow-xl z-30 pointer-events-none uppercase tracking-widest text-slate-900">
          <span className="flex items-center gap-2 text-indigo-600"><Maximize2 className="w-3.5 h-3.5" /> 锚点联动编辑</span>
          <div className="w-px h-3 bg-slate-200" />
          <span className="flex items-center gap-2 text-slate-400"><Info className="w-3.5 h-3.5" /> Del 删除锚点</span>
        </div>
      )}
    </div>
  );
});

export default function App() {
  const [elements, setElements] = useState<ElementItem[]>([]);
  const [activeColor, setActiveColor] = useState('#ff4d00');
  const [palette] = useState(INITIAL_COLORS);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isBrushMode, setIsBrushMode] = useState(false);
  const [brushPoints, setBrushPoints] = useState<Point[]>([]);
  const [isDrawingBrush, setIsDrawingBrush] = useState(false);
  const [activePoint, setActivePoint] = useState<ActivePointState | null>(null);
  const [selectedPointIdx, setSelectedPointIdx] = useState<number | null>(null);
  const [marquee, setMarquee] = useState<MarqueeState | null>(null);
  const [history, setHistory] = useState<ElementItem[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [viewOffset, setViewOffset] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<Point>({ x: 0, y: 0 });
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [rotatingId, setRotatingId] = useState<number | null>(null);
  const [rotatingGroup, setRotatingGroup] = useState(false);
  const [scalingId, setScalingId] = useState<number | null>(null);
  const [scalingGroup, setScalingGroup] = useState(false);
  const [initialScale, setInitialScale] = useState(1);
  const [initialDist, setInitialDist] = useState(0);
  const scaleHandleRef = useRef<ScaleHandle>('corner');
  const [groupCenter, setGroupCenter] = useState<Point>({ x: 0, y: 0 });
  const [initialStates, setInitialStates] = useState<ElementItem[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [rotationSnap, setRotationSnap] = useState({ initialRotation: 0, startAngle: 0 });
  const [liquidSettings, setLiquidSettings] = useState<LiquidSettings>(DEFAULT_LIQUID_SETTINGS);
  const [contactMode, setContactMode] = useState<ContactMode>('fusion');
  const [glowSettings, setGlowSettings] = useState<GlowSettings>(DEFAULT_GLOW_SETTINGS);
  const [contactSettings, setContactSettings] = useState<ContactSettings>(DEFAULT_CONTACT_SETTINGS);
  const [artboard, setArtboard] = useState<ArtboardSettings>(DEFAULT_ARTBOARD_SETTINGS);
  const [shapeStyle, setShapeStyle] = useState<ShapeStyle>('organic');
  const [shapeStyleIntensity, setShapeStyleIntensity] = useState(1);
  const [isExportingGif, setIsExportingGif] = useState(false);
  const [pngExportScale, setPngExportScale] = useState(2);
  const [gifExportScale, setGifExportScale] = useState(1);
  const [gifFrameCount, setGifFrameCount] = useState(24);
  const [collapsedSidebar, setCollapsedSidebar] = useState(false);
  const [sectionOpen, setSectionOpen] = useState<Record<SectionKey, boolean>>({
    quick: true,
    physics: true,
    color: true,
    motion: true,
    style: true,
    artboard: false,
    library: true,
  });

  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageTimerRef = useRef<number | null>(null);
  const idRef = useRef(1);
  const historyIndexRef = useRef(0);
  const dragStartPositionsRef = useRef<Record<number, Point>>({});
  const dragPointerStartRef = useRef<Point>({ x: 0, y: 0 });
  const dragSelectedIdsRef = useRef<number[]>([]);
  const hasPendingHistoryRef = useRef(false);

  const time = useAnimationTime(liquidSettings.enabled, 30);
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const elementsById = useMemo(() => new Map<number, ElementItem>(elements.map((el) => [el.id, el])), [elements]);
  const selectedElements = useMemo(() => elements.filter((el) => selectedIdSet.has(el.id)), [elements, selectedIdSet]);

  const selectedSingle = useMemo<ElementItem | null>(() => {
    if (selectedIds.length !== 1) return null;
    return elementsById.get(selectedIds[0]) || null;
  }, [elementsById, selectedIds]);

  const groupBounds = useMemo(() => {
    if (selectedElements.length <= 1) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    selectedElements.forEach((el) => {
      const bounds = getElementLocalBounds(el);
      const halfW = (bounds.width * el.scale) / 2;
      const halfH = (bounds.height * el.scale) / 2;
      const radius = Math.max(halfW, halfH);
      minX = Math.min(minX, el.x - radius);
      minY = Math.min(minY, el.y - radius);
      maxX = Math.max(maxX, el.x + radius);
      maxY = Math.max(maxY, el.y + radius);
    });

    return { minX, minY, maxX, maxY };
  }, [selectedElements]);

  const artboardRect = useMemo(() => ({
    x: -artboard.width / 2,
    y: -artboard.height / 2,
    width: artboard.width,
    height: artboard.height,
  }), [artboard.height, artboard.width]);

  const pngOutputWidth = useMemo(() => Math.max(1, Math.round(artboard.width * pngExportScale)), [artboard.width, pngExportScale]);
  const pngOutputHeight = useMemo(() => Math.max(1, Math.round(artboard.height * pngExportScale)), [artboard.height, pngExportScale]);
  const gifOutputWidth = useMemo(() => Math.max(1, Math.round(artboard.width * gifExportScale)), [artboard.width, gifExportScale]);
  const gifOutputHeight = useMemo(() => Math.max(1, Math.round(artboard.height * gifExportScale)), [artboard.height, gifExportScale]);

  const artboardCenter = useMemo(() => ({ x: 0, y: 0 }), []);

  const isPointInsideArtboard = useCallback((point: Point) => (
    point.x >= artboardRect.x && point.x <= artboardRect.x + artboardRect.width && point.y >= artboardRect.y && point.y <= artboardRect.y + artboardRect.height
  ), [artboardRect.height, artboardRect.width, artboardRect.x, artboardRect.y]);

  const toggleSection = useCallback((key: SectionKey) => {
    setSectionOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const nextId = useCallback(() => {
    const value = Date.now() * 1000 + idRef.current;
    idRef.current += 1;
    return value;
  }, []);

  const fitViewToArtboard = useCallback(() => {
    const sidebarWidth = collapsedSidebar ? 72 : 320;
    const headerHeight = 64;
    const viewportWidth = Math.max(1, window.innerWidth - sidebarWidth);
    const viewportHeight = Math.max(1, window.innerHeight - headerHeight);
    const padding = 64;
    const fitZoom = Math.min(
      (viewportWidth - padding * 2) / Math.max(1, artboard.width),
      (viewportHeight - padding * 2) / Math.max(1, artboard.height),
      1,
    );
    const nextZoom = Math.max(0.1, Math.min(10, fitZoom));
    setZoom(nextZoom);
    setViewOffset({ x: viewportWidth / 2, y: viewportHeight / 2 });
  }, [artboard.height, artboard.width, collapsedSidebar]);

  const getArtboardMotionBaseline = useCallback(() => {
    const artboardElements = elements.filter((el) => (
      el.x >= artboardRect.x && el.x <= artboardRect.x + artboardRect.width && el.y >= artboardRect.y && el.y <= artboardRect.y + artboardRect.height
    ));
    if (!artboardElements.length) return null;

    const total = artboardElements.reduce((sum, el) => {
      const profile = el.liquidProfile;
      return {
        amplitudeFactor: sum.amplitudeFactor + profile.amplitudeFactor,
        waveFactor: sum.waveFactor + profile.waveFactor,
        viscosityFactor: sum.viscosityFactor + profile.viscosityFactor,
        motionEnergy: sum.motionEnergy + profile.amplitudeFactor * profile.waveFactor * profile.viscosityFactor,
      };
    }, {
      amplitudeFactor: 0,
      waveFactor: 0,
      viscosityFactor: 0,
      motionEnergy: 0,
    });

    const count = artboardElements.length;
    return {
      amplitudeFactor: total.amplitudeFactor / count,
      waveFactor: total.waveFactor / count,
      viscosityFactor: total.viscosityFactor / count,
      motionEnergy: total.motionEnergy / count,
    };
  }, [artboardRect.height, artboardRect.width, artboardRect.x, artboardRect.y, elements]);

  const showMsg = useCallback((text: string) => {
    setMessage(text);
    if (messageTimerRef.current) window.clearTimeout(messageTimerRef.current);
    messageTimerRef.current = window.setTimeout(() => {
      setMessage(null);
      messageTimerRef.current = null;
    }, 2600);
  }, []);

  useEffect(() => () => {
    if (messageTimerRef.current) window.clearTimeout(messageTimerRef.current);
  }, []);

  useEffect(() => {
    historyIndexRef.current = historyIndex;
  }, [historyIndex]);

  useEffect(() => {
    fitViewToArtboard();
  }, [fitViewToArtboard]);

  const saveToHistory = useCallback((currentElements: ElementItem[]) => {
    setHistory((prev) => {
      const currentIndex = historyIndexRef.current;
      const sliced = prev.slice(0, currentIndex + 1);
      const snapshot = deepClone(currentElements);
      const last = sliced[sliced.length - 1] || [];
      if (JSON.stringify(last) === JSON.stringify(snapshot)) return prev;
      const nextHistory = [...sliced, snapshot];
      const nextIndex = nextHistory.length - 1;
      historyIndexRef.current = nextIndex;
      setHistoryIndex(nextIndex);
      return nextHistory;
    });
  }, []);

  const commitElements = useCallback((next: ElementItem[], options?: { saveHistory?: boolean }) => {
    setElements(next);
    if (options?.saveHistory === false) {
      hasPendingHistoryRef.current = true;
      return;
    }
    saveToHistory(next);
    hasPendingHistoryRef.current = false;
  }, [saveToHistory]);

  const applyInteractiveElements = useCallback((producer: (prev: ElementItem[]) => ElementItem[]) => {
    setElements((prev) => {
      const next = producer(prev);
      hasPendingHistoryRef.current = true;
      return next;
    });
  }, []);

  const undo = useCallback(() => {
    if (hasPendingHistoryRef.current) {
      saveToHistory(elements);
      hasPendingHistoryRef.current = false;
    }
    const currentIndex = historyIndexRef.current;
    if (currentIndex <= 0) return;
    const nextIndex = currentIndex - 1;
    historyIndexRef.current = nextIndex;
    setHistoryIndex(nextIndex);
    setElements(deepClone(history[nextIndex] || []));
    setSelectedIds([]);
    setSelectedPointIdx(null);
    setActivePoint(null);
    setMarquee(null);
    setDraggingId(null);
    setRotatingId(null);
    setScalingId(null);
    setRotatingGroup(false);
    setScalingGroup(false);
    setIsDrawingBrush(false);
    setBrushPoints([]);
    dragStartPositionsRef.current = {};
    dragPointerStartRef.current = { x: 0, y: 0 };
    dragSelectedIdsRef.current = [];
  }, [elements, history, saveToHistory]);

  const createElementFromPath = useCallback((pathData: string, name: string, x?: number, y?: number): ElementItem => {
    let segments = parsePathToSegments(pathData);
    const bounds = getSegmentsBounds(segments);
    segments = segments.map((seg) => {
      if (seg.type === 'Z') return seg;
      const next = { ...seg } as Segment;
      if ('x' in next) {
        next.x -= bounds.centerX;
        next.y -= bounds.centerY;
      }
      if ('x1' in next) {
        next.x1 -= bounds.centerX;
        next.y1 -= bounds.centerY;
      }
      if ('x2' in next) {
        next.x2 -= bounds.centerX;
        next.y2 -= bounds.centerY;
      }
      if ('outX' in next && typeof next.outX === 'number' && typeof next.outY === 'number') {
        next.outX -= bounds.centerX;
        next.outY -= bounds.centerY;
      }
      return next;
    });

    const normalizedPath = segmentsToPath(segments);
    const id = nextId();
    return {
      id,
      name,
      path: normalizedPath,
      basePath: normalizedPath,
      segments,
      x: x ?? artboardCenter.x,
      y: y ?? artboardCenter.y,
      rotation: 0,
      scale: 1,
      color: activeColor,
      size: Math.max(bounds.width, bounds.height) / 2 || 50,
      liquidProfile: createRandomLiquidProfile(id),
    };
  }, [activeColor, artboardCenter.x, artboardCenter.y, nextId]);

  const addElement = useCallback((pathData: string, name = '新元素', options?: { alignAmplitudeToArtboard?: boolean }) => {
    const baseElement = createElementFromPath(pathData, name);
    const motionBaseline = options?.alignAmplitudeToArtboard ? getArtboardMotionBaseline() : null;
    const profiledElement: ElementItem = motionBaseline === null
      ? baseElement
      : (() => {
          return {
            ...baseElement,
            liquidProfile: harmonizeLiquidProfile(
              baseElement.liquidProfile,
              motionBaseline,
              liquidSettings.importAmplitudeMode === 'strict' ? 1 : 0.82,
            ),
          };
        })();
    const styledPath = morphPathByStyle(profiledElement.basePath, shapeStyle, profiledElement.id, shapeStyleIntensity);
    const styledSegments = parsePathToSegments(styledPath);
    const styledBounds = getSegmentsBounds(styledSegments);
    const newElement: ElementItem = {
      ...profiledElement,
      path: styledPath,
      segments: styledSegments,
      size: Math.max(styledBounds.width, styledBounds.height) / 2 || profiledElement.size,
    };
    const next = [...elements, newElement];
    commitElements(next);
    setSelectedIds([newElement.id]);
  }, [commitElements, createElementFromPath, elements, getArtboardMotionBaseline, liquidSettings.importAmplitudeMode, shapeStyle, shapeStyleIntensity]);

  const alignElementMotionToArtboard = useCallback((baseElement: ElementItem) => {
    const motionBaseline = getArtboardMotionBaseline();
    if (motionBaseline === null) return baseElement;

    return {
      ...baseElement,
      liquidProfile: harmonizeLiquidProfile(
        baseElement.liquidProfile,
        motionBaseline,
        liquidSettings.importAmplitudeMode === 'strict' ? 0.96 : 0.88,
      ),
    };
  }, [getArtboardMotionBaseline, liquidSettings.importAmplitudeMode]);

  const applyShapeStyleToArtboard = useCallback((style: ShapeStyle, options?: { silent?: boolean }) => {
    const next = elements.map((el) => {
      const inArtboard = el.x >= artboardRect.x && el.x <= artboardRect.x + artboardRect.width && el.y >= artboardRect.y && el.y <= artboardRect.y + artboardRect.height;
      if (!inArtboard) return el;
      const styledPath = morphPathByStyle(el.basePath, style, el.id, shapeStyleIntensity);
      const styledSegments = parsePathToSegments(styledPath);
      const styledBounds = getSegmentsBounds(styledSegments);
      return { ...el, path: styledPath, segments: styledSegments, size: Math.max(styledBounds.width, styledBounds.height) / 2 || el.size };
    });
    commitElements(next);
    setShapeStyle(style);
    if (!options?.silent) {
      showMsg(`已将画板内元素切换为${SHAPE_STYLE_CONFIG[style].label}风格`);
    }
  }, [artboardRect.height, artboardRect.width, artboardRect.x, artboardRect.y, commitElements, elements, shapeStyleIntensity, showMsg]);

  useEffect(() => {
    if (!elements.length) return;
    applyShapeStyleToArtboard(shapeStyle, { silent: true });
  }, [shapeStyleIntensity]);

  const rerandomizeLiquidProfiles = useCallback(() => {
    const next = elements.map((el, index) => ({ ...el, liquidProfile: createRandomLiquidProfile(nextId() + index) }));
    commitElements(next);
    showMsg('已重新随机液体参数');
  }, [commitElements, elements, nextId, showMsg]);

  const deleteSelectedElements = useCallback(() => {
    if (!selectedIds.length) return;
    const next = elements.filter((el) => !selectedIdSet.has(el.id));
    commitElements(next);
    setSelectedIds([]);
    setSelectedPointIdx(null);
  }, [commitElements, elements, selectedIdSet, selectedIds.length]);

  const moveSelectedBackward = useCallback(() => {
    if (!selectedIds.length) return;
    const next = elements.slice();
    for (let index = 1; index < next.length; index += 1) {
      if (selectedIdSet.has(next[index].id) && !selectedIdSet.has(next[index - 1].id)) {
        [next[index - 1], next[index]] = [next[index], next[index - 1]];
      }
    }
    commitElements(next);
    showMsg('已将所选元素下移一层');
  }, [commitElements, elements, selectedIdSet, selectedIds.length, showMsg]);

  const moveSelectedForward = useCallback(() => {
    if (!selectedIds.length) return;
    const next = elements.slice();
    for (let index = next.length - 2; index >= 0; index -= 1) {
      if (selectedIdSet.has(next[index].id) && !selectedIdSet.has(next[index + 1].id)) {
        [next[index], next[index + 1]] = [next[index + 1], next[index]];
      }
    }
    commitElements(next);
    showMsg('已将所选元素上移一层');
  }, [commitElements, elements, selectedIdSet, selectedIds.length, showMsg]);

  const deleteSelectedPoint = useCallback(() => {
    if (!isEditMode || selectedPointIdx === null || !selectedSingle) return;
    const sourceSegments = selectedSingle.segments;
    const target = sourceSegments[selectedPointIdx];
    if (!target || target.type === 'Z') return;
    const drawableCount = sourceSegments.filter((seg) => seg.type !== 'Z').length;
    if (drawableCount <= 2) {
      showMsg('至少保留两个锚点');
      return;
    }

    const nextSegments = sourceSegments.filter((_, idx) => idx !== selectedPointIdx).map((seg) => ({ ...seg })) as Segment[];
    for (let i = 0; i < nextSegments.length; i += 1) {
      const seg = nextSegments[i];
      if (seg.type === 'C') {
        delete seg.outX;
        delete seg.outY;
      }
    }
    for (let i = 0; i < nextSegments.length - 1; i += 1) {
      const seg = nextSegments[i];
      const next = nextSegments[i + 1];
      if (seg.type === 'C' && next.type === 'C') {
        seg.outX = next.x1;
        seg.outY = next.y1;
      }
    }

    const nextElements = elements.map((el) => el.id === selectedSingle.id ? { ...el, segments: nextSegments, path: segmentsToPath(nextSegments) } : el);
    commitElements(nextElements);
    setSelectedPointIdx((prev) => {
      if (prev === null) return null;
      const nextIndex = Math.max(0, Math.min(prev - 1, nextSegments.length - 1));
      return nextSegments[nextIndex]?.type === 'Z' ? null : nextIndex;
    });
  }, [commitElements, elements, isEditMode, selectedPointIdx, selectedSingle, showMsg]);

  const handleSvgFile = useCallback((file: File) => {
    if (!file.name.toLowerCase().endsWith('.svg')) {
      showMsg('请选择标准的 SVG 文件');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = String(e.target?.result || '');
        const parser = new DOMParser();
        const doc = parser.parseFromString(content, 'image/svg+xml');
        const pathElement = doc.querySelector('path');
        const d = pathElement?.getAttribute('d');
        if (!d) {
          showMsg('无法在文件中找到有效路径');
          return;
        }
        addElement(d, file.name.replace(/\.svg$/i, ''), { alignAmplitudeToArtboard: true });
        showMsg('导入成功');
      } catch {
        showMsg('解析失败，请检查 SVG 文件格式');
      }
    };
    reader.readAsText(file);
  }, [addElement, showMsg]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleSvgFile(file);
    e.target.value = '';
  }, [handleSvgFile]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleSvgFile(file);
  }, [handleSvgFile]);

  const fillCanvas = useCallback(() => {
    const count = 12 + Math.floor(Math.random() * 8);
    const width = Math.max(200, artboard.width - 160);
    const height = Math.max(200, artboard.height - 160);
    const newElements = Array.from({ length: count }, (_, index) => {
      const preset = PRESET_DATA[Math.floor(Math.random() * PRESET_DATA.length)];
      const color = palette[Math.floor(Math.random() * palette.length)].value;
      const x = artboardCenter.x - width / 2 + 80 + Math.random() * Math.max(20, width - 160);
      const y = artboardCenter.y - height / 2 + 80 + Math.random() * Math.max(20, height - 160);
      const baseElement = createElementFromPath(preset.path, preset.name, x, y);
      const styledPath = morphPathByStyle(baseElement.basePath, shapeStyle, baseElement.id + index * 17, shapeStyleIntensity);
      const styledSegments = parsePathToSegments(styledPath);
      const styledBounds = getSegmentsBounds(styledSegments);
      return { ...baseElement, rotation: Math.random() * 360, scale: 0.8 + Math.random() * 1.2, color, path: styledPath, segments: styledSegments, size: Math.max(styledBounds.width, styledBounds.height) / 2 || baseElement.size } as ElementItem;
    });
    const next = [...elements, ...newElements];
    commitElements(next);
    showMsg(`已随机生成 ${count} 个融合气泡`);
  }, [artboard.height, artboard.width, artboardCenter.x, artboardCenter.y, commitElements, createElementFromPath, elements, palette, shapeStyle, shapeStyleIntensity, showMsg]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!canvasRef.current) return;
    e.preventDefault();
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const worldX = (mouseX - viewOffset.x) / zoom;
    const worldY = (mouseY - viewOffset.y) / zoom;
    const delta = -e.deltaY * 0.0015;
    const newZoom = Math.min(Math.max(zoom + delta, 0.1), 10);
    setViewOffset({ x: mouseX - worldX * newZoom, y: mouseY - worldY * newZoom });
    setZoom(newZoom);
  }, [viewOffset.x, viewOffset.y, zoom]);

  const finishInteractions = useCallback((currentElements?: ElementItem[]) => {
    if (marquee) {
      const x1 = Math.min(marquee.startX, marquee.currentX);
      const y1 = Math.min(marquee.startY, marquee.currentY);
      const x2 = Math.max(marquee.startX, marquee.currentX);
      const y2 = Math.max(marquee.startY, marquee.currentY);
      const source = currentElements || elements;
      setSelectedIds(source.filter((el) => el.x >= x1 && el.x <= x2 && el.y >= y1 && el.y <= y2).map((el) => el.id));
      setMarquee(null);
    }
    if (currentElements && hasPendingHistoryRef.current) {
      saveToHistory(currentElements);
      hasPendingHistoryRef.current = false;
    }
    setDraggingId(null);
    setRotatingId(null);
    setScalingId(null);
    setRotatingGroup(false);
    setScalingGroup(false);
    setIsPanning(false);
    setActivePoint(null);
    dragStartPositionsRef.current = {};
    dragPointerStartRef.current = { x: 0, y: 0 };
    dragSelectedIdsRef.current = [];
  }, [elements, marquee, saveToHistory]);

  const handlePointerUp = useCallback(() => {
    if (isDrawingBrush) {
      if (brushPoints.length > 2) {
        const rawBounds = getSegmentsBounds(parsePathToSegments(`M${brushPoints[0].x},${brushPoints[0].y} ${brushPoints.slice(1).map((p) => `L${p.x},${p.y}`).join(' ')} Z`));
        const referenceSize = Math.max(rawBounds.width, rawBounds.height);
        const brushAnchorTarget = getBrushAnchorTarget(referenceSize);
        const simplifiedPoints = simplifyBrushPoints(brushPoints, referenceSize);
        const brushAngularity = getBrushAngularity(simplifiedPoints);
        const roundedPoints = brushAngularity > 0.42
          ? simplifiedPoints
          : chaikinSmoothClosed(simplifiedPoints, referenceSize < 240 ? 1 : 2);
        const finalPoints = reducePointsToTarget(simplifyBrushPoints(roundedPoints, referenceSize), brushAnchorTarget);
        const pathStr = buildSmoothClosedPath(finalPoints, brushAngularity > 0.42 ? 0.08 : 0.14);
        const bounds = getSegmentsBounds(parsePathToSegments(pathStr));
        const newElementBase = createElementFromPath(pathStr, `画笔路径 ${elements.length + 1}`, bounds.centerX, bounds.centerY);
        const alignedBase = alignElementMotionToArtboard(newElementBase);
        const stabilizedBase: ElementItem = {
          ...alignedBase,
          liquidProfile: harmonizeLiquidProfile(stabilizeBrushLiquidProfile(alignedBase.liquidProfile), getArtboardMotionBaseline(), 0.92),
        };
        const styledPath = morphPathByStyle(stabilizedBase.basePath, shapeStyle, stabilizedBase.id, shapeStyleIntensity * 0.03);
        const styledSegments = parsePathToSegments(styledPath);
        const styledBounds = getSegmentsBounds(styledSegments);
        const newElement: ElementItem = { ...stabilizedBase, path: styledPath, segments: styledSegments, size: Math.max(styledBounds.width, styledBounds.height) / 2 || stabilizedBase.size };
        const next = [...elements, newElement];
        commitElements(next);
        setSelectedIds([newElement.id]);
      }
      setIsDrawingBrush(false);
      setBrushPoints([]);
    }
    finishInteractions(elements);
  }, [alignElementMotionToArtboard, brushPoints, commitElements, createElementFromPath, elements, finishInteractions, getArtboardMotionBaseline, isDrawingBrush, shapeStyle, shapeStyleIntensity]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (isEditMode && selectedPointIdx !== null && selectedSingle) {
          e.preventDefault();
          deleteSelectedPoint();
          return;
        }
        if (selectedIds.length > 0) {
          e.preventDefault();
          deleteSelectedElements();
        }
      }
    };
    const onWindowPointerUp = () => handlePointerUp();
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointerup', onWindowPointerUp);
    window.addEventListener('pointercancel', onWindowPointerUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerup', onWindowPointerUp);
      window.removeEventListener('pointercancel', onWindowPointerUp);
    };
  }, [deleteSelectedElements, deleteSelectedPoint, handlePointerUp, isEditMode, selectedIds.length, selectedPointIdx, selectedSingle, undo]);

  const computeLiquidFiltersAtTime = useCallback((sampleTime: number) => {
    if (!liquidSettings.enabled) return [] as LiquidFilterFrame[];
    return elements.map((el) => {
      const profile = el.liquidProfile;
      const animatedTime = sampleTime * liquidSettings.speed;
      const viscosity = liquidSettings.viscosity * profile.viscosityFactor;
      const baseFreqX = 0.008 + (1.1 - viscosity) * 0.01;
      const baseFreqY = 0.012 + (1.1 - viscosity) * 0.015;
      const waveScale = liquidSettings.waveScale * profile.waveFactor;
      const phase = profile.phaseOffset;
      const glossiness = liquidSettings.glossiness * profile.glossFactor;
      const driftX = Math.cos(profile.driftAngle) * profile.driftStrength;
      const driftY = Math.sin(profile.driftAngle) * profile.driftStrength;
      const masterPulse = Math.sin(animatedTime * 0.9);
      const masterWobble = Math.cos(animatedTime * 1.15);
      const masterSqueeze = Math.sin(animatedTime * 1.35);
      const orbitA = animatedTime * 0.21 + phase + profile.directionBias * 0.9;
      const orbitB = animatedTime * -0.17 + phase * 0.63 + driftX * 0.45;
      const orbitC = animatedTime * 0.29 - phase * 0.48 + driftY * 0.52;
      const flowX = Math.cos(orbitA) * (0.52 + profile.swirlMix * 0.16) + Math.sin(orbitB) * (0.33 + profile.wobbleBias * 0.12) + Math.cos(orbitC) * (0.21 + profile.pulseBias * 0.08);
      const flowY = Math.sin(orbitA + 0.8) * (0.5 + profile.swirlMix * 0.14) - Math.cos(orbitB - 0.6) * (0.31 + profile.wobbleBias * 0.11) + Math.sin(orbitC + 1.2) * (0.24 + profile.stretchBias * 0.08);
      const curlX = Math.sin(animatedTime * 0.47 + phase * 1.2) * 0.0009 + Math.cos(animatedTime * 0.31 - phase * 0.7) * 0.0007;
      const curlY = Math.cos(animatedTime * 0.43 + phase * 1.1) * 0.0009 - Math.sin(animatedTime * 0.27 - phase * 0.5) * 0.0007;
      let directionalFreqX = baseFreqX + profile.freqXOffset + flowX * 0.0012 + curlX;
      let directionalFreqY = baseFreqY + profile.freqYOffset + flowY * 0.0012 + curlY;
      let displacementScale = 120 * waveScale * viscosity * profile.amplitudeFactor;

      if (liquidSettings.mode === 'classic') {
        const classicSpeed = liquidSettings.speed * (0.75 + profile.viscosityFactor * 0.25);
        const classicAmplitude = liquidSettings.waveScale * (0.72 + profile.amplitudeFactor * 0.28);
        const phaseA = animatedTime * classicSpeed * 0.92 + phase;
        const phaseB = animatedTime * classicSpeed * 0.68 + phase * 0.85;
        const classicFreqX = baseFreqX + Math.sin(phaseA * 0.5) * 0.002 + profile.freqXOffset * 0.7;
        const classicFreqY = baseFreqY + Math.cos(phaseB * 0.4) * 0.002 + profile.freqYOffset * 0.7;
        directionalFreqX = classicFreqX;
        directionalFreqY = classicFreqY;
        displacementScale = 130 * liquidSettings.viscosity * classicAmplitude * (0.38 + Math.sin(animatedTime * classicSpeed + phase) * 0.62);
      } else if (liquidSettings.mode === 'liquid') {
        const streamX = Math.sin(animatedTime * 0.38 + phase * 0.9) * (0.001 + 0.00035 * Math.abs(driftX)) + flowY * 0.00055;
        const streamY = Math.cos(animatedTime * 0.34 - phase * 0.75) * (0.001 + 0.00035 * Math.abs(driftY)) - flowX * 0.00055;
        directionalFreqX += streamX;
        directionalFreqY += streamY;
        displacementScale *= masterPulse * (0.5 + 0.14 * profile.swirlMix) + masterWobble * (0.2 + 0.1 * profile.wobbleBias) + Math.sin(animatedTime * 0.62 + phase * 1.15) * 0.18 + Math.cos(animatedTime * 0.41 - phase * 0.8) * 0.12;
      } else if (liquidSettings.mode === 'bubble') {
        const buoyancy = -0.0017 * (0.9 + profile.pulseBias * 0.16);
        const bubbleOrbitX = Math.sin(animatedTime * 0.52 + phase) * (0.0008 + 0.00025 * profile.directionBias) + flowX * 0.00042;
        const bubbleOrbitY = Math.cos(animatedTime * 0.46 + phase * 0.85) * 0.00055 + buoyancy + flowY * 0.00028;
        const skinShiver = Math.cos(animatedTime * 1.36 + phase * 1.25) * 0.00035;
        directionalFreqX += bubbleOrbitX + skinShiver;
        directionalFreqY += bubbleOrbitY;
        displacementScale *= masterPulse * (0.62 + 0.12 * profile.pulseBias) + Math.abs(masterWobble) * (0.16 + 0.06 * profile.wobbleBias) + 0.1;
        directionalFreqX *= 0.95;
        directionalFreqY *= 0.92;
      } else {
        const squashOrbitX = flowX * 0.00065 + masterSqueeze * (0.0016 + profile.stretchBias * 0.00045);
        const squashOrbitY = flowY * 0.00052 - masterSqueeze * (0.0011 + profile.wobbleBias * 0.0004);
        directionalFreqX += squashOrbitX + profile.directionBias * 0.0009;
        directionalFreqY += squashOrbitY - profile.directionBias * 0.00065;
        displacementScale *= masterSqueeze * (0.6 + 0.15 * profile.stretchBias) + masterWobble * (0.16 + 0.08 * profile.wobbleBias) + Math.sin(animatedTime * 0.74 + phase * 0.95) * 0.12;
      }

      return { id: el.id, baseFrequency: `${directionalFreqX} ${directionalFreqY}`, displacementScale, glossiness };
    });
  }, [elements, liquidSettings.enabled, liquidSettings.glossiness, liquidSettings.mode, liquidSettings.speed, liquidSettings.viscosity, liquidSettings.waveScale]);

  const buildExportSvgString = useCallback((options?: { transparent?: boolean; sampleTime?: number }) => {
    const transparent = options?.transparent ?? false;
    const sampleTime = options?.sampleTime ?? time;
    const frameFilters = computeLiquidFiltersAtTime(sampleTime);
    const width = Math.max(1, Math.round(artboard.width));
    const height = Math.max(1, Math.round(artboard.height));
    const artboardX = artboardCenter.x - width / 2;
    const artboardY = artboardCenter.y - height / 2;
    const clipId = `export-artboard-clip-${Math.round(sampleTime * 1000)}`;
    const overlapCutouts = contactMode === 'fusion' ? [] : getPotentialOverlapPairs(elements);

    const filterMarkup = frameFilters.map((item) => `
      <filter id="liquid-flow-${item.id}" x="-150%" y="-150%" width="400%" height="400%">
        <feTurbulence type="fractalNoise" baseFrequency="${item.baseFrequency}" numOctaves="2" seed="${item.id % 1000}" result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="${item.displacementScale}" result="displaced" />
        <feGaussianBlur in="displaced" stdDeviation="1" result="blur" />
        <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 60 -28" result="gooey" />
        <feSpecularLighting in="gooey" surfaceScale="15" specularConstant="${2 * item.glossiness}" specularExponent="${60 - 50 * item.glossiness}" lightingColor="#ffffff" result="spec">
          <feDistantLight azimuth="45" elevation="55" />
        </feSpecularLighting>
        <feComposite in="spec" in2="gooey" operator="in" result="specOut" />
        <feBlend in="gooey" in2="specOut" mode="screen" />
      </filter>
    `).join('');

    const fusedElementsMarkup = elements.map((el) => `
      <g transform="translate(${el.x - artboardX}, ${el.y - artboardY}) rotate(${el.rotation}) scale(${el.scale})">
        <path d="${escapeXml(el.path)}" fill="${escapeXml(el.color)}" stroke="none" opacity="0.9" ${liquidSettings.enabled ? `filter="url(#liquid-flow-${el.id})"` : ''} />
      </g>
    `).join('');

    const separatedElementsMarkup = elements.map((el) => `
      <g filter="url(#clean-fusion)">
        <g transform="translate(${el.x - artboardX}, ${el.y - artboardY}) rotate(${el.rotation}) scale(${el.scale})">
          <path d="${escapeXml(el.path)}" fill="${escapeXml(el.color)}" stroke="none" opacity="0.9" ${liquidSettings.enabled ? `filter="url(#liquid-flow-${el.id})"` : ''} />
        </g>
      </g>
    `).join('');

    const overlapClipMarkup = overlapCutouts.map((overlap) => `
      <clipPath id="negative-overlap-${overlap.id}-a" clipPathUnits="userSpaceOnUse">
        <g transform="translate(${overlap.a.x - artboardX}, ${overlap.a.y - artboardY}) rotate(${overlap.a.rotation}) scale(${overlap.a.scale})">
          <path d="${escapeXml(overlap.a.path)}" />
        </g>
      </clipPath>
    `).join('') + overlapCutouts.map((overlap) => `
      <clipPath id="negative-overlap-${overlap.id}-b" clipPathUnits="userSpaceOnUse">
        <g transform="translate(${overlap.b.x - artboardX}, ${overlap.b.y - artboardY}) rotate(${overlap.b.rotation}) scale(${overlap.b.scale})">
          <path d="${escapeXml(overlap.b.path)}" />
        </g>
      </clipPath>
    `).join('');

    const overlayBlurMarkup = overlapCutouts.map((overlap) => `
      <g transform="translate(${overlap.a.x - artboardX}, ${overlap.a.y - artboardY}) rotate(${overlap.a.rotation}) scale(${overlap.a.scale})" clip-path="url(#negative-overlap-${overlap.id}-b)" filter="url(#overlay-back-blur)" opacity="${contactSettings.overlayBlurOpacity}">
        <path d="${escapeXml(overlap.a.path)}" fill="${escapeXml(overlap.a.color)}" />
      </g>
    `).join('');

    const bodyMarkup = contactMode === 'overlay'
      ? `${separatedElementsMarkup}${overlayBlurMarkup}`
      : `<g filter="url(#clean-fusion)">${fusedElementsMarkup}</g>`;

    return `
      <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <defs>
          ${filterMarkup}
          ${overlapClipMarkup}
          ${overlapMaskMarkup}
          <filter id="clean-fusion" filterUnits="userSpaceOnUse" x="-10000" y="-10000" width="20000" height="20000" color-interpolation-filters="sRGB">
            <feTurbulence type="turbulence" baseFrequency="0.04" numOctaves="2" result="tremorNoise" />
            <feDisplacementMap in="SourceGraphic" in2="tremorNoise" scale="${glowSettings.lineJitter}" xChannelSelector="R" yChannelSelector="G" result="jitteredSource" />
            <feMorphology in="jitteredSource" operator="dilate" radius="${glowSettings.individualSuction}" result="expanded" />
            <feGaussianBlur in="expanded" stdDeviation="${glowSettings.contactSuction}" result="blur" />
            <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 35 -15" result="blob" />
            <feMorphology in="blob" operator="erode" radius="${glowSettings.glowDepth / 2.5}" result="eroded_inner" />
            <feComposite in="blob" in2="eroded_inner" operator="out" result="inner_rim" />
            <feGaussianBlur in="inner_rim" stdDeviation="${glowSettings.innerSoftness}" result="raw_grad" />
            <feComponentTransfer in="raw_grad" result="shaded_grad"><feFuncA type="linear" slope="${glowSettings.gradientShade / 100 * 2}" /></feComponentTransfer>
            <feTurbulence type="fractalNoise" baseFrequency="0.95" numOctaves="4" seed="42" result="grain_noise" />
            <feColorMatrix in="grain_noise" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -1 1" result="grain_mask" />
            <feComponentTransfer in="grain_mask" result="adj_grain"><feFuncA type="linear" slope="${glowSettings.grain * 25}" intercept="${1 - glowSettings.grain * 12.5}" /></feComponentTransfer>
            <feComposite in="shaded_grad" in2="adj_grain" operator="in" result="textured_grad" />
            <feMorphology in="blob" operator="erode" radius="${glowSettings.edgeThickness}" result="eroded_border" />
            <feComposite in="blob" in2="eroded_border" operator="out" result="sharp_border" />
            <feMerge result="combined"><feMergeNode in="textured_grad" /><feMergeNode in="sharp_border" /></feMerge>
            <feComposite in="combined" in2="blob" operator="in" result="final" />
            <feColorMatrix in="final" type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 ${glowSettings.intensity} 0" />
          </filter>
          <filter id="overlay-back-blur" x="-200%" y="-200%" width="500%" height="500%">
            <feGaussianBlur stdDeviation="${contactSettings.overlayBlur}" />
          </filter>
          <clipPath id="${clipId}"><rect x="0" y="0" width="${width}" height="${height}" /></clipPath>
        </defs>
        ${transparent ? '' : '<rect x="0" y="0" width="100%" height="100%" fill="#fcfcfb" />'}
        <g ${artboard.clipContent ? `clip-path="url(#${clipId})"` : ''}>
          ${bodyMarkup}
        </g>
      </svg>
    `.trim();
  }, [artboard.clipContent, artboard.height, artboard.width, artboardCenter.x, artboardCenter.y, computeLiquidFiltersAtTime, contactMode, contactSettings, elements, glowSettings.contactSuction, glowSettings.edgeThickness, glowSettings.glowDepth, glowSettings.gradientShade, glowSettings.grain, glowSettings.individualSuction, glowSettings.innerSoftness, glowSettings.intensity, glowSettings.lineJitter, liquidSettings.enabled, time]);

  const renderExportCanvas = useCallback((options?: { transparent?: boolean; sampleTime?: number; scale?: number }) => new Promise<HTMLCanvasElement>((resolve, reject) => {
    if (contactMode === 'negative') {
      const width = Math.max(1, Math.round(artboard.width));
      const height = Math.max(1, Math.round(artboard.height));
      const scale = Math.max(1, options?.scale ?? 1);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.floor(width * scale));
      canvas.height = Math.max(1, Math.floor(height * scale));
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        reject(new Error('无法创建画布上下文'));
        return;
      }

      drawNegativeContactScene({
        ctx,
        width: canvas.width,
        height: canvas.height,
        elements,
        overlapCutouts: getPotentialOverlapPairs(elements),
        grain: contactSettings.negativeGrain,
        sampleTime: options?.sampleTime ?? time,
        liquidSettings,
        contactSettings,
        getMatrix: (el) => new DOMMatrix()
          .translateSelf((el.x - artboardRect.x) * scale, (el.y - artboardRect.y) * scale)
          .rotateSelf(el.rotation)
          .scaleSelf(el.scale * scale),
        backgroundFill: options?.transparent ? null : '#fcfcfb',
      });

      resolve(canvas);
      return;
    }

    const svgData = buildExportSvgString({ transparent: options?.transparent, sampleTime: options?.sampleTime });
    if (!svgData) {
      reject(new Error('无法生成导出 SVG'));
      return;
    }

    const width = Math.max(1, Math.round(artboard.width));
    const height = Math.max(1, Math.round(artboard.height));
    const scale = Math.max(1, options?.scale ?? 1);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.floor(width * scale));
    canvas.height = Math.max(1, Math.floor(height * scale));

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      reject(new Error('无法创建画布上下文'));
      return;
    }

    const img = new Image();
    const url = URL.createObjectURL(new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' }));
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('导出画面渲染失败'));
    };
    img.src = url;
  }), [artboard.height, artboard.width, artboardRect.x, artboardRect.y, buildExportSvgString, contactMode, contactSettings, elements, liquidSettings, time]);

  const downloadPNG = useCallback(async () => {
    try {
      const canvas = await renderExportCanvas({ scale: pngExportScale });
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = `高清导出-${pngOutputWidth}x${pngOutputHeight}-${Date.now()}.png`;
      link.click();
    } catch {
      showMsg('PNG 导出失败');
    }
  }, [pngExportScale, pngOutputHeight, pngOutputWidth, renderExportCanvas, showMsg]);

  const buildIllustratorSvgString = useCallback(() => {
    const width = Math.max(1, Math.round(artboard.width));
    const height = Math.max(1, Math.round(artboard.height));
    const artboardX = artboardCenter.x - width / 2;
    const clipId = 'illustrator-artboard-clip';
    const artboardY = artboardCenter.y - height / 2;
    const defsMarkup = elements.map((el) => {
      const baseLight = mixHex(el.color, '#ffffff', 0.34);
      const innerLight = mixHex(el.color, '#ffffff', 0.58);
      const edgeDark = mixHex(el.color, '#0f172a', 0.18);
      const shadowDark = mixHex(el.color, '#020617', 0.38);
      return `
        <radialGradient id="ai-base-${el.id}" cx="34%" cy="28%" r="84%">
          <stop offset="0%" stop-color="${innerLight}" />
          <stop offset="42%" stop-color="${baseLight}" />
          <stop offset="100%" stop-color="${edgeDark}" />
        </radialGradient>
        <radialGradient id="ai-core-${el.id}" cx="36%" cy="30%" r="72%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.68" />
          <stop offset="48%" stop-color="${baseLight}" stop-opacity="0.18" />
          <stop offset="100%" stop-color="${baseLight}" stop-opacity="0" />
        </radialGradient>
        <linearGradient id="ai-highlight-${el.id}" x1="16%" y1="12%" x2="78%" y2="88%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.88" />
          <stop offset="42%" stop-color="#ffffff" stop-opacity="0.18" />
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
        </linearGradient>
        <linearGradient id="ai-shadow-${el.id}" x1="24%" y1="18%" x2="88%" y2="94%">
          <stop offset="0%" stop-color="${shadowDark}" stop-opacity="0" />
          <stop offset="62%" stop-color="${shadowDark}" stop-opacity="0.12" />
          <stop offset="100%" stop-color="${shadowDark}" stop-opacity="0.4" />
        </linearGradient>
      `;
    }).join('');

    const elementsMarkup = elements.map((el) => {
      const localBounds = getElementLocalBounds(el);
      const strokeWidth = Math.max(0.8, Math.min(6, Math.max(localBounds.width, localBounds.height) * 0.028));
      const glossOpacity = 0.12 + liquidSettings.glossiness * 0.35;
      const shadowShift = Math.max(4, el.size * 0.08);
      const highlightShift = Math.max(3, el.size * 0.06);

      return `
        <g transform="translate(${el.x - artboardX}, ${el.y - artboardY}) rotate(${el.rotation}) scale(${el.scale})">
          <path d="${escapeXml(el.path)}" fill="${mixHex(el.color, '#0f172a', 0.08)}" opacity="0.16" transform="translate(0 ${shadowShift * 0.18}) scale(1.04)" />
          <path d="${escapeXml(el.path)}" fill="url(#ai-base-${el.id})" stroke="${mixHex(el.color, '#ffffff', 0.08)}" stroke-width="${strokeWidth}" stroke-linejoin="round" stroke-opacity="0.22" />
          <path d="${escapeXml(el.path)}" fill="url(#ai-shadow-${el.id})" opacity="0.92" />
          <path d="${escapeXml(el.path)}" fill="url(#ai-core-${el.id})" opacity="0.72" transform="translate(${-highlightShift * 0.08} ${-highlightShift * 0.12}) scale(0.96)" />
          <path d="${escapeXml(el.path)}" fill="url(#ai-highlight-${el.id})" opacity="${glossOpacity}" transform="translate(${-highlightShift * 0.16} ${-highlightShift * 0.22}) scale(0.82)" />
          <path d="${escapeXml(el.path)}" fill="none" stroke="${mixHex(el.color, '#020617', 0.26)}" stroke-width="${Math.max(0.4, strokeWidth * 0.42)}" stroke-linejoin="round" stroke-opacity="0.12" />
        </g>
      `;
    }).join('');

    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <defs>
          ${defsMarkup}
          <clipPath id="${clipId}">
            <rect x="0" y="0" width="${width}" height="${height}" />
          </clipPath>
        </defs>
        <rect x="0" y="0" width="${width}" height="${height}" fill="#fcfcfb" />
        <g ${artboard.clipContent ? `clip-path="url(#${clipId})"` : ''}>
          ${elementsMarkup}
        </g>
      </svg>
    `.trim();
  }, [artboard.clipContent, artboard.height, artboard.width, artboardCenter.x, artboardCenter.y, elements, liquidSettings.glossiness]);

  const downloadVisualSvg = useCallback(async () => {
    try {
      const width = Math.max(1, Math.round(artboard.width));
      const height = Math.max(1, Math.round(artboard.height));
      const canvas = await renderExportCanvas({ scale: 2 });
      const pngDataUrl = canvas.toDataURL('image/png');
      const svgData = `
        <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
          <rect x="0" y="0" width="${width}" height="${height}" fill="#fcfcfb" />
          <image
            x="0"
            y="0"
            width="${width}"
            height="${height}"
            href="${pngDataUrl}"
            xlink:href="${pngDataUrl}"
            preserveAspectRatio="none"
          />
        </svg>
      `.trim();
      const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `视觉保真导出-${Date.now()}.svg`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 0);
    } catch {
      showMsg('SVG 导出失败');
    }
  }, [artboard.height, artboard.width, renderExportCanvas, showMsg]);

  const downloadIllustratorSvg = useCallback(() => {
    try {
      const svgData = buildIllustratorSvgString();
      const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `Illustrator兼容导出-${Date.now()}.svg`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 0);
      showMsg('已导出 Illustrator 兼容 SVG');
    } catch {
      showMsg('Illustrator 兼容 SVG 导出失败');
    }
  }, [buildIllustratorSvgString, showMsg]);

  const downloadTransparentGif = useCallback(async () => {
    if (isExportingGif) return;
    if (!liquidSettings.enabled) {
      showMsg('请先开启液体动画，再导出 GIF');
      return;
    }
    const exportWidth = gifOutputWidth;
    const exportHeight = gifOutputHeight;
    const frameCount = gifFrameCount;
    const durationMs = 1400;
    const delay = Math.max(40, Math.round(durationMs / frameCount));
    const gifBackground = '#fcfcfb';
    const exportStartTime = time;
    const yieldToBrowser = () => new Promise<void>((resolve) => window.setTimeout(resolve, 0));

    try {
      setIsExportingGif(true);
      showMsg('正在导出 GIF...');

      const gif = new GIF({
        workers: 2,
        quality: 1,
        dither: 'FloydSteinberg-serpentine',
        workerScript: gifWorkerUrl,
        repeat: 0,
        background: gifBackground,
        width: exportWidth,
        height: exportHeight,
      });

      const renderFrame = async (sampleTime: number) => {
        return renderExportCanvas({ transparent: false, sampleTime, scale: gifExportScale });
      };

      for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
        const sampleTime = exportStartTime + frameIndex * (durationMs / frameCount) / 1000;
        const frameCanvas = await renderFrame(sampleTime);
        gif.addFrame(frameCanvas, { copy: true, delay });
        if (frameIndex < frameCount - 1) {
          showMsg(`正在导出 GIF... ${frameIndex + 1}/${frameCount}`);
          await yieldToBrowser();
        }
      }

      const blob = await new Promise<Blob>((resolve, reject) => {
        gif.on('finished', (output: Blob) => resolve(output));
        gif.on('abort', () => reject(new Error('GIF 导出已中止')));
        gif.render();
      });

      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `动态导出-${exportWidth}x${exportHeight}-${Date.now()}.gif`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 0);
      showMsg('GIF 导出完成');
    } catch {
      showMsg('GIF 导出失败');
    } finally {
      setIsExportingGif(false);
    }
  }, [gifExportScale, gifFrameCount, gifOutputHeight, gifOutputWidth, isExportingGif, liquidSettings.enabled, renderExportCanvas, showMsg, time]);

  const handlePointerDown = useCallback((e: React.PointerEvent, id: number | null, mode: 'drag' | 'rotate' | 'scale' | 'groupScale' | 'groupRotate' | 'point' = 'drag', extra: Partial<ActivePointState> & { elId?: number; segIndex?: number; prop?: 'main' | 'in' | 'out'; scaleHandle?: ScaleHandle } = {}) => {
    if (!canvasRef.current) return;
    if (e.button === 2) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }

    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);

    const rect = canvasRef.current.getBoundingClientRect();
    const point = getClientCanvasPoint(e, rect, viewOffset, zoom);

    if (isBrushMode) {
      setIsDrawingBrush(true);
      setBrushPoints([point]);
      return;
    }

    if (mode === 'point' && extra.elId !== undefined && extra.segIndex !== undefined && extra.prop) {
      const el = elementsById.get(extra.elId);
      if (!el) return;
      const targetSeg = el.segments[extra.segIndex];
      const nextSeg = el.segments[extra.segIndex + 1];
      if (!targetSeg || targetSeg.type === 'Z') return;
      setActivePoint({
        elId: extra.elId,
        segIndex: extra.segIndex,
        prop: extra.prop,
        screenStartX: e.clientX,
        screenStartY: e.clientY,
        initialRotation: el.rotation,
        initialScale: el.scale,
        initialZoom: zoom,
        origPointX: targetSeg.x,
        origPointY: targetSeg.y,
        origX1: 'x1' in targetSeg ? targetSeg.x1 : undefined,
        origY1: 'y1' in targetSeg ? targetSeg.y1 : undefined,
        origX2: 'x2' in targetSeg ? targetSeg.x2 : undefined,
        origY2: 'y2' in targetSeg ? targetSeg.y2 : undefined,
        origOutX: 'outX' in targetSeg ? targetSeg.outX : undefined,
        origOutY: 'outY' in targetSeg ? targetSeg.outY : undefined,
        origNextX1: nextSeg && nextSeg.type === 'C' ? nextSeg.x1 : undefined,
        origNextY1: nextSeg && nextSeg.type === 'C' ? nextSeg.y1 : undefined,
      });
      if (extra.prop === 'main') setSelectedPointIdx(extra.segIndex);
      return;
    }

    if (id === null && mode !== 'groupScale' && mode !== 'groupRotate') {
      if (!isPointInsideArtboard(point)) return;
      setSelectedIds([]);
      setSelectedPointIdx(null);
      if (!isEditMode) setMarquee({ startX: point.x, startY: point.y, currentX: point.x, currentY: point.y });
      return;
    }

    if (mode === 'groupScale' || mode === 'groupRotate') {
      if (!selectedElements.length) return;
      const center = {
        x: selectedElements.reduce((sum, el) => sum + el.x, 0) / selectedElements.length,
        y: selectedElements.reduce((sum, el) => sum + el.y, 0) / selectedElements.length,
      };
      setGroupCenter(center);
      setInitialStates(selectedElements.map((el) => ({ ...el })));
      if (mode === 'groupScale') {
        setScalingGroup(true);
        setInitialDist(Math.max(0.0001, Math.hypot(point.x - center.x, point.y - center.y)));
      } else {
        setRotatingGroup(true);
        setRotationSnap({ initialRotation: 0, startAngle: Math.atan2(point.y - center.y, point.x - center.x) });
      }
      return;
    }

    const el = id === null ? null : elementsById.get(id);
    if (!el || id === null) return;
    const nextSelectedIds = selectedIdSet.has(id) ? selectedIds : [id];
    if (!selectedIdSet.has(id)) {
      setSelectedIds([id]);
      setActiveColor(el.color);
    }

    if (!isPointInsideArtboard(point)) return;

    if (mode === 'drag') {
      setDraggingId(id);
      dragPointerStartRef.current = point;
      dragSelectedIdsRef.current = [...nextSelectedIds];
      const source = elements.filter((item) => nextSelectedIds.includes(item.id));
      const positions: Record<number, Point> = {};
      source.forEach((item) => { positions[item.id] = { x: item.x, y: item.y }; });
      dragStartPositionsRef.current = positions;
    } else if (mode === 'rotate') {
      setRotatingId(id);
      setRotationSnap({ initialRotation: el.rotation, startAngle: Math.atan2(point.y - el.y, point.x - el.x) });
    } else if (mode === 'scale') {
      setScalingId(id);
      setInitialScale(el.scale);
      scaleHandleRef.current = extra.scaleHandle || 'corner';
      if (extra.scaleHandle === 'top' || extra.scaleHandle === 'bottom') {
        setInitialDist(Math.max(0.0001, Math.abs(point.y - el.y)));
      } else if (extra.scaleHandle === 'left' || extra.scaleHandle === 'right') {
        setInitialDist(Math.max(0.0001, Math.abs(point.x - el.x)));
      } else {
        setInitialDist(Math.max(0.0001, Math.hypot(point.x - el.x, point.y - el.y)));
      }
    }
  }, [elements, elementsById, isBrushMode, isEditMode, isPointInsideArtboard, selectedElements, selectedIds, selectedIdSet, viewOffset, zoom]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const point = getClientCanvasPoint(e, rect, viewOffset, zoom);

    if (isPanning) {
      setViewOffset((prev) => ({ x: prev.x + (e.clientX - panStart.x), y: prev.y + (e.clientY - panStart.y) }));
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }

    if (isBrushMode && isDrawingBrush) {
      if (!isPointInsideArtboard(point)) return;
      setBrushPoints((prev) => {
        const lastPoint = prev[prev.length - 1];
        if (lastPoint && distanceBetweenPoints(lastPoint, point) < 5 / zoom) return prev;
        return [...prev, point];
      });
      return;
    }

    if (activePoint) {
      const {
        elId,
        segIndex,
        prop,
        screenStartX,
        screenStartY,
        initialRotation,
        initialScale,
        initialZoom,
        origPointX,
        origPointY,
        origX1,
        origY1,
        origX2,
        origY2,
        origOutX,
        origOutY,
        origNextX1,
        origNextY1,
      } = activePoint;
      const screenDx = (e.clientX - screenStartX) / initialZoom;
      const screenDy = (e.clientY - screenStartY) / initialZoom;
      const rad = -initialRotation * (Math.PI / 180);
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const localDx = (screenDx * cos - screenDy * sin) / initialScale;
      const localDy = (screenDx * sin + screenDy * cos) / initialScale;

      applyInteractiveElements((prev) => prev.map((el) => {
        if (el.id !== elId) return el;
        const nextSegs = [...el.segments];
        const current = nextSegs[segIndex];
        if (!current || current.type === 'Z') return el;
        const seg = { ...current } as CurveSeg | MoveSeg;
        const nextSeg = nextSegs[segIndex + 1];

        if (prop === 'main') {
          seg.x = (origPointX ?? seg.x) + localDx;
          seg.y = (origPointY ?? seg.y) + localDy;
          if ('x1' in seg) { seg.x1 = (origX1 ?? seg.x1) + localDx; seg.y1 = (origY1 ?? seg.y1) + localDy; }
          if ('x2' in seg) { seg.x2 = (origX2 ?? seg.x2) + localDx; seg.y2 = (origY2 ?? seg.y2) + localDy; }
          if ('outX' in seg && typeof seg.outX === 'number' && typeof seg.outY === 'number') {
            seg.outX = (origOutX ?? seg.outX) + localDx;
            seg.outY = (origOutY ?? seg.outY) + localDy;
          }
          if (nextSeg && nextSeg.type === 'C' && origNextX1 !== undefined && origNextY1 !== undefined) {
            nextSegs[segIndex + 1] = { ...nextSeg, x1: origNextX1 + localDx, y1: origNextY1 + localDy };
          }
        } else if (prop === 'in' && 'x2' in seg) {
          seg.x2 = (origX2 ?? seg.x2) + localDx;
          seg.y2 = (origY2 ?? seg.y2) + localDy;
          if ('outX' in seg && typeof seg.outX === 'number' && typeof seg.outY === 'number') {
            const hdx = seg.x2 - seg.x;
            const hdy = seg.y2 - seg.y;
            seg.outX = seg.x - hdx;
            seg.outY = seg.y - hdy;
            if (nextSeg && nextSeg.type === 'C') nextSegs[segIndex + 1] = { ...nextSeg, x1: seg.outX, y1: seg.outY };
          }
        } else if (prop === 'out' && 'outX' in seg) {
          seg.outX = (origOutX ?? seg.outX ?? seg.x) + localDx;
          seg.outY = (origOutY ?? seg.outY ?? seg.y) + localDy;
          if (nextSeg && nextSeg.type === 'C') nextSegs[segIndex + 1] = { ...nextSeg, x1: seg.outX, y1: seg.outY };
          if ('x2' in seg) {
            const hdx = seg.outX - seg.x;
            const hdy = seg.outY - seg.y;
            seg.x2 = seg.x - hdx;
            seg.y2 = seg.y - hdy;
          }
        }

        nextSegs[segIndex] = seg as Segment;
        return { ...el, segments: nextSegs, path: segmentsToPath(nextSegs) };
      }));
      return;
    }

    if (marquee) {
      setMarquee((prev) => prev ? { ...prev, currentX: point.x, currentY: point.y } : prev);
      return;
    }

    if (scalingGroup) {
      const ratio = Math.max(0.05, Math.hypot(point.x - groupCenter.x, point.y - groupCenter.y) / initialDist);
      applyInteractiveElements((prev) => prev.map((el) => {
        const init = initialStates.find((item) => item.id === el.id);
        if (!init) return el;
        return { ...el, scale: init.scale * ratio, x: groupCenter.x + (init.x - groupCenter.x) * ratio, y: groupCenter.y + (init.y - groupCenter.y) * ratio };
      }));
      return;
    }

    if (rotatingGroup) {
      const currentAngle = Math.atan2(point.y - groupCenter.y, point.x - groupCenter.x);
      const deltaAngleDeg = (currentAngle - rotationSnap.startAngle) * (180 / Math.PI);
      const deltaAngleRad = currentAngle - rotationSnap.startAngle;
      applyInteractiveElements((prev) => prev.map((el) => {
        const init = initialStates.find((item) => item.id === el.id);
        if (!init) return el;
        const dx = init.x - groupCenter.x;
        const dy = init.y - groupCenter.y;
        const cos = Math.cos(deltaAngleRad);
        const sin = Math.sin(deltaAngleRad);
        return { ...el, x: groupCenter.x + dx * cos - dy * sin, y: groupCenter.y + dx * sin + dy * cos, rotation: init.rotation + deltaAngleDeg };
      }));
      return;
    }

    if (draggingId !== null) {
      const dx = point.x - dragPointerStartRef.current.x;
      const dy = point.y - dragPointerStartRef.current.y;
      const dragSelectedIds = dragSelectedIdsRef.current;
      applyInteractiveElements((prev) => prev.map((el) => {
        if (!dragSelectedIds.includes(el.id)) return el;
        const start = dragStartPositionsRef.current[el.id];
        if (!start) return el;
        return { ...el, x: start.x + dx, y: start.y + dy };
      }));
      return;
    }

    if (rotatingId !== null) {
      const el = elementsById.get(rotatingId);
      if (!el) return;
      const currentAngle = Math.atan2(point.y - el.y, point.x - el.x);
      const deltaAngle = (currentAngle - rotationSnap.startAngle) * (180 / Math.PI);
      applyInteractiveElements((prev) => prev.map((item) => item.id === rotatingId ? { ...item, rotation: rotationSnap.initialRotation + deltaAngle } : item));
      return;
    }

    if (scalingId !== null) {
      const el = elementsById.get(scalingId);
      if (!el) return;
      let ratio = 1;
      if (scaleHandleRef.current === 'top' || scaleHandleRef.current === 'bottom') {
        ratio = Math.max(0.05, Math.abs(point.y - el.y) / initialDist);
      } else if (scaleHandleRef.current === 'left' || scaleHandleRef.current === 'right') {
        ratio = Math.max(0.05, Math.abs(point.x - el.x) / initialDist);
      } else {
        ratio = Math.max(0.05, Math.hypot(point.x - el.x, point.y - el.y) / initialDist);
      }
      applyInteractiveElements((prev) => prev.map((item) => item.id === scalingId ? { ...item, scale: initialScale * ratio } : item));
    }
  }, [activePoint, applyInteractiveElements, elementsById, draggingId, groupCenter.x, groupCenter.y, initialDist, initialScale, initialStates, isBrushMode, isDrawingBrush, isPanning, isPointInsideArtboard, marquee, panStart.x, panStart.y, rotatingGroup, rotatingId, rotationSnap.initialRotation, rotationSnap.startAngle, scalingGroup, scalingId, viewOffset, zoom]);

  const liquidFilters = useMemo(() => computeLiquidFiltersAtTime(time), [computeLiquidFiltersAtTime, time]);

  return (
    <div className="flex h-screen bg-[#F8F9FA] font-sans text-slate-700 overflow-hidden select-none antialiased">
      {message && <div className="absolute top-24 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-2xl text-xs font-bold shadow-2xl z-[60] pointer-events-none">{message}</div>}

      <Sidebar
        activeColor={activeColor}
        palette={palette}
        selectedIds={selectedIds}
        selectedIdSet={selectedIdSet}
        elements={elements}
        contactMode={contactMode}
        setContactMode={setContactMode}
        contactSettings={contactSettings}
        setContactSettings={setContactSettings}
        glowSettings={glowSettings}
        setGlowSettings={setGlowSettings}
        liquidSettings={liquidSettings}
        setLiquidSettings={setLiquidSettings}
        rerandomizeLiquidProfiles={rerandomizeLiquidProfiles}
        artboard={artboard}
        setArtboard={setArtboard}
        fitViewToArtboard={fitViewToArtboard}
        shapeStyle={shapeStyle}
        shapeStyleIntensity={shapeStyleIntensity}
        setShapeStyleIntensity={setShapeStyleIntensity}
        applyShapeStyleToArtboard={applyShapeStyleToArtboard}
        setActiveColor={setActiveColor}
        commitElements={commitElements}
        addElement={addElement}
        sectionOpen={sectionOpen}
        toggleSection={toggleSection}
        collapsedSidebar={collapsedSidebar}
        setCollapsedSidebar={setCollapsedSidebar}
      />

      <main className="flex-1 flex flex-col relative overflow-hidden">
        <Toolbar
          historyIndex={historyIndex}
          fillCanvas={fillCanvas}
          fileInputRef={fileInputRef}
          handleFileUpload={handleFileUpload}
          isBrushMode={isBrushMode}
          setIsBrushMode={setIsBrushMode}
          isEditMode={isEditMode}
          setIsEditMode={setIsEditMode}
          setBrushPoints={setBrushPoints}
          setIsDrawingBrush={setIsDrawingBrush}
          selectedIds={selectedIds}
          moveSelectedBackward={moveSelectedBackward}
          moveSelectedForward={moveSelectedForward}
          deleteSelectedElements={deleteSelectedElements}
          downloadPNG={downloadPNG}
          downloadTransparentGif={downloadTransparentGif}
          isExportingGif={isExportingGif}
          pngExportScale={pngExportScale}
          setPngExportScale={setPngExportScale}
          pngOutputWidth={pngOutputWidth}
          pngOutputHeight={pngOutputHeight}
          gifExportScale={gifExportScale}
          setGifExportScale={setGifExportScale}
          gifFrameCount={gifFrameCount}
          setGifFrameCount={setGifFrameCount}
          gifOutputWidth={gifOutputWidth}
          gifOutputHeight={gifOutputHeight}
          undo={undo}
          setSelectedIds={setSelectedIds}
        />

        <Stage
          canvasRef={canvasRef}
          isDraggingOver={isDraggingOver}
          setIsDraggingOver={setIsDraggingOver}
          onDrop={onDrop}
          handlePointerDown={handlePointerDown}
          handlePointerMove={handlePointerMove}
          handlePointerUp={handlePointerUp}
          handleWheel={handleWheel}
          isPanning={isPanning}
          isBrushMode={isBrushMode}
          isEditMode={isEditMode}
          marquee={marquee}
          scalingGroup={scalingGroup}
          viewOffset={viewOffset}
          zoom={zoom}
          liquidFilters={liquidFilters}
          contactMode={contactMode}
          contactSettings={contactSettings}
          glowSettings={glowSettings}
          artboard={artboard}
          artboardRect={artboardRect}
          elements={elements}
          selectedIdSet={selectedIdSet}
          liquidSettings={liquidSettings}
          brushPoints={brushPoints}
          isDrawingBrush={isDrawingBrush}
          activeColor={activeColor}
          time={time}
          selectedSingle={selectedSingle}
          selectedPointIdx={selectedPointIdx}
          groupBounds={groupBounds}
          fitViewToArtboard={fitViewToArtboard}
        />
      </main>
    </div>
  );
}
