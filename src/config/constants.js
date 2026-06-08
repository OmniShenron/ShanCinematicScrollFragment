export const CONFIG = {
  // ─── Appearance ─────────────────────────────────────────────────────────────
  BG_COLOR:        0x05070b,       // Deep navy black background
  BLOOM_THRESHOLD: 0.86,           // Brightness threshold for bloom effect
  BLOOM_BASE:      0.15,           // Base bloom strength
  BLOOM_MAX:       1.5,            // Maximum bloom strength at scroll end
  BLOOM_RADIUS:    0.4,            // Bloom spread radius
  GLITCH_MS:       320,            // Glitch effect duration in milliseconds

  // ─── Scroll & Animation ─────────────────────────────────────────────────────
  SCROLL_LERP:      0.06,          // Scroll smoothing factor (lower = smoother)
  TILT_RANGE:       0.8,           // Maximum mouse tilt rotation in radians
  TILT_DIR_X:       1,             // X-axis tilt direction multiplier
  TILT_DIR_Y:       1,             // Y-axis tilt direction multiplier
  MOUSE_SMOOTH:     0.12,          // Mouse smoothing factor (lower = smoother)
  DRAG_SENS:        0.004,         // Drag rotation sensitivity
  BREATH_HZ:        0.85,          // Breathing animation frequency in Hz
  BREATH_AMP:       0.02,          // Breathing animation amplitude
  SCATTER_RADIUS:   2.5,           // Initial scatter radius for shards
  ENTRY_STAGGER:    0.015,         // Stagger delay between shard animations
  HOVER_SCALE:      1.055,         // Scale factor on hover
  HOVER_GLOW:       0.15,          // Emissive glow intensity on hover
  HOVER_FLOAT_DIST: 0.4,           // Hover float animation distance
  SHATTER_DIST:     2.5,           // Shatter explosion distance on click
  CLICK_THRESH:     6,             // Max pixels for click vs drag detection

  // Fragmentation: shards explode after SCROLL_FRAG_START fraction of scroll
  SCROLL_FRAG_DIST:  3.5,          // Maximum fragmentation distance
  SCROLL_FRAG_START: 0.2,          // Scroll progress where fragmentation begins

  // ─── Camera & Model ─────────────────────────────────────────────────────────
  MODEL_SCALE:     1.0,            // Runtime auto-calculated model scale
  CAM_Z_START:     7.0,            // Starting camera Z position
  CAM_Z_ORBIT_END: 5.0,            // Camera Z at 92% scroll
  CAM_Z_RUSH_END:  0.5,            // Final camera Z rush position
  CAM_X_AMP:       1.0,            // Camera X oscillation amplitude
};
