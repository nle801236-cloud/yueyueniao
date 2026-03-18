import { DEFAULT_TEXT_COLOR, DEFAULT_TEXT_FONT_FAMILY, PRESET_DATA } from '../constants';
import type {
  ArtboardSettings,
  ElementItem,
  Point,
  PresetItem,
  ReferenceImageItem,
  ShapeStyle,
  TextItem,
} from '../types';
import {
  createRandomLiquidProfile,
  getNextSceneLayerOrder,
  getOrderedSceneItems,
  getSegmentsBounds,
  morphPathByStyle,
  parsePathToSegments,
  segmentsToPath,
} from '../utils/graphics';

export const createElementFromPathData = ({
  pathData,
  name,
  x,
  y,
  nextId,
  artboardCenter,
  activeColor,
  elements,
  textItems,
  referenceImages = [],
}: {
  pathData: string;
  name: string;
  x?: number;
  y?: number;
  nextId: () => number;
  artboardCenter: Point;
  activeColor: string;
  elements: ElementItem[];
  textItems: TextItem[];
  referenceImages?: ReferenceImageItem[];
}): ElementItem => {
  let segments = parsePathToSegments(pathData);
  const bounds = getSegmentsBounds(segments);
  segments = segments.map((seg) => {
    if (seg.type === 'Z') return seg;
    const next = { ...seg };
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
    layerOrder: getNextSceneLayerOrder(elements, textItems, referenceImages),
    color: activeColor,
    size: Math.max(bounds.width, bounds.height) / 2 || 50,
    liquidProfile: createRandomLiquidProfile(id),
  };
};

export const normalizeElementScaleToArtboard = ({
  element,
  artboard,
}: {
  element: ElementItem;
  artboard: ArtboardSettings;
}) => {
  const bounds = getSegmentsBounds(element.segments);
  const currentMaxDimension = Math.max(bounds.width, bounds.height);
  if (currentMaxDimension <= 0.001) return element;

  const targetMaxDimension = Math.min(
    260,
    Math.max(180, Math.min(artboard.width, artboard.height) * 0.28),
  );
  if (currentMaxDimension >= targetMaxDimension) return element;

  return {
    ...element,
    scale: element.scale * (targetMaxDimension / currentMaxDimension),
  };
};

export const createDefaultTextItem = ({
  nextId,
  artboardCenter,
  artboard,
  elements,
  textItems,
  referenceImages = [],
}: {
  nextId: () => number;
  artboardCenter: Point;
  artboard: ArtboardSettings;
  elements: ElementItem[];
  textItems: TextItem[];
  referenceImages?: ReferenceImageItem[];
}): TextItem => ({
  id: nextId(),
  text: 'Bubble',
  x: artboardCenter.x,
  y: artboardCenter.y,
  fontSize: Math.max(44, Math.min(88, Math.min(artboard.width, artboard.height) * 0.08)),
  scale: 1,
  rotation: 0,
  layerOrder: getNextSceneLayerOrder(elements, textItems, referenceImages),
  color: DEFAULT_TEXT_COLOR,
  fontFamily: DEFAULT_TEXT_FONT_FAMILY,
  fontWeight: 600,
  morphAmount: 0,
  roundnessAmount: 0,
  adhesionAmount: 0,
  grainAmount: 0,
});

export const applyShapeStyleToElementsInArtboard = ({
  elements,
  artboardRect,
  style,
  intensity,
}: {
  elements: ElementItem[];
  artboardRect: { x: number; y: number; width: number; height: number };
  style: ShapeStyle;
  intensity: number;
}) => elements.map((el) => {
  const inArtboard = el.x >= artboardRect.x
    && el.x <= artboardRect.x + artboardRect.width
    && el.y >= artboardRect.y
    && el.y <= artboardRect.y + artboardRect.height;
  if (!inArtboard) return el;
  const styledPath = morphPathByStyle(el.basePath, style, el.id, intensity);
  const styledSegments = parsePathToSegments(styledPath);
  const styledBounds = getSegmentsBounds(styledSegments);
  return {
    ...el,
    path: styledPath,
    segments: styledSegments,
    size: Math.max(styledBounds.width, styledBounds.height) / 2 || el.size,
  };
});

export const reorderSceneSelection = ({
  elements,
  textItems,
  referenceImages,
  selectedIds,
  selectedTextId,
  selectedReferenceImageId,
  direction,
}: {
  elements: ElementItem[];
  textItems: TextItem[];
  referenceImages: ReferenceImageItem[];
  selectedIds: number[];
  selectedTextId: number | null;
  selectedReferenceImageId: number | null;
  direction: 'forward' | 'backward';
}) => {
  const selectedKeys = new Set([
    ...(selectedReferenceImageId !== null ? [`referenceImage:${selectedReferenceImageId}`] : []),
    ...selectedIds.map((id) => `element:${id}`),
    ...(selectedTextId !== null ? [`text:${selectedTextId}`] : []),
  ]);
  const ordered = getOrderedSceneItems(elements, textItems, referenceImages).map((item) => ({ ...item }));

  if (direction === 'backward') {
    for (let index = 1; index < ordered.length; index += 1) {
      const currentKey = `${ordered[index].kind}:${ordered[index].id}`;
      const prevKey = `${ordered[index - 1].kind}:${ordered[index - 1].id}`;
      if (selectedKeys.has(currentKey) && !selectedKeys.has(prevKey)) {
        [ordered[index - 1].layerOrder, ordered[index].layerOrder] = [ordered[index].layerOrder, ordered[index - 1].layerOrder];
        [ordered[index - 1], ordered[index]] = [ordered[index], ordered[index - 1]];
      }
    }
  } else {
    for (let index = ordered.length - 2; index >= 0; index -= 1) {
      const currentKey = `${ordered[index].kind}:${ordered[index].id}`;
      const nextKey = `${ordered[index + 1].kind}:${ordered[index + 1].id}`;
      if (selectedKeys.has(currentKey) && !selectedKeys.has(nextKey)) {
        [ordered[index].layerOrder, ordered[index + 1].layerOrder] = [ordered[index + 1].layerOrder, ordered[index].layerOrder];
        [ordered[index], ordered[index + 1]] = [ordered[index + 1], ordered[index]];
      }
    }
  }

  const orderMap = new Map(ordered.map((item) => [`${item.kind}:${item.id}`, item.layerOrder]));
  return {
    referenceImages: referenceImages.map((item) => ({ ...item, layerOrder: orderMap.get(`referenceImage:${item.id}`) ?? item.layerOrder })),
    elements: elements.map((el) => ({ ...el, layerOrder: orderMap.get(`element:${el.id}`) ?? el.layerOrder })),
    textItems: textItems.map((item) => ({ ...item, layerOrder: orderMap.get(`text:${item.id}`) ?? item.layerOrder })),
  };
};

export const reorderSceneItemsFromList = ({
  elements,
  textItems,
  referenceImages,
  displayOrder,
}: {
  elements: ElementItem[];
  textItems: TextItem[];
  referenceImages: ReferenceImageItem[];
  displayOrder: Array<{ kind: 'element' | 'text' | 'referenceImage'; id: number }>;
}) => {
  const nextLayerOrder = new Map<string, number>();
  const normalizedBottomToTop = [...displayOrder].reverse();
  normalizedBottomToTop.forEach((item, index) => {
    nextLayerOrder.set(`${item.kind}:${item.id}`, index);
  });

  return {
    referenceImages: referenceImages.map((item) => ({
      ...item,
      layerOrder: nextLayerOrder.get(`referenceImage:${item.id}`) ?? item.layerOrder,
    })),
    elements: elements.map((item) => ({
      ...item,
      layerOrder: nextLayerOrder.get(`element:${item.id}`) ?? item.layerOrder,
    })),
    textItems: textItems.map((item) => ({
      ...item,
      layerOrder: nextLayerOrder.get(`text:${item.id}`) ?? item.layerOrder,
    })),
  };
};

const createFilledPresetElement = ({
  preset,
  color,
  x,
  y,
  index,
  shapeStyle,
  shapeStyleIntensity,
  nextId,
  artboardCenter,
  activeColor,
  elements,
  textItems,
}: {
  preset: PresetItem;
  color: string;
  x: number;
  y: number;
  index: number;
  shapeStyle: ShapeStyle;
  shapeStyleIntensity: number;
  nextId: () => number;
  artboardCenter: Point;
  activeColor: string;
  elements: ElementItem[];
  textItems: TextItem[];
}) => {
  const baseElement = createElementFromPathData({
    pathData: preset.path,
    name: preset.name,
    x,
    y,
    nextId,
    artboardCenter,
    activeColor,
    elements,
    textItems,
  });
  const styledPath = morphPathByStyle(baseElement.basePath, shapeStyle, baseElement.id + index * 17, shapeStyleIntensity);
  const styledSegments = parsePathToSegments(styledPath);
  const styledBounds = getSegmentsBounds(styledSegments);
  return {
    ...baseElement,
    rotation: Math.random() * 360,
    scale: 0.8 + Math.random() * 1.2,
    color,
    path: styledPath,
    segments: styledSegments,
    size: Math.max(styledBounds.width, styledBounds.height) / 2 || baseElement.size,
  } as ElementItem;
};

export const generateFilledElements = ({
  artboard,
  artboardCenter,
  palette,
  shapeStyle,
  shapeStyleIntensity,
  nextId,
  elements,
  textItems,
}: {
  artboard: ArtboardSettings;
  artboardCenter: Point;
  palette: { name: string; value: string }[];
  shapeStyle: ShapeStyle;
  shapeStyleIntensity: number;
  nextId: () => number;
  elements: ElementItem[];
  textItems: TextItem[];
}) => {
  const count = 12 + Math.floor(Math.random() * 8);
  const width = Math.max(200, artboard.width - 160);
  const height = Math.max(200, artboard.height - 160);
  const generated = Array.from({ length: count }, (_, index) => {
    const preset = PRESET_DATA[Math.floor(Math.random() * PRESET_DATA.length)];
    const color = palette[Math.floor(Math.random() * palette.length)].value;
    const x = artboardCenter.x - width / 2 + 80 + Math.random() * Math.max(20, width - 160);
    const y = artboardCenter.y - height / 2 + 80 + Math.random() * Math.max(20, height - 160);
    return createFilledPresetElement({
      preset,
      color,
      x,
      y,
      index,
      shapeStyle,
      shapeStyleIntensity,
      nextId,
      artboardCenter,
      activeColor: color,
      elements,
      textItems,
    });
  });

  return { count, elements: generated };
};
