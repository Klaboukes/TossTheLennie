import * as THREE from 'three';

// Procedural canvas textures. Geometry in this project uses UVs measured in
// metres, so each texture's `repeat` is 1 / (metres covered by one tile).

function canvasTexture(size, metres, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / metres, 1 / metres);
  t.anisotropy = 8;
  return t;
}

// Deterministic pseudo-random so the house looks the same every load.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function shade(hex, amount) {
  const c = new THREE.Color(hex);
  c.offsetHSL(0, 0, amount);
  return `#${c.getHexString()}`;
}

/** Running-bond brickwork, drawn in its own colours (not tinted). */
function brick(base, mortar, seed) {
  const r = rng(seed);
  return canvasTexture(512, 1.2, (g, s) => {
    const rows = 12; // 10 cm courses
    const cols = 4; // 30 cm bricks: chunky, comic-sized
    const h = s / rows;
    const w = s / cols;
    const m = 4; // mortar joint
    g.fillStyle = mortar;
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < rows; i++) {
      const off = i % 2 ? w / 2 : 0;
      for (let x = -w; x < s + w; x += w) {
        const bx = x + off + m / 2;
        const by = i * h + m / 2;
        g.fillStyle = shade(base, (r() - 0.5) * 0.09);
        g.fillRect(bx, by, w - m, h - m);
        g.fillStyle = 'rgba(255,255,255,0.12)';
        g.fillRect(bx, by, w - m, 2);
        g.fillStyle = 'rgba(0,0,0,0.16)';
        g.fillRect(bx, by + h - m - 3, w - m, 3);
      }
    }
  });
}

/** Soft striped wallpaper, tinted per room by the material colour. */
function wallpaper() {
  return canvasTexture(256, 1, (g, s) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, s, s);
    g.fillStyle = '#efefef';
    for (let x = 0; x < s; x += 32) g.fillRect(x, 0, 14, s);
    g.fillStyle = '#e2e2e2';
    for (let x = 23; x < s; x += 32) for (let y = 16; y < s; y += 32) {
      g.beginPath(); g.arc(x, y, 2.5, 0, Math.PI * 2); g.fill();
    }
  });
}

/**
 * Lived-in white paint, tinted per room by the material colour: soft greyish
 * blotches, scuffs along the skirting and a shadow of dust up by the ceiling.
 * One tile is a storey high (3 m), so the floor is always at its bottom edge.
 * With `kids`, the living room's walls also get grubby handprints and crayon
 * scribbles down at a child's height. Its tile is wider, so they repeat less.
 * A 'ceiling' gets just the blotches.
 */
