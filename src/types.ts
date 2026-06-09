/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ShapeType = 'original_shards' | 'torus_knot' | 'crystal_spire' | 'geodesic_sphere' | 'cyber_star';

export type TextureType = 'gold_leaf' | 'obsidian_noir' | 'cyber_hologram' | 'mystic_amethyst' | 'vulcan_ruby';

export interface AppSettings {
  shape: ShapeType;
  texture: TextureType;
  bloomIntensity: number;
  fragDistance: number;
  rotationSpeed: number;
  tiltIntensity: number;
  cameraZ: number;
  showGrid: boolean;
  enableGlitch: boolean;
}

export interface SlideData {
  title: string;
  subtitle: string;
  description: string;
  accent: string;
}

export interface ShardDataEntry {
  mesh: import('three').Mesh;
  origPos: import('three').Vector3;
  origScale: import('three').Vector3;
  origRot: import('three').Euler;
  dir: import('three').Vector3;
  rotAxis: import('three').Vector3;
  rotSpeed: number;
  currentPos?: import('three').Vector3;
  currentQuat?: import('three').Quaternion;
}
