import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CONFIG } from '../config/constants.js';

export class ModelManager {
  constructor(rootGroup) {
    this.rootGroup = rootGroup;
    this.shardData = [];      // { mesh, origPos, origScale, origRot, dir, animPos, hoverOffset, fragOffset, rotAxis, rotSpeed }
    this.shardMap  = new Map(); // mesh → entry
    this.meshList  = [];        // flat list for raycasting
  }

  loadModel(path, onSuccess) {
    const loader = new GLTFLoader();
    loader.load(
      path,
      (gltf) => {
        console.log('✓ GLB loaded');

        // Center model at origin
        const box    = new THREE.Box3().setFromObject(gltf.scene);
        const center = box.getCenter(new THREE.Vector3());
        const size   = box.getSize(new THREE.Vector3());
        gltf.scene.position.sub(center);

        // Auto-scale so model fills viewport height
        // At CAM_Z=5.0, visible half-height ≈ 2.1 → full height ≈ 4.2
        CONFIG.MODEL_SCALE = 4.2 / size.y;

        this.rootGroup.add(gltf.scene);
        this._registerShards(gltf.scene);
        onSuccess?.();
      },
      undefined,
      (err) => {
        console.warn('✗ GLB failed – using fallback:', err.message ?? err);
        const fallback = this._createFallback();
        this.rootGroup.add(fallback);
        this._registerShards(fallback);
        onSuccess?.();
      }
    );
  }

  /** Cleanup resources to prevent memory leaks */
  dispose() {
    this.shardData.forEach((entry) => {
      entry.mesh.geometry?.dispose();
      if (Array.isArray(entry.mesh.material)) {
        entry.mesh.material.forEach(m => m.dispose());
      } else {
        entry.mesh.material?.dispose();
      }
    });
    this.shardData.length = 0;
    this.shardMap.clear();
    this.meshList.length = 0;
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  _registerShards(parentGroup) {
    parentGroup.updateMatrixWorld(true);

    parentGroup.traverse((child) => {
      if (!child.isMesh) return;

      // Clone material so each shard can glow independently
      // Preserve texture and other properties by cloning properly
      const originalMaterial = child.material;
      child.material = originalMaterial.clone();
      
      // Ensure texture is properly referenced after cloning
      if (originalMaterial.map && !child.material.map) {
        child.material.map = originalMaterial.map;
      }

      // Geometry bounding-box centre in world space → scatter direction
      child.geometry.computeBoundingBox();
      const localCenter = child.geometry.boundingBox.getCenter(new THREE.Vector3());
      const worldCenter = localCenter.applyMatrix4(child.matrixWorld);

      const dir = worldCenter.lengthSq() > 0.0001
        ? worldCenter.clone().normalize()
        : new THREE.Vector3(
            Math.random() - 0.5,
            Math.random() - 0.5,
            Math.random() - 0.5
          ).normalize();

      // BUG FIX: origPos must come from child.position (local mesh position).
      // The original code referenced an undefined variable `pos`, which caused
      // a ReferenceError that silently emptied shardData and broke everything:
      // fragmentation, scatter entry animation, hover — all depended on shardData.
      const origPos = child.position.clone();

      const entry = {
        mesh:        child,
        origPos,
        origScale:   child.scale.clone(),
        origRot:     child.rotation.clone(),
        dir,
        animPos:     origPos.clone(),
        hoverOffset: 0,
        fragOffset:  0,
        rotAxis: new THREE.Vector3(
          Math.random() - 0.5,
          Math.random() - 0.5,
          Math.random() - 0.5
        ).normalize(),
        rotSpeed: Math.random() * 2 + 0.5,
      };

      this.shardData.push(entry);
      this.shardMap.set(child, entry);
    });

    this.meshList = this.shardData.map(s => s.mesh);
    console.log(`✓ Registered ${this.shardData.length} shards`);
  }

  _createFallback() {
    const group = new THREE.Group();
    const base  = new THREE.TorusKnotGeometry(1.2, 0.4, 24, 6);
    const ni    = base.toNonIndexed();
    const vPos  = ni.getAttribute('position');
    const vNrm  = ni.getAttribute('normal');
    const totalFaces = vPos.count / 3;
    const CLUSTER    = 4;
    const count      = Math.ceil(totalFaces / CLUSTER);

    for (let s = 0; s < count; s++) {
      const sf = s * CLUSTER;
      const ef = Math.min(sf + CLUSTER, totalFaces);
      const vc = (ef - sf) * 3;

      const centroid = new THREE.Vector3();
      for (let i = sf * 3; i < ef * 3; i++) {
        centroid.x += vPos.getX(i);
        centroid.y += vPos.getY(i);
        centroid.z += vPos.getZ(i);
      }
      centroid.divideScalar(vc);

      const positions = new Float32Array(vc * 3);
      const normals   = new Float32Array(vc * 3);
      for (let i = 0; i < vc; i++) {
        const si = sf * 3 + i;
        positions[i * 3]     = vPos.getX(si) - centroid.x;
        positions[i * 3 + 1] = vPos.getY(si) - centroid.y;
        positions[i * 3 + 2] = vPos.getZ(si) - centroid.z;
        normals[i * 3]       = vNrm.getX(si);
        normals[i * 3 + 1]   = vNrm.getY(si);
        normals[i * 3 + 2]   = vNrm.getZ(si);
      }

      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geom.setAttribute('normal',   new THREE.BufferAttribute(normals, 3));

      const hue = 0.05 + (s / count) * 0.10; // warm orange-gold range
      const mat = new THREE.MeshStandardMaterial({
        color:     new THREE.Color().setHSL(hue, 0.65, 0.3),
        metalness: 0.7,
        roughness: 0.25,
      });

      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.copy(centroid);
      group.add(mesh);
    }

    base.dispose();
    ni.dispose();
    return group;
  }
}
