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

/** Cartoon window glass for the neighbours: a flat colour with diagonal glints. */
function fakeGlass(color, glint) {
  return canvasTexture(256, 2, (g, s) => {
    g.fillStyle = color;
    g.fillRect(0, 0, s, s);
    g.strokeStyle = glint;
    g.lineCap = 'butt';
    // stripes drawn three times (shifted by the tile size) so they wrap seamlessly
    for (const off of [-s, 0, s]) {
      for (const [x, w] of [[0.2, 26], [0.36, 9]]) {
        g.lineWidth = w;
        g.beginPath();
        g.moveTo(x * s + off - s / 2, s);
        g.lineTo(x * s + off + s / 2, 0);
        g.stroke();
      }
    }
  });
}

/** A concrete decorative "breeze block" with a rounded cut-out pattern; one per face. */
function breezeBlock() {
  return canvasTexture(128, 1, (g, s) => {
    g.fillStyle = '#d9d4cb';
    g.fillRect(0, 0, s, s);
    g.strokeStyle = '#a49d92';
    g.lineWidth = 4;
    g.strokeRect(2, 2, s - 4, s - 4);
    g.fillStyle = '#3a3330';
    const q = s / 4;
    for (const [cx, cy] of [[q * 1.35, q * 1.35], [q * 2.65, q * 1.35], [q * 1.35, q * 2.65], [q * 2.65, q * 2.65]]) {
      g.beginPath();
      g.arc(cx, cy, q * 0.48, 0, Math.PI * 2);
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
      wood: wood(),
      tiles: tiles(),
      carpet: carpet(),
      grass: grass(),
      pantiles: pantiles(),
      grooves: grooves(),
      glassSky: fakeGlass('#8cc4e8', 'rgba(255,255,255,0.55)'),
      glassWarm: fakeGlass('#f0a75e', 'rgba(255,236,190,0.45)'),
      breezeBlock: breezeBlock(),
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

/** Horizontal floor quad from (x0,z0) to (x1,z1) with metre UVs. */
export function floorGeometry(x0, z0, x1, z1) {
  const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
  geo.rotateX(-Math.PI / 2);
  geo.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i), -pos.getZ(i));
  uv.needsUpdate = true;
  return geo;
}
