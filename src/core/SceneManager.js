import * as THREE from 'three';
import { CONFIG } from '../config/constants.js';

export class SceneManager {
  constructor(canvas) {
    this.canvas = canvas;

    // ─── Scene ─────────────────────────────────────────────────────────────
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(CONFIG.BG_COLOR);
    this.scene.fog = new THREE.Fog(CONFIG.BG_COLOR, 8, 25);

    // ─── Camera ────────────────────────────────────────────────────────────
    this.camera = new THREE.PerspectiveCamera(
      50,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    this.camera.position.set(0, 0, CONFIG.CAM_Z_START);

    // ─── Renderer ──────────────────────────────────────────────────────────
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    // ─── Root group ────────────────────────────────────────────────────────
    this.rootGroup = new THREE.Group();
    this.scene.add(this.rootGroup);

    this._setupLights();
    window.addEventListener('resize', this._onResize.bind(this));
  }

  _setupLights() {
    // Neutral ambient — no blue tint
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.25));

    // Warm hemisphere: warm sky, dark ground
    this.scene.add(new THREE.HemisphereLight(0xfff0dd, 0x1a1408, 0.45));

    // Key light — warm white from top-right
    const key = new THREE.DirectionalLight(0xffeedd, 1.2);
    key.position.set(5, 8, 7);
    this.scene.add(key);

    // Soft fill from left
    const fill = new THREE.DirectionalLight(0xfff5ee, 0.4);
    fill.position.set(-4, 2, 3);
    this.scene.add(fill);
  }

  _onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }
}
