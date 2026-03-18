import type {
  ChangeEvent,
  ComponentType,
  Dispatch,
  DragEvent,
  PointerEvent,
  ReactNode,
  RefObject,
  SetStateAction,
  WheelEvent,
} from 'react';

export type Point = { x: number; y: number };
export type Bounds = { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number; centerX: number; centerY: number };
export type MoveSeg = { type: 'M'; x: number; y: number };
export type CurveSeg = {
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
export type CloseSeg = { type: 'Z' };
export type Segment = MoveSeg | CurveSeg | CloseSeg;

export type MotionMode = 'classic' | 'liquid' | 'bubble' | 'squash';
export type ContactMode = 'fusion' | 'overlay' | 'negative';
export type ShapeStyle = 'smooth' | 'organic' | 'polygon';
export type SectionKey = 'quick' | 'physics' | 'color' | 'motion' | 'style' | 'artboard' | 'library';

export type LiquidProfile = {
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

export type ElementItem = {
  id: number;
  name: string;
  path: string;
  basePath: string;
  segments: Segment[];
  x: number;
  y: number;
  rotation: number;
  scale: number;
  layerOrder: number;
  color: string;
  size: number;
  liquidProfile: LiquidProfile;
};

export type TextItem = {
  id: number;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  scale: number;
  rotation: number;
  layerOrder: number;
  color: string;
  fontFamily: string;
  fontWeight: number;
  morphAmount: number;
  roundnessAmount: number;
  adhesionAmount: number;
  grainAmount: number;
};

export type ReferenceImageItem = {
  id: number;
  name: string;
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
  layerOrder: number;
  opacity: number;
  locked: boolean;
};

export type HistorySnapshot = {
  elements: ElementItem[];
  textItems: TextItem[];
  referenceImages: ReferenceImageItem[];
};

export type ClipboardSnapshot = {
  elements: ElementItem[];
  textItems: TextItem[];
};

export type GlowSettings = {
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

export type ContactSettings = {
  negativeRoundness: number;
  negativeGrain: number;
  overlayBlur: number;
  overlayBlurOpacity: number;
};

export type ImportAmplitudeMode = 'natural' | 'strict';

export type LiquidSettings = {
  enabled: boolean;
  speed: number;
  viscosity: number;
  glossiness: number;
  waveScale: number;
  mode: MotionMode;
  importAmplitudeMode: ImportAmplitudeMode;
};

export type ArtboardSettings = {
  width: number;
  height: number;
  clipContent: boolean;
  backgroundColor: string;
};

export type ActivePointState = {
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

export type MarqueeState = {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
};

export type PresetItem = {
  name: string;
  path: string;
};

export type LiquidFilterFrame = { id: number; baseFrequency: string; displacementScale: number; glossiness: number };
export type ScaleHandle = 'corner' | 'top' | 'right' | 'bottom' | 'left';
export type ContactSeam = { path: string; shadowOpacity: number };
export type ContactOverlap = { id: string; a: ElementItem; b: ElementItem };
export type DraftDocument = { id: string; name: string; createdAt: string };

export type SidebarProps = {
  activeColor: string;
  palette: { name: string; value: string }[];
  selectedIds: number[];
  selectedIdSet: Set<number>;
  elements: ElementItem[];
  contactMode: ContactMode;
  setContactMode: Dispatch<SetStateAction<ContactMode>>;
  contactSettings: ContactSettings;
  setContactSettings: Dispatch<SetStateAction<ContactSettings>>;
  glowSettings: GlowSettings;
  setGlowSettings: Dispatch<SetStateAction<GlowSettings>>;
  liquidSettings: LiquidSettings;
  setLiquidSettings: Dispatch<SetStateAction<LiquidSettings>>;
  rerandomizeLiquidProfiles: () => void;
  artboard: ArtboardSettings;
  setArtboard: Dispatch<SetStateAction<ArtboardSettings>>;
  fitViewToArtboard: () => void;
  shapeStyle: ShapeStyle;
  shapeStyleIntensity: number;
  setShapeStyleIntensity: Dispatch<SetStateAction<number>>;
  applyShapeStyleToArtboard: (style: ShapeStyle, options?: { silent?: boolean }) => void;
  setActiveColor: Dispatch<SetStateAction<string>>;
  commitElements: (next: ElementItem[], options?: { saveHistory?: boolean }) => void;
  addElement: (pathData: string, name?: string, options?: { alignAmplitudeToArtboard?: boolean; preserveImportedShape?: boolean }) => void;
  sectionOpen: Record<SectionKey, boolean>;
  toggleSection: (key: SectionKey) => void;
  collapsedSidebar: boolean;
  setCollapsedSidebar: Dispatch<SetStateAction<boolean>>;
  fillCanvas: () => void;
  createNewPage: () => void;
  saveDraftAndCreateNewPage: () => void;
  drafts: DraftDocument[];
  openDraft: (draftId: string) => void;
  deleteDraft: (draftId: string) => void;
  referenceImages: ReferenceImageItem[];
  selectedTextId: number | null;
  selectedReferenceImageId: number | null;
  orderedSceneItems: SceneOrderItem[];
  selectSceneItem: (item: SceneOrderItem) => void;
  reorderSceneItems: (dragged: SceneOrderItem, target: SceneOrderItem) => void;
  toggleReferenceImageLock: (id: number) => void;
  referenceImageInputRef: RefObject<HTMLInputElement | null>;
  handleReferenceImageUpload: (e: ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
  handleFileUpload: (e: ChangeEvent<HTMLInputElement>) => void;
  addTextElement: () => void;
  textItems?: TextItem[];
  selectedTextItem?: TextItem | null;
  selectedSingle?: ElementItem | null;
  updateSelectedTextItem?: (updater: (prev: TextItem) => TextItem) => void;
  textLensRange?: number;
  setTextLensRange?: Dispatch<SetStateAction<number>>;
};

export type ToolbarProps = {
  historyIndex: number;
  historyLength: number;
  isBrushMode: boolean;
  setIsBrushMode: Dispatch<SetStateAction<boolean>>;
  isEditMode: boolean;
  setIsEditMode: Dispatch<SetStateAction<boolean>>;
  setBrushPoints: Dispatch<SetStateAction<Point[]>>;
  setIsDrawingBrush: Dispatch<SetStateAction<boolean>>;
  selectedIds: number[];
  hasTextSelection: boolean;
  hasReferenceImageSelection: boolean;
  moveSelectedBackward: () => void;
  moveSelectedForward: () => void;
  deleteSelectedElements: () => void;
  downloadPNG: () => void;
  downloadTransparentGif: () => void;
  isExportingGif: boolean;
  pngExportScale: number;
  setPngExportScale: Dispatch<SetStateAction<number>>;
  pngOutputWidth: number;
  pngOutputHeight: number;
  gifExportScale: number;
  setGifExportScale: Dispatch<SetStateAction<number>>;
  gifFrameCount: number;
  setGifFrameCount: Dispatch<SetStateAction<number>>;
  gifOutputWidth: number;
  gifOutputHeight: number;
  undo: () => void;
  redo: () => void;
  setSelectedIds: Dispatch<SetStateAction<number[]>>;
};

export type StageProps = {
  canvasRef: RefObject<HTMLDivElement | null>;
  svgRef: RefObject<SVGSVGElement | null>;
  isDraggingOver: boolean;
  setIsDraggingOver: Dispatch<SetStateAction<boolean>>;
  onDrop: (e: DragEvent) => void;
  handlePointerDown: (
    e: PointerEvent,
    id: number | null,
    mode?: 'drag' | 'rotate' | 'scale' | 'groupScale' | 'groupRotate' | 'point',
    extra?: Partial<ActivePointState> & { elId?: number; segIndex?: number; prop?: 'main' | 'in' | 'out'; scaleHandle?: ScaleHandle },
  ) => void;
  handlePointerMove: (e: PointerEvent) => void;
  handlePointerUp: () => void;
  handleWheel: (e: WheelEvent) => void;
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
  textItems: TextItem[];
  referenceImages: ReferenceImageItem[];
  selectedTextId: number | null;
  selectedReferenceImageId: number | null;
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
  textLensRange: number;
  handleTextPointerDown: (e: PointerEvent, id: number, mode?: 'drag' | 'rotate' | 'scale') => void;
  handleReferenceImagePointerDown: (e: PointerEvent, id: number, mode?: 'drag' | 'scale') => void;
};

export type SceneOrderItem =
  | { kind: 'element'; id: number; layerOrder: number }
  | { kind: 'text'; id: number; layerOrder: number }
  | { kind: 'referenceImage'; id: number; layerOrder: number };

export type SectionComponentProps = {
  title: string;
  icon: ComponentType<{ className?: string }>;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
};
