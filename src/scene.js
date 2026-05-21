import * as THREE from 'three';

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });

  const setSize = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height, false);
  };

  setSize();
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05070b);
  scene.fog = new THREE.Fog(0x05070b, 4.5, 10.5);

  const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.01, 100);
  camera.position.set(0, 0.02, 2.6);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 1.15));
  scene.add(new THREE.HemisphereLight(0xffffff, 0x1a2030, 1.35));

  const key = new THREE.DirectionalLight(0xffffff, 3.8);
  key.position.set(3, 4, 5);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xa8d8ff, 0.8);
  fill.position.set(-4, 1, 3);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xffffff, 0.9);
  rim.position.set(0, -1, -4);
  scene.add(rim);

  const resize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    setSize();
  };

  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('orientationchange', resize, { passive: true });

  return { renderer, scene, camera };
}
