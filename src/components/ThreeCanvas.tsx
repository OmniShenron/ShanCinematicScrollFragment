/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useImperativeHandle, forwardRef, useState } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import gsap from 'gsap';

import { AppSettings, ShardDataEntry } from '../types';
import { getProceduralTexture } from '../utils/materials';
import { createBaseGeometry, fragmentGeometry } from '../utils/geometries';
import { loadMeshBin, UnpackedMesh } from '../utils/meshBinLoader';

// --- CUSTOM VELOCITY-DRIVEN SCREEN-SPACE DIRECTIONAL GAUSSIAN MOTION BLUR SHADER ---
const MotionBlurShader = {
  uniforms: {
    tDiffuse: { value: null },
    uVelocity: { value: 0.0 },
    uResolution: { value: new THREE.Vector2(1200, 800) },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uVelocity;
    uniform vec2 uResolution;
    varying vec2 vUv;

    void main() {
      float speed = abs(uVelocity);
      
      // Conservative horizontal blur scaling to keep movement incredibly crisp and minimum
      float blurScale = speed * 0.0035; 
      
      if (blurScale < 0.0002) {
        gl_FragColor = texture2D(tDiffuse, vUv);
        return;
      }

      vec2 blurStep = vec2(blurScale, 0.0);

      // Pristine 1D 5-sample Gaussian filter weights: [0.06136, 0.24477, 0.38774, 0.24477, 0.06136]
      vec4 color = texture2D(tDiffuse, vUv) * 0.38774;
      color += texture2D(tDiffuse, vUv + blurStep) * 0.24477;
      color += texture2D(tDiffuse, vUv - blurStep) * 0.24477;
      color += texture2D(tDiffuse, vUv + blurStep * 2.0) * 0.06136;
      color += texture2D(tDiffuse, vUv - blurStep * 2.0) * 0.06136;

      gl_FragColor = color;
    }
  `
};

interface ThreeCanvasProps {
  settings: AppSettings;
  scrollProgress: number; // 0 to 1
  onProgressChange?: (progress: number) => void;
}

export interface ThreeCanvasRef {
  // Expose empty ref interface to clean up actions
}

export const ThreeCanvas = forwardRef<ThreeCanvasRef, ThreeCanvasProps>(({
  settings,
  scrollProgress,
  onProgressChange
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Keep references to ThreeJS objects to avoid garbage collection and facilitate updates
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.Camera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const composerRef = useRef<EffectComposer | null>(null);
  const bloomPassRef = useRef<UnrealBloomPass | null>(null);
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);

  // Group hosting our fragments
  const rootGroupRef = useRef<THREE.Group>(new THREE.Group());
  const shardDataRef = useRef<ShardDataEntry[]>([]);

  // Smooth progress mirroring environmental scroll
  const scrollSmoothRef = useRef(0);
  const scrollSpringRef = useRef(0);
  const scrollVelocityRef = useRef(0);
  const yEntryOffsetRef = useRef(-1.5);
  const entryDoneRef = useRef(false);

  // Mouse tilt variables
  const mouseRef = useRef({ rawX: 0, rawY: 0, smoothX: 0, smoothY: 0 });

  const scrollProgressRef = useRef(0);
  useEffect(() => {
    scrollProgressRef.current = scrollProgress;
  }, [scrollProgress]);

  const [fps, setFps] = useState(60);
  const [binLoaded, setBinLoaded] = useState(false);
  const [isLoadingBin, setIsLoadingBin] = useState(false);
  const loadedBinaryMeshesRef = useRef<UnpackedMesh[] | null>(null);
  const defaultTextureRef = useRef<THREE.Texture | null>(null);
  const activeTextureRef = useRef<THREE.Texture | null>(null);

  // Load `.bin` model and extracted texture once on mount
  useEffect(() => {
    let active = true;
    const loadBinAndTexture = async () => {
      setIsLoadingBin(true);
      try {
        const [meshes, texture] = await Promise.all([
          loadMeshBin('/models/shan3d-mesh.bin'),
          new Promise<THREE.Texture>((resolve, reject) => {
            new THREE.TextureLoader().load(
              '/models/shan3D-texture.jpg',
              (tex) => {
                tex.colorSpace = THREE.SRGBColorSpace;
                tex.flipY = false;
                resolve(tex);
              },
              undefined,
              (err) => reject(err)
            );
          }),
        ]);

        if (active) {
          loadedBinaryMeshesRef.current = meshes;
          defaultTextureRef.current = texture;
          setBinLoaded(true);
        }
      } catch (err) {
        console.error('Failed to load packed binary model or default texture:', err);
      } finally {
        if (active) {
          setIsLoadingBin(false);
        }
      }
    };
    loadBinAndTexture();
    return () => {
      active = false;
    };
  }, []);

  // Handle empty imperative handle matching ThreeCanvasRef constraints
  useImperativeHandle(ref, () => ({}));

  // 1. Initial mounting & environment boot
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    const bgColor = 0xdedcd8; // Refined clean concrete neutral cream
    scene.background = new THREE.Color(bgColor);
    scene.fog = new THREE.Fog(bgColor, 12, 35);
    sceneRef.current = scene;

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      50,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    camera.position.set(0, 0, settings.cameraZ);
    cameraRef.current = camera;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: false,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    rendererRef.current = renderer;

    // Add root group to host shapes
    scene.add(rootGroupRef.current);

    // Procedural Studio Light-Box Environment Map to reflect gorgeous white walls and ceiling panel lights!
    const createProceduralEnvMap = () => {
      const cv = document.createElement('canvas');
      cv.width = 512;
      cv.height = 256;
      const ctx = cv.getContext('2d')!;

      // 1. Warm base ambient walls
      ctx.fillStyle = '#f5f3f0';
      ctx.fillRect(0, 0, 512, 256);

      // 2. High-contrast overhead ceiling panel light (soft white)
      const gradCeiling = ctx.createLinearGradient(0, 0, 0, 128);
      gradCeiling.addColorStop(0, '#ffffff');
      gradCeiling.addColorStop(0.4, '#ffffff');
      gradCeiling.addColorStop(1.0, '#f5f3f0');
      ctx.fillStyle = gradCeiling;
      ctx.fillRect(0, 0, 512, 110);

      // 3. Crisp vertical light pillars left and right representing architectural slots
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(64, 40, 48, 160);
      ctx.fillRect(320, 50, 64, 150);

      // 4. Subtle cool architectural bounce shadow in the floor reflection region
      const gradFloor = ctx.createLinearGradient(0, 128, 0, 256);
      gradFloor.addColorStop(0, '#f5f3f0');
      gradFloor.addColorStop(1.0, '#dfdedc');
      ctx.fillStyle = gradFloor;
      ctx.fillRect(0, 128, 512, 128);

      const envTex = new THREE.CanvasTexture(cv);
      envTex.mapping = THREE.EquirectangularReflectionMapping;
      envTex.colorSpace = THREE.SRGBColorSpace;
      return envTex;
    };

    const envMap = createProceduralEnvMap();
    scene.environment = envMap;

    // Setup lights - pristine studio spotlight setup - soft, balanced, non-blown-out
    scene.add(new THREE.AmbientLight(0xffffff, 0.45));
    scene.add(new THREE.HemisphereLight(0xffffff, 0xc2bfb8, 0.30));

    // Warm elegant gallery spotlight
    const keyLight = new THREE.DirectionalLight(0xfff7ed, 0.65);
    keyLight.position.set(6, 7, 5);
    scene.add(keyLight);

    // Cool fill light for natural ambient shadow depth
    const fillLight = new THREE.DirectionalLight(0xecf5ff, 0.30);
    fillLight.position.set(-6, 3, 4);
    scene.add(fillLight);

    // ─── STAGE BACKGROUND: SMOOTH ARCHITECTURAL SHOWROOM (NO BLACK LINES) ───
    const holoRoom = new THREE.Group();
    scene.add(holoRoom);

    // 1. Sleek Studio Cyclorama (Seamless floor blending to vertical walls, stretching high up to eliminate black ceiling circles)
    const cycPoints = [];
    const innerRadius = 5.0; // Flat floor radius
    const filletRadius = 1.5; // Smooth architectural fillet
    const wallHeight = 12.0;  // Extra high seamless wall to prevent ceiling/edge intersections

    // A. Flat Floor Section (Center to fillet start)
    for (let i = 0; i <= 20; i++) {
      const r = (i / 20) * innerRadius;
      cycPoints.push(new THREE.Vector2(r, -2.25));
    }

    // B. Bottom Fillet Turn (Curving smoothly from floor to vertical wall)
    for (let i = 1; i <= 20; i++) {
      const angle = (i / 20) * (Math.PI / 2); // 0 to 90 degrees
      const rx = innerRadius + Math.sin(angle) * filletRadius;
      const ry = -2.25 + filletRadius - Math.cos(angle) * filletRadius;
      cycPoints.push(new THREE.Vector2(rx, ry));
    }

    // C. Vertical wall column going straight up
    const wallStartX = innerRadius + filletRadius;
    const wallStartY = -2.25 + filletRadius;
    for (let i = 1; i <= 30; i++) {
      const h = wallStartY + (i / 30) * wallHeight;
      cycPoints.push(new THREE.Vector2(wallStartX, h));
    }

    const roomCycGeo = new THREE.LatheGeometry(cycPoints, 64);

    // Uniforms for background shaders
    const wallUniforms = {
      uTime: { value: 0 },
      uScroll: { value: 0 },
      uMouse: { value: new THREE.Vector2(0, 0) },
    };

    const roomCycMat = new THREE.MeshStandardMaterial({
      color: 0xdedcd8, // Warm matte plaster/concrete
      side: THREE.BackSide,
      roughness: 0.90,
      metalness: 0.05,
    });

    roomCycMat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = wallUniforms.uTime;
      shader.uniforms.uScroll = wallUniforms.uScroll;
      shader.uniforms.uMouse = wallUniforms.uMouse;

      // Inject custom varying coordinates and world positions
      shader.vertexShader = `
        varying vec3 vWorldPos;
        varying vec2 vCustomUv;
      ` + shader.vertexShader.replace(
        '#include <uv_vertex>',
        `
        #include <uv_vertex>
        vCustomUv = uv;
        vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
        `
      );

      shader.fragmentShader = `
        uniform float uTime;
        uniform float uScroll;
        uniform vec2 uMouse;
        varying vec2 vCustomUv;
        varying vec3 vWorldPos;
      ` + shader.fragmentShader;

      // Perturb standard normal to create realistic 3D columnar curves matching lighting
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <normal_fragment_begin>',
        `
        #include <normal_fragment_begin>
        
        // Compute column perturbation factor (only on vertical walls)
        float columnFactor = smoothstep(-2.25, -1.0, vWorldPos.y) * smoothstep(3.25, 2.0, vWorldPos.y);
        if (columnFactor > 0.001) {
          float rAngle = atan(vWorldPos.z, vWorldPos.x);
          float numColumns = 18.0;
          float phase = rAngle * numColumns;
          
          // Tangent to cylinder around Y-axis
          vec3 cylinderTangent = normalize(vec3(-vWorldPos.z, 0.0, vWorldPos.x));
          
          // Apply sinusoidal wave perturbation for high-fidelity convex column pillars
          float normalPerturb = sin(phase) * 0.40;
          normal = normalize(normal + cylinderTangent * normalPerturb * columnFactor);
        }
        `
      );

      const target = '#include <dithering_fragment>';
      const replacement = `
        #include <dithering_fragment>

        vec2 uv = vCustomUv;

        // Pristine showroom base concrete - warm cream-plaster concrete
        vec3 baseConcrete = vec3(0.92, 0.90, 0.88);

        // Add 3D architectural grooved column shadows matching the perturbed normals without GLSL variable scope collision
        float shdColumnFactor = smoothstep(-2.25, -1.0, vWorldPos.y) * smoothstep(3.25, 2.0, vWorldPos.y);
        float shdAngle = atan(vWorldPos.z, vWorldPos.x);
        float shdNumColumns = 18.0;
        float shdPhase = shdAngle * shdNumColumns;
        
        // Deep shadow inside the column grooves
        float grooveShadow = smoothstep(0.72, 1.0, abs(cos(shdPhase)));
        float grooveAO = mix(1.0, 0.62, grooveShadow * shdColumnFactor);

        // Soft, quiet overhead lighting gradient going upwards
        float ceilingWash = smoothstep(-2.25, 6.0, vWorldPos.y) * 0.12;
        vec3 washColor = vec3(0.96, 0.94, 0.90) * ceilingWash;

        // Realistic architectural ambient occlusion (AO) in the bottom curved fillet, creating rich 3D room depth
        float filletAO = smoothstep(-2.25, -0.6, vWorldPos.y) * 0.15 + 0.85;

        // Combine lighting, column grooves, and AO for 3D depth
        vec3 roomColor = baseConcrete * filletAO * grooveAO + washColor;

        // Add subtle high-fidelity plaster grain for tactile architectural feel
        float grain = fract(sin(dot(uv * 400.0, vec2(12.9898, 78.233))) * 43758.5453);
        vec3 finalColor = roomColor + vec3(grain * 0.006);

        gl_FragColor.rgb = clamp(finalColor, 0.0, 1.0);
      `;

      shader.fragmentShader = shader.fragmentShader.replace(target, replacement);
      roomCycMat.userData.shader = shader;
    };

    const roomCyc = new THREE.Mesh(roomCycGeo, roomCycMat);
    holoRoom.add(roomCyc);

    // 5. Architectural Minimalism: Beveled Exhibition Pedestal - fully rounded top shoulder, perfectly smooth
    const pedPoints = [];
    const pedR = 1.7;
    const bevelR = 0.08;
    
    // Bottom flat
    pedPoints.push(new THREE.Vector2(0, -2.25));
    pedPoints.push(new THREE.Vector2(pedR, -2.25));
    // Side profile wall up
    pedPoints.push(new THREE.Vector2(pedR, -1.8 - bevelR));
    // Soft rounded bevel shoulder (combats harsh edge shadow lines)
    for (let i = 0; i <= 8; i++) {
      const angle = (i / 8) * (Math.PI / 2);
      const rx = pedR - bevelR + Math.cos(angle) * bevelR;
      const ry = -1.8 - bevelR + Math.sin(angle) * bevelR;
      pedPoints.push(new THREE.Vector2(rx, ry));
    }
    // Top face
    pedPoints.push(new THREE.Vector2(0, -1.8));

    const pedestalGeo = new THREE.LatheGeometry(pedPoints, 64);
    const pedestalMat = new THREE.MeshStandardMaterial({
      color: 0xdedcd8, // Fine concrete-grey
      roughness: 0.80, // Soft matte concrete
      metalness: 0.0,
    });
    const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
    holoRoom.add(pedestal);

    // Dynamic grid overlay helper (kept for API consistency but forced invisible)
    const gridHelper = new THREE.GridHelper(30, 30, 0x4f46e5, 0x1e1b4b);
    gridHelper.position.y = -4;
    gridHelper.visible = false;
    scene.add(gridHelper);
    gridHelperRef.current = gridHelper;

    // Post processing setup
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      settings.bloomIntensity,
      0.45,
      1.02
    );
    composer.addPass(bloomPass);
    bloomPassRef.current = bloomPass;

    // Apply custom velocity-based screen space motion blur pass to orbiting shards
    const motionBlurPass = new ShaderPass(MotionBlurShader);
    motionBlurPass.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
    composer.addPass(motionBlurPass);

    composerRef.current = composer;

    // Bind event handlers
    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      composer.setSize(w, h);
      motionBlurPass.uniforms.uResolution.value.set(w, h);
    };

    const handlePointerMove = (e: PointerEvent) => {
      mouseRef.current.rawX = (e.clientX / window.innerWidth) * 2 - 1;
      mouseRef.current.rawY = (e.clientY / window.innerHeight) * 2 - 1;
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('pointermove', handlePointerMove);

    // ─── Core Render Loop ──────────────────────────────────────────────────
    let animationId = 0;
    let lastTime = performance.now();
    let frameCount = 0;
    const clock = new THREE.Clock();

    const animateLoop = () => {
      animationId = requestAnimationFrame(animateLoop);

      // FPS tracking
      const time = performance.now();
      frameCount++;
      if (time >= lastTime + 1000) {
        setFps(Math.round((frameCount * 1000) / (time - lastTime)));
        frameCount = 0;
        lastTime = time;
      }

      const elapsed = clock.getElapsedTime();

      // Physics-based spring-mass-damper system for elegant fluid scrolling
      const targetScroll = scrollProgressRef.current;
      const currentScroll = scrollSpringRef.current;
      const velocityScroll = scrollVelocityRef.current;

      const stiffness = 65.0;
      const damping = 9.0;
      const simDt = 0.016; 

      const displacement = currentScroll - targetScroll;
      const springAcc = -stiffness * displacement - damping * velocityScroll;

      // Euler-Cromer integration
      scrollVelocityRef.current = velocityScroll + springAcc * simDt;
      scrollSpringRef.current = Math.max(-0.2, Math.min(1.2, currentScroll + scrollVelocityRef.current * simDt));

      // Scroll reset stabilization: prevent endless infinitesimal oscillation and completely ground the state at 0
      if (targetScroll === 0 && Math.abs(scrollSpringRef.current) < 0.001) {
        scrollSpringRef.current = 0;
        scrollVelocityRef.current = 0;
      }

      // Mirror state value to scrollSmoothRef
      scrollSmoothRef.current = scrollSpringRef.current;

      // Smooth mouse coordinates
      mouseRef.current.smoothX += (mouseRef.current.rawX - mouseRef.current.smoothX) * 0.08;
      mouseRef.current.smoothY += (mouseRef.current.rawY - mouseRef.current.smoothY) * 0.08;

      // Combine mouse tilt tracking
      const tiltScale = settings.tiltIntensity;
      rootGroupRef.current.rotation.y = mouseRef.current.smoothX * 0.5 * tiltScale;
      rootGroupRef.current.rotation.x = mouseRef.current.smoothY * 0.4 * tiltScale;
      rootGroupRef.current.rotation.z = 0;
      
      // No breathing or hovering: clean, stable pedestal placement
      rootGroupRef.current.position.y = yEntryOffsetRef.current;

      // Subtle parallax depth response on background room
      holoRoom.rotation.y = -mouseRef.current.smoothX * 0.12 * tiltScale;
      holoRoom.rotation.x = -mouseRef.current.smoothY * 0.09 * tiltScale;
      // Opposite translation to create strong stereoscopic depth separation
      holoRoom.position.x = -mouseRef.current.smoothX * 0.35 * tiltScale;
      holoRoom.position.z = -mouseRef.current.smoothY * 0.25 * tiltScale;
      // Scroll parallax
      holoRoom.position.y = scrollSmoothRef.current * -0.45;

      // Update background environment uniforms
      wallUniforms.uTime.value = elapsed;
      wallUniforms.uScroll.value = scrollSmoothRef.current;
      wallUniforms.uMouse.value.set(mouseRef.current.smoothX, mouseRef.current.smoothY);

      // Feed physical scroll speed directly into the motion blur postprocessing shader
      motionBlurPass.uniforms.uVelocity.value = scrollVelocityRef.current;

      // Handle custom behavior on entry completion
      if (entryDoneRef.current) {
        if (bloomPassRef.current) {
          bloomPassRef.current.strength = settings.bloomIntensity;
        }

        if (cameraRef.current) {
          cameraRef.current.position.set(0, 0, settings.cameraZ);
        }

        // Keep the model scale stable
        rootGroupRef.current.scale.setScalar(1.0);
      }

      // ─── SCROLL DRIVEN FRAGMENT DISASSEMBLY AND SAME AXIS ORBIT ───
      const s = Math.max(0, Math.min(1, scrollSmoothRef.current));

      shardDataRef.current.forEach((shard, i) => {
        const originalX = shard.origPos.x;
        const originalY = shard.origPos.y;
        const originalZ = shard.origPos.z;

        // Ensure currentPos and currentQuat exist for our fluid drift physical simulation
        if (!shard.currentPos) {
          shard.currentPos = shard.mesh.position.clone();
        }
        if (!shard.currentQuat) {
          shard.currentQuat = shard.mesh.quaternion.clone();
        }

        // 1. Position disassemble outward + orbit on same vertical axis
        // Calculate original horizontal radius & angle from center (x = 0, z = 0)
        const radiusBase = Math.sqrt(originalX * originalX + originalZ * originalZ) || 0.1;
        const angleBase = Math.atan2(originalZ, originalX);

        // Disassemble slowly outward under scroll: starts exactly at 0 progress and scales up
        const travelFactor = 1.0 + (i % 6) * 0.15;
        const expandedRadius = radiusBase + s * settings.fragDistance * travelFactor;

        // Same-axis horizontal orbit: angular rotation around vertical Y-axis (smooth, directly mapped to scroll progress s)
        // Alternative direction rotation creates a breathtaking interlaced structural weave during scroll
        const orbitDir = (i % 2 === 0) ? 1.0 : -1.0;
        const orbitSpeed = settings.rotationSpeed * (1.1 + (i % 5) * 0.22);
        const totalOrbitRotation = s * Math.PI * 1.6 * orbitSpeed * orbitDir;
        const currentAngle = angleBase + totalOrbitRotation;

        // Convert back to cartesian coordinates
        const rx = Math.cos(currentAngle) * expandedRadius;
        const rz = Math.sin(currentAngle) * expandedRadius;

        // Keep horizontal placement perfectly steady on the same original horizontal axis/elevation
        const ry = originalY;

        // Target position for drifting physical simulation
        const targetPos = new THREE.Vector3(rx, ry, rz);

        // 2. Rotation: Gentle, elegant structural pivot rotation driven strictly by scroll progress s (completely static at s = 0)
        const startQuat = new THREE.Quaternion().setFromEuler(shard.origRot);
        const alignQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), totalOrbitRotation);
        
        // A majestic, pristine tumble speed mapped directly to s
        const tumbleAngle = s * (shard.rotSpeed * 2.8 * settings.rotationSpeed);
        const tumbleQuat = new THREE.Quaternion().setFromAxisAngle(shard.rotAxis, tumbleAngle);

        const targetQuat = alignQuat.clone().multiply(tumbleQuat).multiply(startQuat);

        // --- SUBTLE DRIFT PHYSICS SIMULATION USING LERP / SLERP ---
        // A pristine fluid physics filter (lerp factor 0.085) handles natural mass lag and fluid tracking
        shard.currentPos.lerp(targetPos, 0.085);
        shard.currentQuat.slerp(targetQuat, 0.085);

        // Copy position and quaternion to physical elements
        shard.mesh.position.copy(shard.currentPos);
        shard.mesh.quaternion.copy(shard.currentQuat);

        // 3. Keep scale stable or slightly dynamic for deep volumetric feel
        shard.mesh.scale.copy(shard.origScale);

        // 4. Material Morph: Glistening, translucent premium crystal transition as scroll progress s deepens
        const mat = shard.mesh.material as THREE.MeshPhysicalMaterial;
        if (mat) {
          if (settings.shape === 'original_shards' && defaultTextureRef.current) {
            // Morph from model texture to refractive amethyst gemstone crystal
            const baseColor = new THREE.Color(0xffffff);
            const crystalBaseColor = new THREE.Color(0xf5e5ff); // Lavender-pink base undertone matching image
            mat.color.lerpColors(baseColor, crystalBaseColor, s);

            // True crystal refractive indices and physical transmission
            mat.transmission = THREE.MathUtils.lerp(0.0, 0.99, s);
            mat.thickness = THREE.MathUtils.lerp(0.0, 2.5, s);
            
            // Varying refraction indices per piece that react beautifully to scroll progress (simulating quartz facets)
            const facetRefractionIndex = 1.45 + (i % 5) * 0.12;
            mat.ior = THREE.MathUtils.lerp(1.5, facetRefractionIndex, s);

            mat.roughness = THREE.MathUtils.lerp(0.6, 0.05, s);
            mat.metalness = THREE.MathUtils.lerp(0.1, 0.02, s);
            mat.clearcoat = THREE.MathUtils.lerp(0.0, 1.0, s);
            mat.clearcoatRoughness = THREE.MathUtils.lerp(0.0, 0.03, s);

            // Internal amethyst neon purple/magenta glow
            const crystalGlow = new THREE.Color(0xdc35ff);
            mat.emissive.lerpColors(new THREE.Color(0x000000), crystalGlow, s);
            mat.emissiveIntensity = THREE.MathUtils.lerp(0.0, 0.55, s);
            mat.transparent = true;
            mat.opacity = 1.0;
          } else {
            // Morph from procedural preset to refractive glowing crystal
            const baseColor = new THREE.Color(0xffffff);
            const crystalBaseColor = new THREE.Color(0xf5e5ff);
            mat.color.lerpColors(baseColor, crystalBaseColor, s);

            mat.transmission = THREE.MathUtils.lerp(0.0, 0.99, s);
            mat.thickness = THREE.MathUtils.lerp(0.0, 2.5, s);
            
            const facetRefractionIndex = 1.45 + (i % 5) * 0.12;
            mat.ior = THREE.MathUtils.lerp(1.5, facetRefractionIndex, s);

            const startRough = settings.texture === 'obsidian_noir' ? 0.05 : 0.2;
            const startMetal = settings.texture === 'gold_leaf' ? 1.0 : settings.texture === 'obsidian_noir' ? 0.9 : 0.4;
            mat.roughness = THREE.MathUtils.lerp(startRough, 0.05, s);
            mat.metalness = THREE.MathUtils.lerp(startMetal, 0.02, s);
            mat.clearcoat = THREE.MathUtils.lerp(1.0, 1.0, s);
            mat.clearcoatRoughness = THREE.MathUtils.lerp(0.1, 0.03, s);

            // Custom procedural glow blending
            const crystalGlow = new THREE.Color(0xdc35ff);
            let startGlowColor = new THREE.Color(0x000000);
            let startGlowInt = 0.0;
            if (settings.texture === 'vulcan_ruby') {
              startGlowColor = new THREE.Color(0xff3300);
              startGlowInt = 0.8;
            } else if (settings.texture === 'cyber_hologram') {
              startGlowColor = new THREE.Color(0x00f0ff);
              startGlowInt = 0.5;
            } else if (settings.texture === 'mystic_amethyst') {
              startGlowColor = new THREE.Color(0xcb50eb);
              startGlowInt = 0.6;
            }

            const targetGlowColor = new THREE.Color().lerpColors(startGlowColor, crystalGlow, s);
            const targetGlowInt = THREE.MathUtils.lerp(startGlowInt, 0.55, s);
            mat.emissive.copy(targetGlowColor);
            mat.emissiveIntensity = targetGlowInt;
            mat.transparent = true;
            mat.opacity = 1.0;
          }

          // Update metallic/holographic shader uniforms
          if (mat.userData.shader && mat.userData.shader.uniforms) {
            mat.userData.shader.uniforms.uTime.value = elapsed;
            if (mat.userData.shader.uniforms.uScrollBlend) {
              mat.userData.shader.uniforms.uScrollBlend.value = s;
            }
          }
        }
      });

      // Maintain viewport focus
      if (cameraRef.current) {
        cameraRef.current.lookAt(0, 0, 0);
      }

      // Render actual Frame or Post processing passes
      if (composerRef.current) {
        composerRef.current.render();
      }
    };

    animateLoop();

    // Cleanups on component unmount
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('pointermove', handlePointerMove);

      // Dispose materials, geometries, and textures to avoid memory leaks
      scene.traverse((obj) => {
        if (obj instanceof Reflector) {
          try {
            obj.getRenderTarget().dispose();
          } catch (e) {}
        }
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
          if (obj.geometry) {
            obj.geometry.dispose();
          }
          if (obj.material) {
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
            mats.forEach((m) => {
              if (m.map) m.map.dispose();
              if (m.lightMap) m.lightMap.dispose();
              if (m.bumpMap) m.bumpMap.dispose();
              if (m.normalMap) m.normalMap.dispose();
              if (m.specularMap) m.specularMap.dispose();
              if (m.emissiveMap) m.emissiveMap.dispose();
              m.dispose();
            });
          }
        }
      });

      if (scene.environment) {
        scene.environment.dispose();
        scene.environment = null;
      }

      if (activeTextureRef.current) {
        activeTextureRef.current.dispose();
        activeTextureRef.current = null;
      }
      if (defaultTextureRef.current) {
        defaultTextureRef.current.dispose();
        defaultTextureRef.current = null;
      }

      if (composer) {
        composer.dispose();
      }
      if (bloomPass) {
        bloomPass.dispose();
      }
      if (motionBlurPass) {
        motionBlurPass.dispose();
      }

      renderer.dispose();
    };
  }, []);

  // 2. Re-trigger shape/texture updates dynamically when settings change
  useEffect(() => {
    if (!sceneRef.current) return;

    entryDoneRef.current = false;

    // Clear old meshes
    while (rootGroupRef.current.children.length > 0) {
      const child = rootGroupRef.current.children[0];
      rootGroupRef.current.remove(child);
    }

    shardDataRef.current.forEach((shard) => {
      shard.mesh.geometry.dispose();
      if (Array.isArray(shard.mesh.material)) {
        shard.mesh.material.forEach(m => m.dispose());
      } else {
        shard.mesh.material.dispose();
      }
    });
    shardDataRef.current = [];

    let meshes: THREE.Mesh[] = [];
    let centroids: THREE.Vector3[] = [];
    let baseGeometryToDispose: THREE.BufferGeometry | null = null;

    if (settings.shape === 'original_shards') {
      if (loadedBinaryMeshesRef.current) {
        const tempGroup = new THREE.Group();
        loadedBinaryMeshesRef.current.forEach((item) => {
          const geom = item.geometry.clone();
          const mat = new THREE.MeshPhysicalMaterial({
            roughness: 0.15,
            metalness: 0.85,
            clearcoat: 1.0,
            clearcoatRoughness: 0.1,
          });
          const mesh = new THREE.Mesh(geom, mat);
          mesh.applyMatrix4(item.localMatrix.clone());
          tempGroup.add(mesh);
        });

        const box = new THREE.Box3().setFromObject(tempGroup);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const targetHeight = 3.6;
        const scaleFactor = targetHeight / (size.y || 1);

        loadedBinaryMeshesRef.current.forEach((item, idx) => {
          const mesh = tempGroup.children[idx] as THREE.Mesh;
          mesh.position.sub(center);
          mesh.scale.multiplyScalar(scaleFactor);
          mesh.position.multiplyScalar(scaleFactor);
          
          mesh.geometry.computeBoundingBox();
          const localCenter = mesh.geometry.boundingBox!.getCenter(new THREE.Vector3());
          mesh.updateMatrix();
          const worldCenter = localCenter.clone().applyMatrix4(mesh.matrix);

          meshes.push(mesh);
          centroids.push(worldCenter);
        });
      } else {
        return;
      }
    } else {
      const baseGeom = createBaseGeometry(settings.shape);
      const frag = fragmentGeometry(baseGeom, 8);
      baseGeom.dispose(); 
      meshes = frag.meshes;
      centroids = frag.centroids;
    }

    // Generate dynamic canvas material
    if (activeTextureRef.current) {
      activeTextureRef.current.dispose();
    }
    const texture = getProceduralTexture(settings.texture);
    activeTextureRef.current = texture;

    // Add meshes to root container
    const group = new THREE.Group();
    meshes.forEach((mesh, index) => {
      const originalMat = mesh.material as THREE.MeshPhysicalMaterial;

      if (settings.shape === 'original_shards' && defaultTextureRef.current) {
        originalMat.map = defaultTextureRef.current;
        originalMat.roughness = 0.6;
        originalMat.metalness = 0.1;
        originalMat.clearcoat = 0.0;
        originalMat.clearcoatRoughness = 0.0;
        originalMat.emissive.setHex(0x000000);
        originalMat.emissiveIntensity = 0;
        originalMat.wireframe = false;
      } else {
        originalMat.map = texture;
        originalMat.roughness = settings.texture === 'obsidian_noir' ? 0.05 : 0.2;
        originalMat.metalness = settings.texture === 'gold_leaf' ? 1.0 : settings.texture === 'obsidian_noir' ? 0.9 : 0.4;
        originalMat.clearcoat = 1.0;
        originalMat.clearcoatRoughness = 0.1;

        if (settings.texture === 'vulcan_ruby') {
          originalMat.emissive.setHex(0xff3300);
          originalMat.emissiveIntensity = 0.8;
        } else if (settings.texture === 'cyber_hologram') {
          originalMat.emissive.setHex(0x00f0ff);
          originalMat.emissiveIntensity = 0.5;
          originalMat.wireframe = true; 
        } else if (settings.texture === 'mystic_amethyst') {
          originalMat.emissive.setHex(0xcb50eb);
          originalMat.emissiveIntensity = 0.6;
        }
      }

      // Apply a custom Fresnel Metallic/Holographic edge reflection shader to ALL materials
      originalMat.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = { value: 0 };
        shader.uniforms.uFresnelPower = { value: 4.5 };
        shader.uniforms.uFresnelIntensity = { value: 2.2 };
        shader.uniforms.uScrollBlend = { value: 0.0 };

        // Pass the model's local coordinates to the fragment shader
        shader.vertexShader = `
          varying vec3 vModelPos;
        ` + shader.vertexShader.replace(
          '#include <begin_vertex>',
          `
          #include <begin_vertex>
          vModelPos = position;
          `
        );

        shader.fragmentShader = `
          uniform float uTime;
          uniform float uFresnelPower;
          uniform float uFresnelIntensity;
          uniform float uScrollBlend;
          varying vec3 vModelPos;
        ` + shader.fragmentShader;

        // 1. Inject the magnificent crystal gradient into the diffuse color before standard lighting is computed!
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <color_fragment>',
          `
          #include <color_fragment>
          
          // Map normalized vertical y reference of the bust model [0.0, 1.0]
          float h = clamp((vModelPos.y + 1.8) / 3.6, 0.0, 1.0);

          // Magnificent reference crystal colors from raw image input:
          // Low: Peach-Amber (vec3(1.0, 0.58, 0.38))
          // Mid: Amethyst Magento-Violet (vec3(0.72, 0.10, 0.82))
          // High: Bright Aquamarine Cyan (vec3(0.02, 0.76, 0.94))
          // Tip: Ice-White Translucent (vec3(0.85, 0.95, 1.0))
          vec3 crystalGrad;
          if (h < 0.25) {
            crystalGrad = mix(vec3(1.0, 0.58, 0.38), vec3(0.72, 0.10, 0.82), h / 0.25);
          } else if (h < 0.65) {
            crystalGrad = mix(vec3(0.72, 0.10, 0.82), vec3(0.02, 0.76, 0.94), (h - 0.25) / 0.40);
          } else {
            crystalGrad = mix(vec3(0.02, 0.76, 0.94), vec3(0.85, 0.95, 1.0), (h - 0.65) / 0.35);
          }

          // Shimmering multi-tonal refraction facet logic shifting dynamically
          vec3 shimmer = vec3(
            sin(uTime * 1.5 + vModelPos.x * 0.5) * 0.06,
            sin(uTime * 1.2 + vModelPos.y * 0.4) * 0.04,
            sin(uTime * 1.8 + vModelPos.z * 0.6) * 0.06
          );
          vec3 baseCrystal = clamp(crystalGrad + shimmer, 0.0, 1.0);

          // Merge crystal rendering with standard diffuse color
          diffuseColor.rgb = mix(diffuseColor.rgb, baseCrystal, uScrollBlend);
          `
        );

        // 2. Inject spectacular iridescent edge sheens and facet-star starbursts at the end
        const target = '#include <dithering_fragment>';
        const replacement = `
          #include <dithering_fragment>

          vec3 viewDir = normalize(vViewPosition);
          vec3 normalVec = normalize(vNormal);

          // Fresnel equation for metallic edge reflection at grazing angles
          float fresnel = pow(1.0 - max(0.0, dot(normalVec, viewDir)), uFresnelPower);

          // Animated iridescent edge sheen shifting with time to evoke ice crystals
          vec3 edgeIridescence = vec3(
            0.6 + 0.4 * sin(uTime * 1.8 + vViewPosition.z * 1.2),
            0.5 + 0.5 * sin(uTime * 1.3 + vViewPosition.y * 1.1),
            1.0
          );
          vec3 edgeFresnelColor = edgeIridescence * fresnel * uFresnelIntensity;

          // Glistening physical facet-star speckle highlights matching raw image
          float sparkle = pow(max(0.0, dot(normalVec, viewDir)), 32.0);
          vec3 sparkleHighlight = vec3(1.0, 0.97, 0.92) * sparkle * 1.5;

          // Add spectacular crystal edge sheen and glistening sparkles
          gl_FragColor.rgb += (edgeFresnelColor * 0.40 + sparkleHighlight) * uScrollBlend;
        `;

        shader.fragmentShader = shader.fragmentShader.replace(target, replacement);
        originalMat.userData.shader = shader;
      };

      mesh.material = originalMat;
      group.add(mesh);

      // trajectories TrajectoryTraj
      const dir = centroids[index].lengthSq() > 0.001
        ? centroids[index].clone().normalize()
        : new THREE.Vector3(
            Math.random() - 0.5,
            Math.random() - 0.5,
            Math.random() - 0.5
          ).normalize();

      shardDataRef.current.push({
        mesh,
        origPos: mesh.position.clone(),
        origScale: mesh.scale.clone(),
        origRot: mesh.rotation.clone(),
        dir,
        rotAxis: new THREE.Vector3(
          Math.random() - 0.5,
          Math.random() - 0.5,
          Math.random() - 0.5
        ).normalize(),
        rotSpeed: Math.random() * 0.8 + 0.4,
      });
    });

    // Cascade animation ordering
    shardDataRef.current.sort((a, b) => b.origPos.y - a.origPos.y);

    rootGroupRef.current.add(group);
    
    if (baseGeometryToDispose) {
      baseGeometryToDispose.dispose();
    }

    triggerScatterAppearance();
  }, [settings.shape, settings.texture, binLoaded]);

  // Adjust settings changes
  useEffect(() => {
    if (bloomPassRef.current) {
      bloomPassRef.current.strength = settings.bloomIntensity;
    }
    if (gridHelperRef.current) {
      gridHelperRef.current.visible = settings.showGrid;
    }
    if (cameraRef.current) {
      cameraRef.current.position.z = settings.cameraZ;
    }
  }, [settings.bloomIntensity, settings.showGrid, settings.cameraZ]);

  // Entry sequence
  const triggerScatterAppearance = () => {
    if (shardDataRef.current.length === 0) return;

    shardDataRef.current.forEach((shard) => {
      shard.mesh.position.copy(shard.origPos);
      shard.mesh.quaternion.setFromEuler(shard.origRot);
    });

    yEntryOffsetRef.current = -1.5;
    rootGroupRef.current.scale.set(0.1, 0.1, 0.1);

    gsap.killTweensOf(yEntryOffsetRef);
    gsap.killTweensOf(rootGroupRef.current.scale);

    const animObj = { yOffset: -1.5 };
    gsap.to(animObj, {
      yOffset: 0,
      duration: 1.6,
      ease: 'power3.out',
      onUpdate: () => {
        yEntryOffsetRef.current = animObj.yOffset;
      },
      onComplete: () => {
        entryDoneRef.current = true;
      }
    });

    gsap.to(rootGroupRef.current.scale, {
      x: 1,
      y: 1,
      z: 1,
      duration: 1.6,
      ease: 'power3.out',
    });
  };

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden select-none">
      <canvas ref={canvasRef} className="w-full h-full block cursor-default" id="webgl" />
    </div>
  );
});

ThreeCanvas.displayName = 'ThreeCanvas';
