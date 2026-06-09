/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { ShapeType } from '../types';

/**
 * Creates a base geometry depending on user configuration.
 */
export function createBaseGeometry(type: ShapeType): THREE.BufferGeometry {
  switch (type) {
    case 'torus_knot':
      // Richly faceted torus knot
      return new THREE.TorusKnotGeometry(1.2, 0.38, 48, 8);

    case 'crystal_spire':
      // Towering double cone structure
      return new THREE.ConeGeometry(0.9, 3.0, 16, 6);

    case 'geodesic_sphere':
      // Solid triangular high-poly geodesic sphere
      return new THREE.IcosahedronGeometry(1.5, 2);

    case 'cyber_star':
      // Multi-facet octahedron
      return new THREE.OctahedronGeometry(1.5, 1);

    default:
      return new THREE.TorusKnotGeometry(1.2, 0.4, 24, 6);
  }
}

/**
 * Slices and fragments a basic geometry into a list of clustered Shard meshes.
 * Generates continuous UV indexing across fragments so the texture aligns perfectly when reassembled!
 */
export function fragmentGeometry(
  baseGeom: THREE.BufferGeometry,
  clusterSize: number = 8
): { meshes: THREE.Mesh[]; centroids: THREE.Vector3[] } {
  // Convert standard geometry to non-interleaved non-indexed positions, normals, and UVs
  const niGeom = baseGeom.toNonIndexed();
  const vPos = niGeom.getAttribute('position');
  const vNrm = niGeom.getAttribute('normal');
  const vUv = niGeom.getAttribute('uv');

  const totalFaces = vPos.count / 3;
  
  // We guarantee exactly 7 shards/clusters to match the 7 shards of the original model!
  const numShards = 7;
  const facesPerShard = Math.floor(totalFaces / numShards);
  const extraFaces = totalFaces % numShards;

  const meshes: THREE.Mesh[] = [];
  const centroids: THREE.Vector3[] = [];

  for (let s = 0; s < numShards; s++) {
    const startFace = s * facesPerShard + Math.min(s, extraFaces);
    const endFace = (s + 1) * facesPerShard + Math.min(s + 1, extraFaces);
    const vertCount = (endFace - startFace) * 3;

    // 1. Calculate centroid center point of the cluster faces
    const centroid = new THREE.Vector3();
    for (let i = startFace * 3; i < endFace * 3; i++) {
      centroid.x += vPos.getX(i);
      centroid.y += vPos.getY(i);
      centroid.z += vPos.getZ(i);
    }
    centroid.divideScalar(vertCount);
    centroids.push(centroid);

    // 2. Allocate vertex buffers relative to centroid
    const positions = new Float32Array(vertCount * 3);
    const normals = new Float32Array(vertCount * 3);
    const uvs = new Float32Array(vertCount * 2);

    for (let i = 0; i < vertCount; i++) {
      const sourceIdx = startFace * 3 + i;
      // Position offset from centroid
      positions[i * 3]     = vPos.getX(sourceIdx) - centroid.x;
      positions[i * 3 + 1] = vPos.getY(sourceIdx) - centroid.y;
      positions[i * 3 + 2] = vPos.getZ(sourceIdx) - centroid.z;

      // Unmodified normal direction
      normals[i * 3]     = vNrm.getX(sourceIdx);
      normals[i * 3 + 1] = vNrm.getY(sourceIdx);
      normals[i * 3 + 2] = vNrm.getZ(sourceIdx);

      // Map texture UV coordinatess continuously
      if (vUv) {
        uvs[i * 2]     = vUv.getX(sourceIdx);
        uvs[i * 2 + 1] = vUv.getY(sourceIdx);
      } else {
        // Fallback projections if UVs aren't defined
        uvs[i * 2]     = (positions[i * 3] + centroid.x + 2) / 4;
        uvs[i * 2 + 1] = (positions[i * 3 + 1] + centroid.y + 2) / 4;
      }
    }

    // 3. Create independent BufferGeometry for this shard mesh
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('normal',   new THREE.BufferAttribute(normals, 3));
    geom.setAttribute('uv',       new THREE.BufferAttribute(uvs, 2));

    // Warm, shiny physical default material; textures will overwrite this
    const material = new THREE.MeshPhysicalMaterial({
      color: 0x999999,
      roughness: 0.15,
      metalness: 0.85,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
    });

    const mesh = new THREE.Mesh(geom, material);
    mesh.position.copy(centroid);
    meshes.push(mesh);
  }

  // Dispose of temporary non-indexed geometry
  niGeom.dispose();

  return { meshes, centroids };
}
