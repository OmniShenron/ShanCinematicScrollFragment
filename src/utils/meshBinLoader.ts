/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';

export interface UnpackedMesh {
  name: string;
  geometry: THREE.BufferGeometry;
  localMatrix: THREE.Matrix4;
}

/**
 * Loads and unpacks custom binary meshes directly from a .bin file without invoking any GLB loader.
 */
export async function loadMeshBin(url: string): Promise<UnpackedMesh[]> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch binary mesh from ${url} (status ${response.status})`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const dataView = new DataView(arrayBuffer);

  // 1. Check Magic Word
  const magic = String.fromCharCode(
    dataView.getUint8(0),
    dataView.getUint8(1),
    dataView.getUint8(2),
    dataView.getUint8(3)
  );

  if (magic !== 'SHAN') {
    throw new Error(`Invalid mesh format. Expected magic 'SHAN', found '${magic}'`);
  }

  const numMeshes = dataView.getUint32(4, true);
  console.log(`Unpacking ${numMeshes} binary meshes from .bin...`);

  const results: UnpackedMesh[] = [];

  // 2. Decode headers for each mesh
  for (let idx = 0; idx < numMeshes; idx++) {
    const hOffset = 8 + idx * 112;

    // A. Read Name (32 bytes)
    const nameBytes: number[] = [];
    for (let j = 0; j < 32; j++) {
      const charCode = dataView.getUint8(hOffset + j);
      if (charCode === 0) break; // null termination
      nameBytes.push(charCode);
    }
    const name = String.fromCharCode(...nameBytes);

    // B. Read local transformation Matrix (16 floats = 64 bytes)
    const matrixElements: number[] = [];
    for (let j = 0; j < 16; j++) {
      matrixElements.push(dataView.getFloat32(hOffset + 32 + j * 4, true));
    }
    const localMatrix = new THREE.Matrix4().fromArray(matrixElements);

    // C. Counts & Offsets
    const posCount = dataView.getUint32(hOffset + 96, true);
    const indexCount = dataView.getUint32(hOffset + 100, true);
    const posOffset = dataView.getUint32(hOffset + 104, true);
    const indexOffset = dataView.getUint32(hOffset + 108, true);

    const normalOffset = posOffset + posCount * 3 * 4;
    const uvOffset = posOffset + posCount * 6 * 4;

    // D. Extract Arrays from payloads
    const posArray = new Float32Array(arrayBuffer, posOffset, posCount * 3);
    const normalArray = new Float32Array(arrayBuffer, normalOffset, posCount * 3);
    const uvArray = new Float32Array(arrayBuffer, uvOffset, posCount * 2);
    const indexArray = new Uint32Array(arrayBuffer, indexOffset, indexCount);

    // E. Assemble BufferGeometry
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normalArray, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvArray, 2));
    geometry.setIndex(new THREE.BufferAttribute(indexArray, 1));

    results.push({
      name,
      geometry,
      localMatrix
    });
  }

  console.log(`🎉 Unpacked ${results.length} meshes successfully!`);
  return results;
}
