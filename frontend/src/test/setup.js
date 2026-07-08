import '@testing-library/jest-dom';

// jsdom has no IntersectionObserver, but useInfiniteScroll constructs one, so a
// mounting test would crash without a stand-in. This stub records each instance
// so a test can fire its callback (simulate the sentinel scrolling into view);
// tests that don't care just get harmless no-ops.
class IntersectionObserverStub {
  constructor(callback, options = {}) {
    this.callback = callback;
    this.options = options;
    this.observed = new Set();
    IntersectionObserverStub.instances.push(this);
  }

  observe(node) {
    this.observed.add(node);
  }

  unobserve(node) {
    this.observed.delete(node);
  }

  disconnect() {
    this.observed.clear();
  }

  // Test helper: pretend the observed target crossed the threshold.
  emit(isIntersecting = true) {
    this.callback([{ isIntersecting }], this);
  }
}
IntersectionObserverStub.instances = [];

globalThis.IntersectionObserver = IntersectionObserverStub;
