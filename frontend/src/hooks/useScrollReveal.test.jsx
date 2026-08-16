import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

import { useScrollReveal } from './useScrollReveal';

// The stub from test/setup.js keeps every observer it makes, so a test can fire
// the callback itself. The newest one is the hook's.
const lastObserver = () =>
  IntersectionObserver.instances[IntersectionObserver.instances.length - 1];

// The hook takes the scroll area as a value, not a ref, so it is handed a node
// the same way the page hands it one.
function Harness({ container }) {
  useScrollReveal(container);
  return null;
}

describe('useScrollReveal', () => {
  let container;
  let target;

  beforeEach(() => {
    IntersectionObserver.instances.length = 0;
    container = document.createElement('div');
    target = document.createElement('div');
    target.className = 'rv';
    container.appendChild(target);
    document.body.appendChild(container);
  });

  it('reveals an element the first time it comes into view', () => {
    render(<Harness container={container} />);
    lastObserver().emit(true, { target });
    expect(target).toHaveClass('in');
  });

  it('arms it again once it has dropped below the view', () => {
    render(<Harness container={container} />);
    const observer = lastObserver();

    observer.emit(true, { target });
    observer.emit(false, { target, boundingClientRect: { top: 900 } });

    expect(target).not.toHaveClass('in');
  });

  it('leaves what has gone off the top alone, so scrolling up stays still', () => {
    render(<Harness container={container} />);
    const observer = lastObserver();

    observer.emit(true, { target });
    observer.emit(false, { target, boundingClientRect: { top: -400 } });

    expect(target).toHaveClass('in');
  });

  it('keeps watching, so a second pass down plays like the first', () => {
    render(<Harness container={container} />);
    const observer = lastObserver();

    observer.emit(true, { target });
    observer.emit(false, { target, boundingClientRect: { top: 900 } });
    observer.emit(true, { target });

    expect(target).toHaveClass('in');
  });
});