function grime(kind) {
  const kids = kind === 'kids';
  const r = rng(kind.length * 7 + 3);
  const wM = kids ? 4.5 : 3;
  const c = document.createElement('canvas');
  c.width = kids ? 768 : 512;
  c.height = 512;
  const g = c.getContext('2d');
  const [w, h] = [c.width, c.height];
  const px = w / wM; // pixels per metre
  const yAt = (m) => h - m * (h / 3); // canvas y of a height above the floor
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, w, h);
  /** Draws `f` at (x, y) and again across the tile's edges, so it tiles seamlessly. */
  const wrap = (x, y, f) => {
    for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) f(x + dx, y + dy);
  };
  const smudge = (x, y, rad, a, tone = '110,98,80') => wrap(x, y, (X, Y) => {
    const grad = g.createRadialGradient(X, Y, 0, X, Y, rad);
    grad.addColorStop(0, `rgba(${tone},${a})`);
    grad.addColorStop(1, `rgba(${tone},0)`);
    g.fillStyle = grad;
    g.fillRect(X - rad, Y - rad, rad * 2, rad * 2);
  });
  for (let i = 0; i < 26; i++) smudge(r() * w, r() * h, 20 + r() * 70, 0.03 + r() * 0.05);
  if (kind === 'ceiling') return finish(c, wM);
  // scuffs and dust along the floor, and a dusty shadow up under the ceiling
  let grad = g.createLinearGradient(0, yAt(0.25), 0, h);
  grad.addColorStop(0, 'rgba(90,80,65,0)');
  grad.addColorStop(1, 'rgba(90,80,65,0.13)');
  g.fillStyle = grad;
  g.fillRect(0, yAt(0.25), w, h);
  for (let i = 0; i < 18; i++) smudge(r() * w, yAt(0.04 + r() * 0.12), 6 + r() * 12, 0.08 + r() * 0.08, '60,55,50');
  grad = g.createLinearGradient(0, 0, 0, yAt(2.75));
  grad.addColorStop(0, 'rgba(100,95,85,0.09)');
  grad.addColorStop(1, 'rgba(100,95,85,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, w, yAt(2.75));
  if (kids) {
    // grubby little handprints: a palm and four fingers and a thumb
    const hand = (x, y, s, a) => {
      g.save();
      g.translate(x, y);
      g.rotate((r() - 0.5) * 0.8);
      g.fillStyle = `rgba(95,80,62,${a})`;
      g.filter = 'blur(1.5px)'; // smeared, not stamped
      g.beginPath();
      g.ellipse(0, 0, 6 * s, 7 * s, 0, 0, Math.PI * 2);
      for (const [fx, fy, len] of [[-5, -10, 5], [-1.7, -12, 6], [1.7, -12, 6], [5, -10, 5], [8, -1, 4]]) {
        g.moveTo(fx * s + 1.6 * s, fy * s);
        g.ellipse(fx * s, fy * s, 1.6 * s, len * s * 0.6, fx > 7 ? 1 : 0, 0, Math.PI * 2);
      }
      g.fill();
      g.restore();
    };
    for (let i = 0; i < 14; i++) hand(30 + r() * (w - 60), yAt(0.55 + r() * 0.75), 0.9 + r() * 0.3, 0.04 + r() * 0.05);
    // crayon on the wall, low down where small kids reach
    const crayon = ['#d8382c', '#2f5fd0', '#2a9a48', '#8a3fb0', '#f08a1c'];
    const stroke = (pts, color, lw = 2.2) => {
      g.strokeStyle = color;
      g.globalAlpha = 0.75;
      g.lineWidth = lw;
      g.lineCap = g.lineJoin = 'round';
      g.beginPath();
      pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.stroke();
      g.globalAlpha = 1;
    };
    const jit = () => (r() - 0.5) * 3;
    // zigzag scribbles
    for (const [x, m, col] of [[0.35, 0.55, 0], [1.9, 0.4, 1], [3.6, 0.7, 3]]) {
      const pts = [];
      for (let i = 0; i < 14; i++) pts.push([x * px + i * 4 + jit(), yAt(m) + (i % 2 ? -18 : 6) + jit()]);
      stroke(pts, crayon[col]);
    }
    // a spiral
    {
      const [cx, cy] = [1.2 * px, yAt(0.75)];
      stroke(Array.from({ length: 50 }, (_, i) => [cx + Math.cos(i * 0.45) * i * 0.55 + jit() * 0.3, cy + Math.sin(i * 0.45) * i * 0.5]), crayon[4]);
    }
    // a sun with rays
    {
      const [cx, cy] = [2.7 * px, yAt(1.05)];
      stroke(Array.from({ length: 16 }, (_, i) => [cx + Math.cos(i / 2.4) * 11, cy + Math.sin(i / 2.4) * 11]), crayon[4], 2.6);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        stroke([[cx + Math.cos(a) * 15, cy + Math.sin(a) * 15], [cx + Math.cos(a) * 24, cy + Math.sin(a) * 24]], crayon[4]);
      }
    }
    // a stick figure and a house with a pointy roof
    {
      const [x, y] = [3.05 * px, yAt(0.45)];
      stroke([[x, y], [x, y - 22]], crayon[1]);
      stroke([[x - 9, y + 12], [x, y], [x + 9, y + 12]], crayon[1]);
      stroke([[x - 11, y - 14], [x + 11, y - 18]], crayon[1]);
      stroke(Array.from({ length: 12 }, (_, i) => [x + Math.cos(i / 1.8) * 6, y - 29 + Math.sin(i / 1.8) * 6]), crayon[1]);
      const [hx, hy] = [0.6 * px, yAt(0.3)];
      stroke([[hx, hy], [hx, hy - 30], [hx + 36, hy - 30], [hx + 36, hy], [hx, hy]], crayon[0]);
      stroke([[hx - 4, hy - 28], [hx + 18, hy - 48], [hx + 40, hy - 28]], crayon[0]);
      stroke([[hx + 14, hy], [hx + 14, hy - 14], [hx + 22, hy - 14], [hx + 22, hy]], crayon[2]);
    }
    // a long wobbly line, as if someone walked along with a crayon
    stroke(Array.from({ length: 40 }, (_, i) => [2.1 * px + i * 6, yAt(0.82) + Math.sin(i * 0.5) * 4 + jit()]), crayon[2], 1.8);
  }
  return finish(c, wM);
}
function finish(c, wM) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / wM, 1 / 3);
  t.anisotropy = 8;
  return t;
}

