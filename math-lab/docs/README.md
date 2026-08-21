# Mathematics Lab — Module & Data Documentation

> **Generated from code** — every entry below maps to a real TypeScript/JavaScript module and JSON key. Update `server/data/room.json` and the room relabels itself; no code changes required.

---

## 1. `server/data/room.json` — The Single Source of Truth

All user-facing visuals, lighting, text, and interaction are driven from this file. Validation runs at boot (see `src/registry.js:validate()`).

### 1.1 Room Identity

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `name` | string | ✓ | Page title + window title |
| `tagline` | string | ✓ | Subtitle shown on the main station sign |
| `accent` | `#rrggbb` | ✓ | Theme colour (borders, highlights, signs) |
| `backHref` | URL/path | ✓ | Production back-link (`/c` → Chemistry Lab) |
| `backHrefDev` | URL | | Dev back-link (e.g. `http://localhost:5173/`) |
| `backLabel` | string | ✓ | Text on the exit button (“Back to the Chemistry Lab”) |

### 1.2 Geometry

```jsonc
"geometry": {
  "width": 14,    // metres, X span (-W/2 … +W/2)
  "depth": 10,    // metres, Z span (-D/2 … +D/2)
  "height": 3.5   // metres, ceiling Y
}
```

All wall/floor/ceiling/cornice dimensions derive from these three numbers.

### 1.3 Lighting

```jsonc
"lighting": {
  "ambient":  { "color": "#c8d4da", "intensity": 0.10 },
  "fill":     { "color": "#dde6ea", "ground": "#8f8a80", "intensity": 0.22 },
  "dir":      { "color": "#dfe8ec", "intensity": 0.12,
                "position": [0, 6, 0],
                "shadow": { "radius": 6, "mapSize": [1024,1024],
                            "camera": { "left":-7.3,"right":7.3,"top":5.3,"bottom":-5.3,"near":1,"far":7 },
                            "bias": -0.0001, "normalBias": 0.02 } },
  "fixtures": [
    { "x":0, "y":3.47, "z":-2.5, "size":[1.2,0.3],
      "emissiveColor":"#ffffff", "emissiveIntensity":1.5,
      "lightColor":"#e9f4f6", "lightIntensity":3.2,
      "lookAt":[0,0,-2.5] },
    { "x":0, "y":3.47, "z":0,   "size":[1.2,0.3], ... },
    { "x":0, "y":3.47, "z":2.5, "size":[1.2,0.3], ... },
    { "x":5.25, "y":3.42, "z":1.75, "size":[0.6,0.3],  // section spotlight
      "emissiveColor":"#ffffff", "emissiveIntensity":1.5,
      "lightColor":"#e9f4f6", "lightIntensity":2.0,
      "lookAt":[6.95,0,1.75] }
  ]
}
```

- **ambient** — `THREE.AmbientLight` (cool dim fill)
- **fill** — `THREE.HemisphereLight` (ceiling→floor gradient)
- **dir** — `THREE.DirectionalLight` (shadow caster ONLY; zero visual contribution)
- **fixtures** — array of ceiling panels. Each gets an emissive mesh + a real light:
  - **HIGH quality** → `RectAreaLight` (soft, directional)
  - **LOW quality** → `PointLight` (cheaper)

### 1.4 Sky

```jsonc
"sky": {
  "colors": ["#2f5c8f", "#7fa8c9", "#d9e7f1"],  // gradient stops (top → horizon)
  "size": [2.2, 1.9],                          // plane width × height (metres)
  "position": [9, 1.55, 0],                    // outside right wall (x=9)
  "opacity": 1
}
```

Seen through the window panes. Gradient is drawn to a canvas texture at startup.

### 1.5 Hazard Stripes (yellow/black)

```jsonc
"hazard": {
  "baseColor": "#e0b81f",
  "stripeColor": "#1b1b1b",
  "height": 0.14,         // metres above floor
  "stripePeriod": 32      // canvas pixels per diagonal repeat
}
```

Runs along all four wall bases; right wall split around window.

### 1.6 Exit Door & Sign

```jsonc
"exit": {
  "doorPos": [3, 4.97],           // [x, z] centre of door on front wall
  "signPos": [3, 2.55, 4.97],     // [x, y, z] EXIT sign above door
  "label": "EXIT",
  "color": "#1f7a3c"              // green lightbox
}
```

Distance gate: player must be ≤ 1.3 m from `doorPos` to trigger E-exit.

### 1.7 Wall Paint

```jsonc
"wallPaint": {
  "upper":   "#d3d4d3",   // above dado
  "dado":    "#82a1b4",   // lower 1.05 m band
  "break":   "#7d8f9b",   // thin line between upper/dado
  "ceiling": "#d3d4d3",
  "trim":    "#f4f6f8"    // cornice
}
```

Single canvas drawn once, shared by all walls + window bands.

### 1.8 Station Signs (hanging from ceiling)

```jsonc
"stations": [
  {
    "label": "MATHEMATICS LAB",
    "subtitle": "Numbers, shapes & equations",
    "x": 0, "y": 2.3, "z": -1.5,
    "rotationY": 0,
    "width": 1.6, "height": 0.3,
    "fontSize": 42, "subtitleSize": 22,
    "accent": "#1f6fd6"
  },
  {
    "label": "GEOMETRY",
    "subtitle": "Shapes & proofs",
    "x": -6.55, "y": 2.3, "z": 2.5,
    "rotationY": 0,
    "width": 1.6, "height": 0.3,
    "fontSize": 42, "subtitleSize": 22,
    "accent": "#1f6fd6"
  }
]
```

