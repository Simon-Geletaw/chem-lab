// coat.js — realistic procedural lab-coat wardrobe beside the exit door.
//
// Main visual revision:
//   STAND   — corrected tripod geometry; legs actually radiate from the hub,
//             sit correctly on the floor, and use rounded wood construction.
//   HANGER  — realistic wooden clothes hanger with broad shoulder rails,
//             wooden neck and metal hook.
//   COAT    — rebuilt from a shaped garment silhouette instead of stacked boxes.
//             Includes natural shoulders, long body, notched lapels, front
//             placket, chest/lower pockets, sleeve taper, cuffs and seams.

import * as THREE from 'three';
import { ZONES } from './zones.js';

const WARDROBE_POS = new THREE.Vector3(
  ZONES.coat.x,
  0,
  ZONES.coat.z
);

const HAND_LAYER = 1;
const COAT_WHITE = 0xf3f4f5;


// ============================================================================
// TEXTURES
// ============================================================================

function makeFabricTexture() {
  const S = 256;

  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;

  const ctx = canvas.getContext('2d');

  // Base white fabric
  ctx.fillStyle = '#f1f2f3';
  ctx.fillRect(0, 0, S, S);

  // Horizontal weave
  ctx.strokeStyle = 'rgba(185,188,192,0.22)';
  ctx.lineWidth = 0.7;

  for (let y = 0; y < S; y += 3) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(S, y);
    ctx.stroke();
  }

  // Vertical weave
  ctx.strokeStyle = 'rgba(205,207,210,0.18)';

  for (let x = 0; x < S; x += 3) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, S);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);

  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(5, 5);
  texture.anisotropy = 4;

  return texture;
}


function makeWoodTexture() {
  const W = 96;
  const H = 256;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;

  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#875a31';
  ctx.fillRect(0, 0, W, H);

  // Wood grain
  for (let i = 0; i < 55; i++) {
    const x0 = Math.random() * W;

    ctx.strokeStyle =
      `rgba(42,22,7,${0.10 + Math.random() * 0.18})`;

    ctx.lineWidth = 0.5 + Math.random() * 1.2;

    ctx.beginPath();
    ctx.moveTo(x0, 0);

    for (let y = 0; y <= H; y += 8) {
      ctx.lineTo(
        x0 + Math.sin(y * 0.035 + i) * 2.2,
        y
      );
    }

    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);

  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 2);

  return texture;
}


// ============================================================================
// GEOMETRY HELPERS
// ============================================================================

function roundedRectShape(width, height, radius) {
  const x = -width / 2;
  const y = -height / 2;

  const shape = new THREE.Shape();

  shape.moveTo(x + radius, y);

  shape.lineTo(
    x + width - radius,
    y
  );

  shape.quadraticCurveTo(
    x + width,
    y,
    x + width,
    y + radius
  );

  shape.lineTo(
    x + width,
    y + height - radius
  );

  shape.quadraticCurveTo(
    x + width,
    y + height,
    x + width - radius,
    y + height
  );

  shape.lineTo(
    x + radius,
    y + height
  );

  shape.quadraticCurveTo(
    x,
    y + height,
    x,
    y + height - radius
  );

  shape.lineTo(
    x,
    y + radius
  );

  shape.quadraticCurveTo(
    x,
    y,
    x + radius,
    y
  );

  return shape;
}


function extrudedShape(
  shape,
  depth,
  material,
  bevel = 0.005
) {
  const geometry = new THREE.ExtrudeGeometry(
    shape,
    {
      depth,
      bevelEnabled: bevel > 0,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 3,
      curveSegments: 8
    }
  );

  geometry.center();

  const mesh = new THREE.Mesh(
    geometry,
    material
  );

  mesh.castShadow = true;
  mesh.receiveShadow = true;

  return mesh;
}


function makePanelMaterial(
  texture,
  color = COAT_WHITE
) {
  return new THREE.MeshStandardMaterial({
    map: texture,
    color,
    roughness: 0.86,
    metalness: 0,
    side: THREE.DoubleSide
  });
}


