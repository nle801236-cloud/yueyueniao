import React, { memo, useMemo } from 'react';
import {
  ChevronRight,
  FileCode,
  Image as ImageIcon,
  LayoutGrid,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  Type,
  Wand2,
} from 'lucide-react';

import { PRESET_DATA } from '../constants';
import type { SidebarProps } from '../types';
import BubbleMark from './BubbleMark';
import Section from './Section';

type SidebarPanelProps = Pick<
  SidebarProps,
  | 'activeColor'
  | 'selectedIds'
  | 'elements'
  | 'rerandomizeLiquidProfiles'
  | 'fitViewToArtboard'
  | 'shapeStyleIntensity'
  | 'addElement'
  | 'sectionOpen'
  | 'toggleSection'
  | 'collapsedSidebar'
  | 'setCollapsedSidebar'
  | 'fillCanvas'
  | 'createNewPage'
  | 'saveDraftAndCreateNewPage'
  | 'drafts'
  | 'openDraft'
  | 'deleteDraft'
  | 'referenceImages'
  | 'selectedTextId'
  | 'selectedReferenceImageId'
  | 'orderedSceneItems'
  | 'selectSceneItem'
  | 'referenceImageInputRef'
  | 'handleReferenceImageUpload'
  | 'fileInputRef'
  | 'handleFileUpload'
  | 'addTextElement'
> & {
  getPresetPreviewPath: (path: string, name: string) => string;
};

