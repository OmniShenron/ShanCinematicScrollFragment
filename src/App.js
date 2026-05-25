import * as THREE from 'three';
import { SceneManager }       from './core/SceneManager.js';
import { PostProcessing }     from './core/PostProcessing.js';
import { ModelManager }       from './managers/ModelManager.js';
import { AnimationManager }   from './managers/AnimationManager.js';
import { InteractionManager } from './managers/InteractionManager.js';

export class App {
  constructor(canvas) {
    this.canvas = canvas;
    this.clock  = new THREE.Clock();

    // Core
    this.sceneManager   = new SceneManager(canvas);
    this.postProcessing = new PostProcessing(
      this.sceneManager.renderer,
      this.sceneManager.scene,
      this.sceneManager.camera
    );

    // Managers
    this.modelManager = new ModelManager(this.sceneManager.rootGroup);

    this.animationManager = new AnimationManager(
      this.modelManager,
      this.postProcessing,
      this.sceneManager.camera,
      this.sceneManager.rootGroup
    );

    this.interactionManager = new InteractionManager(
      canvas,
      this.sceneManager.camera,
      this.modelManager,
      this.animationManager
    );

    // Load model → kick off entry animation
    this.modelManager.loadModel('/models/shan3D-shard.glb', () => {
      this.animationManager.scatterAndAnimate();
    });

    // Render loop
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  animate() {
    requestAnimationFrame(this.animate);
    const elapsed = this.clock.getElapsedTime();
    this.animationManager.update(elapsed);
    this.interactionManager.update(this.sceneManager.rootGroup);
    this.postProcessing.render();
  }
}