// ============================================================================
// STAND
// ============================================================================

function buildStand() {
  const group = new THREE.Group();

  const woodTexture = makeWoodTexture();

  const wood = new THREE.MeshStandardMaterial({
    map: woodTexture,
    color: 0x8b5b30,
    roughness: 0.52,
    metalness: 0,
    envMapIntensity: 0.45
  });

  const darkWood = new THREE.MeshStandardMaterial({
    color: 0x4b2d18,
    roughness: 0.65
  });


  // ==========================================================================
  // CENTRAL HUB
  // ==========================================================================

  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(
      0.055,
      0.065,
      0.075,
      18
    ),
    wood
  );

  hub.position.y = 0.045;
  hub.castShadow = true;

  group.add(hub);


  // ==========================================================================
  // TRIPOD LEGS
  // ==========================================================================

  function addLeg(angle) {

    const start = new THREE.Vector3(
      0,
      0.06,
      0
    );

    const end = new THREE.Vector3(
      Math.cos(angle) * 0.39,
      0.025,
      Math.sin(angle) * 0.39
    );

    const direction = end.clone().sub(start);
    const length = direction.length();

    const leg = new THREE.Mesh(
      new THREE.CylinderGeometry(
        0.027,
        0.038,
        length,
        14
      ),
      wood
    );

    leg.position
      .copy(start)
      .add(end)
      .multiplyScalar(0.5);

    leg.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.normalize()
    );

    leg.castShadow = true;

    group.add(leg);


    // Foot cap
    const foot = new THREE.Mesh(
      new THREE.CylinderGeometry(
        0.032,
        0.032,
        0.025,
        14
      ),
      darkWood
    );

    foot.position.copy(end);
    foot.position.y = 0.013;

    foot.castShadow = true;

    group.add(foot);
  }


  addLeg(0);
  addLeg(Math.PI * 2 / 3);
  addLeg(Math.PI * 4 / 3);


  // ==========================================================================
  // MAIN POLE
  // ==========================================================================

  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(
      0.020,
      0.033,
      1.48,
      18
    ),
    wood
  );

  pole.position.y = 0.79;
  pole.castShadow = true;

  group.add(pole);


  // ==========================================================================
  // LOWER COLLAR
  // ==========================================================================

  const lowerCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(
      0.043,
      0.043,
      0.035,
      18
    ),
    wood
  );

  lowerCollar.position.y = 0.105;

  group.add(lowerCollar);


  // ==========================================================================
  // UPPER COLLAR
  // ==========================================================================

  const upperCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(
      0.030,
      0.030,
      0.035,
      18
    ),
    wood
  );

  upperCollar.position.y = 1.30;

  group.add(upperCollar);


  // ==========================================================================
  // HANGER SUPPORT PEG
  // ==========================================================================

  const peg = new THREE.Mesh(
    new THREE.CylinderGeometry(
      0.015,
      0.015,
      0.10,
      12
    ),
    wood
  );

  peg.rotation.z = Math.PI / 2;
  peg.position.y = 1.53;

  group.add(peg);


  // ==========================================================================
  // TOP FINIAL
  // ==========================================================================

  const finial = new THREE.Mesh(
    new THREE.SphereGeometry(
      0.043,
      18,
      12
    ),
    wood
  );

  finial.scale.set(
    1,
    1.25,
    1
  );

  finial.position.y = 1.60;
  finial.castShadow = true;

  group.add(finial);


  return group;
}


// ============================================================================
// CURVED TUBE
// ============================================================================

function tubeCurve(
  points,
  radius,
  material
) {
  const curve = new THREE.CatmullRomCurve3(
    points
  );

  curve.curveType = 'centripetal';

  const geometry = new THREE.TubeGeometry(
    curve,
    24,
    radius,
    10,
    false
  );

  const mesh = new THREE.Mesh(
    geometry,
    material
  );

  mesh.castShadow = true;
  mesh.receiveShadow = true;

  return mesh;
}


// ============================================================================
// TAPERED CURVED TUBE
// ============================================================================

