import React, { memo } from 'react';
import { Download, Maximize2, Pencil, Redo2, Trash2, Undo2 } from 'lucide-react';

import type { ToolbarProps } from '../types';

const Toolbar = memo(function Toolbar({
  historyIndex,
  historyLength,
  isBrushMode,
  setIsBrushMode,
  isEditMode,
  setIsEditMode,
  setBrushPoints,
  setIsDrawingBrush,
  selectedIds,
  hasTextSelection,
  hasReferenceImageSelection,
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
  redo,
  setSelectedIds,
}: ToolbarProps) {
  return (
    <header className="h-[78px] bg-white/80 backdrop-blur-2xl border-b border-white/70 px-6 md:px-8 flex justify-between items-center z-20 gap-4 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 rounded-[22px] bg-white/76 border border-white/90 px-2.5 py-2 shadow-[0_10px_26px_rgba(15,23,42,0.04)]">
          <button onClick={undo} disabled={historyIndex === 0} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-900 transition-all disabled:opacity-20" title="撤销 (Ctrl+Z)">
            <Undo2 className="w-5 h-5" />
          </button>
          <button onClick={redo} disabled={historyIndex >= historyLength - 1} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-900 transition-all disabled:opacity-20" title="返回 (Shift+Ctrl+Z)">
            <Redo2 className="w-5 h-5" />
          </button>
          <div className="w-px h-5 bg-slate-200 mx-1" />
          <div className="hidden md:flex flex-col pr-2">
            <span className="text-[11px] font-semibold tracking-[0.12em] text-slate-400">画布工具</span>
            <span className="text-sm text-slate-500">绘制、编辑、层级、导出</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap justify-end">
        <div className="flex items-center gap-1.5 rounded-[22px] bg-white/76 border border-white/90 p-1.5 shadow-[0_10px_26px_rgba(15,23,42,0.04)]">
          <button onClick={() => { setIsBrushMode((prev) => !prev); setIsEditMode(false); setBrushPoints([]); setIsDrawingBrush(false); }} className={`flex items-center gap-2 px-4 py-2.5 rounded-[18px] text-[11px] font-semibold tracking-wide transition-all border ${isBrushMode ? 'bg-slate-950 text-white border-slate-950 shadow-[0_12px_30px_rgba(15,23,42,0.14)]' : 'bg-transparent text-slate-600 border-transparent hover:bg-slate-100/80'}`}>
            <Pencil className="w-4 h-4" />
            {isBrushMode ? '绘图中...' : '画笔工具'}
          </button>
          <button onClick={() => { setIsEditMode((prev) => !prev); setIsBrushMode(false); setIsDrawingBrush(false); setBrushPoints([]); if (!isEditMode) setSelectedIds((prev) => prev.slice(0, 1)); }} className={`flex items-center gap-2 px-4 py-2.5 rounded-[18px] text-[11px] font-semibold tracking-wide transition-all border ${isEditMode ? 'bg-slate-950 text-white border-slate-950 shadow-[0_12px_30px_rgba(15,23,42,0.14)]' : 'bg-transparent text-slate-600 border-transparent hover:bg-slate-100/80'}`}>
            <Maximize2 className="w-4 h-4" />
            {isEditMode ? '退出编辑' : '曲率编辑'}
          </button>
          <button onClick={moveSelectedBackward} disabled={selectedIds.length === 0 && !hasTextSelection && !hasReferenceImageSelection} className="px-3 py-2.5 rounded-[18px] text-[11px] font-semibold tracking-wide border bg-transparent text-slate-600 border-transparent hover:bg-slate-100/80 disabled:opacity-30">
            下移
          </button>
          <button onClick={moveSelectedForward} disabled={selectedIds.length === 0 && !hasTextSelection && !hasReferenceImageSelection} className="px-3 py-2.5 rounded-[18px] text-[11px] font-semibold tracking-wide border bg-transparent text-slate-600 border-transparent hover:bg-slate-100/80 disabled:opacity-30">
            上移
          </button>
          <button onClick={deleteSelectedElements} disabled={selectedIds.length === 0 && !hasTextSelection && !hasReferenceImageSelection} className="p-2 text-red-500 rounded-[18px] hover:bg-red-50 transition-all disabled:opacity-20" title="删除">
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
        <div className="flex bg-slate-950 rounded-[22px] p-1.5 shadow-[0_12px_30px_rgba(15,23,42,0.18)] items-center gap-1">
          <button onClick={downloadPNG} className="flex items-center gap-2 px-3 py-1.5 text-white/90 text-[10px] font-semibold tracking-[0.12em] hover:text-white">
            <Download className="w-3 h-3" />
            导出 PNG
          </button>
          <select
            value={pngExportScale}
            onChange={(e) => setPngExportScale(parseFloat(e.target.value))}
            className="px-2 py-1 rounded-lg border border-white/10 bg-white/10 text-[10px] font-black text-white/90"
            title="PNG 导出倍率"
          >
            {[1, 1.5, 2, 3, 4, 6].map((scale) => (
              <option key={scale} value={scale}>{scale}x</option>
            ))}
          </select>
          <div className="px-2 text-[9px] font-semibold tracking-[0.12em] text-white/45 whitespace-nowrap border-r border-white/10">
            {pngOutputWidth} x {pngOutputHeight}
          </div>
          <button onClick={downloadTransparentGif} disabled={isExportingGif} className="flex items-center gap-2 px-3 py-1.5 text-white/90 text-[10px] font-semibold tracking-[0.12em] hover:text-white disabled:opacity-50">
            导出 GIF
          </button>
          <select
            value={gifExportScale}
            onChange={(e) => setGifExportScale(parseFloat(e.target.value))}
            className="px-2 py-1 rounded-lg border border-white/10 bg-white/10 text-[10px] font-black text-white/90"
            title="GIF 导出倍率"
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
          <div className="px-2 text-[9px] font-semibold tracking-[0.12em] text-white/45 whitespace-nowrap">
            {gifOutputWidth} x {gifOutputHeight}
          </div>
        </div>
      </div>
    </header>
  );
});

export default Toolbar;
