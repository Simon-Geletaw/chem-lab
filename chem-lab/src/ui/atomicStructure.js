import * as THREE from "three";

// ============================================================
// Helpers
// ============================================================

function fibonacciSphere(samples) {
  const points = [];
  const phi = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < samples; i++) {
    const y = 1 - (i / (samples - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = phi * i;
    points.push(new THREE.Vector3(Math.cos(theta) * r, y, Math.sin(theta) * r));
  }
  return points;
}

function ellipseRadius(a, b, theta) {
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  return (a * b) / Math.sqrt((b * cos) ** 2 + (a * sin) ** 2);
}

// Tiny procedural gradient env map — gives metallic surfaces something
// believable to reflect without loading an external HDRI.
function buildProceduralEnvMap(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size / 2;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, "#1a2340");
  grad.addColorStop(0.5, "#050810");
  grad.addColorStop(1, "#000000");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // a couple of soft "highlight" patches so reflections aren't flat
  ctx.fillStyle = "rgba(255, 210, 130, 0.5)";
  ctx.beginPath();
  ctx.ellipse(size * 0.7, canvas.height * 0.3, 40, 20, 0, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;

  const envRT = pmrem.fromEquirectangular(tex);
  tex.dispose();
  pmrem.dispose();
  return envRT.texture;
}

// Fresnel rim-glow shader — modifies a standard physical material so its
// edges bloom with `glowColor` based on view angle. No extra mesh needed.
function applyFresnelGlow(material, glowColor, power = 2.2, intensity = 1.4) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.glowColor = { value: new THREE.Color(glowColor) };
    shader.uniforms.fresnelPower = { value: power };
    shader.uniforms.fresnelIntensity = { value: intensity };

    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
         varying vec3 vFresnelNormal;
         varying vec3 vFresnelView;`
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
         vFresnelNormal = normalize(normalMatrix * normal);
         vFresnelView = normalize(-(modelViewMatrix * vec4(position, 1.0)).xyz);`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
         uniform vec3 glowColor;
         uniform float fresnelPower;
         uniform float fresnelIntensity;
         varying vec3 vFresnelNormal;
         varying vec3 vFresnelView;`
      )
      .replace(
        "#include <opaque_fragment>",
        `#include <opaque_fragment>
         float fresnel = pow(1.0 - saturate(dot(vFresnelNormal, vFresnelView)), fresnelPower);
         gl_FragColor.rgb += glowColor * fresnel * fresnelIntensity;`
      );

    material.userData.shader = shader;
  };
  material.needsUpdate = true;
}

const TRAIL_LENGTH = 26;

export class AtomicStructure extends THREE.Group {
  constructor(renderer = null) {
    super();

    this.clock = new THREE.Clock();
    this.elapsed = 0;

    this.colors = {
      core: 0xfff2b0,
      proton: 0xff6a3d,
      neutron: 0xffe08a,
      glow: 0xff9900,

      red: 0xff2b4d,
      blue: 0x1fc8ff,
      purple: 0xd23cff,

      orbit: 0x2a3350,
    };

    this.envMap = renderer ? buildProceduralEnvMap(renderer) : null;

    this._buildNucleus();
    this._buildLighting();
    this._buildElectrons();
  }

  // =====================================================
  // NUCLEUS
  // =====================================================
  _buildNucleus() {
    this.nucleus = new THREE.Group();
    this.add(this.nucleus);

    const coreMat = new THREE.MeshBasicMaterial({ color: this.colors.core });
    applyFresnelGlow(coreMat, 0xffb347, 1.8, 1.6);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.9, 48, 48), coreMat);
    this.nucleus.add(core);
    this.core = core;

    const nucleonCount = 13;
    const clusterRadius = 1.15;
    const positions = fibonacciSphere(nucleonCount);
    this.nucleons = [];

    const makeNucleonMat = (color) => {
      const mat = new THREE.MeshPhysicalMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.7,
        metalness: 0.2,
        roughness: 0.22,
        clearcoat: 1,
        clearcoatRoughness: 0.1,
        envMap: this.envMap,
        envMapIntensity: 0.6,
      });
      return mat;
    };

    const protonMat = makeNucleonMat(this.colors.proton);
    const neutronMat = makeNucleonMat(this.colors.neutron);

    positions.forEach((dir, i) => {
      const isProton = i % 2 === 0;
      const radius = 0.55 + Math.random() * 0.08;
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 32, 32),
        (isProton ? protonMat : neutronMat).clone()
      );

      const basePos = dir.clone().multiplyScalar(clusterRadius);
      mesh.position.copy(basePos);
      this.nucleus.add(mesh);

      this.nucleons.push({
        mesh,
        basePos,
        dir,
        phase: Math.random() * Math.PI * 2,
        speed: 1.2 + Math.random() * 0.8,
        amp: 0.05 + Math.random() * 0.03,
      });
    });

    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(2.05, 64, 64),
      new THREE.MeshBasicMaterial({
        color: this.colors.glow,
        transparent: true,
        opacity: 0.1,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.nucleus.add(glow);
    this.glowShell = glow;
  }

  // =====================================================
  // LIGHTING
  // =====================================================
  _buildLighting() {
    this.nucleusLight = new THREE.PointLight(this.colors.core, 20, 34, 2);
    this.add(this.nucleusLight);

    this.fillLight = new THREE.HemisphereLight(0x2a3a66, 0x120018, 0.5);
    this.add(this.fillLight);

    this.rimLight = new THREE.DirectionalLight(0xbfe8ff, 0.7);
    this.rimLight.position.set(-8, 6, 6);
    this.add(this.rimLight);
  }

  // =====================================================
  // ORBITS + ELECTRONS
  // =====================================================
  _buildElectrons() {
    this.electrons = [];

    const specs = [
      { color: this.colors.red, a: 6.5, e: 0.12, speed: 0.55, rot: [0, 0, 0], precess: 0.02 },
      { color: this.colors.blue, a: 6.5, e: 0.24, speed: 0.8, rot: [Math.PI / 3, 0, Math.PI / 8], precess: -0.015 },
      { color: this.colors.purple, a: 6.5, e: 0.32, speed: 1.05, rot: [-Math.PI / 3, Math.PI / 2, 0], precess: 0.025 },
    ];

    specs.forEach((spec) => this._createElectron(spec));
  }

  _createElectron(spec) {
    const { color, a, e, speed, rot, precess } = spec;
    const b = a * Math.sqrt(1 - e * e);

    const pivot = new THREE.Group();
    pivot.rotation.set(rot[0], rot[1], rot[2]);
    this.add(pivot);

    // --- Orbit ring: reflective metal, matches actual electron path ---
    const samples = 200;
    const curvePts = [];
    for (let i = 0; i <= samples; i++) {
      const theta = (i / samples) * Math.PI * 2;
      curvePts.push(new THREE.Vector3(a * Math.cos(theta), b * Math.sin(theta), 0));
    }
    const curve = new THREE.CatmullRomCurve3(curvePts, true);

    const orbitMaterial = new THREE.MeshPhysicalMaterial({
      color: this.colors.orbit,
      metalness: 1,
      roughness: 0.15,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      envMap: this.envMap,
      envMapIntensity: 1.1,
    });

    const orbitTube = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 260, 0.09, 16, true),
      orbitMaterial
    );
    pivot.add(orbitTube);

    // --- Electron: no halo mesh — glow is baked into the material via Fresnel ---
    const electronMat = new THREE.MeshPhysicalMaterial({
      color,
      emissive: color,
      emissiveIntensity: 1.4,
      roughness: 0.1,
      clearcoat: 1,
      envMap: this.envMap,
      envMapIntensity: 0.4,
    });
    applyFresnelGlow(electronMat, color, 2.4, 1.6);

    const electron = new THREE.Mesh(new THREE.SphereGeometry(0.46, 48, 48), electronMat);
    pivot.add(electron);

    // --- Tapered comet-tail trail (tube, not a flat line) ---
    const trailPts = Array.from({ length: TRAIL_LENGTH }, (_, i) => new THREE.Vector3(i * 0.01, 0, 0));
    const trailCurve = new THREE.CatmullRomCurve3(trailPts);
    const trailGeom = new THREE.TubeGeometry(trailCurve, TRAIL_LENGTH - 1, 0.001, 8, false);

    const trailMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const trail = new THREE.Mesh(trailGeom, trailMaterial);
    pivot.add(trail);

    this.electrons.push({
      pivot,
      electron,
      trail,
      trailCurve,
      a,
      b,
      speed,
      precess,
      theta: Math.random() * Math.PI * 2,
      history: Array.from({ length: TRAIL_LENGTH }, () => new THREE.Vector3()),
      jitterPhase: Math.random() * Math.PI * 2,
    });
  }

  // =====================================================
  // DISPOSE
  // =====================================================
  dispose() {
    this.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((m) => m.dispose());
      }
    });
    if (this.envMap) this.envMap.dispose();
  }

  // =====================================================
  // UPDATE
  // =====================================================
  update() {
    const delta = Math.min(this.clock.getDelta(), 0.05);
    this.elapsed += delta;
    const t = this.elapsed;

    // Nucleus breathing + rotation
    const pulse = 1 + Math.sin(t * 3) * 0.02;
    this.nucleus.scale.setScalar(pulse);
    this.nucleus.rotation.y += delta * 0.15;

    // Nucleon micro-jitter with simple neighbor-occlusion darkening
    this.nucleons.forEach((n) => {
      const wob = 1 + Math.sin(t * n.speed + n.phase) * n.amp;
      n.mesh.position.copy(n.basePos).multiplyScalar(wob);

      // faces pointing "inward" toward cluster center get slightly dimmer —
      // cheap fake AO that adds real volume to the cluster
      const facingIn = THREE.MathUtils.clamp(1 - n.dir.y * 0.5 - 0.5, 0.75, 1);
      n.mesh.material.emissiveIntensity = 0.7 * facingIn;
    });

    // Plasma flicker
    const flicker = 0.85 + 0.1 * Math.sin(t * 7.3) + 0.05 * Math.sin(t * 17.1 + 1.3);
    this.nucleusLight.intensity = 20 * flicker;
    this.glowShell.material.opacity = 0.1 + 0.04 * flicker;

    // Electrons
    this.electrons.forEach((e) => {
      const r = ellipseRadius(e.a, e.b, e.theta);
      const angularSpeed = (e.speed * e.a * e.b) / (r * r);
      e.theta += angularSpeed * delta;

      const wobbleZ = Math.sin(t * 2.3 + e.jitterPhase) * 0.09;
      const wobbleR = 1 + Math.sin(t * 3.7 + e.jitterPhase * 1.7) * 0.01;

      const x = e.a * Math.cos(e.theta) * wobbleR;
      const y = e.b * Math.sin(e.theta) * wobbleR;

      e.electron.position.set(x, y, wobbleZ);
      e.electron.rotation.y += delta * 4;

      const speedNorm = THREE.MathUtils.clamp(angularSpeed / (e.speed * (e.a / e.b)), 0, 1.5);
      e.electron.material.emissiveIntensity = 1.2 + speedNorm * 1.2;

      // slow orbital precession — plane itself drifts over time
      e.pivot.rotation.z += e.precess * delta;

      // update trail geometry from position history
      e.history.pop();
      e.history.unshift(e.electron.position.clone());

      const pts = e.history.slice().reverse(); // tail -> head
      const curve = new THREE.CatmullRomCurve3(pts);
      const newGeom = new THREE.TubeGeometry(curve, TRAIL_LENGTH - 1, 0.001, 8, false);

      // taper radius along the tube so it thins toward the tail
      const posAttr = newGeom.getAttribute("position");
      const radials = 8;
      for (let seg = 0; seg <= TRAIL_LENGTH - 1; seg++) {
        const frac = seg / (TRAIL_LENGTH - 1); // 0 at tail, 1 at head
        const radius = 0.02 + frac * 0.16;
        for (let rIdx = 0; rIdx <= radials; rIdx++) {
          const idx = seg * (radials + 1) + rIdx;
          if (idx * 3 + 2 >= posAttr.array.length) continue;
          const cx = posAttr.getX(idx);
          const cy = posAttr.getY(idx);
          const cz = posAttr.getZ(idx);
          const center = curve.getPoint(frac);
          const dir = new THREE.Vector3(cx, cy, cz).sub(center).normalize();
          const scaled = center.clone().add(dir.multiplyScalar(radius));
          posAttr.setXYZ(idx, scaled.x, scaled.y, scaled.z);
        }
      }
      posAttr.needsUpdate = true;

      e.trail.geometry.dispose();
      e.trail.geometry = newGeom;
    });
  }
}