const Sidebar = memo(function Sidebar({
  activeColor,
  selectedIds,
  elements,
  rerandomizeLiquidProfiles,
  fitViewToArtboard,
  shapeStyleIntensity,
  addElement,
  sectionOpen,
  toggleSection,
  collapsedSidebar,
  setCollapsedSidebar,
  fillCanvas,
  createNewPage,
  saveDraftAndCreateNewPage,
  drafts,
  openDraft,
  deleteDraft,
  referenceImages,
  selectedTextId,
  selectedReferenceImageId,
  orderedSceneItems,
  selectSceneItem,
  referenceImageInputRef,
  handleReferenceImageUpload,
  fileInputRef,
  handleFileUpload,
  addTextElement,
  getPresetPreviewPath,
}: SidebarPanelProps) {
  const presetPreviewPaths = useMemo(() => (
    PRESET_DATA.reduce<Record<string, string>>((acc, shape) => {
      acc[shape.name] = getPresetPreviewPath(shape.path, shape.name);
      return acc;
    }, {})
  ), [getPresetPreviewPath, shapeStyleIntensity]);

  return (
    <aside className={`${collapsedSidebar ? 'w-[84px]' : 'w-[320px]'} h-full bg-white/88 backdrop-blur-2xl border border-white/70 rounded-[30px] z-30 flex flex-col shadow-[0_24px_80px_rgba(15,23,42,0.10)] overflow-y-auto transition-all duration-200`}>
      <div className={`p-5 border-b border-slate-100/80 flex items-center ${collapsedSidebar ? 'justify-center' : 'gap-4'}`}>
        <div className="w-12 h-12 rounded-[20px] bg-[#eef7ff] border border-white shadow-[0_10px_24px_rgba(148,163,184,0.12)] flex items-center justify-center">
          <BubbleMark className="w-10 h-10" />
        </div>
        {!collapsedSidebar && (
          <>
            <div className="flex-1 min-w-0">
              <h1 className="text-[22px] font-semibold tracking-tight text-slate-950 leading-none mb-1">Bubble Studio</h1>
              <span className="text-[11px] font-medium text-slate-400 tracking-wide">创建面板</span>
            </div>
            <button onClick={() => setCollapsedSidebar(true)} className="p-2 rounded-xl hover:bg-slate-100/80 text-slate-500"><PanelLeftClose className="w-4 h-4" /></button>
          </>
        )}
        {collapsedSidebar && <button onClick={() => setCollapsedSidebar(false)} className="absolute top-5 left-[72px] p-2 rounded-xl bg-white border border-slate-200 shadow-sm text-slate-500"><PanelLeftOpen className="w-4 h-4" /></button>}
      </div>

      {collapsedSidebar ? (
        <div className="p-3 flex flex-col items-center gap-3">
          {[Wand2, FileCode, Sparkles, LayoutGrid].map((Icon, index) => (
            <button key={index} onClick={() => setCollapsedSidebar(false)} className="w-11 h-11 rounded-2xl border border-slate-200 hover:bg-slate-100 text-slate-600 flex items-center justify-center">
              <Icon className="w-4 h-4" />
            </button>
          ))}
        </div>
      ) : (
        <div className="p-5 space-y-6 flex-1">
          <div className="rounded-[26px] bg-[rgba(246,247,251,0.92)] border border-white/90 p-4 space-y-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_8px_24px_rgba(15,23,42,0.04)]">
            <div>
              <div className="text-[11px] font-semibold tracking-[0.12em] text-slate-400 mb-2">工作区</div>
              <div className="text-sm text-slate-500 leading-6">
                当前 <span className="font-semibold text-slate-900">{elements.length}</span> 个气泡
                <br />
                已选择 <span className="font-semibold text-slate-900">{selectedIds.length}</span> 个对象
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={fillCanvas} className="px-3 py-3 rounded-2xl bg-slate-950 text-white text-[11px] font-semibold tracking-wide shadow-[0_12px_30px_rgba(15,23,42,0.16)]">一键填充</button>
              <button onClick={fitViewToArtboard} className="px-3 py-3 rounded-2xl bg-white/92 text-slate-700 text-[11px] font-semibold tracking-wide border border-slate-200/90 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">适配画板</button>
              <button onClick={rerandomizeLiquidProfiles} className="px-3 py-3 rounded-2xl bg-white/92 text-slate-700 text-[11px] font-semibold tracking-wide border border-slate-200/90 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">液体随机</button>
              <button onClick={() => fileInputRef.current?.click()} className="px-3 py-3 rounded-2xl bg-white/92 text-slate-700 text-[11px] font-semibold tracking-wide border border-slate-200/90 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">导入 SVG</button>
              <button onClick={() => referenceImageInputRef.current?.click()} className="col-span-2 px-3 py-3 rounded-2xl bg-white/92 text-slate-700 text-[11px] font-semibold tracking-wide border border-slate-200/90 shadow-[0_10px_24px_rgba(15,23,42,0.04)] flex items-center justify-center gap-2">
                <ImageIcon className="w-4 h-4" />
                导入参考图
              </button>
              <button onClick={addTextElement} className="col-span-2 px-3 py-3 rounded-2xl bg-white/92 text-slate-700 text-[11px] font-semibold tracking-wide border border-slate-200/90 shadow-[0_10px_24px_rgba(15,23,42,0.04)] flex items-center justify-center gap-2">
                <Type className="w-4 h-4" />
                添加文字
              </button>
              <button onClick={createNewPage} className="px-3 py-3 rounded-2xl bg-white/92 text-slate-700 text-[11px] font-semibold tracking-wide border border-slate-200/90 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
                新建页面
              </button>
              <button onClick={saveDraftAndCreateNewPage} className="px-3 py-3 rounded-2xl bg-white/92 text-slate-700 text-[11px] font-semibold tracking-wide border border-slate-200/90 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
                另存草稿
              </button>
            </div>
            {drafts.length > 0 && (
              <div className="space-y-2 pt-1">
                <div className="text-[11px] font-semibold tracking-[0.12em] text-slate-400">本地草稿</div>
                <div className="space-y-2">
                  {drafts.slice(0, 5).map((draft) => (
                    <div key={draft.id} className="flex items-center gap-2 rounded-2xl border border-slate-200/90 bg-white/92 px-3 py-2 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
                      <button onClick={() => openDraft(draft.id)} className="flex-1 min-w-0 text-left">
                        <div className="truncate text-[12px] font-semibold text-slate-700">{draft.name}</div>
                        <div className="text-[10px] text-slate-400">{draft.createdAt}</div>
                      </button>
                      <button onClick={() => deleteDraft(draft.id)} className="shrink-0 text-[10px] font-semibold text-slate-400 hover:text-slate-700">
                        删除
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {(referenceImages.length > 0 || orderedSceneItems.length > 0) && (
              <div className="space-y-2 pt-1">
                <div className="text-[11px] font-semibold tracking-[0.12em] text-slate-400">图层</div>
                <div className="space-y-2">
                  {[...referenceImages].sort((a, b) => a.layerOrder - b.layerOrder || a.id - b.id).map((item) => (
                    <button
                      key={`ref-layer-${item.id}`}
                      onClick={() => selectSceneItem({ kind: 'referenceImage', id: item.id, layerOrder: item.layerOrder })}
                      className={`w-full flex items-center justify-between rounded-2xl border px-3 py-2 text-left shadow-[0_10px_24px_rgba(15,23,42,0.04)] ${selectedReferenceImageId === item.id ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200/90 bg-white/92 text-slate-700'}`}
                    >
                      <span className="truncate text-[12px] font-semibold">参考图 · {item.name}</span>
                      <span className="text-[10px] opacity-70">底层</span>
                    </button>
                  ))}
                  {[...orderedSceneItems].sort((a, b) => b.layerOrder - a.layerOrder || b.id - a.id).map((item) => {
                    const isText = item.kind === 'text';
                    const isSelected = item.kind === 'element' ? selectedIds.includes(item.id) : selectedTextId === item.id;
                    const label = isText ? `文字 · ${item.id}` : `气泡 · ${elements.find((element) => element.id === item.id)?.name || item.id}`;
                    return (
                      <button
                        key={`${item.kind}-${item.id}`}
                        onClick={() => selectSceneItem(item)}
                        className={`w-full flex items-center justify-between rounded-2xl border px-3 py-2 text-left shadow-[0_10px_24px_rgba(15,23,42,0.04)] ${isSelected ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200/90 bg-white/92 text-slate-700'}`}
                      >
                        <span className="truncate text-[12px] font-semibold">{label}</span>
                        <span className="text-[10px] opacity-70">{isText ? '文字' : '气泡'}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".svg" className="hidden" />
            <input type="file" ref={referenceImageInputRef} onChange={handleReferenceImageUpload} accept=".png,.jpg,.jpeg,image/png,image/jpeg" className="hidden" />
          </div>

          <Section title="预设素材" icon={LayoutGrid} open={sectionOpen.library} onToggle={() => toggleSection('library')}>
            <div className="grid grid-cols-1 gap-2 pb-6">
              {PRESET_DATA.map((shape) => (
                <button key={shape.name} onClick={() => addElement(shape.path, shape.name)} className="group flex items-center justify-between p-3 rounded-2xl hover:bg-slate-950 hover:text-white transition-all border border-slate-100/90 bg-white/92 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-slate-50/90 flex items-center justify-center">
                      <svg viewBox="-50 -50 100 100" className="w-5 h-5"><path d={presetPreviewPaths[shape.name] || shape.path} fill={activeColor} stroke="none" /></svg>
                    </div>
                    <span className="text-sm font-medium tracking-tight">{shape.name}</span>
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

export default Sidebar;
