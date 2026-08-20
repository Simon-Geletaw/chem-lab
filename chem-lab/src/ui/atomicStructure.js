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

function applyFresnelGlow(material, glowColor, power = 3.5, intensity = 0.6) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.glowColor       = { value: new THREE.Color(glowColor) };
    shader.uniforms.fresnelPower    = { value: power };
    shader.uniforms.fresnelIntensity = { value: intensity };

    shader.vertexShader = shader.vertexShader
      .replace("#include <common>",
        `#include <common>
         varying vec3 vFresnelNormal;
         varying vec3 vFresnelView;`)
      .replace("#include <begin_vertex>",
        `#include <begin_vertex>
         vFresnelNormal = normalize(normalMatrix * normal);
         vFresnelView   = normalize(-(modelViewMatrix * vec4(position, 1.0)).xyz);`);

    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>",
        `#include <common>
         uniform vec3  glowColor;
         uniform float fresnelPower, fresnelIntensity;
         varying vec3  vFresnelNormal, vFresnelView;`)
      .replace("#include <opaque_fragment>",
        `#include <opaque_fragment>
         float fresnel = pow(1.0 - saturate(dot(vFresnelNormal, vFresnelView)), fresnelPower);
         gl_FragColor.rgb += glowColor * fresnel * fresnelIntensity;`);

    material.userData.shader = shader;
  };
  material.needsUpdate = true;
}

// ============================================================
// Constants
// ============================================================

const TRAIL_LENGTH = 32;
const _center = new THREE.Vector3();
const _dir    = new THREE.Vector3();
const _prev   = new THREE.Vector3();
const _next   = new THREE.Vector3();

// ============================================================
// HoverSystem — self-contained raycaster + DOM tooltip
// Inject once; call .register(mesh, info) for every hittable
// object, then .update(mouseEvent, camera) each frame.
// ============================================================

const HOVER_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');

