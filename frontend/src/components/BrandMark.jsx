// Codegard brand mark - the C and G monogram.
//
// The outline is the source artwork measured edge by edge: circular arcs where
// the letters are round, straight lines where the G is cut, and the corners
// where those two meet. The counters are holes in the same path (even-odd), so
// whatever is behind the mark shows through them and there is no plate under
// the letters.
//
// The colour comes from `currentColor`, the height from `size`; the width
// follows the artwork, which is wider than it is tall.

const RATIO = 100 / 86.66;

const D =
  'M38.62 0.0A42.6 42.6 0 0 0 0.27 47.29A41.27 41.27 0 0 0 59.21 81.87A38.93 38.93 0 0 0 71.83 70.95A1.58 1.58 0 0 0 72.05 70.45A48.0 48.0 0 0 0 72.07 65.11A9.87 9.87 0 0 0 71.94 61.76L58.83 61.76A21.36 21.36 0 0 1 25.33 64.08A29.46 29.46 0 0 1 29.14 19.04A42.69 42.69 0 0 1 33.67 12.06L33.86 11.6L38.81 6.47A46.52 46.52 0 0 1 46.36 0.82A0.61 0.61 0 0 0 46.77 0.41A6.53 6.53 0 0 0 44.46 0.04L38.62 0.04ZM68.5 0.07A39.75 39.75 0 0 0 44.11 9.98A16.05 16.05 0 0 0 43.34 10.65L38.16 16.36A46.46 46.46 0 0 0 34.56 64.31A15.75 15.75 0 0 0 51.6 62.46A6.35 6.35 0 0 0 50.24 60.23A29.22 29.22 0 0 1 55.96 19.62A29.49 29.49 0 0 1 75.65 15.27L80.65 15.27C81.43 15.26 82.45 15.09 83.3 15.41L83.3 24.3L100.0 24.3L100.0 0.11L68.5 0.11ZM56.81 35.6L56.65 36.08L56.65 51.04L83.3 51.04L83.3 71.13A15.35 15.35 0 0 1 78.01 71.36A1.41 1.41 0 0 0 77.5 71.48A10.07 10.07 0 0 0 75.59 73.84A51.01 51.01 0 0 1 72.82 77.22L68.71 81.13A53.01 53.01 0 0 1 62.75 85.38A58.2 58.2 0 0 0 77.71 86.6L97.97 86.6C98.59 86.6 99.35 86.73 99.9 86.41L99.9 35.87L56.81 35.87Z';

export default function BrandMark({ size = 26, ...props }) {
  return (
    <svg
      width={size * RATIO}
      height={size}
      viewBox="0 0 100 86.66"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      style={{ display: 'block' }}
      {...props}
    >
      <path fillRule="evenodd" d={D} />
    </svg>
  );
}
