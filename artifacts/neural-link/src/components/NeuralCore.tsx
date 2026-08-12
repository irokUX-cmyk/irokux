import { useEffect, useRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

type Mode = "idle" | "listening" | "generating" | "speaking";

/**
 * NeuralCore — restrained, cinematic holographic core (not "shiny").
 * Design intent: dark negative space, a small precise hot center, thin
 * filaments and rings that are dim until they react. Bloom is subtle.
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
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.z = 5.4;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    // restrained palette
    const gold = new THREE.Color("#e8a23c");
    const goldDeep = new THREE.Color("#7a5418");
    const hot = new THREE.Color("#fff1cf");
    const accent = new THREE.Color("#5fe0ff");

    const core = new THREE.Group();
    scene.add(core);

    // small precise hot center (the actual "light source") — kept small + tight
    const center = new THREE.Mesh(
      new THREE.SphereGeometry(0.34, 32, 32),
      new THREE.MeshBasicMaterial({ color: hot.clone(), transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    core.add(center);

    // very faint volumetric shell — NOT a glowing blob
    const shell = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.15, 3),
      new THREE.MeshBasicMaterial({ color: gold.clone(), transparent: true, opacity: 0.045, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    core.add(shell);

    // thin equatorial rings (precise, dim)
    const ringMat = new THREE.MeshBasicMaterial({ color: gold.clone(), transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.012, 12, 160), ringMat);
    core.add(ring);
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(1.12, 0.008, 10, 160), ringMat.clone());
    ring2.rotation.x = Math.PI / 2.4;
    core.add(ring2);

    // faint cage — barely there
    const cage = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.42, 1),
      new THREE.MeshBasicMaterial({ color: goldDeep.clone(), transparent: true, opacity: 0.09, wireframe: true, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    core.add(cage);

    // thin filaments — dim, precise, few
    const FIL = 60;
    const filPos = new Float32Array(FIL * 2 * 3);
    for (let i = 0; i < FIL; i++) {
      const r0 = 0.5 + Math.random() * 0.25;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      const dir = new THREE.Vector3(Math.sin(ph) * Math.cos(th), Math.sin(ph) * Math.sin(th), Math.cos(ph));
      const len = 1.3 + Math.random() * 2.2;
      filPos[i * 6 + 0] = dir.x * r0; filPos[i * 6 + 1] = dir.y * r0; filPos[i * 6 + 2] = dir.z * r0;
      filPos[i * 6 + 3] = dir.x * len; filPos[i * 6 + 4] = dir.y * len; filPos[i * 6 + 5] = dir.z * len;
    }
    const filGeo = new THREE.BufferGeometry();
    filGeo.setAttribute("position", new THREE.BufferAttribute(filPos, 3));
    const filMat = new THREE.LineBasicMaterial({ color: gold.clone(), transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false });
    const filaments = new THREE.LineSegments(filGeo, filMat);
    core.add(filaments);

    // concentric broken arcs — thin, dim
    const arcs: THREE.Mesh[] = [];
    for (let i = 0; i < 2; i++) {
      const a = new THREE.Mesh(
        new THREE.TorusGeometry(1.8 + i * 0.45, 0.006, 6, 160, Math.PI * (1.1 + i * 0.35)),
        new THREE.MeshBasicMaterial({ color: goldDeep.clone(), transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }),
      );
      a.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      arcs.push(a); core.add(a);
    }

    // sparse dust — few, small, dim
    const sprite = (() => {
      const c = document.createElement("canvas"); c.width = c.height = 64;
      const g = c.getContext("2d")!;
      const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grd.addColorStop(0, "rgba(255,240,210,0.9)");
      grd.addColorStop(0.4, "rgba(230,162,60,0.4)");
      grd.addColorStop(1, "rgba(230,162,60,0)");
      g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
      return new THREE.CanvasTexture(c);
    })();
    const DUST = 500;
    const dPos = new Float32Array(DUST * 3);
    const dSpd = new Float32Array(DUST);
    for (let i = 0; i < DUST; i++) {
      const r = 2.5 + Math.random() * 4;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      dPos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      dPos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
      dPos[i * 3 + 2] = r * Math.cos(ph);
      dSpd[i] = 0.08 + Math.random() * 0.4;
    }
    const dGeo = new THREE.BufferGeometry();
    dGeo.setAttribute("position", new THREE.BufferAttribute(dPos, 3));
    const dMat = new THREE.PointsMaterial({ size: 0.05, map: sprite, color: gold.clone(), transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false });
    const dust = new THREE.Points(dGeo, dMat);
    scene.add(dust);

    // subtle bloom (low strength, high threshold so only the hot core blooms)
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.5, 0.7, 0.55);
    composer.addPass(bloom);

    // interaction
    const onResize = () => {
      const w = mount.clientWidth, h = mount.clientHeight;
      renderer.setSize(w, h, false); composer.setSize(w, h);
      camera.aspect = w / h; camera.updateProjectionMatrix();
    };
    const onMove = (e: PointerEvent) => {
      const r = mount.getBoundingClientRect();
      pointerRef.current.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      pointerRef.current.y = ((e.clientY - r.top) / r.height) * 2 - 1;
      if (pointerRef.current.down) { rotRef.current.vy = pointerRef.current.x * 0.008; rotRef.current.vx = pointerRef.current.y * 0.008; }
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

    const tmp = new THREE.Color();
    let t = 0;
    const clock = new THREE.Clock();
    let raf = 0;

    const animate = () => {
      raf = requestAnimationFrame(animate);
      const dt = clock.getDelta();
      t += dt;
      const m = modeRef.current;
      const energy = energyRef.current;

      const baseSpin = m === "generating" ? 0.5 : m === "speaking" ? 0.32 : 0.1;
      core.rotation.y += (baseSpin + energy * 0.8) * dt;
      core.rotation.x += (0.06 + energy * 0.3) * dt;
      filaments.rotation.y -= (0.04 + energy * 0.15) * dt;
      arcs.forEach((a, i) => { a.rotation.z += (0.03 + i * 0.015) * dt; });
      dust.rotation.y -= (0.02 + energy * 0.1) * dt;

      const tiltX = (pointerRef.current.y * 0.35 + gyroRef.current.y * 0.65) * 0.5;
      const tiltY = (pointerRef.current.x * 0.35 + gyroRef.current.x * 0.65) * 0.5;
      core.rotation.x += (tiltX - core.rotation.x) * 0.05;
      scene.rotation.y += (tiltY - scene.rotation.y) * 0.05;

      // gentle breathing — small
      core.scale.setScalar(1 + Math.sin(t * 1.0) * 0.018 + energy * 0.06);

      // color: gold, with a faint cyan only while generating
      const genMix = m === "generating" ? Math.min(1, 0.4 + energy) : 0;
      tmp.copy(gold).lerp(accent, genMix * 0.5);
      (shell.material as THREE.MeshBasicMaterial).color.lerp(tmp, 0.05);
      (ring.material as THREE.MeshBasicMaterial).color.lerp(tmp, 0.05);
      (ring2.material as THREE.MeshBasicMaterial).color.lerp(tmp, 0.05);
      (filMat).color.lerp(tmp, 0.04);
      (center.material as THREE.MeshBasicMaterial).color.lerp(hot.clone().lerp(accent, genMix * 0.4), 0.06);

      // keep things dim by default; only push a little on generate/speak
      (center.material as THREE.MeshBasicMaterial).opacity = 0.9 + energy * 0.08;
      (ring.material as THREE.MeshBasicMaterial).opacity = 0.32 + energy * 0.2;
      (filMat).opacity = 0.1 + energy * 0.18 + (m === "generating" ? 0.06 : 0);
      bloom.strength = 0.45 + energy * 0.3 + (m === "generating" ? 0.15 : 0);

      const dp = dGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < DUST; i++) {
        let z = dp.array[i * 3 + 2] as number;
        z -= dSpd[i] * dt * (0.35 + energy);
        if (z < -5.5) z = 5.5;
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
      renderer.dispose(); composer.dispose();
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
