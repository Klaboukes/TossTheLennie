import * as THREE from 'three';
import { drawn, picture } from './pictures.js';

// The kids' drawings and paintings on the living room's white walls (pictures
// 0–7), and the framed snapshots of friends in the toilet (8–11: cartoon
// people, not real photos). They're all drawn on one canvas (one texture, one
// material), and each picture on the wall is a flat sheet showing its own bit
// of it, so together they cost the graphics chip next to nothing. Each sheet
// fades with the wall it hangs on.

const COLS = 4;
const ROWS = 3;
const CW = 256; // one drawing on the canvas, landscape like an A4 sheet
const CH = 180;

// Deterministic pseudo-random, so the drawings look the same every load.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function atlas() {
  const c = document.createElement('canvas');
  c.width = CW * COLS;
  c.height = CH * ROWS;
  const g = c.getContext('2d');
  const r = rng(17);
  const j = (n = 2.5) => (r() - 0.5) * n; // a crayon's wobble

  /** A wobbly crayon line through the points. */
  const line = (pts, color, w = 5) => {
    g.strokeStyle = color;
    g.lineWidth = w;
    g.lineCap = g.lineJoin = 'round';
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x + j(), y + j()) : g.moveTo(x + j(), y + j())));
    g.stroke();
  };
  /** A crayon-coloured blob: filled, with scratchy strokes over it. */
  const blob = (x, y, rx, ry, color) => {
    g.fillStyle = color;
    g.globalAlpha = 0.85;
    g.beginPath();
    g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
    line(Array.from({ length: 13 }, (_, i) => [x + Math.cos(i / 2) * rx, y + Math.sin(i / 2) * ry]), color, 3);
  };
  const stick = (x, y, color, s = 1, arms = 0.3) => {
    line([[x, y - 26 * s], [x, y]], color, 4);
    line([[x - 14 * s, y - 18 * s + arms * 20], [x, y - 20 * s], [x + 14 * s, y - 18 * s + arms * 20]], color, 4);
    line([[x - 10 * s, y + 18 * s], [x, y], [x + 10 * s, y + 18 * s]], color, 4);
    g.strokeStyle = color;
    g.lineWidth = 4;
    g.beginPath();
    g.arc(x, y - 34 * s, 8 * s, 0, Math.PI * 2);
    g.stroke();
  };
  const word = (text, x, y, color, size = 26) => {
    g.fillStyle = color;
    g.font = `bold ${size}px "Comic Sans MS", "Chalkboard SE", sans-serif`;
    let cx = x;
    for (const ch of text) {
      g.save();
      g.translate(cx, y + j(6));
      g.rotate(j(0.5));
      g.fillText(ch, 0, 0);
      g.restore();
      cx += size * 0.72;
    }
  };
  const sun = (x, y) => {
    blob(x, y, 18, 18, '#f6c90e');
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      line([[x + Math.cos(a) * 24, y + Math.sin(a) * 24], [x + Math.cos(a) * 36, y + Math.sin(a) * 36]], '#f6a90e', 4);
    }
  };
  const grass = (y, color = '#3fae3a') => line(Array.from({ length: 33 }, (_, i) => [i * 8, y + (i % 2 ? -8 : 2)]), color, 4);
  /** Sticky tape on the top corners, or a frame round a painting. */
  const tape = () => {
    g.fillStyle = 'rgba(236, 226, 190, 0.85)';
    for (const x of [6, CW - 34]) g.fillRect(x, 2, 28, 12);
  };
  const frame = (color) => {
    g.strokeStyle = color;
    g.lineWidth = 14;
    g.strokeRect(7, 7, CW - 14, CH - 14);
    g.strokeStyle = 'rgba(255,255,255,0.25)';
    g.lineWidth = 2;
    g.strokeRect(2, 2, CW - 4, CH - 4);
  };

  const pictures = [
    // 0: our house, the sun and the whole family
    () => {
      sun(212, 38);
      blob(70, 112, 44, 36, '#e2231a');
      line([[22, 82], [70, 36], [120, 82]], '#2a5bd7', 6);
      line([[60, 148], [60, 118], [80, 118], [80, 148]], '#5a3a1a', 5);
      stick(150, 128, '#1b1b1b', 1.1);
      stick(178, 134, '#1b1b1b', 0.8);
      stick(200, 138, '#1b1b1b', 0.65);
      stick(222, 136, '#1b1b1b', 0.7);
      grass(166);
    },
    // 1: a rainbow over the clouds, for papa
    () => {
      ['#e2231a', '#f59a23', '#f6d04d', '#3fae3a', '#2a5bd7', '#8e44ad'].forEach((c, i) => {
        line(Array.from({ length: 17 }, (_, k) => {
          const a = Math.PI + (k / 16) * Math.PI;
          return [128 + Math.cos(a) * (100 - i * 9), 150 + Math.sin(a) * (100 - i * 9)];
        }), c, 8);
      });
      blob(40, 148, 34, 18, '#cfe6f5');
      blob(216, 148, 34, 18, '#cfe6f5');
      word('PAPA', 84, 140, '#e2231a', 28);
    },
    // 2: the cat
    () => {
      blob(128, 118, 56, 40, '#f59a23');
      blob(128, 70, 34, 28, '#f59a23');
      line([[100, 52], [104, 26], [118, 46]], '#d9771a', 5);
      line([[138, 46], [152, 26], [156, 52]], '#d9771a', 5);
      for (const x of [116, 140]) blob(x, 66, 5, 7, '#2e7d32');
      line([[122, 82], [128, 88], [134, 82]], '#1b1b1b', 3);
      for (const s of [-1, 1]) for (const dy of [-4, 4]) line([[128 + s * 14, 84 + dy], [128 + s * 44, 80 + dy * 2]], '#1b1b1b', 2);
      line([[184, 128], [214, 104], [222, 74]], '#f59a23', 10);
      grass(168, '#7cc36a');
    },
    // 3: papa flying through the air, with his glasses and beard
    () => {
      blob(48, 40, 30, 14, '#cfe6f5');
      blob(200, 32, 30, 14, '#cfe6f5');
      g.save();
      g.translate(128, 96);
      g.rotate(-0.5);
      g.translate(-128, -96);
      stick(128, 110, '#2a5bd7', 1.5, -0.9);
      g.restore();
      line([[96, 70], [112, 72]], '#1b1b1b', 3);
      line([[118, 70], [134, 72]], '#1b1b1b', 3);
      blob(116, 88, 14, 7, '#7a6a5a');
      word('WHEE!', 150, 160, '#e2231a', 26);
      for (let i = 0; i < 5; i++) line([[30 + i * 8, 120 + i * 6], [52 + i * 8, 116 + i * 6]], '#999999', 2);
    },
    // 4: flowers and a butterfly
    () => {
      for (const [x, c] of [[50, '#e86fa0'], [110, '#f6d04d'], [170, '#8e44ad'], [220, '#e2231a']]) {
        line([[x, 160], [x + 4, 100]], '#3fae3a', 5);
        for (let i = 0; i < 6; i++) blob(x + 4 + Math.cos(i) * 14, 92 + Math.sin(i) * 14, 9, 9, c);
        blob(x + 4, 92, 7, 7, '#f59a23');
      }
      blob(150, 40, 16, 12, '#2a5bd7');
      blob(178, 40, 16, 12, '#2a5bd7');
      line([[164, 28], [164, 54]], '#1b1b1b', 4);
      grass(168);
    },
    // 5: a painting: paint blobs and handprints, in a frame
    () => {
      g.fillStyle = '#fdf6e3';
      g.fillRect(0, 0, CW, CH);
      for (let i = 0; i < 16; i++) {
        const c = ['#e2231a', '#2a5bd7', '#f6d04d', '#3fae3a', '#e86fa0', '#f59a23'][i % 6];
        blob(20 + r() * 216, 20 + r() * 140, 10 + r() * 22, 8 + r() * 18, c);
      }
      for (const [x, y, c] of [[70, 90, '#2a5bd7'], [170, 100, '#e2231a']]) {
        blob(x, y, 20, 24, c);
        for (let f = 0; f < 5; f++) blob(x - 22 + f * 11, y - 32 + Math.abs(f - 2) * 4, 5, 13, c);
      }
      frame('#3a3440');
    },
    // 6: jumping on the trampoline
    () => {
      sun(36, 36);
      line([[50, 150], [60, 128], [196, 128], [206, 150]], '#1b1b1b', 5);
      blob(128, 128, 70, 8, '#2a5bd7');
      stick(128, 70, '#e2231a', 1.1, -0.8);
      for (const x of [104, 150]) line([[x, 112], [x - 6, 100]], '#aaaaaa', 3);
      grass(170);
    },
    // 7: the sea, a boat and some fish, in a frame
    () => {
      g.fillStyle = '#bfe3f7';
      g.fillRect(0, 0, CW, CH);
      g.fillStyle = '#2a7bd7';
      g.fillRect(0, 96, CW, CH - 96);
      line(Array.from({ length: 17 }, (_, i) => [i * 16, 96 + (i % 2 ? -6 : 4)]), '#1b5aa8', 4);
      blob(90, 82, 44, 12, '#c0643c');
      line([[90, 76], [90, 24]], '#5a3a1a', 4);
      g.fillStyle = '#ffffff';
      g.beginPath(); g.moveTo(94, 26); g.lineTo(130, 70); g.lineTo(94, 70); g.fill();
      for (const [x, y, c] of [[60, 140, '#f6d04d'], [160, 124, '#f59a23'], [200, 152, '#e86fa0']]) {
        blob(x, y, 16, 9, c);
        line([[x + 14, y], [x + 26, y - 8], [x + 26, y + 8], [x + 14, y]], c, 4);
      }
      frame('#c9a06a');
    },
  ];

  // ---- the snapshots of friends: cartoon people in a photo frame
  /** One friend: body, head, hair, a smile; `up` raises the arms. */
  const friend = (x, y, s, { skin, shirt, hair, up = false, glasses = false }) => {
    g.fillStyle = shirt;
    g.beginPath();
    g.ellipse(x, y + 26 * s, 15 * s, 22 * s, 0, Math.PI, 0);
    g.fill();
    g.fillRect(x - 15 * s, y + 26 * s, 30 * s, 40 * s);
    g.strokeStyle = shirt;
    g.lineWidth = 7 * s;
    g.lineCap = 'round';
    for (const d of [-1, 1]) {
      g.beginPath();
      g.moveTo(x + d * 13 * s, y + 14 * s);
      g.lineTo(x + d * (up ? 22 : 18) * s, y + (up ? -14 : 40) * s);
      g.stroke();
    }
    g.fillStyle = skin;
    g.beginPath();
    g.arc(x, y, 12 * s, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = hair;
    g.beginPath();
    g.arc(x, y - 2 * s, 12.5 * s, Math.PI * 1.05, Math.PI * 1.95);
    g.fill();
    g.strokeStyle = '#3a2418';
    g.lineWidth = 1.6 * s;
    g.beginPath();
    g.arc(x, y + 2 * s, 6 * s, 0.15 * Math.PI, 0.85 * Math.PI);
    g.stroke();
    g.fillStyle = '#2a2a2a';
    for (const d of [-1, 1]) g.fillRect(x + d * 4.5 * s - 1.2 * s, y - 3 * s, 2.4 * s, 2.4 * s);
    if (glasses) {
      g.strokeStyle = '#222';
      g.lineWidth = 1.4 * s;
      for (const d of [-1, 1]) g.strokeRect(x + d * 4.5 * s - 3.6 * s, y - 5 * s, 7.2 * s, 5 * s);
    }
  };
  const SKIN = ['#f0c2a2', '#d9a07a', '#8d5a3c', '#f5d0b5', '#b97d58'];
  /** A photo: its scene, softly lit, behind a white mount in a dark frame. */
  const photo = (drawScene) => {
    drawScene();
    const shine = g.createLinearGradient(0, 0, CW, CH);
    shine.addColorStop(0, 'rgba(255,255,255,0.12)');
    shine.addColorStop(0.5, 'rgba(255,255,255,0)');
    g.fillStyle = shine;
    g.fillRect(0, 0, CW, CH);
    g.strokeStyle = '#f6f3ec';
    g.lineWidth = 26;
    g.strokeRect(13, 13, CW - 26, CH - 26);
    frame('#2b2622');
  };
  const sky = (top, bottom, horizon = CH) => {
    const grad = g.createLinearGradient(0, 0, 0, horizon);
    grad.addColorStop(0, top);
    grad.addColorStop(1, bottom);
    g.fillStyle = grad;
    g.fillRect(0, 0, CW, horizon);
  };
  pictures.push(
    // 8: a party, everybody cheering, with balloons
    () => photo(() => {
      g.fillStyle = '#4a3a6a';
      g.fillRect(0, 0, CW, CH);
      for (const [x, y, c] of [[50, 50, '#e2231a'], [205, 45, '#f6d04d'], [128, 38, '#2a7bd7']]) {
        g.fillStyle = c;
        g.beginPath(); g.ellipse(x, y, 13, 16, 0, 0, Math.PI * 2); g.fill();
      }
      friend(62, 92, 1, { skin: SKIN[0], shirt: '#e86fa0', hair: '#6b4226', up: true });
      friend(105, 98, 1, { skin: SKIN[2], shirt: '#3fae3a', hair: '#1b1b1b' });
      friend(150, 95, 1, { skin: SKIN[3], shirt: '#f59a23', hair: '#e2b04a', up: true });
      friend(194, 92, 1, { skin: SKIN[1], shirt: '#2f5fbf', hair: '#3a281d', glasses: true });
    }),
    // 9: two friends on the beach
    () => photo(() => {
      sky('#7fc4f0', '#cfeaf8', 100);
      g.fillStyle = '#2a7bd7';
      g.fillRect(0, 100, CW, 30);
      g.fillStyle = '#f0d9a0';
      g.fillRect(0, 130, CW, CH - 130);
      g.fillStyle = '#ffe36b';
      g.beginPath(); g.arc(200, 45, 16, 0, Math.PI * 2); g.fill();
      friend(105, 92, 1.1, { skin: SKIN[3], shirt: '#e2231a', hair: '#8a5a32', glasses: true });
      friend(150, 95, 1.05, { skin: SKIN[4], shirt: '#f6f6f6', hair: '#1b1b1b', up: true });
    }),
    // 10: a barbecue in the garden, raising a glass
    () => photo(() => {
      sky('#9fd3ff', '#e2f2ff', 110);
      g.fillStyle = '#6fae4f';
      g.fillRect(0, 110, CW, CH - 110);
      g.fillStyle = '#2b2b2b';
      g.fillRect(28, 112, 40, 8);
      g.fillRect(44, 120, 6, 30);
      friend(95, 90, 1, { skin: SKIN[1], shirt: '#8e44ad', hair: '#3a281d' });
      friend(140, 88, 1, { skin: SKIN[0], shirt: '#3c8a3a', hair: '#c9c4bb', glasses: true, up: true });
      friend(185, 92, 1, { skin: SKIN[2], shirt: '#f2c14e', hair: '#1b1b1b' });
      g.fillStyle = '#f6d04d';
      g.fillRect(156, 68, 8, 12);
    }),
    // 11: a hike in the hills, arms in the air at the top
    () => photo(() => {
      sky('#8ec8ee', '#e8f4fb', 120);
      g.fillStyle = '#7a9a6a';
      g.beginPath(); g.moveTo(0, 130); g.lineTo(70, 60); g.lineTo(140, 125); g.lineTo(200, 70); g.lineTo(CW, 120); g.lineTo(CW, CH); g.lineTo(0, CH); g.fill();
      g.fillStyle = '#ffffff';
      g.beginPath(); g.moveTo(70, 60); g.lineTo(58, 72); g.lineTo(82, 72); g.fill();
      friend(80, 100, 0.95, { skin: SKIN[4], shirt: '#2f5fbf', hair: '#3a281d', up: true });
      friend(122, 104, 0.95, { skin: SKIN[3], shirt: '#e2231a', hair: '#e2b04a', up: true });
      friend(164, 100, 0.95, { skin: SKIN[0], shirt: '#f59a23', hair: '#6b4226', up: true, glasses: true });
    }),
  );

  pictures.forEach((draw, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    g.save();
    g.translate(col * CW, row * CH);
    g.beginPath();
    g.rect(0, 0, CW, CH);
    g.clip();
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, CW, CH);
    draw();
    if (i < 8 && i !== 5 && i !== 7) tape(); // the paintings and photos are framed instead
    g.restore();
  });

  const t = picture(c, atlas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/**
 * Hangs the drawings. Each spot: { pic (0–11), x, y, z, face ('+x', '-x', '+z',
 * '-z'), w (metres wide), tilt (radians), line (the wall's fade line) }.
 */
export function hangDrawings({ addMesh, std }, spots) {
  const mat = std({ map: atlas(), roughness: 0.9 });
  const yaw = { '+x': Math.PI / 2, '-x': -Math.PI / 2, '-z': Math.PI, '+z': 0 };
  for (const s of spots) {
    const geo = new THREE.PlaneGeometry(s.w, (s.w * CH) / CW);
    const uv = geo.attributes.uv;
    const col = s.pic % COLS;
    const row = Math.floor(s.pic / COLS);
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (col + uv.getX(i)) / COLS, 1 - (row + 1 - uv.getY(i)) / ROWS);
    geo.rotateZ(s.tilt ?? 0);
    geo.rotateY(yaw[s.face]);
    geo.translate(s.x, s.y, s.z);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    addMesh(mesh, 0, s.line);
  }
}

