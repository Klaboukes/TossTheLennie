// How many separate things the game draws per frame, by kind, from the start
// view and turning the camera round Lennie. Works on the tablet or any Chrome
// with remote debugging on port 9222; the count doesn't depend on the device.
//
//   node scripts/tablet/draws.mjs [url]
import { connect, GAME } from './cdp.mjs';

const url = process.argv[2] ?? GAME;
const t = await connect();
await t.open(url);
await t.key('KeyR');
await new Promise((r) => setTimeout(r, 4000));
const views = await t.eval(`(async () => {
  let scene = lennie.aimRing; while (scene.parent) scene = scene.parent;
  scene.traverse((m) => {
    if (!m.isMesh || m.__counted) return;
    const before = m.onBeforeRender;
    m.onBeforeRender = function (...a) { if (window.__drawn) window.__drawn.push(m); return before.apply(this, a); };
    m.__counted = true;
  });
  const frame = () => new Promise((r) => requestAnimationFrame(r));
  async function count(label) {
    await frame();
    window.__drawn = [];
    await frame();
    const drawn = window.__drawn; window.__drawn = null;
    const kinds = {};
    const add = (k) => (kinds[k] = (kinds[k] ?? 0) + 1);
    for (const m of drawn) {
      if (m.userData.products) { add(m.isInstancedMesh ? 'products, one kind each' : 'products, baked'); continue; }
      if (m.isInstancedMesh) { add('other instanced'); continue; }
      const c = m.geometry.boundingSphere ? m.geometry.boundingSphere.center.clone().applyMatrix4(m.matrixWorld) : m.getWorldPosition(m.position.clone());
      const where = c.z > 20 ? 'shop side' : c.z > 4 ? 'street' : 'house side';
      add(where + ([].concat(m.material).some((x) => x.transparent) ? ', see-through' : ''));
    }
    return { label, draws: drawn.length, kinds };
  }
  const out = [await count('start view')];
  const target = lennie.controls.target.clone();
  const from = lennie.camera.position.clone();
  const r = Math.hypot(from.x - target.x, from.z - target.z) || 3;
  for (const deg of [90, 180, 270]) {
    const a = (deg * Math.PI) / 180;
    lennie.camera.position.set(target.x + Math.sin(a) * r, from.y, target.z + Math.cos(a) * r);
    lennie.camera.lookAt(target);
    lennie.camera.updateMatrixWorld();
    out.push(await count('turned ' + deg + '°'));
  }
  lennie.camera.position.copy(from);
  lennie.camera.lookAt(target);
  return out;
})()`);
for (const v of views) console.log(`${v.label.padEnd(12)} ${String(v.draws).padStart(5)} draws  ${JSON.stringify(v.kinds)}`);
t.close();
process.exit(0);
