import * as THREE from 'three';
import gsap from 'gsap';
import { CONFIG } from '../config/constants.js';

export class AnimationManager {
  constructor(modelManager, postProcessing, camera, rootGroup) {
    this.modelManager   = modelManager;
    this.postProcessing = postProcessing;
    this.camera         = camera;
    this.rootGroup      = rootGroup;

    this.entryDone      = false;
    this.glitch3Fired   = false;
    this.scrollTarget   = 0;
    this.smoothProgress = 0;

    this._bindScroll();
  }

  // ─── Public ────────────────────────────────────────────────────────────────

  /** Scatter shards outward then animate them back to resting positions. */
  scatterAndAnimate() {
    this.modelManager.shardData.forEach((shard) => {
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);
      const r     = CONFIG.SCATTER_RADIUS + Math.random() * 4;
      shard.animPos.set(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi)
      );
    });

    const tl = gsap.timeline({ onComplete: () => { this.entryDone = true; } });

    this.modelManager.shardData.forEach((shard, i) => {
      tl.to(
        shard.animPos,
        {
          x: shard.origPos.x,
          y: shard.origPos.y,
          z: shard.origPos.z,
          duration: 1.4,
          ease: 'power3.out',
        },
        i * CONFIG.ENTRY_STAGGER
      );
    });
  }

  /** Click-triggered shatter + reassemble. */
  shatter() {
    this.postProcessing.triggerGlitch();

    this.modelManager.shardData.forEach((shard) => {
      const offset = shard.dir.clone().multiplyScalar(CONFIG.SHATTER_DIST);
      offset.x += (Math.random() - 0.5) * 1.5;
      offset.y += (Math.random() - 0.5) * 1.5;
      offset.z += (Math.random() - 0.5) * 1.5;

      const tl = gsap.timeline();
      tl.to(shard.animPos, {
        x: shard.origPos.x + offset.x,
        y: shard.origPos.y + offset.y,
        z: shard.origPos.z + offset.z,
        duration: 0.4,
        ease: 'power2.out',
      });
      tl.to(shard.animPos, {
        x: shard.origPos.x,
        y: shard.origPos.y,
        z: shard.origPos.z,
        duration: 0.7,
        ease: 'elastic.out(1, 0.3)',
      });
    });
  }

  /** Called every frame from the render loop. */
  update(elapsed) {
    this.smoothProgress += (this.scrollTarget - this.smoothProgress) * CONFIG.SCROLL_LERP;

    if (this.entryDone) {
      this._updateCamera();
      this._updateBloom();
      this._updateGlitch();
      this._updateScale(elapsed);
      this._updateFragmentation();
    } else {
      this.rootGroup.scale.setScalar(CONFIG.MODEL_SCALE);
    }

    this._applyShardTransforms();
    this.camera.lookAt(0, 0, 0);
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  _bindScroll() {
    window.addEventListener('scroll', () => {
      const max = document.body.scrollHeight - window.innerHeight;
      this.scrollTarget = max > 0 ? window.scrollY / max : 0;
    }, { passive: true });
  }

  _updateCamera() {
    const p = this.smoothProgress;
    if (p <= 0.92) {
      const t    = p / 0.92;
      const xOff = Math.sin(t * Math.PI * 2) * CONFIG.CAM_X_AMP;
      const zPos = THREE.MathUtils.lerp(CONFIG.CAM_Z_START, CONFIG.CAM_Z_ORBIT_END, t);
      this.camera.position.set(xOff, 0, zPos);
    } else {
      const t    = Math.min((p - 0.92) / 0.08, 1);
      const zPos = THREE.MathUtils.lerp(CONFIG.CAM_Z_ORBIT_END, CONFIG.CAM_Z_RUSH_END, t);
      this.camera.position.set(0, 0, zPos);
    }
  }

  _updateBloom() {
    const p = this.smoothProgress;
    if (p > 0.88) {
      const t = Math.min((p - 0.88) / 0.12, 1);
      this.postProcessing.setBloomStrength(
        THREE.MathUtils.lerp(CONFIG.BLOOM_BASE, CONFIG.BLOOM_MAX, t)
      );
    } else {
      this.postProcessing.setBloomStrength(CONFIG.BLOOM_BASE);
    }
  }

  _updateGlitch() {
    if (this.smoothProgress > 0.03 && !this.glitch3Fired) {
      this.glitch3Fired = true;
      this.postProcessing.triggerGlitch();
    }
  }

  _updateScale(elapsed) {
    const fade  = Math.max(0, 1 - this.smoothProgress / 0.5);
    const scale = CONFIG.MODEL_SCALE
      + Math.sin(elapsed * CONFIG.BREATH_HZ * Math.PI * 2) * CONFIG.BREATH_AMP * fade;
    this.rootGroup.scale.setScalar(scale);
  }

  _updateFragmentation() {
    // Starts after SCROLL_FRAG_START, accelerates non-linearly toward end
    const raw        = Math.max(0, (this.smoothProgress - CONFIG.SCROLL_FRAG_START)
                         / (1 - CONFIG.SCROLL_FRAG_START));
    const crackCurve = Math.pow(raw, 2.0);
    const fragOffset = crackCurve * CONFIG.SCROLL_FRAG_DIST;

    this.modelManager.shardData.forEach((shard) => {
      shard.fragOffset = fragOffset;
    });
  }

  _applyShardTransforms() {
    this.modelManager.shardData.forEach((shard) => {
      // Position: rest + fragment explosion + hover float
      shard.mesh.position
        .copy(shard.animPos)
        .addScaledVector(shard.dir, shard.fragOffset)
        .addScaledVector(shard.dir, shard.hoverOffset);

      // Rotation: tumble in proportion to how far the shard has flown
      const rotAngle = shard.fragOffset * shard.rotSpeed;
      const quat     = new THREE.Quaternion().setFromAxisAngle(shard.rotAxis, rotAngle);
      const baseQuat = new THREE.Quaternion().setFromEuler(shard.origRot);
      quat.multiply(baseQuat);
      shard.mesh.quaternion.copy(quat);
    });
  }
}
