import React, { memo } from 'react';
import { ChevronRight } from 'lucide-react';

import type { SectionComponentProps } from '../types';

const Section = memo(function Section({
  title,
  icon: Icon,
  open,
  onToggle,
  children,
}: SectionComponentProps) {
  return (
    <section className="space-y-3">
      <button onClick={onToggle} className="w-full flex items-center justify-between gap-2 text-slate-500 hover:text-slate-900 transition-colors">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4" />
          <h3 className="text-[11px] font-semibold tracking-[0.08em] text-slate-500">{title}</h3>
        </div>
        <ChevronRight className={`w-4 h-4 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && children}
    </section>
  );
});

export default Section;