function taperedTubeCurve(
  points,
  radii,
  material,
  segments = 28,
  radialSegments = 12
) {

  const curve = new THREE.CatmullRomCurve3(
    points
  );

  curve.curveType = 'centripetal';

  const frames =
    curve.computeFrenetFrames(
      segments,
      false
    );

  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i <= segments; i++) {

    const t = i / segments;

    const point =
      curve.getPointAt(t);

    const radius =
      THREE.MathUtils.lerp(
        radii[0],
        radii[radii.length - 1],
        t
      );

    const normal =
      frames.normals[i];

    const binormal =
      frames.binormals[i];

    for (
      let j = 0;
      j < radialSegments;
      j++
    ) {

      const angle =
        (j / radialSegments) *
        Math.PI *
        2;

      const c = Math.cos(angle);
      const s = Math.sin(angle);

      const offset =
        normal.clone()
          .multiplyScalar(
            c * radius
          )
          .add(
            binormal.clone()
              .multiplyScalar(
                s * radius
              )
          );

      const vertex =
        point.clone().add(offset);

      positions.push(
        vertex.x,
        vertex.y,
        vertex.z
      );

      const n =
        offset.clone().normalize();

      normals.push(
        n.x,
        n.y,
        n.z
      );

      uvs.push(
        j / radialSegments,
        t
      );
    }
  }


  for (
    let i = 0;
    i < segments;
    i++
  ) {

    for (
      let j = 0;
      j < radialSegments;
      j++
    ) {

      const a =
        i * radialSegments + j;

      const b =
        i * radialSegments +
        ((j + 1) % radialSegments);

      const c =
        (i + 1) * radialSegments +
        ((j + 1) % radialSegments);

      const d =
        (i + 1) * radialSegments +
        j;

      indices.push(
        a,
        b,
        d
      );

      indices.push(
        b,
        c,
        d
      );
    }
  }


  const geometry =
    new THREE.BufferGeometry();

  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      positions,
      3
    )
  );

  geometry.setAttribute(
    'normal',
    new THREE.Float32BufferAttribute(
      normals,
      3
    )
  );

  geometry.setAttribute(
    'uv',
    new THREE.Float32BufferAttribute(
      uvs,
      2
    )
  );

  geometry.setIndex(indices);

  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();


  const mesh =
    new THREE.Mesh(
      geometry,
      material
    );

  mesh.castShadow = true;
  mesh.receiveShadow = true;

  return mesh;
}


// ============================================================================
// HANGER
// ============================================================================

