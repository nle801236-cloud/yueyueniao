import { useEffect, useState } from 'react';

export const useAnimationTime = (enabled: boolean, fps = 30) => {
  const [time, setTime] = useState(0);

  useEffect(() => {
    if (!enabled) return undefined;
    let frame = 0;
    let last = 0;
    const minDelta = 1000 / fps;
    const loop = (t: number) => {
      if (t - last >= minDelta) {
        setTime(t / 1000);
        last = t;
      }
      frame = window.requestAnimationFrame(loop);
    };
    frame = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(frame);
  }, [enabled, fps]);

  return time;
};
