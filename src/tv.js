// The living room TV. It's on, showing a sunny cartoon. Throw Lennie into it
// hard enough and the screen cracks where he hit it: a spider web of cracks,
// a black blot of dead pixels, coloured lines, a flickering picture and
// sparks spitting out of the hole. Touching a cracked TV gives him a shock
// (main.js does the zapping, zap.js the fireworks). "Fix everything" repairs it.
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

// Where it stands: on the low cabinet in the living room's back left corner,
// turned towards the couch, as in the floor plan. Ground floor, so world y is
// the room's y. The TV is built facing local -x and turned by `yaw`.
const PLACE = { x: -5.35, z: -3.9, yaw: Math.atan2(0.6, -0.8) };
const FRAME = { min: [-0.035, 0.5, -0.65], max: [0.035, 1.25, 0.65] };
const SCREEN = { x: -0.037, y0: 0.55, y1: 1.2, z0: -0.6, z1: 0.6 };
const W = 256;
const H = 144;

/** The cartoon on the TV: blue sky, sun, clouds, a green hill and a windmill. */
function drawPicture(g) {
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#3f8fe0');
  sky.addColorStop(1, '#a8dcff');
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#ffd23f';
  g.beginPath();
  g.arc(206, 34, 18, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#ffffff';
  for (const [x, y, s] of [[50, 30, 1], [120, 20, 0.8], [160, 50, 0.6]]) {
    g.beginPath();
    g.arc(x, y, 12 * s, 0, Math.PI * 2);
    g.arc(x + 14 * s, y - 4 * s, 14 * s, 0, Math.PI * 2);
    g.arc(x + 30 * s, y, 11 * s, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = '#4caf50';
  g.beginPath();
  g.ellipse(80, H + 30, 170, 80, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#3d9142';
  g.beginPath();
  g.ellipse(230, H + 20, 120, 60, 0, 0, Math.PI * 2);
  g.fill();
  // a windmill on the hill
  g.fillStyle = '#7a4a2a';
  g.beginPath();
  g.moveTo(88, 60); g.lineTo(100, 60); g.lineTo(106, 96); g.lineTo(82, 96);
  g.fill();
  g.strokeStyle = '#f4f2ee';
  g.lineWidth = 4;
  for (let i = 0; i < 4; i++) {
    const a = 0.4 + (i * Math.PI) / 2;
    g.beginPath();
    g.moveTo(94, 58);
    g.lineTo(94 + Math.cos(a) * 30, 58 + Math.sin(a) * 30);
    g.stroke();
  }
  // the channel logo in the corner
  g.fillStyle = 'rgba(255,255,255,0.8)';
  g.font = 'bold 12px sans-serif';
  g.fillText('TV', 8, 16);
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