function buildHanger(y) {

  const group =
    new THREE.Group();


  // ==========================================================================
  // MATERIALS
  // ==========================================================================

  const wood =
    new THREE.MeshStandardMaterial({
      color: 0xa56a36,
      roughness: 0.38,
      metalness: 0,
      envMapIntensity: 0.65
    });


  const darkWood =
    new THREE.MeshStandardMaterial({
      color: 0x71451f,
      roughness: 0.48
    });


  const chrome =
    new THREE.MeshStandardMaterial({
      color: 0xcfd2d6,
      roughness: 0.16,
      metalness: 0.96,
      envMapIntensity: 1.35
    });


  // ==========================================================================
  // LEFT SHOULDER
  // ==========================================================================

  const leftShoulder =
    tubeCurve(
      [
        new THREE.Vector3(
          0,
          0.025,
          0
        ),

        new THREE.Vector3(
          -0.055,
          0.015,
          0
        ),

        new THREE.Vector3(
          -0.145,
          -0.015,
          0
        ),

        new THREE.Vector3(
          -0.245,
          -0.075,
          0
        ),

        new THREE.Vector3(
          -0.315,
          -0.145,
          0
        )
      ],
      0.021,
      wood
    );


  // ==========================================================================
  // RIGHT SHOULDER
  // ==========================================================================

  const rightShoulder =
    tubeCurve(
      [
        new THREE.Vector3(
          0,
          0.025,
          0
        ),

        new THREE.Vector3(
          0.055,
          0.015,
          0
        ),

        new THREE.Vector3(
          0.145,
          -0.015,
          0
        ),

        new THREE.Vector3(
          0.245,
          -0.075,
          0
        ),

        new THREE.Vector3(
          0.315,
          -0.145,
          0
        )
      ],
      0.021,
      wood
    );


  group.add(
    leftShoulder,
    rightShoulder
  );


  // ==========================================================================
  // LOWER HANGER BAR
  // ==========================================================================

  const bar =
    new THREE.Mesh(
      new THREE.CylinderGeometry(
        0.014,
        0.014,
        0.55,
        14
      ),
      darkWood
    );

  bar.rotation.z =
    Math.PI / 2;

  bar.position.set(
    0,
    -0.148,
    0
  );

  bar.castShadow = true;

  group.add(bar);


  // ==========================================================================
  // WOODEN NECK
  // ==========================================================================

  const neck =
    new THREE.Mesh(
      new THREE.CylinderGeometry(
        0.022,
        0.028,
        0.082,
        16
      ),
      darkWood
    );

  neck.position.y =
    0.060;

  neck.castShadow = true;

  group.add(neck);


  // ==========================================================================
  // WOODEN COLLAR
  // ==========================================================================

  const collar =
    new THREE.Mesh(
      new THREE.SphereGeometry(
        0.030,
        16,
        10
      ),
      wood
    );

  collar.scale.set(
    1.0,
    0.62,
    1.0
  );

  collar.position.y =
    0.022;

  collar.castShadow = true;

  group.add(collar);


  // ==========================================================================
  // METAL HOOK
  // ==========================================================================

  const hook =
    tubeCurve(
      [
        new THREE.Vector3(
          0,
          0.095,
          0
        ),

        new THREE.Vector3(
          0,
          0.145,
          0
        ),

        new THREE.Vector3(
          0.008,
          0.205,
          0
        ),

        new THREE.Vector3(
          0.038,
          0.238,
          0
        ),

        new THREE.Vector3(
          0.080,
          0.236,
          0
        ),

        new THREE.Vector3(
          0.103,
          0.208,
          0
        ),

        new THREE.Vector3(
          0.101,
          0.168,
          0
        ),

        new THREE.Vector3(
          0.082,
          0.145,
          0
        ),

        new THREE.Vector3(
          0.050,
          0.148,
          0
        )
      ],
      0.0095,
      chrome
    );

  group.add(hook);


  // ==========================================================================
  // POSITION
  // ==========================================================================

  group.position.y =
    y;

  group.position.z =
    0;


  return group;
}


// ============================================================================
// COAT
// ============================================================================

