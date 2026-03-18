import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Sparkles,
  Palette,
  Sliders,
  Sun,
  Waves,
  Link2,
  User,
  ChevronRight,
  Settings2,
  LayoutGrid,
  Droplets,
  Wind,
  Zap,
  Layers3,
  Wand2,
  Type,
} from 'lucide-react';
import {
  CONTACT_MODE_CONFIG,
  DEFAULT_ARTBOARD_SETTINGS,
  DEFAULT_CONTACT_SETTINGS,
  DEFAULT_GLOW_SETTINGS,
  DEFAULT_LIQUID_SETTINGS,
  IMPORT_AMPLITUDE_MODE_CONFIG,
  INITIAL_COLORS,
  MOTION_MODE_CONFIG,
  SHAPE_STYLE_CONFIG,
} from './src/features/bubble-machine/constants';
import type {
  ActivePointState,
  ArtboardSettings,
  ClipboardSnapshot,
  ContactMode,
  ContactSettings,
  CurveSeg,
  ElementItem,
  GlowSettings,
  LiquidSettings,
  MarqueeState,
  MoveSeg,
  Point,
  ScaleHandle,
  SectionKey,
  Segment,
  ShapeStyle,
  TextItem,
} from './src/features/bubble-machine/types';
import {
  distanceBetweenPoints,
  getMetricSizeLabel,
} from './src/features/bubble-machine/utils/math';
import {
  buildSmoothClosedPath,
  chaikinSmoothClosed,
  createRandomLiquidProfile,
  getAnchorHandles,
  getBrushAnchorTarget,
  getBrushAngularity,
  getBrushCornerIndexes,
  getClientCanvasPoint,
  getElementLocalBounds,
  getIncomingCurveIndex,
  getNegativeContactSeams,
  getOrderedSceneItems,
  getOutgoingCurveIndex,
  getSegmentsBounds,
  harmonizeLiquidProfile,
  morphPathByStyle,
  parsePathToSegments,
  reducePointsToTargetPreservingIndices,
  segmentsToPath,
  simplifyBrushPoints,
  stabilizeBrushLiquidProfile,
  syncOutgoingHandles,
} from './src/features/bubble-machine/utils/graphics';
import Sidebar from './src/features/bubble-machine/components/Sidebar';
import Toolbar from './src/features/bubble-machine/components/Toolbar';
import InspectorPanel from './src/features/bubble-machine/components/InspectorPanel';
import Stage from './src/features/bubble-machine/components/Stage';
import {
  buildExportSvgString,
  buildIllustratorSvgString,
  downloadGifFile,
  downloadIllustratorSvgFile,
  downloadPngFile,
  downloadVisualSvgFile,
  renderExportCanvas,
  renderTransparentGif,
} from './src/features/bubble-machine/services/export-service';
import { useSceneHistory } from './src/features/bubble-machine/hooks/useSceneHistory';
import { useAnimationTime } from './src/features/bubble-machine/hooks/useAnimationTime';
import {
  applyShapeStyleToElementsInArtboard,
  createDefaultTextItem,
  createElementFromPathData,
  generateFilledElements,
  normalizeElementScaleToArtboard,
  reorderSceneSelection,
} from './src/features/bubble-machine/services/scene-ops';
import { computeLiquidFiltersAtTime as computeLiquidFilterFrames } from './src/features/bubble-machine/services/liquid-motion';


