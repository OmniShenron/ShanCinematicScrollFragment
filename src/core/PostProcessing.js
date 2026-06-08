import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { GlitchPass } from 'three/examples/jsm/postprocessing/GlitchPass.js';
import { CONFIG } from '../config/constants.js';

export class PostProcessing {
  constructor(renderer, scene, camera) {
    this.composer = new EffectComposer(renderer);
    
    // Render Pass
    this.composer.addPass(new RenderPass(scene, camera));

    // Bloom Pass - use renderer's pixel ratio for better performance
    const pixelRatio = Math.min(window.devicePixelRatio, 2);
    const width = Math.floor(window.innerWidth * pixelRatio);
    const height = Math.floor(window.innerHeight * pixelRatio);
    
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      CONFIG.BLOOM_BASE,
      CONFIG.BLOOM_RADIUS,
      CONFIG.BLOOM_THRESHOLD
    );
    this.composer.addPass(this.bloomPass);

    // Glitch Pass
    this.glitchPass = new GlitchPass();
    this.glitchPass.goWild = false;
    this.glitchPass.enabled = false;
    this.composer.addPass(this.glitchPass);

    // Bind resize handler for cleanup
    this._boundResize = this.onResize.bind(this);
    window.addEventListener('resize', this._boundResize);
  }

  /** Cleanup resources to prevent memory leaks */
  dispose() {
    window.removeEventListener('resize', this._boundResize);
    this.bloomPass?.dispose();
    this.glitchPass?.dispose();
    this.composer?.dispose();
  }

  setBloomStrength(strength) {
    this.bloomPass.strength = strength;
  }

  triggerGlitch() {
    this.glitchPass.enabled = true;
    this.glitchPass.goWild = true;
    setTimeout(() => {
      this.glitchPass.goWild = false;
      this.glitchPass.enabled = false;
    }, CONFIG.GLITCH_MS);
  }

  render() {
    this.composer.render();
  }

  onResize() {
    this.composer.setSize(window.innerWidth, window.innerHeight);
  }
}
