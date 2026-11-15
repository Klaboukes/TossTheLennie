// The living room TV. It's on, with the kids' blocky building game on it. Throw Lennie into it
// hard enough and the screen cracks where he hit it: a spider web of cracks,
// a black blot of dead pixels, coloured lines, a flickering picture and
// sparks spitting out of the hole. Touching a cracked TV gives him a shock
// (main.js does the zapping, zap.js the fireworks). "Fix everything" repairs it.
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

// Where it stands: on the low cabinet in the living room's back left corner,
// turned towards the couch, as in the floor plan. Ground floor, so world y is
// the room's y. The TV is built facing local -x and turned by `yaw`.
const PLACE = { x: -3.35, z: -3.9, yaw: Math.atan2(0.6, -0.8) };
const FRAME = { min: [-0.035, 0.5, -0.65], max: [0.035, 1.25, 0.65] };
const SCREEN = { x: -0.037, y0: 0.55, y1: 1.2, z0: -0.6, z1: 0.6 };
const W = 256;
const H = 144;

/** The game on the TV: a blocky building game, seen through the player's eyes. */
function drawPicture(g) {
  let seed = 11;
  const r = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const B = 8; // one block, in canvas pixels
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#6f9fef');
  sky.addColorStop(1, '#b9d4ff');
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);
  // the square sun and flat blocky clouds
  g.fillStyle = '#fff6b0';
  g.fillRect(200, 12, 18, 18);
  g.fillStyle = 'rgba(255,255,255,0.92)';
  for (const [x, y, w] of [[24, 18, 40], [36, 10, 16], [120, 26, 48], [136, 18, 24]]) g.fillRect(x, y, w, 8);
  /** One block: its colour, speckled with darker and lighter pixels. */
  const block = (bx, by, color, specks) => {
    g.fillStyle = color;
    g.fillRect(bx, by, B, B);
    for (let i = 0; i < 5; i++) {
      g.fillStyle = specks[Math.floor(r() * specks.length)];
      g.fillRect(bx + Math.floor(r() * 4) * 2, by + Math.floor(r() * 4) * 2, 2, 2);
    }
  };
  const DIRT = ['#8b5a33', ['#6f4526', '#9c6a40']];
  // rolling hills, a column of blocks at a time: grass on dirt on stone
  const ground = [];
  for (let c = 0; c < W / B; c++) ground.push(10 + Math.round(Math.sin(c * 0.33) * 1.6 + Math.sin(c * 0.11 + 1) * 2));
  ground.forEach((top, c) => {
    for (let row = top; row < H / B; row++) {
      const [x, y] = [c * B, row * B];
      if (row < top + 3) block(x, y, ...DIRT);
      else block(x, y, '#7f7f7f', ['#6a6a6a', '#959595', r() < 0.1 ? '#2b2b2b' : '#8a8a8a']);
      if (row === top) {
        g.fillStyle = '#5fae3a';
        g.fillRect(x, y, B, 3);
        g.fillStyle = '#4c9530';
        g.fillRect(x + (c % 3) * 2, y + 3, 2, 2);
      }
    }
  });
  // a pond in the dip
  g.fillStyle = 'rgba(52, 92, 220, 0.85)';
  for (let c = 20; c < 24; c++) g.fillRect(c * B, ground[c] * B, B, B * 2);
  // a tree: a trunk and a cube of leaves
  const tc = 7;
  for (let i = 1; i <= 3; i++) block(tc * B, (ground[tc] - i) * B, '#6b4f2a', ['#5a4022', '#7a5c33']);
  for (let dx = -2; dx <= 2; dx++) for (let dy = 0; dy < 3; dy++) {
    if (Math.abs(dx) === 2 && dy === 0) continue;
    block((tc + dx) * B, (ground[tc] - 6 + dy) * B, '#3d8a2a', ['#2f6f20', '#4fa236']);
  }
  // the player's hand, holding a pickaxe, in the bottom right corner
  g.fillStyle = '#6b4f2a';
  for (let i = 0; i < 7; i++) g.fillRect(206 + i * 5, 128 - i * 5, 6, 6);
  g.fillStyle = '#7fd8d0';
  for (let i = -3; i <= 3; i++) g.fillRect(232 + i * 5, 92 + Math.abs(i) * 3, 6, 6);
  g.fillStyle = '#c99a6e';
  g.fillRect(214, 116, 26, 28);
  g.fillStyle = '#b5845a';
  g.fillRect(214, 136, 26, 8);
  // the crosshair, the hearts and the hotbar
  g.fillStyle = 'rgba(255,255,255,0.85)';
  g.fillRect(W / 2 - 5, H / 2 - 1, 10, 2);
  g.fillRect(W / 2 - 1, H / 2 - 5, 2, 10);
  const x0 = W / 2 - 54;
  g.fillStyle = 'rgba(30,30,30,0.75)';
  g.fillRect(x0, H - 14, 108, 12);
  const items = ['#5fae3a', '#8b5a33', '#7f7f7f', '#6b4f2a', '#3d8a2a', null, '#e8d36a', null, '#c0392b'];
  items.forEach((c, i) => {
    g.strokeStyle = i === 1 ? '#ffffff' : '#8f8f8f';
    g.lineWidth = 1;
    g.strokeRect(x0 + 1.5 + i * 12, H - 12.5, 9, 9);
    if (c) {
      g.fillStyle = c;
      g.fillRect(x0 + 3 + i * 12, H - 11, 6, 6);
    }
  });
  g.fillStyle = '#e8322b';
  for (let i = 0; i < 10; i++) g.fillRect(x0 + i * 6, H - 21, 4, 4);
}

