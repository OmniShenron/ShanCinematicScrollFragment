import * as THREE from 'three';
import { clamp01, easeInOutQuart, easeOutExpo } from './math.js';

const tempQuat = new THREE.Quaternion();

export function updateFragments(fragments, progress) {
  for (const mesh of fragments) {
    const {
      homePosition,
      explodePosition,
      baseQuaternion,
      rotateAxis,
      rotateAmount,
      breakDelay,
    } = mesh.userData;

    // Each fragment waits for its breakDelay before starting to move.
    // Progress is then re-normalized over the remaining range so every
    // fragment still reaches full travel at progress = 1.0.
    const localProgress = clamp01((progress - breakDelay) / (1.0 - breakDelay));

    // Position: easeInOutQuart — slow ignition, burst in the middle,
    // gradual trailing coast. Feels "charged" before it releases.
    const posEased = easeInOutQuart(localProgress);

    // Rotation: easeOutExpo — snaps into a tumble quickly, then spins out
    // slowly on a long exponential tail. Reads as "physically real debris".
    const rotEased = easeOutExpo(localProgress);

    mesh.position.lerpVectors(homePosition, explodePosition, posEased);

    tempQuat.setFromAxisAngle(rotateAxis, rotateAmount * rotEased);
    mesh.quaternion.copy(baseQuaternion).multiply(tempQuat);
  }
}