/**
 * The big black-and-white painting of a medieval town (an old etching, with
 * hatched shading): a river with a stone bridge in front, the town wall with
 * its towers and gate, steep gabled houses climbing a hill, a church spire,
 * and the castle on top.
 */
function townPicture() {
  const PW = 600;
  const PH = 380;
  const c = document.createElement('canvas');
  c.width = PW;
  c.height = PH;
  const g = c.getContext('2d');
  const r = rng(23);
  const ink = (a) => `rgba(20,20,20,${a})`;
  g.fillStyle = '#e9e6de';
  g.fillRect(0, 0, PW, PH);
  /** Hatching: parallel strokes over the current path. */
  const hatch = (x0, y0, x1, y1, gap, slant) => {
    g.save();
    g.clip();
    g.strokeStyle = ink(0.5);
    g.lineWidth = 1;
    g.beginPath();
    for (let x = x0 - (y1 - y0); x < x1 + (y1 - y0); x += gap) {
      g.moveTo(x, y0);
      g.lineTo(x + (y1 - y0) * slant, y1);
    }
    g.stroke();
    g.restore();
  };
  const trace = (pts) => {
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
  };
  /** A filled, outlined shape, hatched every `gap` pixels if given. */
  const shape = (pts, fill, gap = 0, slant = 0.6) => {
    trace(pts);
    g.fillStyle = fill;
    g.fill();
    if (gap) {
      const xs = pts.map((p) => p[0]);
      const ys = pts.map((p) => p[1]);
      hatch(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys), gap, slant);
      trace(pts);
    }
    g.strokeStyle = ink(0.85);
    g.lineWidth = 1.4;
    g.stroke();
  };
  // the sky: long faint horizontal strokes and outlined clouds
  g.strokeStyle = ink(0.16);
  g.lineWidth = 1;
  for (let y = 12; y < 130; y += 7) {
    g.beginPath();
    g.moveTo(r() * 60, y);
    g.lineTo(PW - r() * 60, y + (r() - 0.5) * 2);
    g.stroke();
  }
  for (const [x, y, s] of [[70, 60, 1], [420, 42, 1.3]]) {
    g.fillStyle = '#efece5';
    g.strokeStyle = ink(0.6);
    for (const [dx, dy, rr] of [[0, 0, 18], [22, -10, 22], [48, -2, 18], [68, 4, 13]]) {
      g.beginPath();
      g.arc(x + dx * s, y + dy * s, rr * s, Math.PI * 0.9, Math.PI * 2.1);
      g.fill();
      g.stroke();
    }
  }
  // far hills, and the hill the town is built on
  shape([[0, 190], [80, 160], [170, 175], [260, 150], [380, 165], [470, 140], [600, 170], [600, 240], [0, 240]], '#d8d5cd', 7, 0);
  shape([[20, 300], [150, 215], [260, 150], [330, 140], [420, 175], [560, 260], [590, 300]], '#cfccc4', 5, 0.8);
  // the castle on top: a keep with battlements and a flag, and a tower with a pointed roof
  const crenel = (x0, x1, y) => {
    for (let x = x0; x < x1 - 4; x += 10) shape([[x, y], [x, y - 7], [x + 6, y - 7], [x + 6, y]], '#bdb9b0');
  };
  shape([[265, 150], [265, 75], [325, 75], [325, 150]], '#c4c0b7', 4, 0.2);
  crenel(265, 325, 75);
  shape([[325, 150], [325, 95], [355, 95], [355, 150]], '#b3afa6', 3, 0.3);
  shape([[321, 95], [340, 58], [359, 95]], '#8e8a82', 3, -0.5);
  g.strokeStyle = ink(0.9);
  g.beginPath();
  g.moveTo(295, 68);
  g.lineTo(295, 38);
  g.stroke();
  shape([[295, 38], [318, 44], [295, 50]], '#7a766f');
  for (const [x, y] of [[280, 100], [305, 100], [292, 128], [337, 118]]) shape([[x, y], [x, y - 10], [x + 3, y - 14], [x + 6, y - 10], [x + 6, y]], '#2a2a2a');
  // the church with its tall spire, part way down the hill
  shape([[150, 215], [150, 165], [215, 165], [215, 215]], '#d0ccc3', 4, 0.2);
  shape([[145, 165], [182, 142], [220, 165]], '#9b978f', 3, -0.6);
  shape([[160, 165], [160, 112], [180, 112], [180, 165]], '#c8c4bb', 3, 0.2);
  shape([[156, 112], [170, 38], [184, 112]], '#8a867e', 3, -0.4);
  shape([[164, 142], [164, 130], [170, 124], [176, 130], [176, 142]], '#222222');
  g.strokeStyle = ink(0.9);
  g.beginPath();
  g.moveTo(170, 38); g.lineTo(170, 26); g.moveTo(165, 31); g.lineTo(175, 31);
  g.stroke();
  // houses with steep and stepped gables, climbing the hill in rows
  const house = (x, base, w, h, stepped) => {
    const top = base - h;
    shape([[x, base], [x, top], [x + w, top], [x + w, base]], r() < 0.5 ? '#dcd8cf' : '#cfcac0', r() < 0.4 ? 4 : 0, 0.2);
    if (stepped) {
      const s = w / 6;
      shape([[x - 1, top], [x + s, top], [x + s, top - 6], [x + 2 * s, top - 6], [x + 2 * s, top - 12], [x + 4 * s, top - 12], [x + 4 * s, top - 6], [x + 5 * s, top - 6], [x + 5 * s, top], [x + w + 1, top]], '#a8a49b', 3, -0.5);
    } else shape([[x - 2, top], [x + w / 2, top - w * 0.8], [x + w + 2, top]], '#8f8b83', 3, -0.6);
    for (let wy = top + 7; wy < base - 9; wy += 12) for (let wx = x + 4; wx < x + w - 6; wx += 9) shape([[wx, wy], [wx + 4, wy], [wx + 4, wy + 6], [wx, wy + 6]], '#333333');
  };
  for (const [front, x0, x1, base, h] of [[0, 70, 145, 250, 30], [0, 222, 262, 222, 26], [0, 365, 470, 232, 32], [1, 40, 560, 285, 40]]) {
    for (let x = x0; x < x1; x += 22 + r() * 8) house(x, base + (front ? 0 : r() * 6), 18 + r() * 8, h + r() * 14, r() < 0.45);
  }
  // the town wall in front, with towers and a gate
  shape([[20, 330], [20, 285], [580, 285], [580, 330]], '#c9c5bc', 5, 0.15);
  crenel(20, 580, 285);
  g.strokeStyle = ink(0.3);
  g.lineWidth = 1;
  for (let y = 293; y < 330; y += 8) for (let x = 26 + (y % 16); x < 570; x += 16 + r() * 6) {
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + 10, y); g.stroke();
  }
  for (const x of [20, 190, 400, 552]) {
    shape([[x - 8, 330], [x - 8, 265], [x + 28, 265], [x + 28, 330]], '#bfbbb2', 3, 0.25);
    shape([[x - 12, 265], [x + 10, 232], [x + 32, 265]], '#86827a', 3, -0.6);
  }
  g.beginPath();
  g.moveTo(280, 330); g.lineTo(280, 307); g.arc(298, 307, 18, Math.PI, 0); g.lineTo(316, 330);
  g.closePath();
  g.fillStyle = '#1e1e1e';
  g.fill();
  // the river in front, with the bridge to the gate and ripples
  g.fillStyle = '#dedad2';
  g.fillRect(0, 330, PW, PH - 330);
  g.strokeStyle = ink(0.35);
  for (let y = 336; y < PH; y += 5) {
    for (let x = r() * 30; x < PW; x += 30 + r() * 40) {
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + 12 + r() * 20, y); g.stroke();
    }
  }
  shape([[232, 346], [232, 330], [364, 330], [364, 346]], '#b8b4ab', 3, 0.2);
  for (const x of [232, 276, 320]) {
    // one span: its piers and the arch between them, down into the water
    g.beginPath();
    g.moveTo(x, 346); g.lineTo(x + 44, 346); g.lineTo(x + 44, PH); g.lineTo(x + 37, PH); g.lineTo(x + 37, 366);
    g.arc(x + 22, 366, 15, 0, Math.PI, true);
    g.lineTo(x + 7, PH); g.lineTo(x, PH);
    g.closePath();
    g.fillStyle = '#b8b4ab';
    g.fill();
    g.strokeStyle = ink(0.85);
    g.stroke();
  }
  // a few dark trees on the banks
  g.fillStyle = '#3a3a3a';
  for (const [x, y] of [[60, 330], [520, 332], [548, 334]]) {
    g.beginPath();
    g.ellipse(x, y - 22, 14, 22, 0, 0, Math.PI * 2);
    g.fill();
    g.fillRect(x - 2, y - 4, 4, 8);
  }
  // an old print: darker towards the edges
  const v = g.createRadialGradient(PW / 2, PH / 2, PH * 0.3, PW / 2, PH / 2, PW * 0.6);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(40,35,25,0.25)');
  g.fillStyle = v;
  g.fillRect(0, 0, PW, PH);
  const t = picture(c, townPicture);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/**
 * Hangs the medieval town painting on a wall: a black wooden frame with the
 * picture set in it. (x, y, z) is the middle of its back, on the wall's face;
 * `w` and `h` are the frame's outer size; `face` is the way it looks.
 */