/** The broken screen, cracked from (cx, cy) in canvas pixels. */
function drawCracked(g, cx, cy) {
  drawPicture(g);
  // the picture goes dim and washed out
  g.fillStyle = 'rgba(10, 10, 30, 0.45)';
  g.fillRect(0, 0, W, H);
  // dead columns of pixels, the classic broken-screen stripes
  const stripes = ['#ff3cf0', '#3cf7ff', '#7dff3c', '#ffffff', '#ffe23c'];
  for (let i = 0; i < 12; i++) {
    g.fillStyle = stripes[i % stripes.length];
    g.globalAlpha = 0.5 + Math.random() * 0.5;
    g.fillRect(Math.random() * W, 0, 1 + Math.random() * 2, H);
  }
  g.globalAlpha = 1;
  // the black blot of dead screen where he hit
  const r = 26 + Math.random() * 14;
  const blot = g.createRadialGradient(cx, cy, 2, cx, cy, r * 1.6);
  blot.addColorStop(0, 'rgba(0,0,0,1)');
  blot.addColorStop(0.55, 'rgba(0,0,0,0.9)');
  blot.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = blot;
  g.fillRect(0, 0, W, H);
  // the spider web: jagged rays out from the hit, and rings joining them
  g.strokeStyle = 'rgba(235, 245, 255, 0.9)';
  g.lineCap = 'round';
  const rays = 11 + Math.floor(Math.random() * 5);
  const paths = [];
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
    const len = 90 + Math.random() * 150;
    const pts = [[cx, cy]];
    let d = 0;
    while (d < len) {
      d += 8 + Math.random() * 18;
      const wobble = (Math.random() - 0.5) * 0.35;
      pts.push([cx + Math.cos(a + wobble) * d, cy + Math.sin(a + wobble) * d]);
    }
    paths.push(pts);
    g.lineWidth = 1 + Math.random();
    g.beginPath();
    g.moveTo(...pts[0]);
    for (const p of pts.slice(1)) g.lineTo(...p);
    g.stroke();
  }
  g.lineWidth = 0.8;
  for (const ring of [2, 4, 6]) {
    g.beginPath();
    paths.forEach((pts, i) => {
      const p = pts[Math.min(ring, pts.length - 1)];
      if (i === 0) g.moveTo(...p);
      else g.lineTo(...p);
    });
    g.closePath();
    g.stroke();
  }
}

