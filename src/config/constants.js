export const CONFIG = {
  // ─── Appearance ─────────────────────────────────────────────────────────────
  BG_COLOR:        0x05070b,
  BLOOM_THRESHOLD: 0.86,
  BLOOM_BASE:      0.15,
  BLOOM_MAX:       1.5,
  BLOOM_RADIUS:    0.4,
  GLITCH_MS:       320,

  // ─── Scroll & Animation ─────────────────────────────────────────────────────
  SCROLL_LERP:      0.06,
  TILT_RANGE:       0.8,
  TILT_DIR_X:       1,
  TILT_DIR_Y:       1,
  MOUSE_SMOOTH:     0.12,
  DRAG_SENS:        0.004,
  BREATH_HZ:        0.85,
  BREATH_AMP:       0.02,
  SCATTER_RADIUS:   2.5,
  ENTRY_STAGGER:    0.015,
  HOVER_SCALE:      1.055,
  HOVER_GLOW:       0.15,
  HOVER_FLOAT_DIST: 0.4,
  SHATTER_DIST:     2.5,
  CLICK_THRESH:     6,

  // Fragmentation: shards explode after SCROLL_FRAG_START fraction of scroll
  SCROLL_FRAG_DIST:  3.5,
  SCROLL_FRAG_START: 0.2,

  // ─── Camera & Model ─────────────────────────────────────────────────────────
  MODEL_SCALE:     1.0,   // overridden at runtime by auto-fit
  CAM_Z_START:     7.0,
  CAM_Z_ORBIT_END: 5.0,
  CAM_Z_RUSH_END:  0.5,
  CAM_X_AMP:       1.0,
};
