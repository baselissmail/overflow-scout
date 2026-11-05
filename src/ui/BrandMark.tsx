/**
 * The mark: print crop marks around a line of text that runs past its frame.
 * Authored SVG in one stroke weight; color comes from `currentColor`.
 */
export function BrandMark({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M1.75 5V1.75H5M13 1.75h3.25V5M1.75 13v3.25H5M13 16.25h3.25V13" />
      <path d="M4.5 9h9" />
      <path d="M13.5 9h3.25" strokeDasharray="1 1.5" />
    </svg>
  );
}
