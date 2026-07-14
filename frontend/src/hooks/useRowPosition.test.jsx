import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { useRef } from 'react';

import { useRowPosition } from './useRowPosition';

// The stub from src/test/setup.js records every observer it constructs and lets
// a test fire its callback with a hand-made entry. The observer fires outside
// React, so wrap it in act() for the resulting state change to land.
const IO = globalThis.IntersectionObserver;
const emit = (...args) =>
  act(() => IO.instances[IO.instances.length - 1].emit(...args));

// An entry for a row that is off screen, on the given side of the root.
const offScreen = (side) => ({
  boundingClientRect: { top: side === 'above' ? -400 : 900 },
  rootBounds: { top: 0 },
});

function Harness({ present = true }) {
  const rootRef = useRef(null);
  const [position, rowRef] = useRowPosition(rootRef);
  return (
    <div ref={rootRef}>
      {present && <div ref={rowRef} data-testid="row" />}
      <span data-testid="pos">{position}</span>
    </div>
  );
}

const position = () => screen.getByTestId('pos').textContent;

beforeEach(() => {
  IO.instances.length = 0;
});

describe('useRowPosition', () => {
  it('reads as below and observes nothing when the row is not rendered', () => {
    render(<Harness present={false} />);

    expect(IO.instances).toHaveLength(0);
    expect(position()).toBe('below');
  });

  it('reads as visible while the row is on screen', () => {
    render(<Harness />);

    emit(true);
    expect(position()).toBe('visible');
  });

  it('reads as above once the row has scrolled off the top', () => {
    render(<Harness />);

    emit(false, offScreen('above'));
    expect(position()).toBe('above');
  });

  it('reads as below while the row is still further down', () => {
    render(<Harness />);

    emit(false, offScreen('below'));
    expect(position()).toBe('below');
  });

  it('falls back to below when the row disappears from the list', () => {
    const { rerender } = render(<Harness />);
    emit(false, offScreen('above'));
    expect(position()).toBe('above');

    // A tier filter can drop your row out of the results entirely.
    rerender(<Harness present={false} />);
    expect(position()).toBe('below');
  });
});
