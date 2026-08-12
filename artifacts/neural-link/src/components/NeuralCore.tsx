import { useEffect, useRef } from "react";
import * as THREE from "three";

type Mode = "idle" | "listening" | "generating" | "speaking";

/**
 * NeuralCore — a reactive 3D orb.
 * - Idle: slow breathing rotation, calm cyan.
 * - Listening: leans toward the pointer, brighter.
 * - Generating: energy surges, color shifts cyan -> violet, faster spin + pulse.
 * - Speaking: warm pulse synchronized to audio amplitude (setEnergy 0..1).
 * Pointer drag rotates; device gyroscope (mobile) tilts the core.
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
    camera.position.z = 4.2;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    // ---- Core mesh: icosahedron with a fresnel-ish shader-ish material ----
    const geo = new THREE.IcosahedronGeometry(1.25, 6);
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#0bd3ff"),
      emissive: new THREE.Color("#0a4d63"),
      emissiveIntensity: 1.1,
      metalness: 0.35,
      roughness: 0.25,
      flatShading: true,
      transparent: true,
      opacity: 0.92,
    });
    const core = new THREE.Mesh(geo, mat);
    scene.add(core);

    // wireframe overlay
    const wire = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.34, 2),
      new THREE.MeshBasicMaterial({ color: "#3ff0ff", wireframe: true, transparent: true, opacity: 0.18 }),
    );
    scene.add(wire);

    // inner glow
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.85, 32, 32),
      new THREE.MeshBasicMaterial({ color: "#0bd3ff", transparent: true, opacity: 0.12 }),
    );
    scene.add(glow);

    // ---- Particle field ----
    const COUNT = 1400;
    const positions = new Float32Array(COUNT * 3);
    const speeds = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      const r = 2.2 + Math.random() * 2.6;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(ph) * Math.cos(th);
      positions[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
      positions[i * 3 + 2] = r * Math.cos(ph);
      speeds[i] = 0.2 + Math.random() * 0.8;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const pMat = new THREE.PointsMaterial({
      color: "#62f4ff", size: 0.035, transparent: true, opacity: 0.55, depthWrite: false,
    });
    const points = new THREE.Points(pGeo, pMat);
    scene.add(points);

    // lights
    scene.add(new THREE.AmbientLight(0x223344, 1.2));
    const key = new THREE.PointLight(0x33e6ff, 60, 50);
    key.position.set(4, 4, 6);
    scene.add(key);
    const rim = new THREE.PointLight(0x7a5bff, 40, 50);
    rim.position.set(-5, -3, 2);
    scene.add(rim);

    // ---- interaction ----
    const onResize = () => {
      const w = mount.clientWidth, h = mount.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
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

    // color targets per mode
    const calm = new THREE.Color("#0bd3ff");
    const hot = new THREE.Color("#9a5bff");
    const listen = new THREE.Color("#22e0a0");
    const speak = new THREE.Color("#ffb24d");
    const tmp = new THREE.Color();
    let t = 0;

    const clock = new THREE.Clock();
    let raf = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      const dt = clock.getDelta();
      t += dt;
      const m = modeRef.current;
      const energy = energyRef.current; // 0..1 from audio / generating surge

      // base spin
      const baseSpin = m === "generating" ? 0.9 : m === "speaking" ? 0.5 : 0.18;
      core.rotation.y += (baseSpin + energy * 1.4) * dt;
      core.rotation.x += (0.12 + energy * 0.6) * dt;
      wire.rotation.copy(core.rotation);
      wire.rotation.y -= 0.15 * dt;
      points.rotation.y -= (0.04 + energy * 0.2) * dt;

      // pointer / gyro tilt
      const tiltX = (pointerRef.current.y * 0.4 + gyroRef.current.y * 0.6) * 0.6;
      const tiltY = (pointerRef.current.x * 0.4 + gyroRef.current.x * 0.6) * 0.6;
      core.rotation.x += (tiltX - core.rotation.x) * 0.05;
      scene.rotation.y += (tiltY - scene.rotation.y) * 0.05;

      // pulse scale
      const breathe = 1 + Math.sin(t * 1.3) * 0.03;
      const surge = energy * 0.18;
      const s = breathe + surge;
      core.scale.setScalar(s);
      glow.scale.setScalar(s * 0.95);

      // color
      if (m === "generating") tmp.copy(calm).lerp(hot, Math.min(1, 0.4 + energy));
      else if (m === "listening") tmp.copy(listen);
      else if (m === "speaking") tmp.copy(calm).lerp(speak, 0.5 + energy * 0.5);
      else tmp.copy(calm);
      mat.color.lerp(tmp, 0.08);
      mat.emissive.lerp(tmp, 0.08);
      (pMat.color as THREE.Color).lerp(tmp, 0.05);
      mat.emissiveIntensity = 1.0 + energy * 1.6 + Math.sin(t * 6) * 0.1 * (m === "generating" ? 1 : 0);

      // particle drift
      const pos = pGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < COUNT; i++) {
        let z = pos.array[i * 3 + 2] as number;
        z -= speeds[i] * dt * (0.4 + energy);
        if (z < -4.8) z = 4.8;
        pos.array[i * 3 + 2] = z;
      }
      pos.needsUpdate = true;

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      mount.removeEventListener("pointermove", onMove);
      mount.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("deviceorientation", onGyro);
      geo.dispose(); mat.dispose(); pGeo.dispose(); pMat.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} className="neural-core" aria-hidden />;
}