export function buildTV({ groups, std, physMats, world }) {
  const tvGroup = new THREE.Group();
  tvGroup.position.set(PLACE.x, 0, PLACE.z);
  tvGroup.rotation.y = PLACE.yaw;
  groups[0].add(tvGroup);
  tvGroup.updateMatrixWorld(true);
  const size = FRAME.max.map((v, i) => v - FRAME.min[i]);
  const mid = FRAME.max.map((v, i) => (v + FRAME.min[i]) / 2);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(...size), std({ color: 0x111114, roughness: 0.35 }));
  frame.position.set(...mid);
  frame.castShadow = true;
  frame.receiveShadow = true;
  tvGroup.add(frame);
  // a little foot on the cabinet
  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.04, 0.4), frame.material);
  foot.position.set(0.02, 0.52, 0);
  tvGroup.add(foot);

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d');
  drawPicture(g);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  // It glows: a lit screen doesn't care about the room's light.
  const mat = new THREE.MeshBasicMaterial({ map: tex });
  const sw = SCREEN.z1 - SCREEN.z0;
  const sh = SCREEN.y1 - SCREEN.y0;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), mat);
  screen.position.set(SCREEN.x, (SCREEN.y0 + SCREEN.y1) / 2, (SCREEN.z0 + SCREEN.z1) / 2);
  screen.rotation.y = -Math.PI / 2; // faces local -x; its left edge (u = 0) is at z0
  tvGroup.add(screen);

  // Sparks spitting out of the hole in a broken screen, in the TV's own frame
  // (local -x is out of the screen).
  const sparkGeo = new THREE.BoxGeometry(0.018, 0.018, 0.018);
  const sparkMat = new THREE.MeshBasicMaterial({ color: 0xfff3a0 });
  const sparks = [];
  for (let i = 0; i < 40; i++) {
    const m = new THREE.Mesh(sparkGeo, sparkMat);
    m.visible = false;
    m.userData.noAim = true;
    tvGroup.add(m);
    sparks.push({ m, vel: new THREE.Vector3(), t: 0 });
  }
  let nextSpark = 0;
  const localHole = new THREE.Vector3();

  const tv = {
    cracked: false,
    crackedAt: 0,
    /** Where the screen broke, in the world. */
    hole: new THREE.Vector3(),
    center: tvGroup.localToWorld(screen.position.clone()),
    normal: new THREE.Vector3(-1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), PLACE.yaw),
    screen,
    body: null,
  };
  const b = new CANNON.Body({ mass: 0, material: physMats.hard, shape: new CANNON.Box(new CANNON.Vec3(size[0] / 2, size[1] / 2, size[2] / 2)) });
  const c = tvGroup.localToWorld(new THREE.Vector3(...mid));
  b.position.set(c.x, c.y, c.z);
  b.quaternion.setFromEuler(0, PLACE.yaw, 0);
  b.surface = { kind: 'tv', sound: 'glass', piece: tv };
  world.addBody(b);
  tv.body = b;

  function spray(n, speed = 1) {
    for (const s of sparks) {
      if (n <= 0) break;
      if (s.m.visible) continue;
      n--;
      s.m.visible = true;
      s.m.position.copy(localHole);
      s.vel.set(-(0.8 + Math.random() * 2) * speed, (Math.random() * 2.2) * speed, (Math.random() - 0.5) * 2.4 * speed);
      s.t = 0;
    }
  }

  /** Cracks the screen around a point in the world (where Lennie hit it). */
  tv.crack = (point) => {
    if (tv.cracked) return;
    tv.cracked = true;
    tv.crackedAt = performance.now();
    const local = tvGroup.worldToLocal(point.clone());
    const z = THREE.MathUtils.clamp(local.z, SCREEN.z0 + 0.1, SCREEN.z1 - 0.1);
    const y = THREE.MathUtils.clamp(local.y, SCREEN.y0 + 0.08, SCREEN.y1 - 0.08);
    localHole.set(SCREEN.x - 0.01, y, z);
    tv.hole.copy(tvGroup.localToWorld(localHole.clone()));
    drawCracked(g, ((z - SCREEN.z0) / sw) * W, ((SCREEN.y1 - y) / sh) * H);
    tex.needsUpdate = true;
    spray(30, 1.4);
    nextSpark = 0.4;
  };

  tv.repair = () => {
    if (!tv.cracked) return;
    tv.cracked = false;
    drawPicture(g);
    tex.needsUpdate = true;
    mat.color.setScalar(1);
    for (const s of sparks) s.m.visible = false;
  };

  /** The broken screen flickers and now and then spits a few sparks. */
  tv.update = (dt) => {
    for (const s of sparks) {
      if (!s.m.visible) continue;
      s.t += dt;
      s.vel.y -= 9.8 * dt;
      s.m.position.addScaledVector(s.vel, dt);
      if (s.m.position.y < 0.02 || s.t > 0.9) s.m.visible = false;
    }
    if (!tv.cracked) return;
    // mostly dim, with the odd bright flash or blackout
    const r = Math.random();
    mat.color.setScalar(r < 0.06 ? 0.15 : r > 0.94 ? 1.3 : 0.7 + Math.random() * 0.15);
    nextSpark -= dt;
    if (nextSpark <= 0) {
      spray(3 + Math.floor(Math.random() * 5));
      nextSpark = 0.5 + Math.random() * 1.5;
    }
  };

  return tv;
}
