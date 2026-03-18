import React, { memo } from 'react';

const BubbleMark = memo(function BubbleMark({ className = 'w-11 h-11' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="bubble-mark-fill" x1="14" y1="10" x2="52" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#dff5ff" />
          <stop offset="0.5" stopColor="#90d8ff" />
          <stop offset="1" stopColor="#4db4ff" />
        </linearGradient>
      </defs>
      <path d="M24 14C15.16 14 8 21.16 8 30s7.16 16 16 16c4.33 0 8.27-1.72 11.16-4.52a5.2 5.2 0 0 1 1.77-1.13c6.41-2.08 11.07-8.1 11.07-15.22C48 18.97 42.63 14 36 14c-3.12 0-6.02 1.1-8.3 2.96A14.8 14.8 0 0 0 24 14Z" fill="url(#bubble-mark-fill)" />
      <path d="M24 14C15.16 14 8 21.16 8 30s7.16 16 16 16c4.33 0 8.27-1.72 11.16-4.52a5.2 5.2 0 0 1 1.77-1.13c6.41-2.08 11.07-8.1 11.07-15.22C48 18.97 42.63 14 36 14c-3.12 0-6.02 1.1-8.3 2.96A14.8 14.8 0 0 0 24 14Z" stroke="#0f172a" strokeOpacity="0.08" />
      <circle cx="22" cy="24" r="4.5" fill="#ffffff" fillOpacity="0.58" />
      <circle cx="40.5" cy="18.5" r="2.5" fill="#ffffff" fillOpacity="0.5" />
    </svg>
  );
});

export default BubbleMark;
