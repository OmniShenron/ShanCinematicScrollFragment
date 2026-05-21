import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

const basePath = import.meta.env.BASE_URL || '/';
const assetUrl = (path) => `${basePath}${path}`;
const tempCenter = new THREE.Vector3();
const tempSize   = new THREE.Vector3();
const tempDir    = new THREE.Vector3();
const tempSeed   = new THREE.Vector3();

function fitRoot(root) {
  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(root);
  bounds.getCenter(tempCenter);
  bounds.getSize(tempSize);
  const maxDim = Math.max(tempSize.x, tempSize.y, tempSize.z, 1e-6);
  const scale  = 1.55 / maxDim;
  root.scale.setScalar(scale);
  root.position.set(-tempCenter.x * scale, -tempCenter.y * scale, -tempCenter.z * scale);
  root.updateMatrixWorld(true);
}

// Deterministic pseudo-random based on seed integer
function dpr(seed) {
  const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export function loadFragments(scene, url, onProgress = () => {}) {
  return new Promise((resolve, reject) => {
    const draco = new DRACOLoader();
    draco.setDecoderPath(assetUrl('draco/'));
    draco.setDecoderConfig({ type: 'wasm' });

    const loader = new GLTFLoader();
    loader.setDRACOLoader(draco);

    loader.load(
      url,
      (gltf) => {
        const root = gltf.scene;
        scene.add(root);
        fitRoot(root);

        const fragments     = [];
        const homePositions = [];

        root.traverse((object) => {
          if (!object.isMesh) return;
          object.frustumCulled = false;
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          for (const mat of materials) mat.side = THREE.DoubleSide;
          fragments.push(object);
          homePositions.push(object.position.clone());
        });

        if (!fragments.length) {
          draco.dispose();
          reject(new Error('No mesh fragments found.'));
          return;
        }

        // Compute aggregate centroid
        tempCenter.set(0, 0, 0);
        for (const p of homePositions) tempCenter.add(p);
        tempCenter.divideScalar(homePositions.length);

        fragments.forEach((mesh, index) => {
          const homePosition = homePositions[index].clone();
          // Rest position: minimal inward pull (keeps assembly tight)
          const restPosition = homePosition.clone().lerp(tempCenter, 0.06);

          // ─── Radial direction from centroid ───────────────────────────
          tempDir.copy(restPosition).sub(tempCenter);

          if (tempDir.lengthSq() < 1e-8) {
            // Fallback for centroid-overlapping fragment
            tempSeed.set(dpr(index * 3 + 0), dpr(index * 3 + 1), dpr(index * 3 + 2));
            tempDir.set(tempSeed.x - 0.5, tempSeed.y - 0.5, tempSeed.z - 0.5);
          }
          tempDir.normalize();

          // ─── Z-depth bias: half fly toward camera, half away ──────────
          // Alternating sign + magnitude driven by deterministic noise
          const zSign      = index % 2 === 0 ? 1.0 : -1.0;
          const zMagnitude = 0.35 + dpr(index * 7 + 5) * 0.55;  // 0.35 – 0.90
          const depthDir   = new THREE.Vector3(
            tempDir.x * 0.65,
            tempDir.y * 0.65,
            tempDir.z + zSign * zMagnitude,
          ).normalize();

          // ─── Travel distance: large, varied ───────────────────────────
          // Inner fragments: still travel far; outer frags: even further
          const radialBoost   = Math.min(homePosition.length() * 1.6, 3.0);
          const explodeDistance = 1.6 + radialBoost + dpr(index * 13 + 3) * 0.8;
          //  → range roughly  1.6 – 5.4  (was  0.14 – 0.56)

          const explodePosition = restPosition.clone().add(
            depthDir.clone().multiplyScalar(explodeDistance),
          );

          // ─── Rotation: dramatic tumble with per-axis variation ─────────
          const rotateAmount = 1.6 + Math.min(homePosition.length() * 1.0, 4.0)
                             + dpr(index * 17 + 2) * 0.9;
          //  → range roughly  1.6 – 6.5  radians  (was  0.2 – 0.65)

          // ─── Break delay: staggered per-fragment ignition (0 – 0.30) ──
          // Outer/peripheral fragments tend to break slightly later
          const breakDelay = dpr(index * 53 + 7) * 0.28;

          mesh.position.copy(restPosition);
          mesh.userData.homePosition    = restPosition;
          mesh.userData.explodePosition = explodePosition;
          mesh.userData.baseQuaternion  = mesh.quaternion.clone();
          mesh.userData.rotateAxis      = new THREE.Vector3(
            Math.sin(homePosition.x * 9.7 + 1.1),
            Math.sin(homePosition.y * 7.9 + 2.3),
            Math.sin(homePosition.z * 8.3 + 3.7),
          ).normalize();
          mesh.userData.rotateAmount    = rotateAmount;
          mesh.userData.breakDelay      = breakDelay;
        });

        draco.dispose();
        onProgress(100);
        resolve({ root, fragments });
      },
      (event) => {
        if (event.lengthComputable) onProgress((event.loaded / event.total) * 100);
      },
      (error) => {
        draco.dispose();
        reject(error);
      },
    );
  });
}