function wood() {
  const r = rng(7);
  return canvasTexture(512, 2, (g, s) => {
    const rows = 10;
    const h = s / rows;
    const tones = ['#c8955f', '#bf8a54', '#d1a06a', '#b98450', '#c99a63'];
    for (let i = 0; i < rows; i++) {
      let x = -r() * s * 0.5;
      while (x < s) {
        const len = s * (0.35 + r() * 0.4);
        g.fillStyle = tones[Math.floor(r() * tones.length)];
        g.fillRect(x, i * h, len, h);
        g.strokeStyle = 'rgba(90, 55, 25, 0.18)';
        g.lineWidth = 1;
        for (let k = 0; k < 5; k++) {
          const y = i * h + 4 + r() * (h - 8);
          g.beginPath();
          g.moveTo(x, y);
          g.bezierCurveTo(x + len * 0.3, y + (r() - 0.5) * 6, x + len * 0.7, y + (r() - 0.5) * 6, x + len, y);
          g.stroke();
        }
        g.fillStyle = 'rgba(70, 40, 15, 0.45)';
        g.fillRect(x, i * h, 2, h);
        x += len;
      }
      g.fillStyle = 'rgba(70, 40, 15, 0.4)';
      g.fillRect(0, i * h, s, 2);
    }
  });
}

function tiles() {
  return canvasTexture(256, 1, (g, s) => {
    const n = 4;
    const t = s / n;
    g.fillStyle = '#c9c9c9';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      g.fillStyle = (i + j) % 2 ? '#ffffff' : '#f2f2f2';
      g.fillRect(i * t + 2, j * t + 2, t - 4, t - 4);
    }
  });
}

function carpet() {
  const r = rng(11);
  return canvasTexture(256, 1, (g, s) => {
    g.fillStyle = '#ececec';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 5000; i++) {
      const v = 200 + Math.floor(r() * 55);
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(r() * s, r() * s, 2, 2);
    }
  });
}

function grass() {
  const r = rng(3);
  return canvasTexture(512, 4, (g, s) => {
    g.fillStyle = '#6fae4f';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 9000; i++) {
      const x = r() * s;
      const y = r() * s;
      const l = 32 + r() * 22;
      g.strokeStyle = `hsl(${95 + r() * 20}, 45%, ${l}%)`;
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (r() - 0.5) * 4, y - 3 - r() * 6);
      g.stroke();
    }
  });
}

/** Dark Dutch roof pantiles: rows of wavy tiles with a highlight on each crest. */
function pantiles() {
  const r = rng(5);
  return canvasTexture(256, 1.2, (g, s) => {
    const rows = 5;
    const cols = 4;
    const h = s / rows;
    const w = s / cols;
    g.fillStyle = '#231d1b';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const x = j * w;
        const y = i * h;
        const tone = shade('#463a36', (r() - 0.5) * 0.06);
        const grad = g.createLinearGradient(x, 0, x + w, 0);
        grad.addColorStop(0, '#2a2321');
        grad.addColorStop(0.35, tone);
        grad.addColorStop(0.5, shade(tone, 0.08));
        grad.addColorStop(0.75, '#2e2624');
        grad.addColorStop(1, '#2a2321');
        g.fillStyle = grad;
        g.fillRect(x + 1, y + 1, w - 2, h - 6);
        g.fillStyle = 'rgba(0,0,0,0.35)';
        g.fillRect(x, y + h - 6, w, 5);
      }
    }
  });
}

/** Horizontally grooved panel between stacked windows; white, so the material colour tints it. */
function grooves() {
  return canvasTexture(128, 0.5, (g, s) => {
    const n = 4; // 12.5 cm grooves
    const h = s / n;
    for (let i = 0; i < n; i++) {
      g.fillStyle = '#d6d6d6';
      g.fillRect(0, i * h, s, h);
      g.fillStyle = '#ffffff';
      g.fillRect(0, i * h, s, 3);
      g.fillStyle = '#9a9a9a';
      g.fillRect(0, i * h + h - 4, s, 4);
    }
  });
}

/**
 * Plywood boards over the neighbours' windows, so it's plain you can't go in
 * there: pale wood with long wavy grain and a few knots, the seam between two
 * sheets at the tile edge (a sheet is 1.22 m wide).
 */
