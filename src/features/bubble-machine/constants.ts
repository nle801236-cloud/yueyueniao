import type {
  ArtboardSettings,
  ContactMode,
  ContactSettings,
  GlowSettings,
  ImportAmplitudeMode,
  LiquidSettings,
  MotionMode,
  PresetItem,
  ShapeStyle,
} from './types';

export const PRESET_DATA: PresetItem[] = [
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

export const INITIAL_COLORS = [
  { name: '暖白', value: '#fffdf6' },
  { name: '正红', value: '#ed0000' },
  { name: '亮青', value: '#00d5ff' },
  { name: '亮黄', value: '#ffe52e' },
];

export const DEFAULT_GLOW_SETTINGS: GlowSettings = {
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

export const DEFAULT_CONTACT_SETTINGS: ContactSettings = {
  negativeRoundness: 0.35,
  negativeGrain: 0.08,
  overlayBlur: 7,
  overlayBlurOpacity: 0.42,
};

export const DEFAULT_LIQUID_SETTINGS: LiquidSettings = {
  enabled: false,
  speed: 0.5,
  viscosity: 0.4,
  glossiness: 0,
  waveScale: 0.5,
  mode: 'liquid',
  importAmplitudeMode: 'natural',
};

export const DEFAULT_ARTBOARD_SETTINGS: ArtboardSettings = {
  width: 794,
  height: 1123,
  clipContent: true,
  backgroundColor: '#ffffff',
};

export const MOTION_MODE_CONFIG: Record<MotionMode, { label: string; hint: string }> = {
  classic: { label: '经典', hint: '回到更简洁的旧版液体节奏，连续、顺滑，像材质在自然呼吸。' },
  liquid: { label: '液体', hint: '更像流场推进的连续流动，方向会自然游走' },
  bubble: { label: '气泡', hint: '更轻盈、更上浮，带有鼓胀呼吸和柔软弹性感' },
  squash: { label: '挤压', hint: '统一节奏下更明显的拉伸与受压回弹' },
};

export const CONTACT_MODE_CONFIG: Record<ContactMode, { label: string; hint: string }> = {
  fusion: { label: '融合', hint: '接触时会自然吸附并连成一体，像胶质或液体相互牵连。' },
  overlay: { label: '叠加', hint: '保留上下层叠压关系，后层在交叠处会出现更像真实泡泡的模糊透视。' },
  negative: { label: '负形', hint: '切换为纯填充块面，两个图形交叠的区域会直接变成空白负形。' },
};

export const IMPORT_AMPLITUDE_MODE_CONFIG: Record<ImportAmplitudeMode, { label: string; hint: string }> = {
  natural: { label: '自然接近', hint: '导入素材会向画板现有动态靠拢，但保留一部分自身动态特征。' },
  strict: { label: '严格统一', hint: '导入素材会尽量贴合画板当前动态幅度，整体观感更一致。' },
};

export const SHAPE_STYLE_CONFIG: Record<ShapeStyle, { label: string; smoothness: number; jitter: number; cornerBias: number }> = {
  smooth: { label: '液体', smoothness: 0.34, jitter: 0.04, cornerBias: 0.08 },
  organic: { label: '有机', smoothness: 0.2, jitter: 0.12, cornerBias: 0.2 },
  polygon: { label: '硬边', smoothness: 0.08, jitter: 0.16, cornerBias: 0.32 },
};

export const DEFAULT_TEXT_FONT_FAMILY = "-apple-system,BlinkMacSystemFont,'SF Pro Display','PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif";
export const DEFAULT_TEXT_COLOR = '#111827';
export const TEXT_FONT_OPTIONS = [
  { label: '系统无衬线', value: "-apple-system,BlinkMacSystemFont,'SF Pro Display','PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif" },
  { label: '思源黑体', value: "'Source Han Sans SC','Noto Sans CJK SC','PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif" },
  { label: '思源宋体', value: "'Source Han Serif SC','Noto Serif CJK SC','Songti SC','STSong','SimSun',serif" },
  { label: '系统衬线', value: "'Songti SC','STSong','Times New Roman',serif" },
];
