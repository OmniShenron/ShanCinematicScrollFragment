export const clamp01 = (value) => Math.max(0, Math.min(1, value));

// Kept for back-compat
export const easeOutCubic = (t) => {
  const x = clamp01(t);
  return 1 - Math.pow(1 - x, 3);
};

// Slow ignition → mid burst → graceful trail — cinematic feel
export const easeInOutQuart = (t) => {
  const x = clamp01(t);
  return x < 0.5 ? 8 * x * x * x * x : 1 - Math.pow(-2 * x + 2, 4) / 2;
};

// Snap → long exponential coast — ideal for rotation tumble
export const easeOutExpo = (t) => {
  const x = clamp01(t);
  return x === 0 ? 0 : x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
};