function buildCoat() {

  const group =
    new THREE.Group();


  const fabricTexture =
    makeFabricTexture();


  const fabric =
    makePanelMaterial(
      fabricTexture,
      0xf5f6f7
    );


  const detailFabric =
    new THREE.MeshStandardMaterial({
      color: 0xe7e9eb,
      roughness: 0.78,
      metalness: 0,
      side: THREE.DoubleSide
    });


  const seamMaterial =
    new THREE.MeshStandardMaterial({
      color: 0xcfd2d5,
      roughness: 0.82,
      metalness: 0,
      side: THREE.DoubleSide
    });


  const darkButton =
    new THREE.MeshStandardMaterial({
      color: 0xb9bdc1,
      roughness: 0.30,
      metalness: 0.08
    });


  // ==========================================================================
  // HANGER
  // ==========================================================================

  group.add(
    buildHanger(1.56)
  );


  // ==========================================================================
  // MAIN COAT BODY
  // ==========================================================================

  const bodyShape =
    new THREE.Shape();


  // Neck / upper left
  bodyShape.moveTo(
    -0.075,
    0.73
  );


  // Left shoulder
  bodyShape.quadraticCurveTo(
    -0.145,
    0.725,
    -0.215,
    0.675
  );


  // Shoulder into armhole
  bodyShape.quadraticCurveTo(
    -0.285,
    0.620,
    -0.315,
    0.525
  );


  // Left side
  bodyShape.quadraticCurveTo(
    -0.305,
    0.10,
    -0.310,
    -0.305
  );


  // Lower flare
  bodyShape.quadraticCurveTo(
    -0.312,
    -0.405,
    -0.330,
    -0.505
  );


  // Rounded lower-left hem
  bodyShape.quadraticCurveTo(
    -0.335,
    -0.545,
    -0.285,
    -0.555
  );


  // Bottom hem
  bodyShape.lineTo(
    0.285,
    -0.555
  );


  // Rounded lower-right hem
  bodyShape.quadraticCurveTo(
    0.335,
    -0.545,
    0.330,
    -0.505
  );


  bodyShape.quadraticCurveTo(
    0.312,
    -0.405,
    0.310,
    -0.305
  );


  // Right side
  bodyShape.quadraticCurveTo(
    0.305,
    0.10,
    0.315,
    0.525
  );


  // Right armhole
  bodyShape.quadraticCurveTo(
    0.285,
    0.620,
    0.215,
    0.675
  );


  // Right shoulder
  bodyShape.quadraticCurveTo(
    0.145,
    0.725,
    0.075,
    0.73
  );


  // Neck
  bodyShape.quadraticCurveTo(
    0.035,
    0.69,
    0.0,
    0.635
  );


  bodyShape.quadraticCurveTo(
    -0.035,
    0.69,
    -0.075,
    0.73
  );


  const body =
    extrudedShape(
      bodyShape,
      0.16,
      fabric,
      0.018
    );


  body.position.set(
    0,
    1.03,
    0
  );


  group.add(body);


  // ==========================================================================
  // SLEEVES
  // ==========================================================================

  for (
    const side of [-1, 1]
  ) {

    const sleeve =
      taperedTubeCurve(
        [
          new THREE.Vector3(
            side * 0.255,
            1.48,
            0
          ),

          new THREE.Vector3(
            side * 0.315,
            1.405,
            0
          ),

          new THREE.Vector3(
            side * 0.350,
            1.25,
            0
          ),

          new THREE.Vector3(
            side * 0.365,
            1.03,
            0
          ),

          new THREE.Vector3(
            side * 0.350,
            0.82,
            0
          ),

          new THREE.Vector3(
            side * 0.330,
            0.705,
            0
          )
        ],

        [
          0.095,
          0.088,
          0.078,
          0.066,
          0.056,
          0.050
        ],

        fabric,
        30,
        14
      );


    // Flatten the sleeve so it reads as fabric.
    sleeve.scale.z =
      0.72;


    group.add(sleeve);


    // Rounded shoulder transition
    const shoulder =
      new THREE.Mesh(
        new THREE.SphereGeometry(
          1,
          20,
          14
        ),
        fabric
      );


    shoulder.scale.set(
      0.115,
      0.080,
      0.070
    );


    shoulder.position.set(
      side * 0.245,
      1.475,
      0
    );


    shoulder.castShadow = true;
    shoulder.receiveShadow = true;


    group.add(
      shoulder
    );


    // Cuff
    const cuff =
      new THREE.Mesh(
        new THREE.CylinderGeometry(
          0.054,
          0.050,
          0.060,
          18
        ),
        detailFabric
      );


    cuff.rotation.z =
      side * -0.105;

    cuff.rotation.x =
      Math.PI / 2;

    cuff.scale.z =
      0.62;


    cuff.position.set(
      side * 0.331,
      0.705,
      0
    );


    cuff.castShadow = true;

    group.add(cuff);
  }


  // ==========================================================================
  // FRONT PLACKET
  // ==========================================================================

  const placket =
    extrudedShape(
      roundedRectShape(
        0.060,
        0.735,
        0.010
      ),
      0.026,
      detailFabric,
      0.004
    );


  placket.position.set(
    0,
    1.055,
    0.088
  );


  group.add(placket);


  // Small overlap panel
  const overlap =
    extrudedShape(
      roundedRectShape(
        0.030,
        0.68,
        0.006
      ),
      0.020,
      fabric,
      0.003
    );


  overlap.position.set(
    -0.028,
    1.06,
    0.097
  );


  group.add(overlap);


  // ==========================================================================
  // BUTTONS
  // ==========================================================================

  for (
    let i = 0;
    i < 5;
    i++
  ) {

    const button =
      new THREE.Mesh(
        new THREE.CylinderGeometry(
          0.0145,
          0.0145,
          0.011,
          16
        ),
        darkButton
      );


    button.rotation.x =
      Math.PI / 2;


    button.position.set(
      0.012,
      1.355 - i * 0.145,
      0.111
    );


    button.castShadow = true;

    group.add(button);
  }


  // ==========================================================================
  // NOTCHED LAPELS
  // ==========================================================================

  function addLapel(side) {

    const shape =
      new THREE.Shape();


    const points = [
      [0.018, 0.305],
      [0.080, 0.455],
      [0.175, 0.605],
      [0.125, 0.610],
      [0.058, 0.535],
      [0.035, 0.455],
      [0.035, 0.345]
    ];


    const transformed =
      points.map(
        ([x, y]) => [
          x * side,
          y
        ]
      );


    shape.moveTo(
      transformed[0][0],
      transformed[0][1]
    );


    for (
      let i = 1;
      i < transformed.length;
      i++
    ) {

      shape.lineTo(
        transformed[i][0],
        transformed[i][1]
      );
    }


    shape.closePath();


    const lapel =
      extrudedShape(
        shape,
        0.030,
        fabric,
        0.004
      );


    lapel.position.set(
      0,
      1.045,
      0.103
    );


    group.add(lapel);


    // Raised lapel seam
    const seam =
      tubeCurve(
        [
          new THREE.Vector3(
            side * 0.050,
            1.365,
            0.121
          ),

          new THREE.Vector3(
            side * 0.078,
            1.475,
            0.121
          ),

          new THREE.Vector3(
            side * 0.135,
            1.585,
            0.121
          )
        ],
        0.0035,
        seamMaterial
      );


    group.add(seam);
  }


  addLapel(-1);
  addLapel(1);


  // ==========================================================================
  // COLLAR
  // ==========================================================================

  const collar =
    extrudedShape(
      roundedRectShape(
        0.205,
        0.070,
        0.018
      ),
      0.040,
      detailFabric,
      0.006
    );


  collar.position.set(
    0,
    1.635,
    0.035
  );


  collar.rotation.x =
    -0.10;


  group.add(collar);


  // ==========================================================================
  // POCKETS
  // ==========================================================================

  function addPocket(
    x,
    y,
    width,
    height,
    angle = 0
  ) {

    const pocket =
      extrudedShape(
        roundedRectShape(
          width,
          height,
          0.016
        ),
        0.022,
        fabric,
        0.004
      );


    pocket.position.set(
      x,
      y,
      0.103
    );


    pocket.rotation.z =
      angle;


    group.add(pocket);


    // Pocket opening
    const opening =
      new THREE.Mesh(
        new THREE.BoxGeometry(
          width * 0.78,
          0.010,
          0.010
        ),
        seamMaterial
      );


    opening.position.set(
      x,
      y + height * 0.5 - 0.018,
      0.117
    );


    opening.rotation.z =
      angle;


    group.add(opening);


    // Pocket corner stitching
    for (
      const dx of [-1, 1]
    ) {

      const stitch =
        new THREE.Mesh(
          new THREE.BoxGeometry(
            0.006,
            height * 0.72,
            0.007
          ),
          seamMaterial
        );


      stitch.position.set(
        x + dx * width * 0.39,
        y - height * 0.005,
        0.116
      );


      stitch.rotation.z =
        angle;


      group.add(stitch);
    }
  }


  // Chest pocket
  addPocket(
    -0.115,
    1.225,
    0.145,
    0.145,
    0.0
  );


  // Lower left pocket
  addPocket(
    -0.178,
    0.805,
    0.205,
    0.185,
    -0.025
  );


  // Lower right pocket
  addPocket(
    0.178,
    0.805,
    0.205,
    0.185,
    0.025
  );


  // ==========================================================================
  // HEM
  // ==========================================================================

  const hem =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        0.575,
        0.014,
        0.018
      ),
      seamMaterial
    );


  hem.position.set(
    0,
    0.485,
    0.087
  );


  group.add(hem);


  // ==========================================================================
  // SIDE SEAMS
  // ==========================================================================

  for (
    const side of [-1, 1]
  ) {

    const seam =
      tubeCurve(
        [
          new THREE.Vector3(
            side * 0.302,
            0.99,
            0.088
          ),

          new THREE.Vector3(
            side * 0.303,
            0.78,
            0.088
          ),

          new THREE.Vector3(
            side * 0.305,
            0.55,
            0.088
          )
        ],
        0.003,
        seamMaterial
      );


    group.add(seam);
  }


  return group;
}