#atm-tooltip {
  position: fixed;
  pointer-events: none;
  z-index: 9999;
  opacity: 0;
  transform: translateY(6px) scale(0.97);
  transition: opacity 0.2s cubic-bezier(.4,0,.2,1),
              transform 0.2s cubic-bezier(.4,0,.2,1);
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
}
#atm-tooltip.atm-vis {
  opacity: 1;
  transform: translateY(0) scale(1);
}
.atm-card {
  background: rgba(8, 10, 20, 0.82);
  border: 1px solid rgba(255,255,255,0.10);
  border-radius: 12px;
  padding: 13px 16px 14px;
  min-width: 190px;
  max-width: 240px;
  backdrop-filter: blur(16px) saturate(180%);
  -webkit-backdrop-filter: blur(16px) saturate(180%);
  box-shadow: 0 8px 32px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06);
}
.atm-header {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-bottom: 7px;
}
.atm-icon {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: -0.01em;
}
.atm-name {
  font-size: 13.5px;
  font-weight: 600;
  letter-spacing: 0.01em;
  line-height: 1.2;
}
.atm-tag {
  display: inline-block;
  font-size: 9.5px;
  font-weight: 500;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  padding: 2px 7px;
  border-radius: 20px;
  margin-top: 2px;
  opacity: 0.7;
}
.atm-divider {
  height: 1px;
  background: rgba(255,255,255,0.07);
  margin: 9px 0;
}
.atm-row {
  display: flex;
  align-items: baseline;
  gap: 7px;
  margin-bottom: 5px;
}
.atm-row:last-child { margin-bottom: 0; }
.atm-label {
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.32);
  flex-shrink: 0;
  min-width: 54px;
}
.atm-value {
  font-size: 12px;
  font-weight: 400;
  color: rgba(255,255,255,0.72);
  line-height: 1.4;
}
.atm-value strong {
  font-weight: 600;
  color: rgba(255,255,255,0.92);
}
`;

function injectTooltipStyles() {
  if (document.getElementById("atm-style")) return;
  const style = document.createElement("style");
  style.id = "atm-style";
  style.textContent = HOVER_CSS;
  document.head.appendChild(style);
}

function buildTooltipDOM() {
  if (document.getElementById("atm-tooltip")) return document.getElementById("atm-tooltip");
  const el = document.createElement("div");
  el.id = "atm-tooltip";
  el.innerHTML = `<div class="atm-card">
    <div class="atm-header">
      <div class="atm-icon" id="atm-icon"></div>
      <div>
        <div class="atm-name" id="atm-name"></div>
        <div class="atm-tag" id="atm-tag"></div>
      </div>
    </div>
    <div class="atm-divider"></div>
    <div id="atm-rows"></div>
  </div>`;
  document.body.appendChild(el);
  return el;
}

class HoverSystem {
  constructor() {
    injectTooltipStyles();
    this._tip    = buildTooltipDOM();
    this._rc     = new THREE.Raycaster();
    this._mouse  = new THREE.Vector2(-9999, -9999);
    this._map    = new Map();   // mesh → info object
    this._meshes = [];
    this._last   = null;
    this._hideTimer = null;
  }

  /**
   * Register a mesh as hoverable.
   * info = { name, tag, color, hexIcon, rows: [{label, value}] }
   *   name    — display name, e.g. "Proton"
   *   tag     — short category, e.g. "Hadron · +1 charge"
   *   color   — hex string for accent, e.g. "#c44020"
   *   hexIcon — single character shown in the icon circle, e.g. "p"
   *   rows    — array of { label, value } fact rows
   */
  register(mesh, info) {
    this._map.set(mesh, info);
    this._meshes.push(mesh);
  }

  onMouseMove(evt) {
    this._mouse.x =  (evt.clientX / window.innerWidth)  * 2 - 1;
    this._mouse.y = -(evt.clientY / window.innerHeight) * 2 + 1;
    this._cursorX = evt.clientX;
    this._cursorY = evt.clientY;
  }

  update(camera) {
    this._rc.setFromCamera(this._mouse, camera);
    const hits = this._rc.intersectObjects(this._meshes, false);

    if (hits.length > 0) {
      const info = this._map.get(hits[0].object);
      if (!info) return;

      if (this._last !== info) {
        this._last = info;
        this._populate(info);
      }

      // Position — clamp to viewport
      const tx = Math.min(this._cursorX + 18, window.innerWidth  - 260);
      const ty = Math.min(this._cursorY - 12, window.innerHeight - 180);
      this._tip.style.left = tx + "px";
      this._tip.style.top  = ty + "px";
      this._tip.classList.add("atm-vis");

      if (this._hideTimer) { clearTimeout(this._hideTimer); this._hideTimer = null; }
    } else {
      if (this._last) {
        this._last = null;
        // Small grace period before hiding (prevents flicker when crossing meshes)
        this._hideTimer = setTimeout(() => {
          this._tip.classList.remove("atm-vis");
          this._hideTimer = null;
        }, 80);
      }
    }
  }

  _populate(info) {
    const icon  = document.getElementById("atm-icon");
    const name  = document.getElementById("atm-name");
    const tag   = document.getElementById("atm-tag");
    const rows  = document.getElementById("atm-rows");

    // Icon circle — bg is 15% opacity of accent color
    icon.textContent = info.hexIcon;
    icon.style.background   = info.color + "26";   // 15% alpha
    icon.style.border       = `1px solid ${info.color}55`;
    icon.style.color        = info.color;

    name.textContent = info.name;
    name.style.color = "#ffffff";

    tag.textContent  = info.tag;
    tag.style.background = info.color + "22";
    tag.style.color      = info.color;

    rows.innerHTML = info.rows.map(r =>
      `<div class="atm-row">
         <span class="atm-label">${r.label}</span>
         <span class="atm-value">${r.value}</span>
       </div>`
    ).join("");
  }

  dispose() {
    this._tip.remove();
    const s = document.getElementById("atm-style");
    if (s) s.remove();
  }
}

// ============================================================
// Particle data catalogue
// ============================================================

const PARTICLE_INFO = {
  nucleus: {
    name: "Nucleus",
    tag: "Atomic core",
    color: "#e8820a",
    hexIcon: "N",
    rows: [
      { label: "Contents", value: "<strong>Protons + Neutrons</strong>" },
      { label: "Force",    value: "Strong nuclear (~10⁴⁴ N)" },
      { label: "Mass",     value: "≈ 99.97% of atom's mass" },
      { label: "Size",     value: "~1–10 fm (10⁻¹⁵ m)" },
    ],
  },
  proton: {
    name: "Proton",
    tag: "Hadron · +1e charge",
    color: "#d94f2a",
    hexIcon: "p",
    rows: [
      { label: "Quarks",  value: "<strong>2 up + 1 down</strong>" },
      { label: "Charge",  value: "+1.602 × 10⁻¹⁹ C" },
      { label: "Mass",    value: "938.3 MeV/c²" },
      { label: "Spin",    value: "½" },
    ],
  },
  neutron: {
    name: "Neutron",
    tag: "Hadron · neutral",
    color: "#c49030",
    hexIcon: "n",
    rows: [
      { label: "Quarks",  value: "<strong>1 up + 2 down</strong>" },
      { label: "Charge",  value: "0" },
      { label: "Mass",    value: "939.6 MeV/c²" },
      { label: "Role",    value: "Stabilises nucleus" },
    ],
  },
};

const ELECTRON_INFO = [
  {
    name: "Electron — shell 1",
    tag: "Lepton · −1e charge",
    color: "#e03050",
    hexIcon: "e",
    rows: [
      { label: "Shell",   value: "<strong>1st orbital (K)</strong>" },
      { label: "Charge",  value: "−1.602 × 10⁻¹⁹ C" },
      { label: "Mass",    value: "0.511 MeV/c²" },
      { label: "Spin",    value: "½" },
    ],
  },
  {
    name: "Electron — shell 2",
    tag: "Lepton · −1e charge",
    color: "#1a9fde",
    hexIcon: "e",
    rows: [
      { label: "Shell",   value: "<strong>2nd orbital (L)</strong>" },
      { label: "Charge",  value: "−1.602 × 10⁻¹⁹ C" },
      { label: "Mass",    value: "0.511 MeV/c²" },
      { label: "Spin",    value: "½" },
    ],
  },
  {
    name: "Electron — shell 3",
    tag: "Lepton · −1e charge",
    color: "#9030e8",
    hexIcon: "e",
    rows: [
      { label: "Shell",   value: "<strong>3rd orbital (M)</strong>" },
      { label: "Charge",  value: "−1.602 × 10⁻¹⁹ C" },
      { label: "Mass",    value: "0.511 MeV/c²" },
      { label: "Spin",    value: "½" },
    ],
  },
];

// ============================================================
// Main class
// ============================================================

export class AtomicStructure extends THREE.Group {
  /**
   * @param {object} [opts]
   * @param {HTMLCanvasElement} [opts.canvas]   – renderer's canvas (for cursor)
   * @param {THREE.Camera}     [opts.camera]    – required for raycasting
   */
  constructor(opts = {}) {
    super();

    this.clock   = new THREE.Clock();
    this.elapsed = 0;
    this._camera = opts.camera || null;

    this.colors = {
      coreBase: 0xd4610a,
      coreEmit: 0xff8c2a,
      glowHalo: 0xff6600,
      proton:   0xc44020,
      neutron:  0xb8872a,
      red:      0xe03050,
      blue:     0x1a9fde,
      purple:   0x9030e8,
      orbit:    0x3a4a5a,
    };

    // Hover system — attaches to window mouse events automatically
    this._hover = new HoverSystem();
    this._boundMouseMove = (e) => this._hover.onMouseMove(e);
    window.addEventListener("mousemove", this._boundMouseMove, { passive: true });

    this._buildNucleus();
    this._buildLighting();
    this._buildElectrons();
  }

  // -----------------------------------------------------------
  // Expose setCamera() so the caller can wire it after init
  // -----------------------------------------------------------
  setCamera(camera) { this._camera = camera; }

  // ===========================================================
  // NUCLEUS
  // ===========================================================
  _buildNucleus() {
    this.nucleus = new THREE.Group();
    this.add(this.nucleus);

    const coreMat = new THREE.MeshStandardMaterial({
      color:             this.colors.coreBase,
      emissive:          this.colors.coreEmit,
      emissiveIntensity: 0.25,
      metalness:         0.15,
      roughness:         0.55,
    });
    applyFresnelGlow(coreMat, 0xff7700, 3.8, 0.45);

    const core = new THREE.Mesh(new THREE.SphereGeometry(0.9, 48, 48), coreMat);
    this.nucleus.add(core);
    this.core = core;

    // Register nucleus for hover
    this._hover.register(core, PARTICLE_INFO.nucleus);

    // Nucleons
    const positions = fibonacciSphere(13);
    this.nucleons   = [];

    const makeNucleonMat = (color, emitColor) =>
      new THREE.MeshStandardMaterial({
        color,
        emissive:          emitColor,
        emissiveIntensity: 0.3,
        metalness:         0.2,
        roughness:         0.45,
      });

    const protonMat  = makeNucleonMat(this.colors.proton,  0x7a1808);
    const neutronMat = makeNucleonMat(this.colors.neutron, 0x6a4a08);

    positions.forEach((dir, i) => {
      const isProton = i % 2 === 0;
      const radius   = 0.52 + Math.random() * 0.06;
      const mat      = (isProton ? protonMat : neutronMat).clone();
      mat.userData.isProton = isProton;

      const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 28, 28), mat);
      const basePos = dir.clone().multiplyScalar(1.18);
      mesh.position.copy(basePos);
      this.nucleus.add(mesh);

      // Register each nucleon for hover
      this._hover.register(mesh, isProton ? PARTICLE_INFO.proton : PARTICLE_INFO.neutron);

      this.nucleons.push({
        mesh, basePos, dir,
        phase: Math.random() * Math.PI * 2,
        speed: 1.0 + Math.random() * 0.7,
        amp:   0.04 + Math.random() * 0.02,
      });
    });

    // Glow halo
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(2.0, 32, 32),
      new THREE.MeshBasicMaterial({
        color:       this.colors.glowHalo,
        transparent: true,
        opacity:     0.04,
        blending:    THREE.AdditiveBlending,
        depthWrite:  false,
        side:        THREE.BackSide,
      })
    );
    this.nucleus.add(halo);
    this.glowShell = halo;
  }

  // ===========================================================
  // LIGHTING
  // ===========================================================
  _buildLighting() {
    this.keyLight = new THREE.PointLight(0xffcc88, 3.5, 40, 2);
    this.keyLight.position.set(6, 5, 4);
    this.add(this.keyLight);

    this.nucleusLight = new THREE.PointLight(0xff9940, 4.0, 14, 2.5);
    this.add(this.nucleusLight);

    this.rimLight = new THREE.DirectionalLight(0x88c8ff, 0.55);
    this.rimLight.position.set(-7, 4, -5);
    this.add(this.rimLight);

    this.add(new THREE.HemisphereLight(0x0a0e2a, 0x06030a, 0.25));
  }

  // ===========================================================
  // ELECTRONS
  // ===========================================================
  _buildElectrons() {
    this.electrons = [];

    const specs = [
      { color: this.colors.red,    a: 6.0, e: 0.10, speed: 0.50, rot: [0, 0, 0],                  precess:  0.018, idx: 0 },
      { color: this.colors.blue,   a: 6.0, e: 0.22, speed: 0.72, rot: [Math.PI/3, 0, Math.PI/8],  precess: -0.013, idx: 1 },
      { color: this.colors.purple, a: 6.0, e: 0.30, speed: 0.95, rot: [-Math.PI/3, Math.PI/2, 0], precess:  0.022, idx: 2 },
    ];

    specs.forEach((s) => this._createElectron(s));
  }

  _createElectron({ color, a, e, speed, rot, precess, idx }) {
    const b          = a * Math.sqrt(1 - e * e);
    const startTheta = Math.random() * Math.PI * 2;
    const pivot      = new THREE.Group();
    pivot.rotation.set(...rot);
    this.add(pivot);

    // Orbit ring
    const samples  = 120;
    const curvePts = [];
    for (let i = 0; i <= samples; i++) {
      const th = (i / samples) * Math.PI * 2;
      curvePts.push(new THREE.Vector3(a * Math.cos(th), b * Math.sin(th), 0));
    }

    const orbitMat = new THREE.MeshStandardMaterial({
      color:             this.colors.orbit,
      emissive:          new THREE.Color(color).multiplyScalar(0.06),
      emissiveIntensity: 1.0,
      metalness:         0.8,
      roughness:         0.35,
    });
    pivot.add(new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(curvePts, true), samples, 0.045, 8, true),
      orbitMat
    ));

    // Electron sphere
    const electronMat = new THREE.MeshStandardMaterial({
      color,
      emissive:          color,
      emissiveIntensity: 0.55,
      roughness:         0.25,
      metalness:         0.1,
    });
    applyFresnelGlow(electronMat, color, 2.8, 0.9);

    const electron = new THREE.Mesh(new THREE.SphereGeometry(0.40, 32, 32), electronMat);
    pivot.add(electron);

    // Register electron for hover
    this._hover.register(electron, ELECTRON_INFO[idx]);

    const electronLight = new THREE.PointLight(color, 0.8, 5.0, 2.0);
    electron.add(electronLight);

    // Comet trail
    const history = Array.from({ length: TRAIL_LENGTH }, (_, i) => {
      const th = startTheta - i * 0.06;
      return new THREE.Vector3(a * Math.cos(th), b * Math.sin(th), 0);
    });
    const points   = history.map((p) => p.clone());
    const trailGeom = new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(points), TRAIL_LENGTH - 1, 0.015, 6, false
    );
    const trail = new THREE.Mesh(trailGeom, new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity:     0.40,
      blending:    THREE.AdditiveBlending,
      depthWrite:  false,
    }));
    pivot.add(trail);

    this.electrons.push({
      pivot, electron, electronLight, trail,
      history, historyIdx: 0, points,
      a, b, speed, precess,
      theta:       startTheta,
      jitterPhase: Math.random() * Math.PI * 2,
    });
  }

  // ===========================================================
  // DISPOSE
  // ===========================================================
  dispose() {
    window.removeEventListener("mousemove", this._boundMouseMove);
    this._hover.dispose();
    this.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((m) => m.dispose());
      }
    });
  }

  // ===========================================================
  // UPDATE
  // ===========================================================
  update() {
    const delta   = Math.min(this.clock.getDelta(), 0.05);
    this.elapsed += delta;
    const t       = this.elapsed;

    // Nucleus
    const pulse = 1 + Math.sin(t * 2.0) * 0.012;
    this.nucleus.scale.setScalar(pulse);
    this.nucleus.rotation.y += delta * 0.10;

    this.nucleons.forEach((n) => {
      const wob = 1 + Math.sin(t * n.speed + n.phase) * n.amp;
      n.mesh.position.copy(n.basePos).multiplyScalar(wob);
      const ao = THREE.MathUtils.clamp(0.7 + n.dir.y * 0.3, 0.65, 1.0);
      n.mesh.material.emissiveIntensity = 0.3 * ao;
    });

    const flicker = 0.92 + 0.05 * Math.sin(t * 5.1) + 0.03 * Math.sin(t * 11.7 + 1.2);
    this.nucleusLight.intensity          = 4.0 * flicker;
    this.keyLight.intensity              = 3.5 * (0.96 + 0.04 * Math.sin(t * 3.3));
    this.glowShell.material.opacity      = 0.035 + 0.015 * flicker;

    // Electrons
    this.electrons.forEach((e) => {
      const r            = ellipseRadius(e.a, e.b, e.theta);
      const angularSpeed = (e.speed * e.a * e.b) / (r * r);
      e.theta           += angularSpeed * delta;

      const wobbleZ = Math.sin(t * 1.7 + e.jitterPhase) * 0.06;
      const wobbleR = 1 + Math.sin(t * 2.9 + e.jitterPhase * 1.5) * 0.008;

      const x = e.a * Math.cos(e.theta) * wobbleR;
      const y = e.b * Math.sin(e.theta) * wobbleR;
      e.electron.position.set(x, y, wobbleZ);
      e.electron.rotation.y += delta * 2.5;

      const speedNorm = THREE.MathUtils.clamp(angularSpeed / (e.speed * (e.a / e.b)), 0, 1.5);
      e.electron.material.emissiveIntensity = 0.45 + speedNorm * 0.35;
      e.electronLight.intensity             = 0.6 + speedNorm * 0.5;
      e.pivot.rotation.z                   += e.precess * delta;

      // Trail ring-buffer mutate
      const posAttr = e.trail.geometry.getAttribute("position");
      const arr     = posAttr.array;
      e.history[e.historyIdx].copy(e.electron.position);
      e.historyIdx = (e.historyIdx + 1) % TRAIL_LENGTH;
      for (let i = 0; i < TRAIL_LENGTH; i++)
        e.points[i].copy(e.history[(e.historyIdx + i) % TRAIL_LENGTH]);

      const radials = 6;
      for (let seg = 0; seg < TRAIL_LENGTH; seg++) {
        const frac   = seg / (TRAIL_LENGTH - 1);
        const radius = 0.015 + frac * 0.13;
        _center.copy(e.points[seg]);
        if (seg < TRAIL_LENGTH - 1) _next.copy(e.points[seg + 1]); else _next.copy(e.points[seg]);
        if (seg > 0)                _prev.copy(e.points[seg - 1]); else _prev.copy(e.points[seg]);
        for (let rIdx = 0; rIdx <= radials; rIdx++) {
          const idx = seg * (radials + 1) + rIdx;
          _dir.set(arr[idx*3], arr[idx*3+1], arr[idx*3+2]).sub(_center);
          const len = _dir.length();
          if (len > 1e-6) _dir.divideScalar(len); else _dir.set(1, 0, 0);
          arr[idx*3]   = _center.x + _dir.x * radius;
          arr[idx*3+1] = _center.y + _dir.y * radius;
          arr[idx*3+2] = _center.z + _dir.z * radius;
        }
      }
      posAttr.needsUpdate = true;
    });

    // Drive hover raycasting every frame
    if (this._camera) {
      this._hover.update(this._camera);
    }
  }
}