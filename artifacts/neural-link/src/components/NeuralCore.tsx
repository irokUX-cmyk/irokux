import { useEffect, useRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

type Mode = "idle" | "listening" | "generating" | "speaking";

/**
 * NeuralCore — a holographic, transparent, reactive energy core.
 * Style reference: golden/amber glass orb, hot white center, radiating
 * filaments, concentric rings, faint cage, floating dust (UnrealBloom glow).
 *
 * - Idle / listening / speaking: warm gold (like the reference image).
 * - Generating: white-hot surge + cyan accent (clear "thinking" signal).
 * - Pointer drag rotates; mobile gyroscope tilts the core.
 * - Audio amplitude (energyRef 0..1) pulses the core while speaking.
 */
export function NeuralCore({ mode, energyRef }: { mode: Mode; energyRef: React.MutableRefObject<number> }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const modeRef = useRef<Mode>(mode);
  const rotRef = useRef({ x: 0, y: 0, vx: 0, vy: 0 });
  const pointerRef = useRef({ x: 0, y: 0, down: false });
  const gyroRef = useRef({ x: 0, y: 0 });

  useEffect(() => { modeRef.current = mode; }, [mode]);

  useEffect(() => {
    const mount = mountRef.current!;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
    camera.position.z = 4.6;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    // ---------- palette ----------
    const gold = new THREE.Color("#ffc24d");
    const goldDeep = new THREE.Color("#c8861f");
    const hot = new THREE.Color("#fff4d6");
    const accent = new THREE.Color("#5fe0ff"); // generating signal

    // ---------- core group ----------
    const core = new THREE.Group();
    scene.add(core);

    // hot inner center (additive, self-lit)
    const center = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 32, 32),
      new THREE.MeshBasicMaterial({ color: hot.clone(), transparent: true, opacity: 0.92, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    core.add(center);

    // glassy volume shell (transparent)
    const shell = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.25, 4),
      new THREE.MeshBasicMaterial({ color: gold.clone(), transparent: true, opacity: 0.10, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    core.add(shell);

    // central ring (the bright torus from the reference)
    const ringMat = new THREE.MeshBasicMaterial({ color: gold.clone(), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.04, 16, 120), ringMat);
    core.add(ring);
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(1.18, 0.018, 12, 120), ringMat.clone());
    ring2.rotation.x = Math.PI / 2.2;
    core.add(ring2);

    // faint wireframe cage
    const cage = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.5, 1),
      new THREE.MeshBasicMaterial({ color: goldDeep.clone(), transparent: true, opacity: 0.16, wireframe: true, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    core.add(cage);

    // ---------- radiating filaments (starburst lines) ----------
    const FIL = 90;
    const filPos = new Float32Array(FIL * 2 * 3);
    for (let i = 0; i < FIL; i++) {
      const r0 = 0.6 + Math.random() * 0.3;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      const dir = new THREE.Vector3(Math.sin(ph) * Math.cos(th), Math.sin(ph) * Math.sin(th), Math.cos(ph));
      const len = 1.4 + Math.random() * 2.6;
      filPos[i * 6 + 0] = dir.x * r0; filPos[i * 6 + 1] = dir.y * r0; filPos[i * 6 + 2] = dir.z * r0;
      filPos[i * 6 + 3] = dir.x * len; filPos[i * 6 + 4] = dir.y * len; filPos[i * 6 + 5] = dir.z * len;
    }
    const filGeo = new THREE.BufferGeometry();
    filGeo.setAttribute("position", new THREE.BufferAttribute(filPos, 3));
    const filMat = new THREE.LineBasicMaterial({ color: gold.clone(), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false });
    const filaments = new THREE.LineSegments(filGeo, filMat);
    core.add(filaments);

    // ---------- concentric outer rings (fragmented arcs) ----------
    const arcs: THREE.Mesh[] = [];
    const arcMat = new THREE.MeshBasicMaterial({ color: goldDeep.clone(), transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false });
    for (let i = 0; i < 3; i++) {
      const a = new THREE.Mesh(new THREE.TorusGeometry(1.9 + i * 0.5, 0.01, 8, 160, Math.PI * (1.2 + i * 0.3)), arcMat.clone());
      a.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      arcs.push(a); core.add(a);
    }

    // ---------- floating dust ----------
    const sprite = (() => {
      const c = document.createElement("canvas"); c.width = c.height = 64;
      const g = c.getContext("2d")!;
      const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grd.addColorStop(0, "rgba(255,255,255,1)");
      grd.addColorStop(0.3, "rgba(255,200,120,0.8)");
      grd.addColorStop(1, "rgba(255,160,40,0)");
      g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
      const t = new THREE.CanvasTexture(c); return t;
    })();
    const DUST = 900;
    const dPos = new Float32Array(DUST * 3);
    const dSpd = new Float32Array(DUST);
    for (let i = 0; i < DUST; i++) {
      const r = 2 + Math.random() * 4;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      dPos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      dPos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
      dPos[i * 3 + 2] = r * Math.cos(ph);
      dSpd[i] = 0.1 + Math.random() * 0.5;
    }
    const dGeo = new THREE.BufferGeometry();
    dGeo.setAttribute("position", new THREE.BufferAttribute(dPos, 3));
    const dMat = new THREE.PointsMaterial({ size: 0.09, map: sprite, color: gold.clone(), transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false });
    const dust = new THREE.Points(dGeo, dMat);
    scene.add(dust);

    // ---------- post-processing (bloom = the glow) ----------
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 1.15, 0.55, 0.0);
    composer.addPass(bloom);

    // ---------- interaction ----------
    const onResize = () => {
      const w = mount.clientWidth, h = mount.clientHeight;
      renderer.setSize(w, h, false);
      composer.setSize(w, h);
      camera.aspect = w / h; camera.updateProjectionMatrix();
    };
    const onMove = (e: PointerEvent) => {
      const r = mount.getBoundingClientRect();
      pointerRef.current.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      pointerRef.current.y = ((e.clientY - r.top) / r.height) * 2 - 1;
      if (pointerRef.current.down) { rotRef.current.vy = pointerRef.current.x * 0.01; rotRef.current.vx = pointerRef.current.y * 0.01; }
    };
    const onDown = () => { pointerRef.current.down = true; };
    const onUp = () => { pointerRef.current.down = false; rotRef.current.vx *= 0.6; rotRef.current.vy *= 0.6; };
    mount.addEventListener("pointermove", onMove);
    mount.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    const onGyro = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      gyroRef.current.x = THREE.MathUtils.clamp(e.gamma / 45, -1, 1);
      gyroRef.current.y = THREE.MathUtils.clamp((e.beta - 45) / 45, -1, 1);
    };
    window.addEventListener("deviceorientation", onGyro);
    onResize();
    const ro = new ResizeObserver(onResize);
    ro.observe(mount);

    // ---------- color targets per mode ----------
    const tmp = new THREE.Color();
    const tmpHot = new THREE.Color();
    let t = 0;
    const clock = new THREE.Clock();
    let raf = 0;

    const animate = () => {
      raf = requestAnimationFrame(animate);
      const dt = clock.getDelta();
      t += dt;
      const m = modeRef.current;
      const energy = energyRef.current; // 0..1 (audio / surge)

      // rotation
      const baseSpin = m === "generating" ? 0.8 : m === "speaking" ? 0.45 : 0.16;
      core.rotation.y += (baseSpin + energy * 1.2) * dt;
      core.rotation.x += (0.1 + energy * 0.5) * dt;
      filaments.rotation.y -= (0.05 + energy * 0.2) * dt;
      arcs.forEach((a, i) => { a.rotation.z += (0.05 + i * 0.02) * dt; });
      dust.rotation.y -= (0.03 + energy * 0.15) * dt;

      // pointer / gyro tilt
      const tiltX = (pointerRef.current.y * 0.4 + gyroRef.current.y * 0.6) * 0.6;
      const tiltY = (pointerRef.current.x * 0.4 + gyroRef.current.x * 0.6) * 0.6;
      core.rotation.x += (tiltX - core.rotation.x) * 0.05;
      scene.rotation.y += (tiltY - scene.rotation.y) * 0.05;

      // breathing + surge scale
      const breathe = 1 + Math.sin(t * 1.2) * 0.025;
      const surge = energy * 0.16 + (m === "generating" ? 0.06 + Math.sin(t * 7) * 0.03 : 0);
      core.scale.setScalar(breathe + surge);

      // ---- color logic ----
      // idle/listening/speaking = gold; generating = white-hot + cyan accent
      const genMix = m === "generating" ? Math.min(1, 0.5 + energy) : 0;
      // base body color
      tmp.copy(gold).lerp(accent, genMix * 0.7);
      tmpHot.copy(hot).lerp(accent, genMix * 0.5);
      (shell.material as THREE.MeshBasicMaterial).color.lerp(tmp, 0.08);
      (ring.material as THREE.MeshBasicMaterial).color.lerp(tmpHot, 0.08);
      (ring2.material as THREE.MeshBasicMaterial).color.lerp(tmpHot, 0.08);
      (cage.material as THREE.MeshBasicMaterial).color.lerp(goldDeep.clone().lerp(accent, genMix * 0.6), 0.08);
      (filMat).color.lerp(tmp, 0.06);
      (center.material as THREE.MeshBasicMaterial).color.lerp(tmpHot, 0.1);
      (dMat.color as THREE.Color).lerp(tmp, 0.04);

      // opacity / intensity reacts to energy + mode
      const coreOpacity = 0.85 + energy * 0.1 + (m === "generating" ? 0.05 : 0);
      (center.material as THREE.MeshBasicMaterial).opacity = coreOpacity;
      (ring.material as THREE.MeshBasicMaterial).opacity = 0.7 + energy * 0.25;
      (filMat).opacity = 0.28 + energy * 0.4 + (m === "generating" ? 0.15 : 0);
      bloom.strength = 1.0 + energy * 0.9 + (m === "generating" ? 0.4 : 0);

      // dust drift
      const dp = dGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < DUST; i++) {
        let z = dp.array[i * 3 + 2] as number;
        z -= dSpd[i] * dt * (0.4 + energy);
        if (z < -5) z = 5;
        dp.array[i * 3 + 2] = z;
      }
      dp.needsUpdate = true;

      composer.render();
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      mount.removeEventListener("pointermove", onMove);
      mount.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("deviceorientation", onGyro);
      renderer.dispose();
      composer.dispose();
      scene.traverse((o) => {
        const any = o as THREE.Mesh;
        if (any.geometry) any.geometry.dispose();
        const mat = any.material as THREE.Material | THREE.Material[];
        if (Array.isArray(mat)) mat.forEach((mm) => mm.dispose());
        else if (mat) mat.dispose();
      });
      sprite.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} className="neural-core" aria-hidden />;
}