export default function App() {
  const [activeColor, setActiveColor] = useState('#f7da2e');
  const [palette] = useState(INITIAL_COLORS);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isBrushMode, setIsBrushMode] = useState(false);
  const [brushPoints, setBrushPoints] = useState<Point[]>([]);
  const [isDrawingBrush, setIsDrawingBrush] = useState(false);
  const [activePoint, setActivePoint] = useState<ActivePointState | null>(null);
  const [selectedPointIdx, setSelectedPointIdx] = useState<number | null>(null);
  const [marquee, setMarquee] = useState<MarqueeState | null>(null);
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
  const [selectedTextId, setSelectedTextId] = useState<number | null>(null);
  const [draggingTextId, setDraggingTextId] = useState<number | null>(null);
  const [rotatingTextId, setRotatingTextId] = useState<number | null>(null);
  const [scalingTextId, setScalingTextId] = useState<number | null>(null);
  const [textInitialScale, setTextInitialScale] = useState(1);
  const [textInitialDist, setTextInitialDist] = useState(0);
  const [textRotationSnap, setTextRotationSnap] = useState({ initialRotation: 0, startAngle: 0 });
  const [textLensRange, setTextLensRange] = useState(0.42);
  const [rotationSnap, setRotationSnap] = useState({ initialRotation: 0, startAngle: 0 });
  const [liquidSettings, setLiquidSettings] = useState<LiquidSettings>(DEFAULT_LIQUID_SETTINGS);
  const [contactMode, setContactMode] = useState<ContactMode>('fusion');
  const [glowSettings, setGlowSettings] = useState<GlowSettings>(DEFAULT_GLOW_SETTINGS);
  const [contactSettings, setContactSettings] = useState<ContactSettings>(DEFAULT_CONTACT_SETTINGS);
  const [artboard, setArtboard] = useState<ArtboardSettings>(DEFAULT_ARTBOARD_SETTINGS);
  const [shapeStyle, setShapeStyle] = useState<ShapeStyle>('polygon');
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
  const stageSvgRef = useRef<SVGSVGElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageTimerRef = useRef<number | null>(null);
  const idRef = useRef(1);
  const didInitialFitRef = useRef(false);
  const dragStartPositionsRef = useRef<Record<number, Point>>({});
  const dragPointerStartRef = useRef<Point>({ x: 0, y: 0 });
  const dragSelectedIdsRef = useRef<number[]>([]);
  const textDragOffsetRef = useRef<Point>({ x: 0, y: 0 });
  const clipboardRef = useRef<ClipboardSnapshot | null>(null);
  const clipboardPasteCountRef = useRef(0);

  const resetEditorUiState = useCallback(() => {
    setSelectedIds([]);
    setSelectedTextId(null);
    setSelectedPointIdx(null);
    setActivePoint(null);
    setMarquee(null);
    setDraggingId(null);
    setRotatingId(null);
    setScalingId(null);
    setDraggingTextId(null);
    setRotatingTextId(null);
    setScalingTextId(null);
    setRotatingGroup(false);
    setScalingGroup(false);
    setIsDrawingBrush(false);
    setBrushPoints([]);
    dragStartPositionsRef.current = {};
    dragPointerStartRef.current = { x: 0, y: 0 };
    dragSelectedIdsRef.current = [];
  }, []);

  const {
    elements,
    textItems,
    history,
    historyIndex,
    elementsRef,
    textItemsRef,
    hasPendingHistoryRef,
    saveToHistory,
    commitScene,
    commitElements,
    commitTextItems,
    applyInteractiveElements,
    applyInteractiveTextItems,
    undo,
    redo,
  } = useSceneHistory({ onResetInteractions: resetEditorUiState });

  const time = useAnimationTime(liquidSettings.enabled, 30);
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const elementsById = useMemo(() => new Map<number, ElementItem>(elements.map((el) => [el.id, el])), [elements]);
  const textItemsById = useMemo(() => new Map<number, TextItem>(textItems.map((item) => [item.id, item])), [textItems]);
  const selectedElements = useMemo(() => elements.filter((el) => selectedIdSet.has(el.id)), [elements, selectedIdSet]);
  const elementsInLayerOrder = useMemo(() => [...elements].sort((a, b) => a.layerOrder - b.layerOrder || a.id - b.id), [elements]);
  const orderedSceneItems = useMemo(() => getOrderedSceneItems(elements, textItems), [elements, textItems]);

  const selectedSingle = useMemo<ElementItem | null>(() => {
    if (selectedIds.length !== 1) return null;
    return elementsById.get(selectedIds[0]) || null;
  }, [elementsById, selectedIds]);
  const selectedTextItem = useMemo(() => textItems.find((item) => item.id === selectedTextId) || null, [selectedTextId, textItems]);

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
    if (didInitialFitRef.current) return;
    didInitialFitRef.current = true;
    fitViewToArtboard();
  }, [fitViewToArtboard]);

  const createElementFromPath = useCallback((pathData: string, name: string, x?: number, y?: number): ElementItem => {
    return createElementFromPathData({
      pathData,
      name,
      x,
      y,
      nextId,
      artboardCenter,
      activeColor,
      elements: elementsRef.current,
      textItems: textItemsRef.current,
    });
  }, [activeColor, artboardCenter.x, artboardCenter.y, nextId]);

  const normalizeNewElementScale = useCallback((element: ElementItem) => {
    return normalizeElementScaleToArtboard({ element, artboard });
  }, [artboard.height, artboard.width]);

  const addTextElement = useCallback(() => {
    const nextText = createDefaultTextItem({
      nextId,
      artboardCenter,
      artboard,
      elements: elementsRef.current,
      textItems: textItemsRef.current,
    });
    const id = nextText.id;
    commitTextItems([...textItemsRef.current, nextText]);
    setSelectedTextId(id);
    setSelectedIds([]);
    setSelectedPointIdx(null);
    setDraggingTextId(null);
    showMsg('已添加文字，可直接拖动到气泡上方');
  }, [artboard.height, artboard.width, artboardCenter.x, artboardCenter.y, commitTextItems, nextId, showMsg]);

  const updateSelectedTextItem = useCallback((updater: (prev: TextItem) => TextItem) => {
    if (selectedTextId === null) return;
    commitTextItems(textItemsRef.current.map((item) => (item.id === selectedTextId ? updater(item) : item)));
  }, [commitTextItems, selectedTextId]);

  const addElement = useCallback((pathData: string, name = '新元素', options?: { alignAmplitudeToArtboard?: boolean; preserveImportedShape?: boolean }) => {
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
    const styledPath = options?.preserveImportedShape
      ? profiledElement.basePath
      : morphPathByStyle(profiledElement.basePath, shapeStyle, profiledElement.id, shapeStyleIntensity);
    const styledSegments = parsePathToSegments(styledPath);
    const styledBounds = getSegmentsBounds(styledSegments);
    const newElement: ElementItem = normalizeNewElementScale({
      ...profiledElement,
      path: styledPath,
      segments: styledSegments,
      size: Math.max(styledBounds.width, styledBounds.height) / 2 || profiledElement.size,
    });
    const next = [...elements, newElement];
    commitElements(next);
    setSelectedIds([newElement.id]);
    setSelectedTextId(null);
  }, [commitElements, createElementFromPath, elements, getArtboardMotionBaseline, liquidSettings.importAmplitudeMode, normalizeNewElementScale, shapeStyle, shapeStyleIntensity]);

  const getPresetPreviewPath = useCallback((pathData: string, name: string) => (
    morphPathByStyle(pathData, 'smooth', name.length * 97, shapeStyleIntensity * 0.5)
  ), [shapeStyleIntensity]);

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
    const next = applyShapeStyleToElementsInArtboard({
      elements,
      artboardRect,
      style,
      intensity: shapeStyleIntensity,
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
    if (selectedTextId !== null) {
      commitTextItems(textItemsRef.current.filter((item) => item.id !== selectedTextId));
      setSelectedTextId(null);
      showMsg('已删除文字');
      return;
    }
    if (!selectedIds.length) return;
    const next = elements.filter((el) => !selectedIdSet.has(el.id));
    commitElements(next);
    setSelectedIds([]);
    setSelectedPointIdx(null);
  }, [commitElements, commitTextItems, elements, selectedIdSet, selectedIds.length, selectedTextId, showMsg]);

  const moveSelectedBackward = useCallback(() => {
    if (!selectedIds.length && selectedTextId === null) return;
    const next = reorderSceneSelection({
      elements: elementsRef.current,
      textItems: textItemsRef.current,
      selectedIds,
      selectedTextId,
      direction: 'backward',
    });
    commitScene(next.elements, next.textItems);
    showMsg(selectedTextId !== null && !selectedIds.length ? '已将所选文字下移一层' : '已将所选对象下移一层');
  }, [commitScene, selectedIds, selectedTextId, showMsg]);

  const moveSelectedForward = useCallback(() => {
    if (!selectedIds.length && selectedTextId === null) return;
    const next = reorderSceneSelection({
      elements: elementsRef.current,
      textItems: textItemsRef.current,
      selectedIds,
      selectedTextId,
      direction: 'forward',
    });
    commitScene(next.elements, next.textItems);
    showMsg(selectedTextId !== null && !selectedIds.length ? '已将所选文字上移一层' : '已将所选对象上移一层');
  }, [commitScene, selectedIds, selectedTextId, showMsg]);

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

    const nextSegments = syncOutgoingHandles(
      sourceSegments.filter((_, idx) => idx !== selectedPointIdx).map((seg) => ({ ...seg })) as Segment[],
    );

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
        addElement(d, file.name.replace(/\.svg$/i, ''), { alignAmplitudeToArtboard: true, preserveImportedShape: true });
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
    const generated = generateFilledElements({
      artboard,
      artboardCenter,
      palette,
      shapeStyle,
      shapeStyleIntensity,
      nextId,
      elements: elementsRef.current,
      textItems: textItemsRef.current,
    });
    const { count, elements: newElements } = generated;
    const next = [...elements, ...newElements];
    commitElements(next);
    showMsg(`已随机生成 ${count} 个融合气泡`);
  }, [artboard, artboardCenter, commitElements, elements, nextId, palette, shapeStyle, shapeStyleIntensity, showMsg]);

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
      saveToHistory({ elements: currentElements, textItems: textItemsRef.current });
      hasPendingHistoryRef.current = false;
    }
    setDraggingId(null);
    setRotatingId(null);
    setScalingId(null);
    setDraggingTextId(null);
    setRotatingTextId(null);
    setScalingTextId(null);
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
        const cornerIndexes = getBrushCornerIndexes(simplifiedPoints);
        const roundedPoints = brushAngularity > 0.46
          ? simplifiedPoints
          : chaikinSmoothClosed(simplifiedPoints, 1);
        const resimplifiedPoints = simplifyBrushPoints(roundedPoints, referenceSize);
        const finalPoints = reducePointsToTargetPreservingIndices(resimplifiedPoints, brushAnchorTarget, cornerIndexes);
        const pathStr = buildSmoothClosedPath(finalPoints, brushAngularity > 0.46 ? 0.075 : 0.11);
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
        const newElement: ElementItem = normalizeNewElementScale({
          ...stabilizedBase,
          path: styledPath,
          segments: styledSegments,
          size: Math.max(styledBounds.width, styledBounds.height) / 2 || stabilizedBase.size,
        });
        const next = [...elements, newElement];
        commitElements(next);
        setSelectedIds([newElement.id]);
      }
      setIsDrawingBrush(false);
      setBrushPoints([]);
    }
    finishInteractions(elements);
  }, [alignElementMotionToArtboard, brushPoints, commitElements, createElementFromPath, elements, finishInteractions, getArtboardMotionBaseline, isDrawingBrush, normalizeNewElementScale, shapeStyle, shapeStyleIntensity]);

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
    return computeLiquidFilterFrames(elements, liquidSettings, sampleTime);
  }, [elements, liquidSettings]);

  const buildExportSvg = useCallback((options?: { transparent?: boolean; sampleTime?: number }) => buildExportSvgString({
    artboard,
    artboardCenter,
    elements,
    textItems,
    liquidSettings,
    contactMode,
    contactSettings,
    glowSettings,
    textLensRange,
    time,
    computeLiquidFiltersAtTime,
    transparent: options?.transparent,
    sampleTime: options?.sampleTime,
  }), [artboard, artboardCenter, elements, textItems, liquidSettings, contactMode, contactSettings, glowSettings, textLensRange, time, computeLiquidFiltersAtTime]);

  const renderCurrentExportCanvas = useCallback((options?: { transparent?: boolean; sampleTime?: number; scale?: number; useStageSnapshot?: boolean }) => renderExportCanvas({
    artboard,
    artboardRect,
    elements,
    textItems,
    liquidSettings,
    contactMode,
    contactSettings,
    textLensRange,
    time,
    buildSvg: buildExportSvg,
    transparent: options?.transparent,
    sampleTime: options?.sampleTime,
    scale: options?.scale,
    useStageSnapshot: options?.useStageSnapshot,
    stageSvg: stageSvgRef.current,
    stageViewBox: {
      x: viewOffset.x + artboardRect.x * zoom,
      y: viewOffset.y + artboardRect.y * zoom,
      width: artboardRect.width * zoom,
      height: artboardRect.height * zoom,
    },
  }), [artboard, artboardRect, elements, textItems, liquidSettings, contactMode, contactSettings, textLensRange, time, buildExportSvg, viewOffset.x, viewOffset.y, zoom]);

  const downloadPNG = useCallback(async () => {
    try {
      await downloadPngFile({
        renderCanvas: (options) => renderCurrentExportCanvas({ ...options, useStageSnapshot: true }),
        scale: pngExportScale,
        width: pngOutputWidth,
        height: pngOutputHeight,
      });
      showMsg('PNG 导出完成');
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      showMsg(`PNG 导出失败：${message}`);
    }
  }, [pngExportScale, pngOutputHeight, pngOutputWidth, renderCurrentExportCanvas, showMsg]);

  const buildIllustratorExportSvg = useCallback(() => buildIllustratorSvgString({
    artboard,
    artboardCenter,
    elements,
    liquidGlossiness: liquidSettings.glossiness,
  }), [artboard, artboardCenter, elements, liquidSettings.glossiness]);

  const downloadVisualSvg = useCallback(async () => {
    try {
      await downloadVisualSvgFile({
        width: Math.max(1, Math.round(artboard.width)),
        height: Math.max(1, Math.round(artboard.height)),
        renderCanvas: renderCurrentExportCanvas,
      });
    } catch {
      showMsg('SVG 导出失败');
    }
  }, [artboard.height, artboard.width, renderCurrentExportCanvas, showMsg]);

  const downloadIllustratorSvg = useCallback(() => {
    try {
      downloadIllustratorSvgFile(buildIllustratorExportSvg());
      showMsg('已导出 Illustrator 兼容 SVG');
    } catch {
      showMsg('Illustrator 兼容 SVG 导出失败');
    }
  }, [buildIllustratorExportSvg, showMsg]);

  const downloadTransparentGif = useCallback(async () => {
    if (isExportingGif) return;
    if (!liquidSettings.enabled) {
      showMsg('请先开启液体动画，再导出 GIF');
      return;
    }
    const exportWidth = gifOutputWidth;
    const exportHeight = gifOutputHeight;
    const frameCount = gifFrameCount;
    const exportStartTime = time;
    const yieldToBrowser = () => new Promise<void>((resolve) => window.setTimeout(resolve, 0));

    try {
      setIsExportingGif(true);
      showMsg('正在导出 GIF...');

      const renderFrame = async (sampleTime: number) => {
        return renderCurrentExportCanvas({ transparent: false, sampleTime, scale: gifExportScale });
      };
      const blob = await renderTransparentGif({
        width: exportWidth,
        height: exportHeight,
        frameCount,
        exportStartTime,
        renderFrame,
        onProgress: async (current, total) => {
          showMsg(`正在导出 GIF... ${current}/${total}`);
          await yieldToBrowser();
        },
      });
      downloadGifFile(blob, exportWidth, exportHeight);
      showMsg('GIF 导出完成');
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      showMsg(`GIF 导出失败：${message}`);
    } finally {
      setIsExportingGif(false);
    }
  }, [gifExportScale, gifFrameCount, gifOutputHeight, gifOutputWidth, isExportingGif, liquidSettings.enabled, renderCurrentExportCanvas, showMsg, time]);

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
      if (!targetSeg || targetSeg.type === 'Z') return;
      const handles = getAnchorHandles(el.segments, extra.segIndex);
      const incomingCurve = handles.incomingCurveIndex === null ? null : el.segments[handles.incomingCurveIndex];
      const outgoingCurve = handles.outgoingCurveIndex === null ? null : el.segments[handles.outgoingCurveIndex];
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
        origX2: incomingCurve && incomingCurve.type === 'C' ? incomingCurve.x2 : undefined,
        origY2: incomingCurve && incomingCurve.type === 'C' ? incomingCurve.y2 : undefined,
        origOutX: 'outX' in targetSeg ? targetSeg.outX : undefined,
        origOutY: 'outY' in targetSeg ? targetSeg.outY : undefined,
        origNextX1: outgoingCurve && outgoingCurve.type === 'C' ? outgoingCurve.x1 : undefined,
        origNextY1: outgoingCurve && outgoingCurve.type === 'C' ? outgoingCurve.y1 : undefined,
      });
      if (extra.prop === 'main') setSelectedPointIdx(extra.segIndex);
      return;
    }

    if (id === null && mode !== 'groupScale' && mode !== 'groupRotate') {
      if (!isPointInsideArtboard(point)) return;
      setSelectedIds([]);
      setSelectedTextId(null);
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
      setSelectedTextId(null);
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

  const handleTextPointerDown = useCallback((e: React.PointerEvent, id: number, mode: 'drag' | 'rotate' | 'scale' = 'drag') => {
    if (!canvasRef.current) return;
    if (e.button === 2) return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const rect = canvasRef.current.getBoundingClientRect();
    const point = getClientCanvasPoint(e, rect, viewOffset, zoom);
    const target = textItems.find((item) => item.id === id);
    if (!target) return;
    setSelectedTextId(id);
    setSelectedIds([]);
    setSelectedPointIdx(null);
    if (mode === 'drag') {
      setDraggingTextId(id);
      setRotatingTextId(null);
      setScalingTextId(null);
      textDragOffsetRef.current = { x: point.x - target.x, y: point.y - target.y };
      return;
    }
    if (mode === 'rotate') {
      setDraggingTextId(null);
      setRotatingTextId(id);
      setScalingTextId(null);
      setTextRotationSnap({ initialRotation: target.rotation, startAngle: Math.atan2(point.y - target.y, point.x - target.x) });
      return;
    }
    setDraggingTextId(null);
    setRotatingTextId(null);
    setScalingTextId(id);
    setTextInitialScale(target.scale);
    setTextInitialDist(Math.max(0.0001, Math.hypot(point.x - target.x, point.y - target.y)));
  }, [textItems, viewOffset, zoom]);

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
        const incomingCurveIndex = getIncomingCurveIndex(nextSegs, segIndex);
        const outgoingCurveIndex = getOutgoingCurveIndex(nextSegs, segIndex);

        if (prop === 'main') {
          seg.x = (origPointX ?? seg.x) + localDx;
          seg.y = (origPointY ?? seg.y) + localDy;
          if (incomingCurveIndex !== null) {
            const incomingCurve = nextSegs[incomingCurveIndex];
            if (incomingCurve && incomingCurve.type === 'C' && origX2 !== undefined && origY2 !== undefined) {
              nextSegs[incomingCurveIndex] = {
                ...incomingCurve,
                x2: origX2 + localDx,
                y2: origY2 + localDy,
              };
            }
          }
          if (outgoingCurveIndex !== null) {
            const outgoingCurve = nextSegs[outgoingCurveIndex];
            if (outgoingCurve && outgoingCurve.type === 'C' && origNextX1 !== undefined && origNextY1 !== undefined) {
              nextSegs[outgoingCurveIndex] = {
                ...outgoingCurve,
                x1: origNextX1 + localDx,
                y1: origNextY1 + localDy,
              };
            }
          }
        } else if (prop === 'in' && incomingCurveIndex !== null) {
          const incomingCurve = nextSegs[incomingCurveIndex];
          if (incomingCurve && incomingCurve.type === 'C') {
            nextSegs[incomingCurveIndex] = {
              ...incomingCurve,
              x2: (origX2 ?? incomingCurve.x2) + localDx,
              y2: (origY2 ?? incomingCurve.y2) + localDy,
            };
          }
        } else if (prop === 'out' && outgoingCurveIndex !== null) {
          const outgoingCurve = nextSegs[outgoingCurveIndex];
          if (outgoingCurve && outgoingCurve.type === 'C') {
            nextSegs[outgoingCurveIndex] = {
              ...outgoingCurve,
              x1: (origNextX1 ?? outgoingCurve.x1) + localDx,
              y1: (origNextY1 ?? outgoingCurve.y1) + localDy,
            };
          }
        }

        nextSegs[segIndex] = seg as Segment;
        const syncedSegments = syncOutgoingHandles(nextSegs);
        return { ...el, segments: syncedSegments, path: segmentsToPath(syncedSegments) };
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

    if (draggingTextId !== null) {
      applyInteractiveTextItems((prev) => prev.map((item) => (
        item.id === draggingTextId
          ? { ...item, x: point.x - textDragOffsetRef.current.x, y: point.y - textDragOffsetRef.current.y }
          : item
      )));
      return;
    }

    if (rotatingTextId !== null) {
      const target = textItemsRef.current.find((item) => item.id === rotatingTextId);
      if (!target) return;
      const currentAngle = Math.atan2(point.y - target.y, point.x - target.x);
      const deltaAngle = (currentAngle - textRotationSnap.startAngle) * (180 / Math.PI);
      applyInteractiveTextItems((prev) => prev.map((item) => (
        item.id === rotatingTextId
          ? { ...item, rotation: textRotationSnap.initialRotation + deltaAngle }
          : item
      )));
      return;
    }

    if (scalingTextId !== null) {
      const target = textItemsRef.current.find((item) => item.id === scalingTextId);
      if (!target) return;
      const ratio = Math.max(0.25, Math.hypot(point.x - target.x, point.y - target.y) / textInitialDist);
      applyInteractiveTextItems((prev) => prev.map((item) => (
        item.id === scalingTextId
          ? { ...item, scale: textInitialScale * ratio }
          : item
      )));
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
  }, [activePoint, applyInteractiveElements, applyInteractiveTextItems, draggingId, draggingTextId, elementsById, groupCenter.x, groupCenter.y, initialDist, initialScale, initialStates, isBrushMode, isDrawingBrush, isPanning, isPointInsideArtboard, marquee, panStart.x, panStart.y, rotatingGroup, rotatingId, rotatingTextId, rotationSnap.initialRotation, rotationSnap.startAngle, scalingGroup, scalingId, scalingTextId, textInitialDist, textInitialScale, textRotationSnap.initialRotation, textRotationSnap.startAngle, viewOffset, zoom]);

  const liquidFilters = useMemo(() => computeLiquidFiltersAtTime(time), [computeLiquidFiltersAtTime, time]);

  return (
    <div className="h-screen bg-[radial-gradient(circle_at_top,_#ffffff_0%,_#f4f7fb_52%,_#edf2f8_100%)] font-sans text-slate-700 overflow-hidden select-none antialiased p-4">
      {message && <div className="absolute top-10 left-1/2 -translate-x-1/2 bg-slate-950 text-white px-6 py-3 rounded-2xl text-xs font-semibold shadow-2xl z-[60] pointer-events-none">{message}</div>}

      <div className="flex h-full gap-4">
        <Sidebar
          activeColor={activeColor}
          selectedIds={selectedIds}
          elements={elements}
          rerandomizeLiquidProfiles={rerandomizeLiquidProfiles}
          fitViewToArtboard={fitViewToArtboard}
          shapeStyleIntensity={shapeStyleIntensity}
          addElement={addElement}
          sectionOpen={sectionOpen}
          toggleSection={toggleSection}
          collapsedSidebar={collapsedSidebar}
          setCollapsedSidebar={setCollapsedSidebar}
          fillCanvas={fillCanvas}
          fileInputRef={fileInputRef}
          handleFileUpload={handleFileUpload}
          addTextElement={addTextElement}
          getPresetPreviewPath={getPresetPreviewPath}
        />

        <main className="flex-1 flex flex-col relative overflow-hidden bg-white/70 backdrop-blur-2xl border border-white/60 rounded-[32px] shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
        <Toolbar
          historyIndex={historyIndex}
          historyLength={history.length}
          isBrushMode={isBrushMode}
          setIsBrushMode={setIsBrushMode}
          isEditMode={isEditMode}
          setIsEditMode={setIsEditMode}
          setBrushPoints={setBrushPoints}
          setIsDrawingBrush={setIsDrawingBrush}
          selectedIds={selectedIds}
          hasTextSelection={selectedTextId !== null}
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
          redo={redo}
          setSelectedIds={setSelectedIds}
        />

        <Stage
          canvasRef={canvasRef}
          svgRef={stageSvgRef}
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
          textItems={textItems}
          selectedTextId={selectedTextId}
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
          textLensRange={textLensRange}
          handleTextPointerDown={handleTextPointerDown}
        />
        </main>

        <InspectorPanel
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
          artboard={artboard}
          setArtboard={setArtboard}
          fitViewToArtboard={fitViewToArtboard}
          shapeStyle={shapeStyle}
          shapeStyleIntensity={shapeStyleIntensity}
          setShapeStyleIntensity={setShapeStyleIntensity}
          applyShapeStyleToArtboard={applyShapeStyleToArtboard}
          setActiveColor={setActiveColor}
          commitElements={commitElements}
          sectionOpen={sectionOpen}
          toggleSection={toggleSection}
          textItems={textItems}
          selectedTextItem={selectedTextItem}
          updateSelectedTextItem={updateSelectedTextItem}
          selectedSingle={selectedSingle}
          textLensRange={textLensRange}
          setTextLensRange={setTextLensRange}
        />
      </div>
    </div>
  );
}