export function hangPainting({ addMesh, std }, { x, y, z, w, h, face, line }) {
  const yaw = { '+x': Math.PI / 2, '-x': -Math.PI / 2, '-z': Math.PI, '+z': 0 }[face];
  const place = (geo) => geo.rotateY(yaw).translate(x, y, z);
  const B = 0.07; // the frame's width
  const D = 0.045; // how far it stands off the wall (sunk 5 mm into it, so no face lies on the wall's)
  const frame = std({ color: 0x1d1a18, roughness: 0.5 });
  for (const [x0, y0, x1, y1] of [
    [-w / 2, h / 2 - B, w / 2, h / 2], // top
    [-w / 2, -h / 2, w / 2, -h / 2 + B], // bottom
    [-w / 2, -h / 2 + B, -w / 2 + B, h / 2 - B], // the sides, between them
    [w / 2 - B, -h / 2 + B, w / 2, h / 2 - B],
  ]) {
    const geo = new THREE.BoxGeometry(x1 - x0, y1 - y0, D + 0.005).translate((x0 + x1) / 2, (y0 + y1) / 2, D / 2 - 0.0025);
    addMesh(new THREE.Mesh(place(geo), frame), 0, line);
  }
  // the picture, set back in the frame and reaching in under its edges
  const pic = new THREE.PlaneGeometry(w - 2 * B + 0.02, h - 2 * B + 0.02).translate(0, 0, D - 0.015);
  const mesh = new THREE.Mesh(place(pic), std({ map: townPicture(), roughness: 0.8 }));
  mesh.receiveShadow = true;
  addMesh(mesh, 0, line);
}

