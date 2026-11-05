import { i18n } from '#i18n';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/** A label lengthening the way a translation does (pseudo-locale filler after the original). */
const FINAL = 'Save changes Šåṽé çĥåñĝéš';
const START = 'Save';
const BOX = { x: 16, y: 14, width: 116, height: 34 };
const TEXT_X = BOX.x + 12;
/** Overflow is clipped at the box edge; the label starts after the padding. */
const EDGE = BOX.x + BOX.width;
const HAS = EDGE - TEXT_X;
const STEP_MS = 55;
const BAR = { y: 72, width: 248 };

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * The home screen's one authored moment: a button label grows past its box,
 * a crop mark lands on the edge, and the measure bar shows what it now needs.
 * Plays once. SVG, so the panel's own stress test leaves it alone.
 */
export function OverflowDemo() {
  const [length, setLength] = useState(() => (reducedMotion() ? FINAL.length : START.length));
  const [textWidth, setTextWidth] = useState(0);
  const textRef = useRef<SVGTextElement>(null);
  const text = FINAL.slice(0, length);

  useEffect(() => {
    if (length >= FINAL.length) return;
    const timer = setTimeout(
      () => {
        setLength((current) => current + 1);
      },
      length === START.length ? 500 : STEP_MS,
    );
    return () => {
      clearTimeout(timer);
    };
  }, [length]);

  useLayoutEffect(() => {
    setTextWidth(textRef.current?.getComputedTextLength() ?? 0);
  }, [text]);

  const needs = Math.round(textWidth);
  const overflow = Math.max(0, needs - HAS);
  const span = Math.max(HAS, needs, 1);
  const hasWidth = (HAS / span) * BAR.width;
  const needsWidth = (needs / span) * BAR.width;

  return (
    <svg
      viewBox="0 0 280 104"
      className="w-full max-w-[280px]"
      role="img"
      aria-label={i18n.t('home.demoLabel')}
    >
      <defs>
        <pattern
          id="os-bleed"
          width="5"
          height="5"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line x1="0" y1="0" x2="0" y2="5" className="stroke-critical" strokeWidth="1.5" />
        </pattern>
        <clipPath id="os-inside">
          <rect x={BOX.x} y={BOX.y} width={BOX.width} height={BOX.height} />
        </clipPath>
        <clipPath id="os-outside">
          <rect x={EDGE} y={0} width={400} height={64} />
        </clipPath>
      </defs>

      {/* The button, and its label inside and past the edge */}
      <rect
        x={BOX.x}
        y={BOX.y}
        width={BOX.width}
        height={BOX.height}
        rx="6"
        className="fill-surface stroke-line-strong"
        strokeWidth="1"
      />
      {overflow > 0 && (
        <rect
          x={EDGE}
          y={BOX.y + 6}
          width={overflow + 2}
          height={BOX.height - 12}
          fill="url(#os-bleed)"
          opacity="0.35"
        />
      )}
      <text
        ref={textRef}
        x={TEXT_X}
        y={BOX.y + 22}
        className="fill-fg font-sans text-[13px] font-medium"
        clipPath="url(#os-inside)"
      >
        {text}
      </text>
      <text
        x={TEXT_X}
        y={BOX.y + 22}
        className="fill-fg-muted font-sans text-[13px] font-medium"
        clipPath="url(#os-outside)"
        aria-hidden="true"
      >
        {text}
      </text>
      {overflow > 0 && (
        <g className="stroke-critical" strokeWidth="1.5" strokeLinecap="round">
          <line x1={EDGE} y1={BOX.y - 6} x2={EDGE} y2={BOX.y + BOX.height + 6} />
          <line x1={EDGE - 4} y1={BOX.y - 6} x2={EDGE + 4} y2={BOX.y - 6} />
          <line
            x1={EDGE - 4}
            y1={BOX.y + BOX.height + 6}
            x2={EDGE + 4}
            y2={BOX.y + BOX.height + 6}
          />
        </g>
      )}

      {/* The measure bar: the box, then the bleed past its end */}
      <rect x={BOX.x} y={BAR.y} width={BAR.width} height="6" rx="1" className="fill-surface" />
      <rect x={BOX.x} y={BAR.y} width={hasWidth} height="6" rx="1" className="fill-fg/20" />
      <line
        x1={BOX.x + hasWidth}
        y1={BAR.y - 2}
        x2={BOX.x + hasWidth}
        y2={BAR.y + 8}
        className="stroke-fg"
        strokeWidth="1.5"
      />
      {needsWidth > hasWidth && (
        <rect
          x={BOX.x + hasWidth}
          y={BAR.y}
          width={needsWidth - hasWidth}
          height="6"
          fill="url(#os-bleed)"
        />
      )}
      <text x={BOX.x} y={BAR.y + 22} className="fill-fg-muted font-mono text-[10px]">
        {i18n.t('detail.has', [`${String(HAS)} px`])}
      </text>
      {overflow > 0 && (
        <text
          x={BOX.x + BAR.width}
          y={BAR.y + 22}
          textAnchor="end"
          className="fill-critical font-mono text-[10px] font-semibold"
        >
          {i18n.t('detail.short', [`${String(overflow)} px`])}
        </text>
      )}
    </svg>
  );
}
