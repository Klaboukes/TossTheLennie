import * as THREE from 'three';

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

  const t = new THREE.CanvasTexture(c);
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