// ---------------------------------------------------------------- the kitchen whiteboard
// The family's week on the kitchen whiteboard, in marker: a column per day
// with what's on and what's for dinner, a shopping list and a note for Lennie.
// It's the family's own board, so it's in Dutch whatever language the game is
// in (like the supermarket's signs), and its texts don't go through t().
const DAYS = [
  // [day, its colour, what's on (each with its colour), dinner]
  ['ma', '#1f4fbf', [['Zwemles', '#1f4fbf'], ['Kliko buiten!', '#1e8a3c']], 'Pasta'],
  ['di', '#d1262b', [['Voetbal', '#d1262b'], ['Boeken naar bieb', '#1f4fbf']], 'Pannenkoeken'],
  ['wo', '#1e8a3c', [['Pianoles', '#1f4fbf'], ['Middag vrij', '#1e8a3c']], 'Patat!'],
  ['do', '#1f4fbf', [['Tandarts 9:30', '#d1262b'], ['Gymtas mee!', '#1e8a3c']], 'Soep'],
  ['vr', '#d1262b', [['Pizza-avond!', '#d1262b'], ['Film kijken', '#1f4fbf']], 'Pizza!'],
  ['za', '#1e8a3c', [['Wedstrijd 10:00', '#1f4fbf'], ['Oma jarig!', '#d1262b']], 'BBQ'],
  ['zo', '#1f4fbf', [['Uitslapen!', '#d1262b'], ['Fietsen', '#1e8a3c']], 'Stamppot'],
];
const HAND = '"Segoe Print", "Comic Sans MS", "Chalkboard SE", "Marker Felt", "Bradley Hand", cursive';

