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

/** Horizontal lap siding, white-ish so the material colour tints it. */
function siding() {
  return canvasTexture(256, 1, (g, s) => {
    const rows = 8;
    const h = s / rows;
    for (let i = 0; i < rows; i++) {
      const grad = g.createLinearGradient(0, i * h, 0, (i + 1) * h);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(1, '#dedede');
      g.fillStyle = grad;
      g.fillRect(0, i * h, s, h);
      g.fillStyle = '#a9a9a9';
      g.fillRect(0, (i + 1) * h - 3, s, 3);
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

function shingles() {
  const r = rng(5);
  return canvasTexture(256, 1.2, (g, s) => {
    const rows = 6;
    const h = s / rows;
    const w = s / 5;
    g.fillStyle = '#5a2a22';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < rows; i++) {
      const off = i % 2 ? w / 2 : 0;
      for (let x = -w; x < s + w; x += w) {
        g.fillStyle = shade('#9a3d2f', (r() - 0.5) * 0.12);
        g.fillRect(x + off + 1.5, i * h, w - 3, h - 4);
        g.fillStyle = 'rgba(0,0,0,0.25)';
        g.fillRect(x + off + 1.5, i * h + h - 8, w - 3, 4);
      }
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
      siding: siding(),
      wallpaper: wallpaper(),
      wood: wood(),
      tiles: tiles(),
      carpet: carpet(),
      grass: grass(),
      shingles: shingles(),
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
