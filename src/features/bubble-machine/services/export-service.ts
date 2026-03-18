import GIF from 'gif.js.optimized';
import gifWorkerUrl from 'gif.js.optimized/dist/gif.worker.js?url';
import { mixHex } from '../utils/color';
import { clamp01 } from '../utils/math';
import {
  drawNegativeContactScene,
  drawTextLensScene,
  getElementLocalBounds,
  getPotentialOverlapPairs,
  getTextEffectSettings,
  getTextLensBlur,
  getTextLensDisplacement,
  getTextLensScale,
  getTextStrokeWidth,
} from '../utils/graphics';
import type {
  ArtboardSettings,
  ContactMode,
  ContactSettings,
  ElementItem,
  GlowSettings,
  LiquidFilterFrame,
  LiquidSettings,
  TextItem,
} from '../types';

const escapeXml = (value: string) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&apos;');

const getExportBackgroundFill = (artboard: ArtboardSettings, transparent: boolean) => (
  transparent || artboard.backgroundColor === 'transparent' ? null : artboard.backgroundColor
);

const triggerDownload = (blob: Blob, filename: string) => {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 0);
};

const renderStageSnapshotCanvas = ({
  stageSvg,
  stageViewBox,
  width,
  height,
  scale,
}: {
  stageSvg: SVGSVGElement;
  stageViewBox: { x: number; y: number; width: number; height: number };
  width: number;
  height: number;
  scale: number;
}) => new Promise<HTMLCanvasElement>((resolve, reject) => {
  const clone = stageSvg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  clone.setAttribute('width', String(Math.max(1, Math.round(width * scale))));
  clone.setAttribute('height', String(Math.max(1, Math.round(height * scale))));
  clone.setAttribute('viewBox', `${stageViewBox.x} ${stageViewBox.y} ${stageViewBox.width} ${stageViewBox.height}`);
  clone.style.width = `${Math.max(1, Math.round(width * scale))}px`;
  clone.style.height = `${Math.max(1, Math.round(height * scale))}px`;

  const serializer = new XMLSerializer();
  const svgData = serializer.serializeToString(clone);
  const url = URL.createObjectURL(new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' }));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    URL.revokeObjectURL(url);
    reject(new Error('无法创建画布上下文'));
    return;
  }

  const img = new Image();
  img.onload = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    resolve(canvas);
  };
  img.onerror = () => {
    URL.revokeObjectURL(url);
    reject(new Error('实时画板快照渲染失败'));
  };
  img.src = url;
});

type SharedExportOptions = {
  artboard: ArtboardSettings;
  artboardCenter: { x: number; y: number };
  artboardRect: { x: number; y: number; width: number; height: number };
  elements: ElementItem[];
  textItems: TextItem[];
  liquidSettings: LiquidSettings;
  contactMode: ContactMode;
  contactSettings: ContactSettings;
  glowSettings: GlowSettings;
  textLensRange: number;
  time: number;
  computeLiquidFiltersAtTime: (sampleTime: number) => LiquidFilterFrame[];
};

