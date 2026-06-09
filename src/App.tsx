/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import Lenis from 'lenis';
import { AppSettings } from './types';
import { ThreeCanvas, ThreeCanvasRef } from './components/ThreeCanvas';

export default function App() {
  // 1. App Configuration state variables
  const [settings] = useState<AppSettings>({
    shape: 'original_shards',
    texture: 'gold_leaf',
    bloomIntensity: 0.0,
    fragDistance: 3.5,
    rotationSpeed: 1.2,
    tiltIntensity: 1.0,
    cameraZ: 6.2,
    showGrid: false,
    enableGlitch: true,
  });

  const [scrollProgress, setScrollProgress] = useState(0);
  const canvasRef = useRef<ThreeCanvasRef>(null);

  // 2. Initialize Lenis for smooth scrolling and track progress
  useEffect(() => {
    // Force scroll position to the absolute top on reload
    window.scrollTo(0, 0);

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });

    // Reset translation coordinate
    lenis.scrollTo(0, { immediate: true });

    const handleScroll = (e: any) => {
      // Ensure we get a normalized progress between 0 and 1
      const progress = Math.max(0, Math.min(1, e.progress ?? 0));
      setScrollProgress(progress);
    };

    lenis.on('scroll', handleScroll);

    // Standard native scroll listener fallback to ensure 100% iframe scroll tracking reliability
    const handleNativeScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? scrollTop / docHeight : 0;
      setScrollProgress(Math.max(0, Math.min(1, progress)));
    };
    window.addEventListener('scroll', handleNativeScroll, { passive: true });

    // Initial trigger
    setScrollProgress(0);

    let rafId: number;
    const raf = (time: number) => {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    };
    rafId = requestAnimationFrame(raf);

    return () => {
      lenis.off('scroll', handleScroll);
      window.removeEventListener('scroll', handleNativeScroll);
      lenis.destroy();
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div id="canvas-stage" className="relative w-full min-h-[250vh] bg-[#f0efed] text-slate-800">
      
      {/* Fixed Fullscreen WebGL Layer */}
      <div className="fixed inset-0 w-full h-screen bg-[#f0efed] overflow-hidden">
        <ThreeCanvas 
          ref={canvasRef}
          settings={settings}
          scrollProgress={scrollProgress}
        />
      </div>

      {/* Decorative Branding Frame / Non-intrusive Minimal Overlay */}
      <div 
        className="fixed bottom-10 left-1/2 -translate-x-1/2 pointer-events-none transition-all duration-300 flex flex-col items-center gap-2"
        style={{ opacity: Math.max(0, 1 - scrollProgress * 3.5), transform: `translate(-50%, ${scrollProgress * 25}px)` }}
      >
        <div className="w-[1px] h-8 bg-gradient-to-b from-slate-400 to-transparent animate-pulse" />
      </div>

    </div>
  );
}
