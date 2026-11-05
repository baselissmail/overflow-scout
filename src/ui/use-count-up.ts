import { useEffect, useRef, useState } from 'react';

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Counts up to `value` when it first arrives (results "landing"), then follows
 * it exactly. Skipped under reduced motion.
 */
export function useCountUp(value: number, durationMs = 420): number {
  const [shown, setShown] = useState(() => (reducedMotion() ? value : 0));
  const started = useRef(false);

  useEffect(() => {
    if (started.current || reducedMotion() || value === 0) {
      started.current = true;
      setShown(value);
      return;
    }
    started.current = true;
    const start = performance.now();
    let frame = requestAnimationFrame(function step(now) {
      const progress = Math.min(1, (now - start) / durationMs);
      const eased = 1 - (1 - progress) ** 3;
      setShown(Math.round(value * eased));
      if (progress < 1) frame = requestAnimationFrame(step);
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [value, durationMs]);

  return shown;
}