Each entry → one `PlaneGeometry` with a `CanvasTexture` (built by `textures.js`).

### 1.9 Toggle Wall Signs (E-key interaction)

```jsonc
"toggleSigns": [
  {
    "id": "geom-alg",
    "x": 6.95, "y": 1.9, "z": 1.5,
    "rotationY": -1.5707963267948966,  // -π/2 (faces room interior)
    "width": 0.95, "height": 0.4,
    "states": [
      { "label": "GEOMETRY",   "subtitle": "Shapes & proofs",
        "bg": "#22303c", "text": "#ffffff", "accent": "#1f6fd6",
        "borderColor": "#9fc5e8", "fontSize": 42, "subtitleSize": 22 },
      { "label": "ALGEBRA",    "subtitle": "Equations & identity",
        "bg": "#22303c", "text": "#ffffff", "accent": "#8e44ad",
        "borderColor": "#d4b5f5", "fontSize": 42, "subtitleSize": 22 }
    ]
  }
]
```

- **Position** — on right wall between window (z=0.87) and extinguisher (z=2), inside the X=3.5→7, Z=−1→2 section.
- **Interaction** — crosshair aim + E key cycles `states[]`; `#action-hint` shows `[E] Toggle <current label>`.

---

## 2. Module Map

| Module | Responsibility | Key Exports |
|--------|----------------|-------------|
| `registry.js` | Load + validate `room.json`; typed accessors | `loadRoom()`, `getRoom()`, `getGeometry()`, `getLighting()`, `getSky()`, `getHazard()`, `getExit()`, `getStations()`, `getToggleSigns()`, `getWallPaint()` |
| `lights.js` | Build all lights from JSON | `createLights(scene) → {ambient, fill, dir, fixtures, fixtureLights}`, `rebuildFixtureLights(scene, current)` |
| `textures.js` | Canvas-texture factory (cached) | `createFloorTexture()`, `createWallTexture()`, `makeWallTexture()`, `paintBandMat()`, `createTrimMaterial()`, `createSkyTexture()`, `createHazardStripeMaterial()`, `createExitTexture()`, `createStationSignTexture()`, `createToggleSignTexture()`, `createGlassMaterial()` |
| `signs.js` | Sign meshes + E-toggle logic | `createStationSigns(scene)`, `createExitSign(scene)`, `createToggleWallSign(scene, camera, interactableObjects) → {update}`, `handleToggleSignKeyDown(camera)` |
| `room.js` | Geometry assembly (floor, walls, ceiling, cornice, exit door, window, sky, logo, hazard stripes) | `createRoom(scene, interactableObjects) → {ambient, fill, dir, fixtureLights, windowReady}` |
| `furniture.js` | Benches only (signs moved to `signs.js`) | `createFurniture(scene, interactableObjects, colliders)` |
| `main.js` | Boot, loader stages, wiring, animate loop | — |
| `player.js` | Pointer-lock FPS movement + collision | `createPlayer(camera)` |
| `exitDoor.js` | Exit door raycast + E-handler + travel overlay | `createExitDoor(scene, camera, interactableObjects)` |
| `quality.js` | Performance preset + auto-degrade + FPS meter | `quality`, `effectivePixelRatio()`, `createFpsMeter()`, `createQualityMonitor()` |

---

## 3. Quality Tiers

| Setting | HIGH | LOW |
|---------|------|-----|
| RectAreaLight | ✓ | → PointLight |
| Shadow map | 1024² PCFSoft | disabled |
| Pixel ratio | device ≤ 1.5 | 1.0 |
| Bloom (UnrealBloomPass) | ✓ | — |
| Particle scale | 1.0 | 0.5 |

Switch at runtime: `?quality=low` or auto-degrade after 3 s < 45 fps.

---

## 4. Adding / Changing Content

1. Edit `server/data/room.json`
2. `npm run build` (validates schema via `registry.js`)
3. `npm run dev` → walk the section X=3.5→7, Z=−1→2, aim at the toggle sign, press **E**

No code edits needed for:
- Light colours / intensities / fixture positions
- Sky gradient, hazard colours, wall paint
- Station sign text, position, font sizes
- Toggle sign labels / colours / count of states
- Exit door position / label
- Room footprint (width / depth / height)

---

## 5. Git Commit Convention

Each part was committed separately:

| Commit | Scope |
|--------|-------|
| `feat(data): math-lab room.json full dynamic config` | JSON schema + defaults |
| `feat(lighting): JSON-driven lights module` | `lights.js` + `rebuildFixtureLights` |
| `feat(materials): data-driven texture factory` | `textures.js` |
| `feat(room): geometry/texture-data-driven room refactor` | `room.js` |
| `feat(signs): station plates + E-toggle wall sign` | `signs.js` |
| `feat(main): wire lights+signs+anim loop` | `main.js` |
| `feat(registry): validate new config keys` | `registry.js` |
| `docs(math-lab): room.json schema + module map` | `docs/README.md` |

Prefixes: `feat:` `docs:` — no attribution lines.