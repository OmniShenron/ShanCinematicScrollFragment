/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { TextureType } from '../types';

/**
 * Returns a procedural canvas-backed texture for Three.js.
 */
export function getProceduralTexture(type: TextureType): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  switch (type) {
    case 'gold_leaf':
      generateGoldLeaf(ctx, canvas.width, canvas.height);
      break;
    case 'obsidian_noir':
      generateObsidianNoir(ctx, canvas.width, canvas.height);
      break;
    case 'cyber_hologram':
      generateCyberHologram(ctx, canvas.width, canvas.height);
      break;
    case 'mystic_amethyst':
      generateMysticAmethyst(ctx, canvas.width, canvas.height);
      break;
    case 'vulcan_ruby':
      generateVulcanRuby(ctx, canvas.width, canvas.height);
      break;
    default:
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 1);
  return texture;
}

// ─── Procedural Texture Generators ──────────────────────────────────────────

function generateGoldLeaf(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Rich golden gradients
  const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 1.4);
  grad.addColorStop(0, '#ffd700');     // bright gold
  grad.addColorStop(0.3, '#f5c324');   // amber gold
  grad.addColorStop(0.7, '#daaa18');   // dark rich gold
  grad.addColorStop(1, '#8c6001');     // deepest bronze

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Add speckled gold leaf noise and metallic flakes
  for (let i = 0; i < 600; i++) {
    const rx = Math.random() * w;
    const ry = Math.random() * h;
    const size = Math.random() * 6 + 1;
    ctx.fillStyle = Math.random() > 0.4 ? 'rgba(255, 250, 220, 0.45)' : 'rgba(120, 80, 0, 0.3)';
    ctx.beginPath();
    ctx.arc(rx, ry, size, 0, Math.PI * 2);
    ctx.fill();
  }

  // Hammered metal look (organic cellular structure)
  ctx.strokeStyle = 'rgba(255, 235, 170, 0.25)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 40; i++) {
    ctx.beginPath();
    ctx.moveTo(Math.random() * w, Math.random() * h);
    for (let j = 0; j < 5; j++) {
      ctx.lineTo(Math.random() * w, Math.random() * h);
    }
    ctx.stroke();
  }
}

function generateObsidianNoir(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Deep igneous charcoal gradients
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#020305');
  grad.addColorStop(0.5, '#0c0e12');
  grad.addColorStop(1, '#151b24');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Sharp granite obsidian crystalline fractures
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 25; i++) {
    ctx.beginPath();
    let cx = Math.random() * w;
    let cy = Math.random() * h;
    ctx.moveTo(cx, cy);
    for (let j = 0; j < 6; j++) {
      cx += (Math.random() - 0.5) * 80;
      cy += (Math.random() - 0.5) * 80;
      ctx.lineTo(cx, cy);
    }
    ctx.stroke();
  }

  // Specular speckles (micro crystal shards)
  for (let i = 0; i < 150; i++) {
    ctx.fillStyle = 'rgba(250, 253, 255, 0.15)';
    const size = Math.random() * 2 + 0.5;
    ctx.fillRect(Math.random() * w, Math.random() * h, size, size);
  }
}

function generateCyberHologram(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Pure dark matrix background
  ctx.fillStyle = '#010308';
  ctx.fillRect(0, 0, w, h);

  // Neon glowing green-blue digital grids
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
  ctx.lineWidth = 3;
  ctx.strokeRect(0, 0, w, h);

  const steps = 8;
  const size = w / steps;
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.12)';
  ctx.lineWidth = 1;

  for (let i = 0; i <= steps; i++) {
    // Verticals
    ctx.beginPath();
    ctx.moveTo(i * size, 0);
    ctx.lineTo(i * size, h);
    ctx.stroke();

    // Horizontals
    ctx.beginPath();
    ctx.moveTo(0, i * size);
    ctx.lineTo(w, i * size);
    ctx.stroke();
  }

  // Glowing crosshairs
  ctx.strokeStyle = 'rgba(0, 255, 136, 0.5)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 4; i++) {
    const cx = Math.random() * w;
    const cy = Math.random() * h;
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx - 10, cy); ctx.lineTo(cx + 10, cy);
    ctx.moveTo(cx, cy - 10); ctx.lineTo(cx, cy + 10);
    ctx.stroke();
  }

  // Abstract binary code strings / dots
  ctx.fillStyle = 'rgba(0, 255, 136, 0.35)';
  ctx.font = 'bold 10px monospace';
  for (let i = 0; i < 15; i++) {
    const txt = Math.random() > 0.5 ? '1' : '0';
    ctx.fillText(txt, Math.random() * w, Math.random() * h);
  }
}

function generateMysticAmethyst(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Deep purple base gradient
  const grad = ctx.createLinearGradient(0, h, w, 0);
  grad.addColorStop(0, '#2c0c3a');     // deep violet
  grad.addColorStop(0.5, '#4e1269');   // mid violet
  grad.addColorStop(0.8, '#821695');   // amethyst
  grad.addColorStop(1, '#cb50eb');     // neon purple-pink peak

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Geometric facets in amethyst
  ctx.strokeStyle = 'rgba(235, 160, 255, 0.15)';
  ctx.lineWidth = 2;
  const points = Array.from({ length: 15 }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
  }));

  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    for (let j = i + 1; j < Math.min(i + 4, points.length); j++) {
      const p2 = points[j];
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
  }

  // Glittering star bursts (magical glow sparkles)
  for (let i = 0; i < 12; i++) {
    const cx = Math.random() * w;
    const cy = Math.random() * h;
    ctx.fillStyle = '#ffffff';

    // Sparkle diamond shape
    ctx.beginPath();
    ctx.moveTo(cx, cy - 8);
    ctx.lineTo(cx + 4, cy);
    ctx.lineTo(cx, cy + 8);
    ctx.lineTo(cx - 4, cy);
    ctx.closePath();
    ctx.fill();
  }
}

function generateVulcanRuby(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Coal/Obsidian black base
  ctx.fillStyle = '#060404';
  ctx.fillRect(0, 0, w, h);

  // Volcano ruby cracks and lava glowing veins
  const rGrad = ctx.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, w / 1.2);
  rGrad.addColorStop(0, '#ff1a00');    // pure radiant red
  rGrad.addColorStop(0.4, '#b30000');  // dark red lava
  rGrad.addColorStop(0.8, '#4d0000');  // cooling magma red-brown
  rGrad.addColorStop(1, '#060404');    // black coal outer

  // Draw some organic lava channels
  ctx.shadowColor = '#ff3300';
  ctx.shadowBlur = 15;
  ctx.strokeStyle = '#ff1a00';
  ctx.lineWidth = 3;

  for (let i = 0; i < 8; i++) {
    ctx.beginPath();
    let cx = Math.random() * w;
    let cy = Math.random() * h;
    ctx.moveTo(cx, cy);
    for (let j = 0; j < 5; j++) {
      cx += (Math.random() - 0.5) * 120;
      cy += (Math.random() - 0.5) * 120;
      ctx.lineTo(cx, cy);
    }
    ctx.stroke();
  }

  // Magma cells
  ctx.strokeStyle = '#ff6600';
  ctx.lineWidth = 1;
  ctx.shadowBlur = 0;
  for (let i = 0; i < 20; i++) {
    ctx.beginPath();
    ctx.arc(Math.random() * w, Math.random() * h, Math.random() * 40 + 10, 0, Math.PI * 2);
    ctx.stroke();
  }
}