// ============================================================================
// EXPORT
// ============================================================================

export function createCoat(
  scene,
  camera,
  interactableObjects,
  hud,
  gloves
) {

  const wardrobe =
    new THREE.Group();


  wardrobe.position.copy(
    WARDROBE_POS
  );


  scene.add(wardrobe);


  // ==========================================================================
  // STAND
  // ==========================================================================

  wardrobe.add(
    buildStand()
  );


  // ==========================================================================
  // COAT
  // ==========================================================================

  const coatPart =
    buildCoat();


  coatPart.userData = {

    coat: true,

    name: 'Lab Coat',

    description:
      'A white lab coat hangs on the stand by the door. Press E to put it on — ' +
      'it shields your arms and clothes from chemical splashes.'
  };


  wardrobe.add(
    coatPart
  );


  interactableObjects.push(
    coatPart
  );


  // ==========================================================================
  // WARDROBE INTERACTION
  // ==========================================================================

  wardrobe.userData = {

    name: 'Coat Stand',

    description:
      'A walnut coat stand beside the door. The lab coat hangs from a wooden hanger. ' +
      'Press E to take it or put it back.'
  };


  interactableObjects.push(
    wardrobe
  );


  // ==========================================================================
  // FIRST-PERSON SLEEVES
  // ==========================================================================

  const sleeveMaterial =
    new THREE.MeshStandardMaterial({

      map: makeFabricTexture(),

      color: 0xf4f5f6,

      roughness: 0.88,

      side: THREE.DoubleSide
    });


  const cuffMaterial =
    new THREE.MeshStandardMaterial({

      color: 0xdcddde,

      roughness: 0.82
    });


  const sleeves = [];


  for (
    const roll of [
      gloves.rightRoll,
      gloves.leftRoll
    ]
  ) {

    // Forearm sleeve
    const sleeve =
      new THREE.Mesh(

        new THREE.CylinderGeometry(
          0.040,
          0.033,
          0.17,
          22,
          1,
          true
        ),

        sleeveMaterial
      );


    sleeve.position.set(
      0,
      -0.11,
      0.012
    );


    sleeve.visible =
      false;


    sleeve.layers.set(
      HAND_LAYER
    );


    roll.add(
      sleeve
    );


    // Wrist cuff
    const cuff =
      new THREE.Mesh(

        new THREE.CylinderGeometry(
          0.042,
          0.042,
          0.028,
          22
        ),

        cuffMaterial
      );


    cuff.position.set(
      0,
      -0.20,
      0.012
    );


    cuff.visible =
      false;


    cuff.layers.set(
      HAND_LAYER
    );


    roll.add(
      cuff
    );


    sleeves.push(
      sleeve,
      cuff
    );
  }


  // ==========================================================================
  // WEAR / REMOVE
  // ==========================================================================

  let on = false;


  function setOn(value) {

    on = value;


    hud.setCoat(
      on
    );


    for (
      const sleeve of sleeves
    ) {

      sleeve.visible =
        on;
    }


    coatPart.visible =
      !on;
  }


  return {

    get on() {
      return on;
    },


    wear() {
      setOn(true);
    },


    remove() {
      setOn(false);
    }
  };
}