function drawWhiteboard(c) {
  const [W, Hc] = [c.width, c.height];
  const g = c.getContext('2d');
  const r = rng(23);
  const j = (n) => (r() - 0.5) * n; // a marker's wobble
  g.fillStyle = '#fbfbf8';
  g.fillRect(0, 0, W, Hc);
  // ghosts of last week, never quite wiped off
  g.lineCap = 'round';
  for (let i = 0; i < 14; i++) {
    g.strokeStyle = `rgba(120, 130, 150, ${0.04 + r() * 0.05})`;
    g.lineWidth = 8 + r() * 30;
    g.beginPath();
    const [x, y] = [r() * W, r() * Hc];
    g.moveTo(x, y);
    g.quadraticCurveTo(x + j(160), y + j(60), x + j(320), y + j(50));
    g.stroke();
  }
  const line = (x0, y0, x1, y1, color = '#2a2d33', w = 3) => {
    g.strokeStyle = color;
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(x0 + j(3), y0 + j(3));
    g.quadraticCurveTo((x0 + x1) / 2 + j(5), (y0 + y1) / 2 + j(5), x1 + j(3), y1 + j(3));
    g.stroke();
  };
  // handwriting, `size` px tall, wrapped onto more lines (and shrunk if need be) to fit `maxW`, centred
  // on `y` (or starting at it, with `fromTop`); returns its height
  const write = (text, x, y, size, color, maxW, { align = 'center', tilt = 0.03, fromTop = false } = {}) => {
    const font = (s) => `bold ${s}px ${HAND}`;
    g.font = font(size);
    // a word that would have to shrink a lot to fit breaks in two, after its hyphen if it has one
    const words = text.split(' ').flatMap((word) => {
      if (g.measureText(word).width <= maxW / 0.72 || word.length < 8) return [word];
      const at = word.includes('-') ? word.indexOf('-') + 1 : Math.ceil(word.length / 2);
      return [word.includes('-') ? word.slice(0, at) : `${word.slice(0, at)}-`, word.slice(at)];
    });
    let lines = [text];
    if (g.measureText(text).width > maxW && words.length > 1) {
      lines = [];
      for (const word of words) {
        const last = lines[lines.length - 1];
        if (last && g.measureText(`${last} ${word}`).width <= maxW) lines[lines.length - 1] = `${last} ${word}`;
        else lines.push(word);
      }
    }
    const widest = Math.max(...lines.map((l) => g.measureText(l).width));
    const s = widest > maxW ? Math.floor((size * maxW) / widest) : size;
    g.font = font(s);
    g.fillStyle = color;
    g.textAlign = align;
    g.textBaseline = 'middle';
    lines.forEach((l, i) => {
      g.save();
      g.translate(x + j(4), y + (fromTop ? i + 0.5 : i - (lines.length - 1) / 2) * s * 1.05);
      g.rotate(j(tilt * 2));
      g.fillText(l, 0, 0);
      g.restore();
    });
    return lines.length * s * 1.05;
  };

  write('Deze week', 50, 52, 46, '#1f4fbf', 420, { align: 'left', tilt: 0.02 });
  // the grid: a column per day, the day's name on top and dinner at the bottom
  const [X0, X1] = [40, W - 40];
  const cw = (X1 - X0) / 7;
  const [TOP, HEAD, DINNER, BOTTOM] = [92, 140, 430, 520];
  for (const y of [TOP, HEAD, DINNER, BOTTOM]) line(X0, y, X1, y);
  for (let i = 0; i <= 7; i++) line(X0 + i * cw, TOP, X0 + i * cw, BOTTOM);
  DAYS.forEach(([day, color, todo, dinner], i) => {
    const cx = X0 + (i + 0.5) * cw;
    write(day, cx, (TOP + HEAD) / 2, 34, color, cw - 16);
    let y = HEAD + 26;
    for (const [what, c] of todo) y += write(what, cx, y, 26, c, cw - 14, { fromTop: true }) + 22;
    // a little knife and fork above dinner
    line(cx - 6, DINNER + 12, cx - 6, DINNER + 29, '#6b6f78', 2);
    line(cx + 6, DINNER + 12, cx + 6, DINNER + 29, '#6b6f78', 2);
    write(dinner, cx, DINNER + 60, 26, '#2a2d33', cw - 14);
  });
  // under the grid: the shopping list, and a note for Lennie
  write('Boodschappen: melk, hagelslag, eieren', 50, 568, 28, '#1e8a3c', 540, { align: 'left', tilt: 0.01 });
  write('Lennie: opruimen!!', 640, 572, 36, '#d1262b', 330, { align: 'left', tilt: 0.02 });
  line(640, 600, 900, 598, '#d1262b', 3);
  line(644, 610, 880, 609, '#d1262b', 3);
  // a smiley, and three magnets
  g.strokeStyle = '#1f4fbf';
  g.lineWidth = 3;
  g.beginPath();
  g.arc(W - 90, 50, 24, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.arc(W - 90, 52, 14, 0.2, Math.PI - 0.2);
  g.stroke();
  g.fillStyle = '#1f4fbf';
  for (const dx of [-8, 8]) g.fillRect(W - 90 + dx - 2, 40, 4, 6);
  for (const [mx, my, mc] of [[520, 48, '#f2c14e'], [W - 30, Hc - 70, '#d1262b'], [30, 615, '#3fa35a']]) {
    g.fillStyle = 'rgba(0, 0, 0, 0.18)';
    g.beginPath();
    g.arc(mx + 3, my + 4, 15, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = mc;
    g.beginPath();
    g.arc(mx, my, 15, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(255, 255, 255, 0.45)';
    g.beginPath();
    g.arc(mx - 5, my - 5, 5, 0, Math.PI * 2);
    g.fill();
  }
}

/**
 * Hangs the whiteboard on a wall: an aluminium frame round the white board,
 * with a tray of markers and a wiper under it. (x, y, z) is the middle of its
 * back, on the wall's face; `w` and `h` the frame's outer size; `face` the way it looks.
 */
export function hangWhiteboard({ addMesh, std }, { x, y, z, w, h, face, line }) {
  const yaw = { '+x': Math.PI / 2, '-x': -Math.PI / 2, '-z': Math.PI, '+z': 0 }[face];
  const place = (geo) => geo.rotateY(yaw).translate(x, y, z);
  const add = (geo, mat) => addMesh(new THREE.Mesh(place(geo), mat), 0, line);
  const B = 0.025; // the frame's width
  const D = 0.022; // how far it stands off the wall (sunk 5 mm into it, so no face lies on the wall's)
  const alu = std({ color: 0xc4c8cc, roughness: 0.35, metalness: 0.5 });
  for (const [x0, y0, x1, y1] of [
    [-w / 2, h / 2 - B, w / 2, h / 2], // top
    [-w / 2, -h / 2, w / 2, -h / 2 + B], // bottom
    [-w / 2, -h / 2 + B, -w / 2 + B, h / 2 - B], // the sides, between them
    [w / 2 - B, -h / 2 + B, w / 2, h / 2 - B],
  ]) add(new THREE.BoxGeometry(x1 - x0, y1 - y0, D + 0.005).translate((x0 + x1) / 2, (y0 + y1) / 2, D / 2 - 0.0025), alu);
  // the board, set back in the frame and reaching in under its edges
  const map = drawn(1024, 656, (g) => drawWhiteboard(g.canvas));
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  const board = add(new THREE.PlaneGeometry(w - 2 * B + 0.02, h - 2 * B + 0.02).translate(0, 0, D - 0.008), std({ map, roughness: 0.25 }));
  board.receiveShadow = true;
  // the tray, 8 mm under the frame: a shelf (sunk into the wall) with a lip along
  // its front, a little shorter and 2 mm back, so their ends and fronts don't lie in one plane
  const ty = -h / 2 - 0.008; // the tray's top
  add(new THREE.BoxGeometry(0.56, 0.012, 0.075).translate(0, ty - 0.006, 0.0325), alu);
  add(new THREE.BoxGeometry(0.55, 0.016, 0.008).translate(0, ty + 0.006, 0.064), alu);
  // two markers (white, with a blue and a red cap) and the wiper lying in it, sunk 1 mm
  const marker = std({ color: 0xf0f0ee, roughness: 0.5 });
  for (const [mx, mz, cap] of [[0.06, 0.022, 0x1f4fbf], [0.12, 0.045, 0xd1262b]]) {
    add(new THREE.CylinderGeometry(0.008, 0.008, 0.12, 10).rotateZ(Math.PI / 2).translate(mx, ty + 0.007, mz), marker);
    add(new THREE.CylinderGeometry(0.0088, 0.0088, 0.035, 10).rotateZ(Math.PI / 2).translate(mx + 0.05, ty + 0.007, mz), std({ color: cap, roughness: 0.4 }));
  }
  add(new THREE.BoxGeometry(0.12, 0.028, 0.045).translate(-0.14, ty + 0.013, 0.032), std({ color: 0x2b2d31, roughness: 0.8 }));
  // (its blue grip tucked 1 mm into its top)
  add(new THREE.BoxGeometry(0.114, 0.006, 0.039).translate(-0.14, ty + 0.029, 0.032), std({ color: 0x3a5a8c, roughness: 0.6 }));
}
