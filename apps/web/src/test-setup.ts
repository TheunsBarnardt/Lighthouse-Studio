// Polyfill ResizeObserver — jsdom does not implement it, but Radix UI components require it.
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