export const buildExportSvgString = ({
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
  transparent = false,
  sampleTime = time,
  includeText = true,
}: SharedExportOptions & {
  transparent?: boolean;
  sampleTime?: number;
  includeText?: boolean;
}) => {
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

  const textClipMarkup = elements.map((el) => `
    <clipPath id="export-text-lens-clip-${el.id}" clipPathUnits="userSpaceOnUse">
      <g transform="translate(${el.x - artboardX}, ${el.y - artboardY}) rotate(${el.rotation}) scale(${el.scale})">
        <path d="${escapeXml(el.path)}" />
      </g>
    </clipPath>
  `).join('');

  const textBaseFilterMarkup = textItems
    .filter((textItem) => (textItem.morphAmount ?? 0) > 0.001 || (textItem.roundnessAmount ?? 0) > 0.001 || (textItem.adhesionAmount ?? 0) > 0.001)
    .map((textItem) => {
      const effect = getTextEffectSettings(textItem.morphAmount ?? 0, textItem.roundnessAmount ?? 0, textItem.adhesionAmount ?? 0, sampleTime);
      return `
        <filter id="export-text-effect-${textItem.id}" x="-60%" y="-60%" width="220%" height="220%">
          ${(textItem.adhesionAmount ?? 0) > 0.001
            ? `<feGaussianBlur in="SourceGraphic" stdDeviation="${effect.adhesionBlur}" result="adhesionBlur" />
               <feColorMatrix in="adhesionBlur" type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 ${effect.adhesionAlphaSlope} ${effect.adhesionAlphaIntercept}" result="adhesive" />`
            : '<feOffset in="SourceGraphic" dx="0" dy="0" result="adhesive" />'}
          ${effect.blur > 0.001
            ? `<feGaussianBlur in="adhesive" stdDeviation="${effect.blur}" result="softened" />`
            : '<feOffset in="adhesive" dx="0" dy="0" result="softened" />'}
          ${(textItem.morphAmount ?? 0) > 0.001
            ? `<feTurbulence type="fractalNoise" baseFrequency="${effect.baseFrequencyX} ${effect.baseFrequencyY}" numOctaves="2" seed="${textItem.id % 997}" result="noise" />
               <feDisplacementMap in="softened" in2="noise" scale="${effect.displacementScale}" xChannelSelector="R" yChannelSelector="G" />`
            : '<feOffset in="softened" dx="0" dy="0" />'}
        </filter>
      `;
    }).join('');

  const textLensFilterMarkup = textItems.map((textItem) => `
    <filter id="export-text-lens-effect-${textItem.id}" x="-80%" y="-80%" width="260%" height="260%">
      <feTurbulence type="fractalNoise" baseFrequency="${0.003 + clamp01(textLensRange) * 0.004} ${0.006 + clamp01(textLensRange) * 0.005}" numOctaves="2" seed="${textItem.id % 983}" result="lensNoise" />
      <feDisplacementMap in="SourceGraphic" in2="lensNoise" scale="${getTextLensDisplacement(textLensRange)}" xChannelSelector="R" yChannelSelector="G" result="refracted" />
      <feGaussianBlur in="refracted" stdDeviation="${getTextLensBlur(textLensRange)}" />
    </filter>
  `).join('');

  const textMarkup = textItems.map((textItem) => `
    <g>
      <g transform="translate(${textItem.x - artboardX}, ${textItem.y - artboardY}) rotate(${textItem.rotation}) scale(${textItem.scale})" ${((textItem.morphAmount ?? 0) > 0.001 || (textItem.roundnessAmount ?? 0) > 0.001 || (textItem.adhesionAmount ?? 0) > 0.001) ? `filter="url(#export-text-effect-${textItem.id})"` : ''}>
        <text
          x="0"
          y="0"
          fill="${escapeXml(textItem.color)}"
          font-size="${textItem.fontSize}"
          font-family="${escapeXml(textItem.fontFamily)}"
          font-weight="${textItem.fontWeight}"
          stroke="${escapeXml(textItem.color)}"
          stroke-width="${getTextStrokeWidth(textItem)}"
          paint-order="stroke fill"
          text-anchor="middle"
          dominant-baseline="middle"
        >${escapeXml(textItem.text)}</text>
      </g>
      ${elements.filter((el) => el.layerOrder > textItem.layerOrder).map((el) => `
        <g clip-path="url(#export-text-lens-clip-${el.id})">
          <g transform="translate(${el.x - artboardX}, ${el.y - artboardY}) scale(${getTextLensScale(textLensRange)}) translate(${-(el.x - artboardX)}, ${-(el.y - artboardY)})" filter="url(#export-text-lens-effect-${textItem.id})" opacity="0.98">
            <g transform="translate(${textItem.x - artboardX}, ${textItem.y - artboardY}) rotate(${textItem.rotation}) scale(${textItem.scale})">
              <text
                x="0"
                y="0"
                fill="${escapeXml(textItem.color)}"
                font-size="${textItem.fontSize}"
                font-family="${escapeXml(textItem.fontFamily)}"
                font-weight="${textItem.fontWeight}"
                stroke="${escapeXml(textItem.color)}"
                stroke-width="${getTextStrokeWidth(textItem)}"
                paint-order="stroke fill"
                text-anchor="middle"
                dominant-baseline="middle"
              >${escapeXml(textItem.text)}</text>
            </g>
          </g>
          <g transform="translate(${el.x - artboardX}, ${el.y - artboardY}) scale(${1 + clamp01(textLensRange) * 0.32}) translate(${-(el.x - artboardX)}, ${-(el.y - artboardY)})" opacity="${0.12 + clamp01(textLensRange) * 0.28}">
            <g transform="translate(${textItem.x - artboardX + textItem.fontSize * (0.018 + clamp01(textLensRange) * 0.024)}, ${textItem.y - artboardY + textItem.fontSize * (-0.012 - clamp01(textLensRange) * 0.02)}) rotate(${textItem.rotation}) scale(${textItem.scale})">
              <text
                x="0"
                y="0"
                fill="#ffffff"
                font-size="${textItem.fontSize}"
                font-family="${escapeXml(textItem.fontFamily)}"
                font-weight="${textItem.fontWeight}"
                text-anchor="middle"
                dominant-baseline="middle"
              >${escapeXml(textItem.text)}</text>
            </g>
          </g>
        </g>
      `).join('')}
    </g>
  `).join('');

  return `
    <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        ${filterMarkup}
        ${overlapClipMarkup}
        ${textClipMarkup}
        ${textBaseFilterMarkup}${textLensFilterMarkup}
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
      ${getExportBackgroundFill(artboard, transparent) ? `<rect x="0" y="0" width="100%" height="100%" fill="${escapeXml(getExportBackgroundFill(artboard, transparent) as string)}" />` : ''}
      <g ${artboard.clipContent ? `clip-path="url(#${clipId})"` : ''}>
        ${bodyMarkup}
        ${includeText ? textMarkup : ''}
      </g>
    </svg>
  `.trim();
};

export const renderExportCanvas = ({
  artboard,
  artboardRect,
  elements,
  textItems,
  liquidSettings,
  contactMode,
  contactSettings,
  textLensRange,
  time,
  buildSvg,
  transparent = false,
  sampleTime = time,
  scale = 1,
  useStageSnapshot = false,
  stageSvg,
  stageViewBox,
}: Pick<SharedExportOptions, 'artboard' | 'artboardRect' | 'elements' | 'textItems' | 'liquidSettings' | 'contactMode' | 'contactSettings' | 'textLensRange' | 'time'> & {
  buildSvg: (options?: { transparent?: boolean; sampleTime?: number; includeText?: boolean }) => string;
  transparent?: boolean;
  sampleTime?: number;
  scale?: number;
  useStageSnapshot?: boolean;
  stageSvg?: SVGSVGElement | null;
  stageViewBox?: { x: number; y: number; width: number; height: number };
}) => new Promise<HTMLCanvasElement>((resolve, reject) => {
  const width = Math.max(1, Math.round(artboard.width));
  const height = Math.max(1, Math.round(artboard.height));
  const exportScale = Math.max(1, scale);

  if (useStageSnapshot && stageSvg && stageViewBox) {
    renderStageSnapshotCanvas({
      stageSvg,
      stageViewBox,
      width,
      height,
      scale: exportScale,
    }).then(resolve).catch(reject);
    return;
  }

  if (contactMode === 'negative') {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.floor(width * exportScale));
    canvas.height = Math.max(1, Math.floor(height * exportScale));
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
      sampleTime,
      liquidSettings,
      contactSettings,
      getMatrix: (el) => new DOMMatrix()
        .translateSelf((el.x - artboardRect.x) * exportScale, (el.y - artboardRect.y) * exportScale)
        .rotateSelf(el.rotation)
        .scaleSelf(el.scale * exportScale),
      backgroundFill: getExportBackgroundFill(artboard, transparent),
    });

    drawTextLensScene({
      ctx,
      textItems,
      elements,
      lensRange: textLensRange,
      getTextPoint: (textItem) => ({
        x: (textItem.x - artboardRect.x) * exportScale,
        y: (textItem.y - artboardRect.y) * exportScale,
      }),
      getMatrix: (el) => new DOMMatrix()
        .translateSelf((el.x - artboardRect.x) * exportScale, (el.y - artboardRect.y) * exportScale)
        .rotateSelf(el.rotation)
        .scaleSelf(el.scale * exportScale),
      getVisibleElementsForText: (textItem) => elements.filter((el) => el.layerOrder > textItem.layerOrder),
    });

    resolve(canvas);
    return;
  }

  const svgData = buildSvg({ transparent, sampleTime, includeText: false });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(width * exportScale));
  canvas.height = Math.max(1, Math.floor(height * exportScale));

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    reject(new Error('无法创建画布上下文'));
    return;
  }

  const img = new Image();
  const url = URL.createObjectURL(new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' }));
  img.onload = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const visibleTextItems = textItems.filter((textItem) => elements.some((el) => el.layerOrder > textItem.layerOrder));
    visibleTextItems.forEach((textItem) => {
      ctx.save();
      ctx.font = `${textItem.fontWeight} ${textItem.fontSize}px ${textItem.fontFamily}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = textItem.color;
      ctx.strokeStyle = textItem.color;
      ctx.lineWidth = getTextStrokeWidth(textItem) * exportScale;
      ctx.translate((textItem.x - artboardRect.x) * exportScale, (textItem.y - artboardRect.y) * exportScale);
      ctx.rotate(textItem.rotation * (Math.PI / 180));
      ctx.scale(textItem.scale * exportScale, textItem.scale * exportScale);
      ctx.strokeText(textItem.text, 0, 0);
      ctx.fillText(textItem.text, 0, 0);
      ctx.restore();

      const visibleElements = elements.filter((el) => el.layerOrder > textItem.layerOrder);
      if (!visibleElements.length) return;

      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      visibleElements.forEach((el) => {
        const transformedPath = new Path2D();
        transformedPath.addPath(
          new Path2D(el.path),
          new DOMMatrix()
            .translateSelf((el.x - artboardRect.x) * exportScale, (el.y - artboardRect.y) * exportScale)
            .rotateSelf(el.rotation)
            .scaleSelf(el.scale * exportScale),
        );
        ctx.fill(transformedPath);
      });
      ctx.restore();
    });

    drawTextLensScene({
      ctx,
      textItems: visibleTextItems,
      elements,
      lensRange: textLensRange,
      getTextPoint: (textItem) => ({
        x: (textItem.x - artboardRect.x) * exportScale,
        y: (textItem.y - artboardRect.y) * exportScale,
      }),
      getTextScale: (textItem) => textItem.scale * exportScale,
      getMatrix: (el) => new DOMMatrix()
        .translateSelf((el.x - artboardRect.x) * exportScale, (el.y - artboardRect.y) * exportScale)
        .rotateSelf(el.rotation)
        .scaleSelf(el.scale * exportScale),
      getVisibleElementsForText: (textItem) => elements.filter((el) => el.layerOrder > textItem.layerOrder),
      clipToVisibleElements: true,
    });

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    resolve(canvas);
  };
  img.onerror = () => {
    URL.revokeObjectURL(url);
    reject(new Error('导出画面渲染失败'));
  };
  img.src = url;
});

