import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { FileCode, Hand, Info, Maximize2, Pencil, Target, ZoomIn } from 'lucide-react';
import type { ElementItem, ReferenceImageItem, StageProps, TextItem } from '../types';
import {
  drawNegativeContactScene,
  drawTextLensScene,
  getAnchorHandles,
  getContactRenderPath,
  getElementLocalBounds,
  getOrderedSceneItems,
  getPotentialOverlapPairs,
  getTextApproxHeight,
  getTextApproxWidth,
  getTextEffectSettings,
  getTextStrokeWidth,
} from '../utils/graphics';

type TextSceneLayer = {
  id: number;
  href: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

const Stage = memo(function Stage({
  canvasRef,
  svgRef,
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
  textItems,
  referenceImages,
  selectedTextId,
  selectedReferenceImageId,
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
  textLensRange,
  handleTextPointerDown,
  handleReferenceImagePointerDown,
}: StageProps) {
  const elementsById = useMemo(() => new Map<number, ElementItem>(elements.map((el) => [el.id, el])), [elements]);
  const textItemsById = useMemo(() => new Map<number, TextItem>(textItems.map((item) => [item.id, item])), [textItems]);
  const elementsInLayerOrder = useMemo(() => [...elements].sort((a, b) => a.layerOrder - b.layerOrder || a.id - b.id), [elements]);
  const elementIdsWithTextBehind = useMemo(() => {
    const ids = new Set<number>();
    elementsInLayerOrder.forEach((el) => {
      if (textItems.some((textItem) => textItem.layerOrder < el.layerOrder)) ids.add(el.id);
    });
    return ids;
  }, [elementsInLayerOrder, textItems]);
  const orderedSceneItems = useMemo(() => getOrderedSceneItems(elements, textItems), [elements, textItems]);
  const referenceImagesInLayerOrder = useMemo(
    () => [...referenceImages].sort((a, b) => a.layerOrder - b.layerOrder || a.id - b.id),
    [referenceImages],
  );
  const highestElementLayerOrder = useMemo(() => elementsInLayerOrder.reduce((max, el) => Math.max(max, el.layerOrder), -Infinity), [elementsInLayerOrder]);
  const textItemsBehindBubbles = useMemo(() => (
    textItems.filter((item) => item.layerOrder < highestElementLayerOrder)
  ), [highestElementLayerOrder, textItems]);
  const textItemsAboveBubbles = useMemo(() => (
    textItems.filter((item) => item.layerOrder >= highestElementLayerOrder)
  ), [highestElementLayerOrder, textItems]);
  const overlapCutouts = useMemo(() => (contactMode === 'fusion' ? [] : getPotentialOverlapPairs(elementsInLayerOrder)), [contactMode, elementsInLayerOrder]);
  const textItemsWithBubbleCover = useMemo(() => (
    textItems.filter((textItem) => elementsInLayerOrder.some((el) => el.layerOrder > textItem.layerOrder))
  ), [elementsInLayerOrder, textItems]);
  const [negativeSceneHref, setNegativeSceneHref] = useState<string | null>(null);
  const [textBaseSceneHref, setTextBaseSceneHref] = useState<string | null>(null);
  const [textLensLayers, setTextLensLayers] = useState<TextSceneLayer[]>([]);
  const viewportWidth = canvasRef.current?.clientWidth ?? 1;
  const viewportHeight = canvasRef.current?.clientHeight ?? 1;
  const textMaskPadding = Math.max(80, 180 / Math.max(zoom, 0.1));
  const selectedReferenceImageBounds = useMemo(() => {
    if (!selectedReferenceImageId) return null;
    const item = referenceImages.find((entry) => entry.id === selectedReferenceImageId);
    if (!item) return null;
    const width = item.width * item.scale;
    const height = item.height * item.scale;
    return {
      ...item,
      left: item.x - width / 2,
      top: item.y - height / 2,
      width,
      height,
    };
  }, [referenceImages, selectedReferenceImageId]);

  const renderTextSceneItem = useCallback((textItem: TextItem, keyPrefix = 'scene-text', options?: { applyEffects?: boolean }) => (
    <g key={`${keyPrefix}-${textItem.id}`} transform={`translate(${textItem.x}, ${textItem.y}) rotate(${textItem.rotation}) scale(${textItem.scale})`} filter={options?.applyEffects !== false && ((textItem.morphAmount ?? 0) > 0.001 || (textItem.roundnessAmount ?? 0) > 0.001 || (textItem.adhesionAmount ?? 0) > 0.001) ? `url(#text-effect-${textItem.id})` : undefined}>
      <text
        x={0}
        y={0}
        fill={textItem.color}
        fontSize={textItem.fontSize}
        fontFamily={textItem.fontFamily}
        fontWeight={textItem.fontWeight}
        stroke={textItem.color}
        strokeWidth={getTextStrokeWidth(textItem)}
        paintOrder="stroke fill"
        textAnchor="middle"
        dominantBaseline="middle"
      >
        {textItem.text}
      </text>
    </g>
  ), []);

  const renderBubbleEdgeOverlay = useCallback((el: ElementItem, keyPrefix = 'bubble-edge') => {
    if (contactMode === 'fusion' || contactMode === 'overlay') return null;
    const edgePath = contactMode === 'negative' ? getContactRenderPath(el, contactMode, contactSettings) : el.path;
    const strokeWidth = Math.max(0.08, 0.08 + glowSettings.edgeThickness * 1.22);
    return (
      <g key={`${keyPrefix}-${el.id}`} transform={`translate(${el.x}, ${el.y}) rotate(${el.rotation}) scale(${el.scale})`} pointerEvents="none">
        <path
          d={edgePath}
          fill="none"
          stroke={el.color}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity={0.94}
        />
      </g>
    );
  }, [contactMode, contactSettings, glowSettings.edgeThickness]);

  const getFusionBodyStrokeWidth = useCallback(() => (
    0.28
  ), []);

  const renderBubbleSurfaceOverlay = useCallback(() => null, []);

  const renderReferenceImages = useCallback((items: ReferenceImageItem[]) => (
    items.map((item) => (
      <g
        key={`reference-image-${item.id}`}
        transform={`translate(${item.x}, ${item.y}) scale(${item.scale})`}
        className="pointer-events-auto"
        style={{ touchAction: 'none' }}
      >
        <image
          href={item.src}
          x={-item.width / 2}
          y={-item.height / 2}
          width={item.width}
          height={item.height}
          opacity={item.opacity}
          preserveAspectRatio="xMidYMid meet"
          onPointerDown={(e) => handleReferenceImagePointerDown(e, item.id, 'drag')}
        />
      </g>
    ))
  ), [handleReferenceImagePointerDown]);

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

  useEffect(() => {
    if (viewportWidth <= 1 || viewportHeight <= 1) {
      setTextBaseSceneHref(null);
      return;
    }

    const visibleTextItems = textItemsWithBubbleCover;
    if (!visibleTextItems.length) {
      setTextBaseSceneHref(null);
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(viewportWidth));
    canvas.height = Math.max(1, Math.round(viewportHeight));
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setTextBaseSceneHref(null);
      return;
    }

    visibleTextItems.forEach((textItem) => {
      ctx.save();
      ctx.font = `${textItem.fontWeight} ${textItem.fontSize}px ${textItem.fontFamily}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = textItem.color;
      ctx.strokeStyle = textItem.color;
      ctx.lineWidth = getTextStrokeWidth(textItem) * zoom;
      ctx.translate(viewOffset.x + textItem.x * zoom, viewOffset.y + textItem.y * zoom);
      ctx.rotate(textItem.rotation * (Math.PI / 180));
      ctx.scale(textItem.scale * zoom, textItem.scale * zoom);
      ctx.strokeText(textItem.text, 0, 0);
      ctx.fillText(textItem.text, 0, 0);
      ctx.restore();

      const visibleElements = elementsInLayerOrder.filter((el) => el.layerOrder > textItem.layerOrder);
      if (!visibleElements.length) return;

      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      visibleElements.forEach((el) => {
        const transformedPath = new Path2D();
        transformedPath.addPath(
          new Path2D(el.path),
          new DOMMatrix()
            .translateSelf(viewOffset.x + el.x * zoom, viewOffset.y + el.y * zoom)
            .rotateSelf(el.rotation)
            .scaleSelf(el.scale * zoom),
        );
        ctx.fill(transformedPath);
      });
      ctx.restore();
    });

    setTextBaseSceneHref(canvas.toDataURL('image/png'));
  }, [elementsInLayerOrder, textItemsWithBubbleCover, viewOffset.x, viewOffset.y, viewportHeight, viewportWidth, zoom]);

  useEffect(() => {
    if (viewportWidth <= 1 || viewportHeight <= 1) {
      setTextLensLayers([]);
      return;
    }

    const visibleTextItems = textItemsWithBubbleCover;
    if (!visibleTextItems.length) {
      setTextLensLayers([]);
      return;
    }

    const layers = visibleTextItems.flatMap((textItem) => {
      const textScreenWidth = Math.max(1, getTextApproxWidth(textItem) * textItem.scale * zoom);
      const textScreenHeight = Math.max(1, getTextApproxHeight(textItem) * textItem.scale * zoom);
      const effectPadding = 84
        + textLensRange * 32
        + Math.max(textItem.roundnessAmount ?? 0, textItem.adhesionAmount ?? 0) * 34
        + (textItem.blurAmount ?? 0) * 18;
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(textScreenWidth + effectPadding * 2));
      canvas.height = Math.max(1, Math.round(textScreenHeight + effectPadding * 2));
      const ctx = canvas.getContext('2d');
      if (!ctx) return [];
      const originX = viewOffset.x + textItem.x * zoom - canvas.width / 2;
      const originY = viewOffset.y + textItem.y * zoom - canvas.height / 2;

      drawTextLensScene({
        ctx,
        textItems: [textItem],
        elements,
        lensRange: textLensRange,
        getTextPoint: () => ({
          x: canvas.width / 2,
          y: canvas.height / 2,
        }),
        getTextScale: (item) => item.scale * zoom,
        getMatrix: (el) => new DOMMatrix()
          .translateSelf(viewOffset.x + el.x * zoom - originX, viewOffset.y + el.y * zoom - originY)
          .rotateSelf(el.rotation)
          .scaleSelf(el.scale * zoom),
        getVisibleElementsForText: (item) => elementsInLayerOrder.filter((el) => el.layerOrder > item.layerOrder),
        clipToVisibleElements: false,
      });

      return [{
        id: textItem.id,
        href: canvas.toDataURL('image/png'),
        x: textItem.x - canvas.width / (2 * zoom),
        y: textItem.y - canvas.height / (2 * zoom),
        width: canvas.width / zoom,
        height: canvas.height / zoom,
      }];
    });

    setTextLensLayers(layers);
  }, [elements, elementsInLayerOrder, textItemsWithBubbleCover, textLensRange, viewOffset.x, viewOffset.y, viewportHeight, viewportWidth, zoom]);

  return (
    <div className={`flex-1 relative ${isDraggingOver ? 'bg-slate-100/50' : ''}`} style={{ touchAction: 'none', cursor: isPanning ? 'grabbing' : isBrushMode || isEditMode || marquee ? 'crosshair' : scalingGroup ? 'nwse-resize' : 'default' }} onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }} onDragLeave={() => setIsDraggingOver(false)} onDrop={onDrop} onPointerDown={(e) => handlePointerDown(e, null)} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp} onWheel={handleWheel} onContextMenu={(e) => e.preventDefault()} ref={canvasRef}>
      <svg ref={svgRef} className="w-full h-full pointer-events-none" style={{ touchAction: 'none' }}>
        <defs>
          {textItems.filter((item) => (item.morphAmount ?? 0) > 0.001 || (item.roundnessAmount ?? 0) > 0.001 || (item.adhesionAmount ?? 0) > 0.001).map((textItem) => {
            const effect = getTextEffectSettings(textItem.morphAmount ?? 0, textItem.roundnessAmount ?? 0, textItem.adhesionAmount ?? 0, time);
            return (
              <filter key={`text-effect-${textItem.id}`} id={`text-effect-${textItem.id}`} x="-60%" y="-60%" width="220%" height="220%">
                {(textItem.adhesionAmount ?? 0) > 0.001 ? (
                  <>
                    <feGaussianBlur in="SourceGraphic" stdDeviation={effect.adhesionBlur} result="adhesionBlur" />
                    <feColorMatrix
                      in="adhesionBlur"
                      type="matrix"
                      values={`1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 ${effect.adhesionAlphaSlope} ${effect.adhesionAlphaIntercept}`}
                      result="adhesive"
                    />
                  </>
                ) : (
                  <feOffset in="SourceGraphic" dx="0" dy="0" result="adhesive" />
                )}
                {effect.blur > 0.001 ? <feGaussianBlur in="adhesive" stdDeviation={effect.blur} result="softened" /> : <feOffset in="adhesive" dx="0" dy="0" result="softened" />}
                {(textItem.morphAmount ?? 0) > 0.001 ? (
                  <>
                    <feTurbulence type="fractalNoise" baseFrequency={`${effect.baseFrequencyX} ${effect.baseFrequencyY}`} numOctaves="2" seed={textItem.id % 997} result="noise" />
                    <feDisplacementMap in="softened" in2="noise" scale={effect.displacementScale} xChannelSelector="R" yChannelSelector="G" />
                  </>
                ) : (
                  <feOffset in="softened" dx="0" dy="0" />
                )}
              </filter>
            );
          })}
          {liquidFilters.map((item) => (
            <filter key={`liquid-flow-${item.id}`} id={`liquid-flow-${item.id}`} x="-150%" y="-150%" width="400%" height="400%">
              <feTurbulence type="fractalNoise" baseFrequency={item.baseFrequency} numOctaves="2" seed={item.id % 1000} result="noise" />
              <feDisplacementMap in="SourceGraphic" in2="noise" scale={item.displacementScale} result="displaced" />
              <feGaussianBlur in="displaced" stdDeviation={0.8} result="blur" />
              <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 52 -24" result="gooey" />
              <feOffset in="gooey" dx="0" dy="0" />
            </filter>
          ))}
          <filter id="clean-fusion" filterUnits="userSpaceOnUse" x="-10000" y="-10000" width="20000" height="20000" colorInterpolationFilters="sRGB">
            <feTurbulence type="turbulence" baseFrequency="0.032" numOctaves="2" result="tremorNoise" />
            <feDisplacementMap in="SourceGraphic" in2="tremorNoise" scale={glowSettings.lineJitter * 0.82} xChannelSelector="R" yChannelSelector="G" result="jitteredSource" />
            <feMorphology
              in="jitteredSource"
              operator="dilate"
              radius={glowSettings.individualSuction}
              result="expanded"
            />
            <feGaussianBlur
              in="expanded"
              stdDeviation={glowSettings.contactSuction * 0.92}
              result="blur"
            />
            <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 35 -15" result="blob" />
            <feMorphology in="blob" operator="erode" radius={glowSettings.glowDepth / 2.5} result="eroded_inner" />
            <feComposite in="blob" in2="eroded_inner" operator="out" result="inner_rim" />
            <feGaussianBlur in="inner_rim" stdDeviation={glowSettings.innerSoftness * 0.46} result="raw_grad" />
            <feComponentTransfer in="raw_grad" result="shaded_grad"><feFuncA type="linear" slope={glowSettings.gradientShade / 100 * 0.72} /></feComponentTransfer>
            <feTurbulence type="fractalNoise" baseFrequency="1.35" numOctaves="2" seed="42" result="grain_noise" />
            <feColorMatrix in="grain_noise" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -1 1" result="grain_mask" />
            <feComponentTransfer in="grain_mask" result="adj_grain"><feFuncA type="linear" slope={glowSettings.grain * 10} intercept={1 - glowSettings.grain * 5.5} /></feComponentTransfer>
            <feComposite in="shaded_grad" in2="adj_grain" operator="in" result="textured_grad" />
            <feMorphology in="blob" operator="erode" radius={Math.max(0.08, glowSettings.edgeThickness * 0.72)} result="eroded_border" />
            <feComposite in="blob" in2="eroded_border" operator="out" result="sharp_border" />
            <feComponentTransfer in="sharp_border" result="emphasized_border">
              <feFuncA type="linear" slope={1.4 + glowSettings.edgeThickness * 4.2} />
            </feComponentTransfer>
            <feMerge result="combined"><feMergeNode in="textured_grad" /><feMergeNode in="emphasized_border" /></feMerge>
            <feComposite in="combined" in2="blob" operator="in" result="final" />
            <feColorMatrix in="final" type="matrix" values={`1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 ${glowSettings.intensity} 0`} />
          </filter>
          {textItemsWithBubbleCover.map((textItem) => {
            const visibleElements = elementsInLayerOrder.filter((el) => el.layerOrder > textItem.layerOrder);
            if (!visibleElements.length) return null;
            return (
              <React.Fragment key={`fusion-text-mask-def-${textItem.id}`}>
                <filter
                  id={`fusion-text-mask-filter-${textItem.id}`}
                  filterUnits="userSpaceOnUse"
                  x={artboardRect.x - textMaskPadding}
                  y={artboardRect.y - textMaskPadding}
                  width={artboardRect.width + textMaskPadding * 2}
                  height={artboardRect.height + textMaskPadding * 2}
                  colorInterpolationFilters="sRGB"
                >
                  <feTurbulence type="turbulence" baseFrequency="0.032" numOctaves="2" result="tremorNoise" />
                  <feDisplacementMap in="SourceGraphic" in2="tremorNoise" scale={glowSettings.lineJitter * 0.82} xChannelSelector="R" yChannelSelector="G" result="jitteredSource" />
                  <feMorphology in="jitteredSource" operator="dilate" radius={glowSettings.individualSuction} result="expanded" />
                  <feGaussianBlur in="expanded" stdDeviation={glowSettings.contactSuction * 0.92} result="blur" />
                  <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 35 -15" result="blob" />
                  <feGaussianBlur
                    in="blob"
                    stdDeviation={Math.max(0.95, glowSettings.edgeThickness * 0.58 + glowSettings.contactSuction * 0.26)}
                    result="softInteriorBlur"
                  />
                  <feComponentTransfer in="softInteriorBlur" result="tightenedInterior">
                    <feFuncA type="linear" slope="4.1" intercept="-1.36" />
                  </feComponentTransfer>
                  <feComposite in="tightenedInterior" in2="blob" operator="in" result="softInterior" />
                  <feMorphology
                    in="softInterior"
                    operator="erode"
                    radius={Math.max(0.42, glowSettings.edgeThickness * 0.22 + glowSettings.contactSuction * 0.08)}
                    result="rimInset"
                  />
                  <feGaussianBlur
                    in="rimInset"
                    stdDeviation={Math.max(0.35, glowSettings.edgeThickness * 0.14 + glowSettings.contactSuction * 0.05)}
                    result="smoothedInset"
                  />
                  <feComponentTransfer in="smoothedInset">
                    <feFuncA type="linear" slope="2.6" intercept="-0.62" />
                  </feComponentTransfer>
                </filter>
                <mask
                  id={`fusion-text-mask-${textItem.id}`}
                  maskUnits="userSpaceOnUse"
                  x={artboardRect.x - textMaskPadding}
                  y={artboardRect.y - textMaskPadding}
                  width={artboardRect.width + textMaskPadding * 2}
                  height={artboardRect.height + textMaskPadding * 2}
                >
                  <rect
                    x={artboardRect.x - textMaskPadding}
                    y={artboardRect.y - textMaskPadding}
                    width={artboardRect.width + textMaskPadding * 2}
                    height={artboardRect.height + textMaskPadding * 2}
                    fill="black"
                  />
                  <g filter={`url(#fusion-text-mask-filter-${textItem.id})`}>
                    {visibleElements.map((el) => (
                      <g key={`fusion-text-mask-shape-${textItem.id}-${el.id}`} transform={`translate(${el.x}, ${el.y}) rotate(${el.rotation}) scale(${el.scale})`}>
                        <path d={el.path} fill="white" stroke="white" strokeWidth={getFusionBodyStrokeWidth()} strokeLinejoin="round" strokeLinecap="round" />
                      </g>
                    ))}
                  </g>
                </mask>
              </React.Fragment>
            );
          })}
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
            <rect x={artboardRect.x} y={artboardRect.y} width={artboardRect.width} height={artboardRect.height} fill={artboard.backgroundColor === 'transparent' ? 'transparent' : artboard.backgroundColor} stroke="#94a3b8" strokeWidth={1 / zoom} strokeDasharray={`${6 / zoom} ${6 / zoom}`} />
          </g>

          <g clipPath={artboard.clipContent ? 'url(#workspace-artboard-clip)' : undefined}>
            {renderReferenceImages(referenceImagesInLayerOrder)}
          </g>

          {contactMode === 'negative' ? (
            <g clipPath={artboard.clipContent ? 'url(#workspace-artboard-clip)' : undefined}>
              {textBaseSceneHref && (
                <image
                  href={textBaseSceneHref}
                  x={-viewOffset.x / zoom}
                  y={-viewOffset.y / zoom}
                  width={viewportWidth / zoom}
                  height={viewportHeight / zoom}
                  preserveAspectRatio="none"
                  pointerEvents="none"
                />
              )}
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
              <g data-ui="true" pointerEvents="none">
                {elementsInLayerOrder.map((el) => renderBubbleSurfaceOverlay(el, 'negative-surface'))}
              </g>
              <g data-ui="true" pointerEvents="none">
                {elementsInLayerOrder.map((el) => renderBubbleEdgeOverlay(el, 'negative-edge'))}
              </g>
              {textItemsAboveBubbles.map((textItem) => renderTextSceneItem(textItem, 'negative-front-text', { applyEffects: false }))}
            </g>
          ) : contactMode === 'overlay' ? (
            <g clipPath={artboard.clipContent ? 'url(#workspace-artboard-clip)' : undefined}>
              {textBaseSceneHref && (
                <image
                  href={textBaseSceneHref}
                  x={-viewOffset.x / zoom}
                  y={-viewOffset.y / zoom}
                  width={viewportWidth / zoom}
                  height={viewportHeight / zoom}
                  preserveAspectRatio="none"
                  pointerEvents="none"
                />
              )}
              {textLensLayers.map((layer) => (
                <image
                  key={`overlay-text-lens-${layer.id}`}
                  href={layer.href}
                  x={layer.x}
                  y={layer.y}
                  width={layer.width}
                  height={layer.height}
                  preserveAspectRatio="none"
                  pointerEvents="none"
                  mask={`url(#fusion-text-mask-${layer.id})`}
                />
              ))}
              {elementsInLayerOrder.map((el) => (
                <g key={el.id} filter="url(#clean-fusion)">
                  <g transform={`translate(${el.x}, ${el.y}) rotate(${el.rotation}) scale(${el.scale})`} onPointerDown={(e) => handlePointerDown(e, el.id, 'drag')}>
                    <path
                      d={el.path}
                      fill={el.color}
                      stroke={el.color}
                      strokeWidth={getFusionBodyStrokeWidth()}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      opacity={selectedIdSet.has(el.id) ? 1 : 0.9}
                      filter={liquidSettings.enabled ? `url(#liquid-flow-${el.id})` : 'none'}
                    />
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
              <g data-ui="true" pointerEvents="none">
                {elementsInLayerOrder.map((el) => renderBubbleSurfaceOverlay(el, 'overlay-surface'))}
              </g>
              <g data-ui="true" pointerEvents="none">
                {elementsInLayerOrder.map((el) => renderBubbleEdgeOverlay(el, 'overlay-edge'))}
              </g>
              {textItemsAboveBubbles.map((textItem) => renderTextSceneItem(textItem, 'front-text', { applyEffects: false }))}
            </g>
          ) : (
            <>
              <g clipPath={artboard.clipContent ? 'url(#workspace-artboard-clip)' : undefined}>
              {textBaseSceneHref && (
                <image
                  href={textBaseSceneHref}
                  x={-viewOffset.x / zoom}
                  y={-viewOffset.y / zoom}
                  width={viewportWidth / zoom}
                  height={viewportHeight / zoom}
                  preserveAspectRatio="none"
                  pointerEvents="none"
                />
              )}
              </g>
              <g clipPath={artboard.clipContent ? 'url(#workspace-artboard-clip)' : undefined}>
                {textLensLayers.map((layer) => (
                  <image
                    key={`fusion-text-lens-${layer.id}`}
                    href={layer.href}
                    x={layer.x}
                    y={layer.y}
                    width={layer.width}
                    height={layer.height}
                    preserveAspectRatio="none"
                    pointerEvents="none"
                    mask={`url(#fusion-text-mask-${layer.id})`}
                  />
                ))}
              </g>
              <g filter="url(#clean-fusion)" clipPath={artboard.clipContent ? 'url(#workspace-artboard-clip)' : undefined}>
                {elementsInLayerOrder.map((el) => (
                  <g key={el.id} transform={`translate(${el.x}, ${el.y}) rotate(${el.rotation}) scale(${el.scale})`} onPointerDown={(e) => handlePointerDown(e, el.id, 'drag')}>
                    <path
                      d={el.path}
                      fill={el.color}
                      stroke={el.color}
                      strokeWidth={getFusionBodyStrokeWidth()}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      opacity={selectedIdSet.has(el.id) ? 1 : 0.9}
                      filter={liquidSettings.enabled ? `url(#liquid-flow-${el.id})` : 'none'}
                    />
                  </g>
                ))}
              </g>
              <g clipPath={artboard.clipContent ? 'url(#workspace-artboard-clip)' : undefined}>
                {elementsInLayerOrder.map((el) => renderBubbleSurfaceOverlay(el, 'fusion-surface'))}
              </g>
              <g data-ui="true" pointerEvents="none" clipPath={artboard.clipContent ? 'url(#workspace-artboard-clip)' : undefined}>
                {elementsInLayerOrder.map((el) => renderBubbleEdgeOverlay(el, 'fusion-edge'))}
              </g>
              <g clipPath={artboard.clipContent ? 'url(#workspace-artboard-clip)' : undefined}>
                {textItemsAboveBubbles.map((textItem) => renderTextSceneItem(textItem, 'front-text', { applyEffects: false }))}
              </g>
            </>
          )}

          {textItems.length > 0 && (
            <g data-ui="true" clipPath={artboard.clipContent ? 'url(#workspace-artboard-clip)' : undefined}>
              {textItems.map((textItem) => {
                const halfWidth = getTextApproxWidth(textItem) / 2;
                const halfHeight = getTextApproxHeight(textItem) / 2;
                const selectionPad = 10 / zoom;
                const handleRadius = 6 / zoom;
                const handleStroke = 1.4 / zoom;
                const rotateDistance = 26 / zoom;
                return (
                  <g key={`text-${textItem.id}`} transform={`translate(${textItem.x}, ${textItem.y}) rotate(${textItem.rotation}) scale(${textItem.scale})`}>
                    <rect
                      x={-halfWidth - selectionPad}
                      y={-halfHeight - selectionPad}
                      width={halfWidth * 2 + selectionPad * 2}
                      height={halfHeight * 2 + selectionPad * 2}
                      rx={10 / zoom}
                      fill="transparent"
                      className="pointer-events-auto"
                      style={{ touchAction: 'none' }}
                      onPointerDown={(e) => handleTextPointerDown(e, textItem.id, 'drag')}
                    />
                    {selectedTextId === textItem.id && (
                      <>
                        <rect
                          x={-halfWidth - selectionPad}
                          y={-halfHeight - selectionPad}
                          width={halfWidth * 2 + selectionPad * 2}
                          height={halfHeight * 2 + selectionPad * 2}
                          rx={10 / zoom}
                          fill="none"
                          stroke="#3b82f6"
                          strokeWidth={1 / (zoom * Math.max(textItem.scale, 0.0001))}
                          strokeDasharray={`${4 / zoom} ${4 / zoom}`}
                          pointerEvents="none"
                          opacity={0.7}
                        />
                        <line x1={0} y1={-halfHeight - selectionPad} x2={0} y2={-halfHeight - selectionPad - rotateDistance} stroke="#3b82f6" strokeWidth={handleStroke / Math.max(textItem.scale, 0.0001)} strokeDasharray={`${2 / zoom} ${2 / zoom}`} pointerEvents="none" />
                        <circle cx={0} cy={-halfHeight - selectionPad - rotateDistance} r={handleRadius / Math.max(textItem.scale, 0.0001)} fill="white" stroke="#3b82f6" strokeWidth={handleStroke / Math.max(textItem.scale, 0.0001)} className="pointer-events-auto" style={{ touchAction: 'none' }} onPointerDown={(e) => handleTextPointerDown(e, textItem.id, 'rotate')} />
                        <circle cx={halfWidth + selectionPad} cy={halfHeight + selectionPad} r={handleRadius / Math.max(textItem.scale, 0.0001)} fill="white" stroke="#3b82f6" strokeWidth={handleStroke / Math.max(textItem.scale, 0.0001)} className="pointer-events-auto" style={{ touchAction: 'none' }} onPointerDown={(e) => handleTextPointerDown(e, textItem.id, 'scale')} />
                      </>
                    )}
                  </g>
                );
              })}
            </g>
          )}

          {selectedReferenceImageBounds && (
            <g data-ui="true" clipPath={artboard.clipContent ? 'url(#workspace-artboard-clip)' : undefined}>
              <rect
                x={selectedReferenceImageBounds.left}
                y={selectedReferenceImageBounds.top}
                width={selectedReferenceImageBounds.width}
                height={selectedReferenceImageBounds.height}
                fill="none"
                stroke="#3b82f6"
                strokeWidth={1 / zoom}
                strokeDasharray={`${4 / zoom} ${4 / zoom}`}
                pointerEvents="none"
                opacity={0.75}
              />
              <rect
                x={selectedReferenceImageBounds.left}
                y={selectedReferenceImageBounds.top}
                width={selectedReferenceImageBounds.width}
                height={selectedReferenceImageBounds.height}
                fill="transparent"
                className="pointer-events-auto"
                style={{ touchAction: 'none' }}
                onPointerDown={(e) => handleReferenceImagePointerDown(e, selectedReferenceImageBounds.id, 'drag')}
              />
              <circle
                cx={selectedReferenceImageBounds.left + selectedReferenceImageBounds.width}
                cy={selectedReferenceImageBounds.top + selectedReferenceImageBounds.height}
                r={6 / zoom}
                fill="white"
                stroke="#3b82f6"
                strokeWidth={1.4 / zoom}
                className="pointer-events-auto"
                style={{ touchAction: 'none' }}
                onPointerDown={(e) => handleReferenceImagePointerDown(e, selectedReferenceImageBounds.id, 'scale')}
              />
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
                const { incomingHandle, outgoingHandle } = getAnchorHandles(selectedSingle.segments, idx);
                const localHandleScale = Math.max(0.0001, selectedSingle.scale);
                const hStroke = 1 / (zoom * localHandleScale);
                const hRad = 5 / (zoom * localHandleScale);
                const hitRad = 9 / (zoom * localHandleScale);
                return (
                  <g key={`edit-${selectedSingle.id}-${idx}`}>
                    {isSelected && (
                      <>
                        {incomingHandle && (
                          <>
                            <line x1={seg.x} y1={seg.y} x2={incomingHandle.x} y2={incomingHandle.y} stroke="#6366f1" strokeWidth={hStroke} strokeDasharray="2 2" />
                            <circle cx={incomingHandle.x} cy={incomingHandle.y} r={hitRad} fill="transparent" className="pointer-events-auto" style={{ touchAction: 'none' }} onPointerDown={(e) => handlePointerDown(e, selectedSingle.id, 'point', { elId: selectedSingle.id, segIndex: idx, prop: 'in' })} />
                            <circle cx={incomingHandle.x} cy={incomingHandle.y} r={hRad * 0.85} fill="white" stroke="#6366f1" strokeWidth={hStroke} className="pointer-events-none" />
                          </>
                        )}
                        {outgoingHandle && (
                          <>
                            <line x1={seg.x} y1={seg.y} x2={outgoingHandle.x} y2={outgoingHandle.y} stroke="#6366f1" strokeWidth={hStroke} strokeDasharray="2 2" />
                            <circle cx={outgoingHandle.x} cy={outgoingHandle.y} r={hitRad} fill="transparent" className="pointer-events-auto" style={{ touchAction: 'none' }} onPointerDown={(e) => handlePointerDown(e, selectedSingle.id, 'point', { elId: selectedSingle.id, segIndex: idx, prop: 'out' })} />
                            <circle cx={outgoingHandle.x} cy={outgoingHandle.y} r={hRad * 0.85} fill="white" stroke="#6366f1" strokeWidth={hStroke} className="pointer-events-none" />
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

export default Stage;
