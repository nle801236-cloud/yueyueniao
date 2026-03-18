import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Droplets,
  Layers3,
  Link2,
  Palette,
  Settings2,
  Sliders,
  Sparkles,
  Sun,
  Target,
  Type,
  User,
  Waves,
  Wind,
  Zap,
} from 'lucide-react';

import {
  CONTACT_MODE_CONFIG,
  IMPORT_AMPLITUDE_MODE_CONFIG,
  MOTION_MODE_CONFIG,
  SHAPE_STYLE_CONFIG,
  TEXT_FONT_OPTIONS,
} from '../constants';
import type {
  ArtboardSettings,
  ContactMode,
  ContactSettings,
  GlowSettings,
  ImportAmplitudeMode,
  LiquidSettings,
  MotionMode,
  ShapeStyle,
  SidebarProps,
} from '../types';
import { cmykToHex, hexToCmyk, hexToRgb, normalizeHex, rgbToHex } from '../utils/color';
import {
  millimetersToPixels,
  pixelsToMillimeters,
} from '../utils/math';
import Section from './Section';

type InspectorPanelProps = Pick<
  SidebarProps,
  | 'activeColor'
  | 'palette'
  | 'selectedIds'
  | 'selectedIdSet'
  | 'elements'
  | 'contactMode'
  | 'setContactMode'
  | 'contactSettings'
  | 'setContactSettings'
  | 'glowSettings'
  | 'setGlowSettings'
  | 'liquidSettings'
  | 'setLiquidSettings'
  | 'artboard'
  | 'setArtboard'
  | 'fitViewToArtboard'
  | 'shapeStyle'
  | 'shapeStyleIntensity'
  | 'setShapeStyleIntensity'
  | 'applyShapeStyleToArtboard'
  | 'setActiveColor'
  | 'commitElements'
  | 'sectionOpen'
  | 'toggleSection'
  | 'textItems'
  | 'selectedTextItem'
  | 'selectedSingle'
  | 'updateSelectedTextItem'
  | 'textLensRange'
  | 'setTextLensRange'
>;