export const buildIllustratorSvgString = ({
  artboard,
  artboardCenter,
  elements,
  liquidGlossiness,
}: {
  artboard: ArtboardSettings;
  artboardCenter: { x: number; y: number };
  elements: ElementItem[];
  liquidGlossiness: number;
}) => {
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
    const glossOpacity = 0.12 + liquidGlossiness * 0.35;
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
};

export const downloadPngFile = async ({
  renderCanvas,
  scale,
  width,
  height,
}: {
  renderCanvas: (options?: { scale?: number }) => Promise<HTMLCanvasElement>;
  scale: number;
  width: number;
  height: number;
}) => {
  const canvas = await renderCanvas({ scale });
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((output) => {
      if (output) resolve(output);
      else reject(new Error('无法生成 PNG 文件'));
    }, 'image/png');
  });
  triggerDownload(blob, `高清导出-${width}x${height}-${Date.now()}.png`);
};

export const downloadVisualSvgFile = async ({
  width,
  height,
  renderCanvas,
}: {
  width: number;
  height: number;
  renderCanvas: (options?: { scale?: number }) => Promise<HTMLCanvasElement>;
}) => {
  const canvas = await renderCanvas({ scale: 2 });
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
  triggerDownload(new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' }), `视觉保真导出-${Date.now()}.svg`);
};

export const downloadIllustratorSvgFile = (svgData: string) => {
  triggerDownload(new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' }), `Illustrator兼容导出-${Date.now()}.svg`);
};

export const renderTransparentGif = async ({
  width,
  height,
  frameCount,
  exportStartTime,
  renderFrame,
  onProgress,
}: {
  width: number;
  height: number;
  frameCount: number;
  exportStartTime: number;
  renderFrame: (sampleTime: number) => Promise<HTMLCanvasElement>;
  onProgress?: (current: number, total: number) => Promise<void> | void;
}) => {
  const durationMs = 1400;
  const delay = Math.max(40, Math.round(durationMs / frameCount));
  const gif = new GIF({
    workers: 2,
    quality: 1,
    dither: 'FloydSteinberg-serpentine',
    workerScript: gifWorkerUrl,
    repeat: 0,
    background: '#fcfcfb',
    width,
    height,
  });

  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    const sampleTime = exportStartTime + frameIndex * (durationMs / frameCount) / 1000;
    const frameCanvas = await renderFrame(sampleTime);
    gif.addFrame(frameCanvas, { copy: true, delay });
    if (frameIndex < frameCount - 1) {
      await onProgress?.(frameIndex + 1, frameCount);
    }
  }

  return new Promise<Blob>((resolve, reject) => {
    gif.on('finished', (output: Blob) => resolve(output));
    gif.on('abort', () => reject(new Error('GIF 导出已中止')));
    gif.render();
  });
};

export const downloadGifFile = (blob: Blob, width: number, height: number) => {
  triggerDownload(blob, `动态导出-${width}x${height}-${Date.now()}.gif`);
};