function plywood() {
  const r = rng(31);
  return canvasTexture(256, 1.22, (g, s) => {
    g.fillStyle = '#c9a46a';
    g.fillRect(0, 0, s, s);
    // grain: long thin streaks running across the sheet, drawn wrapping so tiles join
    for (let i = 0; i < 46; i++) {
      const y = r() * s;
      const amp = 2 + r() * 5;
      const phase = r() * Math.PI * 2;
      g.strokeStyle = r() < 0.5 ? `rgba(120,80,35,${0.12 + r() * 0.18})` : `rgba(255,236,190,${0.1 + r() * 0.15})`;
      g.lineWidth = 1 + r() * 2.5;
      for (const off of [-s, 0, s]) {
        g.beginPath();
        for (let x = 0; x <= s; x += 8) {
          const yy = y + off + Math.sin((x / s) * Math.PI * 2 + phase) * amp;
          if (x === 0) g.moveTo(x, yy);
          else g.lineTo(x, yy);
        }
        g.stroke();
      }
    }
    // a few knots and darker patches
    for (let i = 0; i < 4; i++) {
      const x = 20 + r() * (s - 40);
      const y = 20 + r() * (s - 40);
      g.fillStyle = 'rgba(110,70,30,0.35)';
      g.beginPath();
      g.ellipse(x, y, 10 + r() * 8, 4 + r() * 3, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(80,50,20,0.5)';
      g.beginPath();
      g.ellipse(x, y, 4, 2, 0, 0, Math.PI * 2);
      g.fill();
    }
    // the seam where two sheets meet, with a row of screw heads beside it
    g.fillStyle = 'rgba(70,45,20,0.6)';
    g.fillRect(0, 0, 3, s);
    g.fillStyle = '#6d6a64';
    for (let y = 16; y < s; y += 42) {
      g.beginPath();
      g.arc(12, y, 3, 0, Math.PI * 2);
      g.fill();
    }
  });
}

function stone() {
  const r = rng(9);
  return canvasTexture(256, 1, (g, s) => {
    g.fillStyle = '#8f8a80';
    g.fillRect(0, 0, s, s);
    const n = 2;
    const t = s / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      g.fillStyle = shade('#cfc8b8', (r() - 0.5) * 0.1);
      g.fillRect(i * t + 5, j * t + 5, t - 10, t - 10);
    }
  });
}

let cache = null;
export function textures() {
  if (!cache) {
    cache = {
      brick: brick('#8e5a48', '#bdb1a5', 21),
      brickLight: brick('#a58a7a', '#d2c8bd', 23),
      wallpaper: wallpaper(),
      grime: grime('wall'),
      kidsWall: grime('kids'),
      ceilingGrime: grime('ceiling'),
      wood: wood(),
      tiles: tiles(),
      carpet: carpet(),
      grass: grass(),
      pantiles: pantiles(),
      grooves: grooves(),
      plywood: plywood(),
      stone: stone(),
    };
  }
  return cache;
}

/**
 * Rewrites a BoxGeometry's UVs in world metres (given the box's world min/max)
 * so tiling textures line up across neighbouring boxes.
 */
export function meterBoxUVs(geo, min, max) {
  const sx = max[0] - min[0];
  const sy = max[1] - min[1];
  const sz = max[2] - min[2];
  const faces = [
    (u, v) => [-max[2] + u * sz, min[1] + v * sy], // +x
    (u, v) => [min[2] + u * sz, min[1] + v * sy], // -x
    (u, v) => [min[0] + u * sx, min[2] + v * sz], // +y
    (u, v) => [min[0] + u * sx, min[2] + v * sz], // -y
    (u, v) => [min[0] + u * sx, min[1] + v * sy], // +z
    (u, v) => [-max[0] + u * sx, min[1] + v * sy], // -z
  ];
  const uv = geo.attributes.uv;
  for (let f = 0; f < 6; f++) {
    for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      const [a, b] = faces[f](uv.getX(k), uv.getY(k));
      uv.setXY(k, a, b);
    }
  }
  uv.needsUpdate = true;
}

/**
 * Horizontal floor quad from (x0,z0) to (x1,z1) with metre UVs. `turned`
 * turns the texture a quarter, so floorboards run front to back instead of across.
 */
export function floorGeometry(x0, z0, x1, z1, turned = false) {
  const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
  geo.rotateX(-Math.PI / 2);
  geo.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    if (turned) uv.setXY(i, -pos.getZ(i), -pos.getX(i));
    else uv.setXY(i, pos.getX(i), -pos.getZ(i));
  }
  uv.needsUpdate = true;
  return geo;
}