const InspectorPanel = memo(function InspectorPanel({
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
  artboard,
  setArtboard,
  fitViewToArtboard,
  shapeStyle,
  shapeStyleIntensity,
  setShapeStyleIntensity,
  applyShapeStyleToArtboard,
  setActiveColor,
  commitElements,
  sectionOpen,
  toggleSection,
  textItems = [],
  selectedTextItem = null,
  selectedSingle = null,
  updateSelectedTextItem,
  textLensRange = 0.4,
  setTextLensRange,
}: InspectorPanelProps) {
  const activeCmyk = useMemo(() => hexToCmyk(activeColor), [activeColor]);
  const activeRgb = useMemo(() => hexToRgb(activeColor), [activeColor]);
  const artboardRgb = useMemo(() => hexToRgb(artboard.backgroundColor), [artboard.backgroundColor]);
  const artboardCmyk = useMemo(() => hexToCmyk(artboard.backgroundColor), [artboard.backgroundColor]);
  const [colorInputMode, setColorInputMode] = useState<'rgb' | 'hex' | 'cmyk'>('hex');
  const [artboardColorInputMode, setArtboardColorInputMode] = useState<'rgb' | 'hex' | 'cmyk'>('hex');
  const [hexDraft, setHexDraft] = useState(activeColor.toUpperCase());
  const [artboardHexDraft, setArtboardHexDraft] = useState(artboard.backgroundColor.toUpperCase());
  const [artboardSizeDrafts, setArtboardSizeDrafts] = useState(() => ({
    width: pixelsToMillimeters(artboard.width).toFixed(1),
    height: pixelsToMillimeters(artboard.height).toFixed(1),
  }));

  useEffect(() => {
    setHexDraft(activeColor.toUpperCase());
  }, [activeColor]);

  useEffect(() => {
    setArtboardHexDraft(artboard.backgroundColor.toUpperCase());
  }, [artboard.backgroundColor]);

  useEffect(() => {
    setArtboardSizeDrafts({
      width: pixelsToMillimeters(artboard.width).toFixed(1),
      height: pixelsToMillimeters(artboard.height).toFixed(1),
    });
  }, [artboard.height, artboard.width]);

  const applyColor = useCallback((color: string) => {
    setActiveColor(color);
    if (selectedIds.length > 0) {
      const next = elements.map((el) => (selectedIdSet.has(el.id) ? { ...el, color } : el));
      commitElements(next);
    }
  }, [commitElements, elements, selectedIdSet, selectedIds.length, setActiveColor]);

  const updateRgbChannel = useCallback((channel: 'r' | 'g' | 'b', rawValue: string) => {
    const nextValue = Math.max(0, Math.min(255, parseInt(rawValue || '0', 10) || 0));
    const nextColor = rgbToHex({ ...activeRgb, [channel]: nextValue });
    applyColor(nextColor);
  }, [activeRgb, applyColor]);

  const updateCmykChannel = useCallback((channel: 'c' | 'm' | 'y' | 'k', rawValue: string) => {
    const nextValue = Math.max(0, Math.min(100, parseInt(rawValue || '0', 10) || 0));
    const nextColor = cmykToHex({ ...activeCmyk, [channel]: nextValue });
    applyColor(nextColor);
  }, [activeCmyk, applyColor]);

  const commitHexDraft = useCallback(() => {
    const normalized = normalizeHex(hexDraft.trim());
    setHexDraft(normalized.toUpperCase());
    applyColor(normalized);
  }, [applyColor, hexDraft]);

  const applyArtboardColor = useCallback((color: string) => {
    setArtboard((prev) => ({ ...prev, backgroundColor: color }));
  }, [setArtboard]);

  const updateArtboardRgbChannel = useCallback((channel: 'r' | 'g' | 'b', rawValue: string) => {
    const nextValue = Math.max(0, Math.min(255, parseInt(rawValue || '0', 10) || 0));
    applyArtboardColor(rgbToHex({ ...artboardRgb, [channel]: nextValue }));
  }, [applyArtboardColor, artboardRgb]);

  const updateArtboardCmykChannel = useCallback((channel: 'c' | 'm' | 'y' | 'k', rawValue: string) => {
    const nextValue = Math.max(0, Math.min(100, parseInt(rawValue || '0', 10) || 0));
    applyArtboardColor(cmykToHex({ ...artboardCmyk, [channel]: nextValue }));
  }, [applyArtboardColor, artboardCmyk]);

  const commitArtboardHexDraft = useCallback(() => {
    const normalized = normalizeHex(artboardHexDraft.trim());
    setArtboardHexDraft(normalized.toUpperCase());
    applyArtboardColor(normalized);
  }, [applyArtboardColor, artboardHexDraft]);

  const updateArtboardSizeDraft = useCallback((key: 'width' | 'height', value: string) => {
    setArtboardSizeDrafts((prev) => ({ ...prev, [key]: value }));
  }, []);

  const commitArtboardSizeDraft = useCallback((key: 'width' | 'height', min: number, max: number) => {
    const rawValue = artboardSizeDrafts[key].trim();
    const parsedMillimeters = Number.parseFloat(rawValue);
    const fallbackMillimeters = pixelsToMillimeters(artboard[key]);
    const nextMillimeters = Number.isFinite(parsedMillimeters) ? parsedMillimeters : fallbackMillimeters;
    const nextPixels = millimetersToPixels(nextMillimeters);
    const clampedPixels = Math.min(max, Math.max(min, Math.round(nextPixels) || min));
    setArtboard((prev) => ({ ...prev, [key]: clampedPixels }));
    setArtboardSizeDrafts((prev) => ({
      ...prev,
      [key]: pixelsToMillimeters(clampedPixels).toFixed(1),
    }));
  }, [artboard, artboardSizeDrafts, setArtboard]);

  return (
    <aside className="w-[356px] h-full bg-white/88 backdrop-blur-2xl border border-white/70 rounded-[30px] z-30 flex flex-col shadow-[0_24px_80px_rgba(15,23,42,0.10)] overflow-y-auto">
      <div className="p-5 border-b border-slate-100/80">
        <div className="text-[11px] font-semibold tracking-[0.12em] text-slate-400 mb-1">检视面板</div>
        <div className="text-[24px] font-semibold tracking-tight text-slate-950">外观与动态</div>
        <div className="text-sm text-slate-500 mt-2">当前选择 {selectedIds.length} 个对象，参数会按创建、接触、动态的顺序组织。</div>
      </div>

      <div className="p-5 space-y-6 flex-1">
        <Section title="外观" icon={Palette} open={sectionOpen.color} onToggle={() => toggleSection('color')}>
          <div className="bg-[rgba(246,247,251,0.92)] rounded-[26px] p-4 border border-white/90 space-y-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.88),0_8px_24px_rgba(15,23,42,0.04)]">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="text-[10px] font-semibold text-slate-500 tracking-[0.12em]">当前活动色</div>
                <div className="text-[11px] text-slate-400">更换后会同步到新建气泡和当前选中对象</div>
              </div>
              <div className="relative group">
                <input type="color" value={activeColor} onChange={(e) => applyColor(e.target.value)} className="w-10 h-10 rounded-xl opacity-0 absolute inset-0 cursor-pointer z-10" />
                <div className="w-10 h-10 rounded-[16px] border-2 border-white shadow-sm" style={{ backgroundColor: activeColor }} />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {palette.map((color) => (
                <button
                  key={color.value}
                  onClick={() => applyColor(color.value)}
                  className={`h-10 rounded-2xl border transition-all ${activeColor === color.value ? 'ring-2 ring-slate-900 ring-offset-2 border-slate-900/10 shadow-[0_10px_24px_rgba(15,23,42,0.08)]' : 'border-white/90 shadow-[0_8px_18px_rgba(15,23,42,0.05)]'}`}
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                />
              ))}
            </div>
            <div className="rounded-[22px] bg-white/75 border border-white/90 p-3 shadow-[0_8px_18px_rgba(15,23,42,0.04)] space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[10px] font-semibold text-slate-500 tracking-[0.12em]">颜色输入</div>
                <div className="rounded-[18px] bg-slate-100/90 p-1 flex items-center gap-1">
                  {([['rgb', 'RGB'], ['hex', 'HEX'], ['cmyk', 'CMYK']] as const).map(([mode, label]) => (
                    <button key={mode} onClick={() => setColorInputMode(mode)} className={`px-3 py-1.5 rounded-[14px] text-[10px] font-semibold transition-all ${colorInputMode === mode ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {colorInputMode === 'rgb' && (
                <>
                  <div className="text-[11px] text-slate-400">RGB 使用屏幕显示色值，范围 0 - 255</div>
                  <div className="grid grid-cols-3 gap-2">
                    {([['r', 'R'], ['g', 'G'], ['b', 'B']] as const).map(([key, label]) => (
                      <label key={key} className="space-y-1.5">
                        <span className="block text-[10px] font-semibold text-slate-400 tracking-[0.12em]">{label}</span>
                        <input type="number" min={0} max={255} value={activeRgb[key]} onChange={(e) => updateRgbChannel(key, e.target.value)} className="w-full px-2 py-2 rounded-[16px] border border-slate-200 bg-white text-[12px] font-semibold text-slate-700 outline-none focus:border-slate-400" />
                      </label>
                    ))}
                  </div>
                </>
              )}
              {colorInputMode === 'hex' && (
                <>
                  <div className="text-[11px] text-slate-400">HEX 是网页显示使用的实际颜色值</div>
                  <input
                    type="text"
                    value={hexDraft}
                    onChange={(e) => setHexDraft(e.target.value.toUpperCase())}
                    onBlur={commitHexDraft}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        commitHexDraft();
                      }
                    }}
                    className="w-full px-3 py-2.5 rounded-[16px] border border-slate-200 bg-white text-[13px] font-semibold tracking-[0.08em] text-slate-700 outline-none focus:border-slate-400"
                  />
                </>
              )}
              {colorInputMode === 'cmyk' && (
                <>
                  <div className="text-[11px] leading-relaxed text-slate-400">CMYK 为网页近似预览，用于输入参考印刷数值，不等同 Illustrator 的色彩管理结果。</div>
                  <div className="grid grid-cols-4 gap-2">
                    {([['c', 'C'], ['m', 'M'], ['y', 'Y'], ['k', 'K']] as const).map(([key, label]) => (
                      <label key={key} className="space-y-1.5">
                        <span className="block text-[10px] font-semibold text-slate-400 tracking-[0.12em]">{label}</span>
                        <input type="number" min={0} max={100} value={activeCmyk[key]} onChange={(e) => updateCmykChannel(key, e.target.value)} className="w-full px-2 py-2 rounded-[16px] border border-slate-200 bg-white text-[12px] font-semibold text-slate-700 outline-none focus:border-slate-400" />
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className="rounded-[22px] bg-white/75 border border-white/90 p-1.5 shadow-[0_8px_18px_rgba(15,23,42,0.04)]">
              <div className="grid grid-cols-3 gap-1.5">
                {(Object.keys(SHAPE_STYLE_CONFIG) as ShapeStyle[]).map((styleKey) => (
                  <button
                    key={styleKey}
                    onClick={() => applyShapeStyleToArtboard(styleKey)}
                    className={`px-3 py-2.5 rounded-[18px] text-[11px] font-semibold border transition-all ${shapeStyle === styleKey ? 'bg-slate-950 text-white border-slate-950 shadow-[0_10px_24px_rgba(15,23,42,0.12)]' : 'bg-transparent text-slate-600 border-transparent hover:bg-slate-100/80'}`}
                  >
                    {SHAPE_STYLE_CONFIG[styleKey].label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center text-[10px] font-semibold text-slate-500 tracking-[0.12em]">
                <span>形态幅度</span>
                <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200">{Math.round(shapeStyleIntensity * 100)}%</span>
              </div>
              <input type="range" min={0} max={1} step={0.01} value={shapeStyleIntensity} onChange={(e) => setShapeStyleIntensity(parseFloat(e.target.value))} className="w-full h-1.5 rounded-full bg-slate-200 appearance-none cursor-pointer" />
            </div>
            {(textItems.length > 0 || selectedTextItem) && (
              <div className="rounded-[22px] bg-white/75 border border-white/90 p-3 shadow-[0_8px_18px_rgba(15,23,42,0.04)] space-y-3">
                <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-500 tracking-[0.12em]">
                  <Type className="w-3.5 h-3.5 opacity-70" />
                  <span>文字透镜</span>
                </div>
                {selectedTextItem && updateSelectedTextItem ? (
                  <>
                    <label className="space-y-1.5 block">
                      <span className="block text-[10px] font-semibold text-slate-400 tracking-[0.12em]">文字内容</span>
                      <input type="text" value={selectedTextItem.text} onChange={(e) => updateSelectedTextItem((prev) => ({ ...prev, text: e.target.value || '文字' }))} className="w-full px-3 py-2.5 rounded-[16px] border border-slate-200 bg-white text-[13px] font-semibold text-slate-700 outline-none focus:border-slate-400" />
                    </label>
                    <label className="space-y-1.5 block">
                      <span className="block text-[10px] font-semibold text-slate-400 tracking-[0.12em]">字号</span>
                      <input type="number" min={18} max={240} step={1} value={Math.round(selectedTextItem.fontSize)} onChange={(e) => updateSelectedTextItem((prev) => ({ ...prev, fontSize: Math.max(18, Math.min(240, parseInt(e.target.value || '0', 10) || 18)) }))} className="w-full px-3 py-2.5 rounded-[16px] border border-slate-200 bg-white text-[13px] font-semibold text-slate-700 outline-none focus:border-slate-400" />
                    </label>
                    <label className="space-y-1.5 block">
                      <span className="block text-[10px] font-semibold text-slate-400 tracking-[0.12em]">字体</span>
                      <select value={selectedTextItem.fontFamily} onChange={(e) => updateSelectedTextItem((prev) => ({ ...prev, fontFamily: e.target.value }))} className="w-full px-3 py-2.5 rounded-[16px] border border-slate-200 bg-white text-[13px] font-semibold text-slate-700 outline-none focus:border-slate-400">
                        {TEXT_FONT_OPTIONS.map((font) => (
                          <option key={font.label} value={font.value}>{font.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1.5 block">
                      <span className="block text-[10px] font-semibold text-slate-400 tracking-[0.12em]">文字颜色</span>
                      <div className="flex items-center gap-3 rounded-[16px] border border-slate-200 bg-white px-3 py-2.5">
                        <input
                          type="color"
                          value={selectedTextItem.color}
                          onChange={(e) => updateSelectedTextItem((prev) => ({ ...prev, color: e.target.value }))}
                          className="h-9 w-11 shrink-0 rounded-xl border border-slate-200 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={selectedTextItem.color.toUpperCase()}
                          onChange={(e) => updateSelectedTextItem((prev) => ({ ...prev, color: normalizeHex(e.target.value) }))}
                          className="flex-1 bg-transparent text-[13px] font-semibold tracking-[0.08em] text-slate-700 outline-none"
                        />
                      </div>
                    </label>
                    <label className="space-y-1.5 block">
                      <div className="flex items-center justify-between gap-3">
                        <span className="block text-[10px] font-semibold text-slate-400 tracking-[0.12em]">字重</span>
                        <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-[11px] font-semibold text-slate-500">
                          {selectedTextItem.fontWeight}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={300}
                        max={900}
                        step={100}
                        value={selectedTextItem.fontWeight}
                        onChange={(e) => updateSelectedTextItem((prev) => ({ ...prev, fontWeight: parseInt(e.target.value, 10) || 400 }))}
                        className="w-full accent-slate-900"
                      />
                    </label>
                    {[
                      { label: '文字形态', key: 'morphAmount', hint: '从原始字形逐渐过渡到更柔软、更像液体的文字轮廓。' },
                      { label: '文字模糊', key: 'roundnessAmount', hint: '让文字边缘逐渐产生更柔和的模糊晕开感。' },
                      { label: '吸附圆润', key: 'adhesionAmount', hint: '让字的细节逐渐融化并被重塑成更圆、更黏连的块面字形。' },
                    ].map((item) => (
                      <div key={item.key} className="space-y-2">
                        <div className="flex justify-between items-center text-[10px] font-semibold text-slate-500 tracking-[0.12em]">
                          <span>{item.label}</span>
                          <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200">{Math.round(((selectedTextItem[item.key as keyof typeof selectedTextItem] as number) ?? 0) * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.01}
                          value={(selectedTextItem[item.key as keyof typeof selectedTextItem] as number) ?? 0}
                          onChange={(e) => updateSelectedTextItem((prev) => ({ ...prev, [item.key]: parseFloat(e.target.value) }))}
                          className="w-full h-1.5 rounded-full bg-slate-200 appearance-none cursor-pointer"
                        />
                        <div className="text-[11px] text-slate-400 leading-relaxed">{item.hint}</div>
                      </div>
                    ))}
                  </>
                ) : (
                  <div className="text-[11px] text-slate-400">添加文字后，拖动到气泡上方即可预览局部凸透镜效果。</div>
                )}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-[10px] font-semibold text-slate-500 tracking-[0.12em]">
                    <span>折射强度</span>
                    <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200">{Math.round(textLensRange * 100)}%</span>
                  </div>
                  <input type="range" min={0} max={1} step={0.01} value={textLensRange} onChange={(e) => setTextLensRange?.(parseFloat(e.target.value))} className="w-full h-1.5 rounded-full bg-slate-200 appearance-none cursor-pointer" />
                </div>
                <div className="text-[11px] text-slate-400 leading-relaxed">仅在文字与气泡重叠的区域内，文字会出现局部放大、折射与模糊；气泡外文字保持原样。</div>
              </div>
            )}
          </div>
        </Section>

        <Section title="接触" icon={Settings2} open={sectionOpen.physics} onToggle={() => toggleSection('physics')}>
          <div className="bg-[rgba(246,247,251,0.92)] rounded-[26px] p-4 border border-white/90 space-y-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.88),0_8px_24px_rgba(15,23,42,0.04)]">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.12em] text-slate-500">
                <Link2 className="w-3.5 h-3.5 opacity-70" />
                <span>接触模式</span>
              </div>
              <div className="rounded-[22px] bg-white/75 border border-white/90 p-1.5 shadow-[0_8px_18px_rgba(15,23,42,0.04)]">
                <div className="grid grid-cols-3 gap-1.5">
                  {(Object.keys(CONTACT_MODE_CONFIG) as ContactMode[]).map((modeKey) => (
                    <button
                      key={modeKey}
                      onClick={() => setContactMode(modeKey)}
                      className={`px-3 py-2.5 rounded-[18px] text-[11px] font-semibold border transition-all ${contactMode === modeKey ? 'bg-slate-950 text-white border-slate-950 shadow-[0_10px_24px_rgba(15,23,42,0.12)]' : 'bg-transparent text-slate-600 border-transparent hover:bg-slate-100/80'}`}
                    >
                      {CONTACT_MODE_CONFIG[modeKey].label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="text-[11px] font-medium text-slate-500 leading-relaxed">{CONTACT_MODE_CONFIG[contactMode].hint}</div>
            </div>
            {contactMode === 'negative' && [
              { label: '轮廓圆润', icon: Waves, key: 'negativeRoundness', min: 0, max: 1, step: 0.01 },
              { label: '块面颗粒', icon: Sparkles, key: 'negativeGrain', min: 0, max: 1, step: 0.01 },
            ].map((item) => (
              <div key={item.key} className="space-y-2">
                <div className="flex justify-between items-center text-[10px] font-semibold text-slate-500 tracking-[0.12em]">
                  <span className="flex items-center gap-2"><item.icon className="w-3 h-3 opacity-60" /> {item.label}</span>
                  <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200">{Math.round((contactSettings[item.key as keyof ContactSettings] as number) * 100)}%</span>
                </div>
                <input type="range" min={item.min} max={item.max} step={item.step} value={contactSettings[item.key as keyof ContactSettings] as number} onChange={(e) => setContactSettings((prev) => ({ ...prev, [item.key]: parseFloat(e.target.value) }))} className="w-full h-1.5 rounded-full bg-slate-200 appearance-none cursor-pointer" />
              </div>
            ))}
            {contactMode === 'overlay' && [
              { label: '叠压模糊', icon: Waves, key: 'overlayBlur', min: 0, max: 24, step: 0.5, format: (value: number) => value.toFixed(1).replace(/\.0$/, '') },
              { label: '模糊强度', icon: Sun, key: 'overlayBlurOpacity', min: 0, max: 1, step: 0.01, format: (value: number) => `${Math.round(value * 100)}%` },
            ].map((item) => (
              <div key={item.key} className="space-y-2">
                <div className="flex justify-between items-center text-[10px] font-semibold text-slate-500 tracking-[0.12em]">
                  <span className="flex items-center gap-2"><item.icon className="w-3 h-3 opacity-60" /> {item.label}</span>
                  <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200">{item.format(contactSettings[item.key as keyof ContactSettings] as number)}</span>
                </div>
                <input type="range" min={item.min} max={item.max} step={item.step} value={contactSettings[item.key as keyof ContactSettings] as number} onChange={(e) => setContactSettings((prev) => ({ ...prev, [item.key]: parseFloat(e.target.value) }))} className="w-full h-1.5 rounded-full bg-slate-200 appearance-none cursor-pointer" />
              </div>
            ))}
            {[
              { label: '接触吸附', icon: Link2, key: 'contactSuction', min: 1, max: 45, step: 1 },
              { label: '单体吸附', icon: User, key: 'individualSuction', min: 0, max: 25, step: 1 },
              { label: '渐变深度', icon: Sliders, key: 'glowDepth', min: 0, max: 100, step: 1 },
              { label: '渐变强度', icon: Sun, key: 'gradientShade', min: 0, max: 100, step: 1 },
              { label: '边沿厚度', icon: Sliders, key: 'edgeThickness', min: 0, max: 15, step: 0.05 },
              { label: '内部柔化', icon: Waves, key: 'innerSoftness', min: 0, max: 30, step: 0.5 },
              { label: '线条抖动', icon: Waves, key: 'lineJitter', min: 0, max: 8, step: 0.1 },
              { label: '整体强度', icon: Sparkles, key: 'intensity', min: 0.5, max: 3, step: 0.05 },
              { label: '质感颗粒', icon: Waves, key: 'grain', min: 0, max: 1, step: 0.01 },
            ].map((item) => (
              <div key={item.key} className="space-y-2">
                <div className="flex justify-between items-center text-[10px] font-semibold text-slate-500 tracking-[0.12em]">
                  <span className="flex items-center gap-2"><item.icon className="w-3 h-3 opacity-60" /> {item.label}</span>
                  <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200">{typeof glowSettings[item.key as keyof GlowSettings] === 'number' ? Number(glowSettings[item.key as keyof GlowSettings]).toFixed(item.key === 'grain' ? 2 : 1).replace(/\.0$/, '') : ''}</span>
                </div>
                <input type="range" min={item.min} max={item.max} step={item.step} value={glowSettings[item.key as keyof GlowSettings] as number} onChange={(e) => setGlowSettings((prev) => ({ ...prev, [item.key]: parseFloat(e.target.value) }))} className="w-full h-1.5 rounded-full bg-slate-200 appearance-none cursor-pointer" />
              </div>
            ))}
          </div>
        </Section>

        <Section title="动态" icon={Droplets} open={sectionOpen.motion} onToggle={() => toggleSection('motion')}>
          <div className="bg-[rgba(246,247,251,0.92)] rounded-[26px] p-4 border border-white/90 space-y-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.88),0_8px_24px_rgba(15,23,42,0.04)]">
            <button onClick={() => setLiquidSettings((prev) => ({ ...prev, enabled: !prev.enabled }))} className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border transition-all ${liquidSettings.enabled ? 'bg-slate-950 text-white border-slate-950' : 'bg-white text-slate-700 border-slate-200'}`}>
              <span className="text-[11px] font-semibold tracking-wide">液体动画</span>
              <span className="text-[11px] font-semibold tracking-wide">{liquidSettings.enabled ? '开启' : '关闭'}</span>
            </button>
            <div className="rounded-[22px] bg-white/75 border border-white/90 p-1.5 shadow-[0_8px_18px_rgba(15,23,42,0.04)]">
              <div className="grid grid-cols-2 gap-1.5">
                {(Object.keys(MOTION_MODE_CONFIG) as MotionMode[]).map((modeKey) => (
                  <button
                    key={modeKey}
                    onClick={() => setLiquidSettings((prev) => ({ ...prev, mode: modeKey }))}
                    className={`px-3 py-2.5 rounded-[18px] text-[11px] font-semibold border transition-all ${liquidSettings.mode === modeKey ? 'bg-slate-950 text-white border-slate-950 shadow-[0_10px_24px_rgba(15,23,42,0.12)]' : 'bg-transparent text-slate-600 border-transparent hover:bg-slate-100/80'}`}
                  >
                    {MOTION_MODE_CONFIG[modeKey].label}
                  </button>
                ))}
              </div>
            </div>
            <div className="text-[11px] font-medium text-slate-500 leading-relaxed">{MOTION_MODE_CONFIG[liquidSettings.mode].hint}</div>
            <div className="rounded-[22px] bg-white/75 border border-white/90 p-1.5 shadow-[0_8px_18px_rgba(15,23,42,0.04)]">
              <div className="grid grid-cols-3 gap-1.5">
                {(Object.keys(IMPORT_AMPLITUDE_MODE_CONFIG) as ImportAmplitudeMode[]).map((modeKey) => (
                  <button
                    key={modeKey}
                    onClick={() => setLiquidSettings((prev) => ({ ...prev, importAmplitudeMode: modeKey }))}
                    className={`px-3 py-2 rounded-[18px] text-[10px] font-semibold border transition-all ${liquidSettings.importAmplitudeMode === modeKey ? 'bg-slate-900 text-white border-slate-900 shadow-[0_10px_24px_rgba(15,23,42,0.10)]' : 'bg-transparent text-slate-600 border-transparent hover:bg-slate-100/80'}`}
                  >
                    {IMPORT_AMPLITUDE_MODE_CONFIG[modeKey].label}
                  </button>
                ))}
              </div>
            </div>
            {[
              { label: '流动速度', icon: Wind, key: 'speed', min: 0.1, max: 5, step: 0.1 },
              { label: '粘稠程度', icon: Zap, key: 'viscosity', min: 0.1, max: 1, step: 0.05 },
              { label: '光泽强度', icon: Sparkles, key: 'glossiness', min: 0, max: 1, step: 0.05 },
              { label: '波动幅度', icon: Waves, key: 'waveScale', min: 0.1, max: 2, step: 0.1 },
            ].map((item) => (
              <div key={item.key} className="space-y-2">
                <div className="flex justify-between items-center text-[10px] font-semibold text-slate-500 tracking-[0.12em]">
                  <span className="flex items-center gap-2"><item.icon className="w-3 h-3 opacity-60" /> {item.label}</span>
                  <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200">{((liquidSettings[item.key as keyof LiquidSettings] as number) * 100).toFixed(0)}%</span>
                </div>
                <input type="range" min={item.min} max={item.max} step={item.step} value={liquidSettings[item.key as keyof LiquidSettings] as number} onChange={(e) => setLiquidSettings((prev) => ({ ...prev, [item.key]: parseFloat(e.target.value) }))} className="w-full h-1.5 rounded-full bg-slate-200 appearance-none cursor-pointer" />
              </div>
            ))}
            {selectedSingle && (
              <div className="rounded-[22px] bg-white/75 border border-white/90 p-3 shadow-[0_8px_18px_rgba(15,23,42,0.04)] space-y-3">
                <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-500 tracking-[0.12em]">
                  <Droplets className="w-3.5 h-3.5 opacity-70" />
                  <span>当前元素动态</span>
                </div>
                {[
                  { label: '单体速度', key: 'waveFactor', min: 0.4, max: 1.8, step: 0.01, value: selectedSingle.liquidProfile.waveFactor, format: (value: number) => `${Math.round(value * 100)}%` },
                  { label: '单体幅度', key: 'amplitudeFactor', min: 0.4, max: 1.8, step: 0.01, value: selectedSingle.liquidProfile.amplitudeFactor, format: (value: number) => `${Math.round(value * 100)}%` },
                  { label: '单体粘稠', key: 'viscosityFactor', min: 0.4, max: 1.6, step: 0.01, value: selectedSingle.liquidProfile.viscosityFactor, format: (value: number) => `${Math.round(value * 100)}%` },
                  { label: '单体光泽', key: 'glossFactor', min: 0.4, max: 1.6, step: 0.01, value: selectedSingle.liquidProfile.glossFactor, format: (value: number) => `${Math.round(value * 100)}%` },
                ].map((item) => (
                  <div key={item.key} className="space-y-2">
                    <div className="flex justify-between items-center text-[10px] font-semibold text-slate-500 tracking-[0.12em]">
                      <span>{item.label}</span>
                      <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200">{item.format(item.value)}</span>
                    </div>
                    <input
                      type="range"
                      min={item.min}
                      max={item.max}
                      step={item.step}
                      value={item.value}
                      onChange={(e) => {
                        const nextValue = parseFloat(e.target.value);
                        const next = elements.map((el) => (
                          el.id === selectedSingle.id
                            ? { ...el, liquidProfile: { ...el.liquidProfile, [item.key]: nextValue } }
                            : el
                        ));
                        commitElements(next);
                      }}
                      className="w-full h-1.5 rounded-full bg-slate-200 appearance-none cursor-pointer"
                    />
                  </div>
                ))}
                <div className="text-[11px] text-slate-400 leading-relaxed">只调整当前选中气泡的动态，不会影响其他素材。</div>
              </div>
            )}
          </div>
        </Section>

        <Section title="画板" icon={Layers3} open={sectionOpen.artboard} onToggle={() => toggleSection('artboard')}>
          <div className="bg-[rgba(246,247,251,0.92)] rounded-[26px] p-4 border border-white/90 space-y-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.88),0_8px_24px_rgba(15,23,42,0.04)]">
            <button onClick={() => setArtboard((prev) => ({ ...prev, clipContent: !prev.clipContent }))} className={`w-full flex items-center justify-between px-3 py-2.5 rounded-2xl border transition-all ${artboard.clipContent ? 'bg-slate-950 text-white border-slate-950' : 'bg-white text-slate-700 border-slate-200'}`}>
              <span className="text-[11px] font-semibold tracking-wide">超出画板裁切</span>
              <span className="text-[11px] font-semibold tracking-wide">{artboard.clipContent ? '开启' : '关闭'}</span>
            </button>
            <div className="flex items-center justify-between gap-3 rounded-[22px] bg-white/75 border border-white/90 p-3 shadow-[0_8px_18px_rgba(15,23,42,0.04)]">
              <div className="space-y-1">
                <div className="text-[10px] font-semibold text-slate-500 tracking-[0.12em]">画板背景色</div>
                <div className="text-[11px] text-slate-400">预览与导出会同步使用这块底色</div>
              </div>
              <div className="relative shrink-0">
                <input type="color" value={artboard.backgroundColor} onChange={(e) => applyArtboardColor(e.target.value)} className="absolute inset-0 w-11 h-11 opacity-0 cursor-pointer" />
                <div className="w-11 h-11 rounded-[16px] border-2 border-white shadow-sm" style={{ backgroundColor: artboard.backgroundColor }} />
              </div>
            </div>
            <div className="rounded-[22px] bg-white/75 border border-white/90 p-3 shadow-[0_8px_18px_rgba(15,23,42,0.04)] space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[10px] font-semibold text-slate-500 tracking-[0.12em]">背景颜色输入</div>
                <div className="rounded-[18px] bg-slate-100/90 p-1 flex items-center gap-1">
                  {([['rgb', 'RGB'], ['hex', 'HEX'], ['cmyk', 'CMYK']] as const).map(([mode, label]) => (
                    <button key={mode} onClick={() => setArtboardColorInputMode(mode)} className={`px-3 py-1.5 rounded-[14px] text-[10px] font-semibold transition-all ${artboardColorInputMode === mode ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {artboardColorInputMode === 'rgb' && (
                <>
                  <div className="text-[11px] text-slate-400">RGB 使用屏幕显示色值，范围 0 - 255</div>
                  <div className="grid grid-cols-3 gap-2">
                    {([['r', 'R'], ['g', 'G'], ['b', 'B']] as const).map(([key, label]) => (
                      <label key={key} className="space-y-1.5">
                        <span className="block text-[10px] font-semibold text-slate-400 tracking-[0.12em]">{label}</span>
                        <input type="number" min={0} max={255} value={artboardRgb[key]} onChange={(e) => updateArtboardRgbChannel(key, e.target.value)} className="w-full px-2 py-2 rounded-[16px] border border-slate-200 bg-white text-[12px] font-semibold text-slate-700 outline-none focus:border-slate-400" />
                      </label>
                    ))}
                  </div>
                </>
              )}
              {artboardColorInputMode === 'hex' && (
                <>
                  <div className="text-[11px] text-slate-400">HEX 是网页显示使用的实际颜色值</div>
                  <input
                    type="text"
                    value={artboardHexDraft}
                    onChange={(e) => setArtboardHexDraft(e.target.value.toUpperCase())}
                    onBlur={commitArtboardHexDraft}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        commitArtboardHexDraft();
                      }
                    }}
                    className="w-full px-3 py-2.5 rounded-[16px] border border-slate-200 bg-white text-[13px] font-semibold tracking-[0.08em] text-slate-700 outline-none focus:border-slate-400"
                  />
                </>
              )}
              {artboardColorInputMode === 'cmyk' && (
                <>
                  <div className="text-[11px] leading-relaxed text-slate-400">CMYK 为网页近似预览，用于输入参考印刷数值，不等同 Illustrator 的色彩管理结果。</div>
                  <div className="grid grid-cols-4 gap-2">
                    {([['c', 'C'], ['m', 'M'], ['y', 'Y'], ['k', 'K']] as const).map(([key, label]) => (
                      <label key={key} className="space-y-1.5">
                        <span className="block text-[10px] font-semibold text-slate-400 tracking-[0.12em]">{label}</span>
                        <input type="number" min={0} max={100} value={artboardCmyk[key]} onChange={(e) => updateArtboardCmykChannel(key, e.target.value)} className="w-full px-2 py-2 rounded-[16px] border border-slate-200 bg-white text-[12px] font-semibold text-slate-700 outline-none focus:border-slate-400" />
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>
            {[
              { key: 'width', label: '宽度', min: 400, max: 4000 },
              { key: 'height', label: '高度', min: 400, max: 4000 },
            ].map((item) => {
              const pixelValue = artboard[item.key as keyof ArtboardSettings] as number;
              const draftValue = artboardSizeDrafts[item.key as 'width' | 'height'];
              return (
                <div key={item.key} className="space-y-2">
                  <div className="flex justify-between items-center text-[10px] font-semibold text-slate-500 tracking-[0.12em]">
                    <span>{item.label}</span>
                    <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200">{pixelsToMillimeters(pixelValue).toFixed(1)} mm</span>
                  </div>
                  <label className="space-y-1 block">
                    <span className="block text-[10px] font-semibold text-slate-400 tracking-[0.12em]">MM</span>
                    <input
                      type="number"
                      min={pixelsToMillimeters(item.min)}
                      max={pixelsToMillimeters(item.max)}
                      step={0.1}
                      value={draftValue}
                      onChange={(e) => updateArtboardSizeDraft(item.key as 'width' | 'height', e.target.value)}
                      onBlur={() => commitArtboardSizeDraft(item.key as 'width' | 'height', item.min, item.max)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          commitArtboardSizeDraft(item.key as 'width' | 'height', item.min, item.max);
                        }
                      }}
                      className="w-full px-3 py-2.5 rounded-[16px] border border-slate-200 bg-white text-[13px] font-semibold text-slate-700 outline-none focus:border-slate-400"
                    />
                  </label>
                </div>
              );
            })}
            <button onClick={fitViewToArtboard} className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-2xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-sm transition-all">
              <Target className="w-4 h-4" />
              <span className="text-[11px] font-semibold tracking-wide">适配到画板</span>
            </button>
          </div>
        </Section>
      </div>
    </aside>
  );
});

export default InspectorPanel;
