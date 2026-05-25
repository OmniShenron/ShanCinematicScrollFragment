import * as THREE from 'three';
import gsap from 'gsap';
import { CONFIG } from '../config/constants.js';

export class InteractionManager {
  constructor(canvas, camera, modelManager, animationManager) {
    this.canvas           = canvas;
    this.camera           = camera;
    this.modelManager     = modelManager;
    this.animationManager = animationManager;

    // Raw + smoothed mouse NDC
    this.mouseRawX = 0;
    this.mouseRawY = 0;
    this.smoothMX  = 0;
    this.smoothMY  = 0;

    // Drag state
    this.dragBaseX    = 0;
    this.dragBaseY    = 0;
    this.isDragging   = false;
    this.pointerDownX = 0;
    this.pointerDownY = 0;
    this.prevPointerX = 0;
    this.prevPointerY = 0;

    // Hover / raycasting
    this.raycaster   = new THREE.Raycaster();
    this.ndcPointer  = new THREE.Vector2();
    this.hoveredMesh = null;

    this._bindEvents();
  }

  // ─── Public ────────────────────────────────────────────────────────────────

  update(rootGroup) {
    this.smoothMX += (this.mouseRawX - this.smoothMX) * CONFIG.MOUSE_SMOOTH;
    this.smoothMY += (this.mouseRawY - this.smoothMY) * CONFIG.MOUSE_SMOOTH;

    rootGroup.rotation.y = this.smoothMX * CONFIG.TILT_RANGE * CONFIG.TILT_DIR_X + this.dragBaseY;
    rootGroup.rotation.x = this.smoothMY * CONFIG.TILT_RANGE * CONFIG.TILT_DIR_Y + this.dragBaseX;

    if (this.modelManager.meshList.length > 0) {
      this.raycaster.setFromCamera(this.ndcPointer, this.camera);
      const hits       = this.raycaster.intersectObjects(this.modelManager.meshList, false);
      const newHovered = hits.length > 0 ? hits[0].object : null;
      this._applyHover(newHovered);
    }
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  _bindEvents() {
    this.canvas.addEventListener('pointermove', this._onPointerMove.bind(this));
    this.canvas.addEventListener('pointerdown', this._onPointerDown.bind(this));
    window.addEventListener('pointerup',        this._onPointerUp.bind(this));
  }

  _onPointerMove(e) {
    this.mouseRawX = (e.clientX / window.innerWidth)  * 2 - 1;
    this.mouseRawY = (e.clientY / window.innerHeight) * 2 - 1;
    this.ndcPointer.set(this.mouseRawX, -this.mouseRawY);

    if (this.isDragging) {
      const dx = e.clientX - this.prevPointerX;
      const dy = e.clientY - this.prevPointerY;
      this.dragBaseY -= dx * CONFIG.DRAG_SENS;
      this.dragBaseX += dy * CONFIG.DRAG_SENS;
      this.prevPointerX = e.clientX;
      this.prevPointerY = e.clientY;
    }
  }

  _onPointerDown(e) {
    this.isDragging   = true;
    this.pointerDownX = e.clientX;
    this.pointerDownY = e.clientY;
    this.prevPointerX = e.clientX;
    this.prevPointerY = e.clientY;
  }

  _onPointerUp(e) {
    if (!this.isDragging) return;
    this.isDragging = false;
    const dist = Math.hypot(e.clientX - this.pointerDownX, e.clientY - this.pointerDownY);
    if (dist < CONFIG.CLICK_THRESH) this.animationManager.shatter();
  }

  _applyHover(newHovered) {
    if (newHovered === this.hoveredMesh) return;

    // Un-hover previous
    if (this.hoveredMesh) {
      const sd = this.modelManager.shardMap.get(this.hoveredMesh);
      if (sd) {
        gsap.killTweensOf(this.hoveredMesh.material);
        gsap.killTweensOf(this.hoveredMesh.scale);
        gsap.killTweensOf(sd);
        gsap.to(this.hoveredMesh.material, { emissiveIntensity: 0, duration: 0.25 });
        gsap.to(this.hoveredMesh.scale, {
          x: sd.origScale.x, y: sd.origScale.y, z: sd.origScale.z,
          duration: 0.25,
        });
        gsap.to(sd, { hoverOffset: 0, duration: 0.5, ease: 'power2.out' });
      }
    }

    // Hover new
    if (newHovered) {
      const sd = this.modelManager.shardMap.get(newHovered);
      if (sd) {
        gsap.killTweensOf(newHovered.material);
        gsap.killTweensOf(newHovered.scale);
        gsap.killTweensOf(sd);
        newHovered.material.emissive.set(0xffffff);
        gsap.set(newHovered.material, { emissiveIntensity: CONFIG.HOVER_GLOW });
        gsap.to(newHovered.scale, {
          x: sd.origScale.x * CONFIG.HOVER_SCALE,
          y: sd.origScale.y * CONFIG.HOVER_SCALE,
          z: sd.origScale.z * CONFIG.HOVER_SCALE,
          duration: 0.25,
        });
        gsap.to(sd, {
          hoverOffset: CONFIG.HOVER_FLOAT_DIST,
          duration: 1.2,
          yoyo: true,
          repeat: -1,
          ease: 'sine.inOut',
        });
      }
    }

    this.hoveredMesh = newHovered;
  }
}
