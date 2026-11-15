import * as THREE from 'three';

// The family's bikes and a moped, parked any old how along the bushes on the
// left-hand side of the garden, roughly one behind the other, fronts towards
// the house, each at its own angle and its own distance from the next: a
// black omafiets with a crate on the front, a blue city bike, a pink kid's
// bike and a little green one, and a dark blue scooter-style
// moped with a windscreen and a top box.
//
// They're loose pieces (loose.js), like the dining chairs: Lennie knocks them
// over, and R stands them back up. Each is built in its own frame (along x,
// front at +x, standing on y = 0), drawn by a detailed look of wheels and
// tubes, with a body of a few plain boxes: a slab for the wheels and frame,
// the handlebars, the saddle, and the kickstand's foot, which is what lets a
// leaning bike stand.

const LINE = -1.85; // the wheels' line, just in front of the bushes (2.15 m in from the fence at x −4): the handlebars reach into the leaves, clear of their body (garden.js)
const Y = new THREE.Vector3(0, 1, 0);

export function parkBikes(loose, parent, std) {
  const black = std({ color: 0x1c1c1c, roughness: 0.75 });
  const steel = std({ color: 0xb8bcc2, metalness: 0.6, roughness: 0.35 });
  const lamp = std({ color: 0xfff3c4, emissive: 0x5c5330, roughness: 0.3 });
  const red = std({ color: 0xc8261e, emissive: 0x3a0806, roughness: 0.4 });

  // shapes for the look, in the piece's own frame
  const tube = (g, a, b, r, mat, seg = 6) => {
    const p = new THREE.Vector3(...a);
    const d = new THREE.Vector3(...b).sub(p);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), seg), mat);
    m.position.copy(p).addScaledVector(d, 0.5);
    m.quaternion.setFromUnitVectors(Y, d.normalize());
    g.add(m);
    return m;
  };
  const block = (g, size, at, mat, rz = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
    m.position.set(...at);
    m.rotation.z = rz;
    g.add(m);
    return m;
  };
  const blob = (g, scale, at, mat) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 8), mat);
    m.scale.set(...scale);
    m.position.set(...at);
    g.add(m);
    return m;
  };
  // a wheel in the xy plane: tyre, rim, spokes and hub
  const wheel = (g, x, y, r, tyreR, spokes = true) => {
    const tyre = new THREE.Mesh(new THREE.TorusGeometry(r, tyreR, 6, 28), black);
    tyre.position.set(x, y, 0);
    g.add(tyre);
    if (!spokes) return;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(r - tyreR, tyreR * 0.4, 4, 28), steel);
    rim.position.set(x, y, 0);
    g.add(rim);
    for (let k = 0; k < 4; k++) block(g, [2 * (r - tyreR), 0.007, 0.007], [x, y, 0], steel, (k * Math.PI) / 4);
    tube(g, [x, y, -0.04], [x, y, 0.04], 0.025, steel);
  };
  // a mudguard: part of a flattened ring over a wheel, from angle a0 to a1 (radians, 0 = forward, π/2 = up)
  const guard = (g, x, y, r, a0, a1, mat, thick, wide) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(r, thick, 4, 16, a1 - a0), mat);
    m.position.set(x, y, 0);
    m.rotation.z = a0;
    m.scale.z = wide / thick;
    g.add(m);
  };
  // The next piece's place in the row: its front where the last one's back
  // ended (plus a gap to the next), facing the house (+z) but turned by yaw
  // (+ turns its front out from the bushes), out from the line by out, and
  // leaning a little to its left (its own −z, the kickstand side: away from
  // the bushes, into the garden). Turned ones keep clear of the bushes' body:
  // their nearest handlebar end or back stays at x > −2.3.
  let tip = -8.7; // the first one's front
  const place = (front, back, { lean = 0, yaw = 0, out = 0, gap = 0.25 } = {}) => {
    const at = new THREE.Vector3(LINE + out, 0, tip - front * Math.cos(yaw));
    tip -= (front + back) * Math.cos(yaw) + gap;
    return { at, turn: new THREE.Quaternion().setFromEuler(new THREE.Euler(lean, -Math.PI / 2 + yaw, 0, 'YXZ')) };
  };

  /** A bicycle `s` times the size of a grown-up's. */
  function bicycle({ s, color, saddle = black, crate = false, spot }) {
    const g = new THREE.Group();
    const frame = std({ color, roughness: 0.45, metalness: 0.2 });
    const P = (px, py, pz = 0) => [px * s, py * s, pz * s];
    const R = 0.34;
    for (const wx of [-0.55, 0.55]) wheel(g, wx * s, R * s, R * s, 0.026 * s);
    guard(g, -0.55 * s, R * s, (R + 0.05) * s, 0.35, Math.PI, frame, 0.02 * s, 0.035 * s);
    guard(g, 0.55 * s, R * s, (R + 0.05) * s, -0.15, 2.4, frame, 0.02 * s, 0.035 * s);
    // the frame: a low step-through, like a Dutch bike
    const A = P(-0.55, R); // rear axle
    const F = P(0.55, R); // front axle
    const B = P(-0.06, 0.3); // the pedals' axle
    const S = P(-0.2, 0.86); // top of the seat tube
    const Ht = P(0.38, 0.9); // the head tube, top and bottom
    const Hb = P(0.43, 0.7);
    const r = 0.02 * s;
    tube(g, B, S, r, frame);
    tube(g, P(-0.55, R, 0.04), B, r * 0.8, frame);
    tube(g, P(-0.55, R, -0.04), B, r * 0.8, frame);
    tube(g, P(-0.55, R, 0.04), S, r * 0.8, frame);
    tube(g, P(-0.55, R, -0.04), S, r * 0.8, frame);
    tube(g, Hb, Ht, r * 1.3, frame);
    tube(g, Hb, F, r, frame);
    tube(g, Hb, B, r * 1.1, frame);
    tube(g, P(0.41, 0.8), P(-0.15, 0.62), r, frame);
    // the closed chain guard, the pedals
    block(g, P(0.56, 0.11, 0.025), P(-0.3, 0.32, 0.07), frame, -0.08);
    tube(g, P(-0.06, 0.3, -0.08), P(-0.06, 0.3, 0.08), 0.02 * s, steel);
    tube(g, P(-0.06, 0.3, 0.09), P(0.02, 0.15, 0.09), 0.012 * s, steel);
    tube(g, P(-0.06, 0.3, -0.09), P(-0.14, 0.45, -0.09), 0.012 * s, steel);
    block(g, P(0.1, 0.025, 0.07), P(0.02, 0.15, 0.14), black);
    block(g, P(0.1, 0.025, 0.07), P(-0.14, 0.45, -0.14), black);
    // saddle, handlebars, bell, a black front lamp
    tube(g, S, P(-0.23, 0.99), r * 0.8, steel);
    block(g, P(0.26, 0.06, 0.15), P(-0.25, 1.01), saddle, -0.05);
    tube(g, Ht, P(0.36, 1.02), r, steel);
    tube(g, P(0.36, 1.02, -0.12), P(0.36, 1.02, 0.12), 0.014 * s, steel);
    for (const side of [-1, 1]) {
      tube(g, P(0.36, 1.02, 0.12 * side), P(0.22, 1.04, 0.28 * side), 0.014 * s, steel);
      tube(g, P(0.22, 1.04, 0.28 * side), P(0.14, 1.04, 0.3 * side), 0.022 * s, black);
    }
    blob(g, P(0.03, 0.02, 0.03), P(0.33, 1.05, 0.1), steel);
    tube(g, P(0.42, 0.86), P(0.48, 0.86), 0.035 * s, black, 8);
    // a carrier over the back wheel with a red rear light
    block(g, P(0.46, 0.015, 0.13), P(-0.5, 0.8), black);
    for (const side of [-1, 1]) tube(g, P(-0.55, R, 0.06 * side), P(-0.7, 0.8, 0.06 * side), 0.01 * s, black);
    tube(g, P(-0.27, 0.8), P(-0.19, 0.8), 0.01 * s, black);
    block(g, P(0.02, 0.04, 0.08), P(-0.74, 0.78), red);
    // the body: the wheels and frame as one slab, saddle, handlebars
    const parts = [
      [P(-0.9, 0, -0.03), P(0.9, 0.8, 0.03)],
      [P(-0.36, 0.8, -0.07), P(-0.14, 1.04, 0.07)],
      [P(0.12, 0.98, -0.3), P(0.42, 1.06, 0.3)],
    ];
    if (crate) {
      // a crate on a rack over the front wheel
      const c = std({ color: 0x2a2a2a, roughness: 0.8 });
      const [x0, x1, y0, y1, w, t] = [0.48, 0.86, 0.8, 1.04, 0.18, 0.015];
      block(g, P(x1 - x0, t, 2 * w - 2 * t), P((x0 + x1) / 2, y0 + t / 2), c);
      for (const side of [-1, 1]) block(g, P(x1 - x0, y1 - y0, t), P((x0 + x1) / 2, (y0 + y1) / 2, side * (w - t / 2)), c);
      for (const ex of [x0 + t / 2, x1 - t / 2]) block(g, P(t, y1 - y0, 2 * w - 2 * t), P(ex, (y0 + y1) / 2), c);
      for (const side of [-1, 1]) tube(g, P(0.55, R, 0.05 * side), P(0.6, 0.8, 0.12 * side), 0.01 * s, black);
      parts.push([P(x0, y0, -w), P(x1, y1, w)]);
    }
    // the kickstand, out to its left; leaning on it brings its foot down to the ground
    tube(g, P(-0.12, 0.28, -0.03), P(-0.3, 0.03, -0.13), 0.012 * s, steel);
    parts.push([P(-0.34, 0.015, -0.16), P(-0.26, 0.06, -0.1)]);
    const { at, turn } = place(0.96 * s, 0.95 * s, spot);
    loose.add(parent, parts, { mass: 14 * s, surface: { kind: 'bike', sound: 'metal' }, look: g, at, turn });
  }

  /** A scooter-style moped on its centre stand, with a windscreen and a top box. */
  function moped(spot) {
    const g = new THREE.Group();
    const paint = std({ color: 0x1f3566, roughness: 0.3, metalness: 0.15 });
    const R = 0.21;
    for (const wx of [-0.55, 0.76]) {
      wheel(g, wx, R, 0.16, 0.05, false);
      tube(g, [wx, R, -0.035], [wx, R, 0.035], 0.11, steel, 14);
    }
    guard(g, 0.76, R, 0.25, 0.35, 2.8, paint, 0.03, 0.075);
    for (const side of [-1, 1]) tube(g, [0.52, 0.72, 0.09 * side], [0.76, R, 0.09 * side], 0.022, steel);
    // floorboard with its rubber mat, leg shield, the rounded back with the seat
    block(g, [0.68, 0.08, 0.34], [0.12, 0.26, 0], paint);
    block(g, [0.5, 0.012, 0.26], [0.1, 0.306, 0], black);
    block(g, [0.04, 0.7, 0.42], [0.45, 0.62, 0], paint, 0.22);
    blob(g, [0.42, 0.24, 0.23], [-0.48, 0.44, 0], paint);
    blob(g, [0.3, 0.07, 0.16], [-0.38, 0.69, 0], black);
    // headset with the lamp, handlebars, mirrors
    block(g, [0.2, 0.1, 0.3], [0.37, 0.98, 0], paint);
    tube(g, [0.46, 0.98, 0], [0.5, 0.98, 0], 0.055, lamp, 12);
    tube(g, [0.36, 1.03, -0.34], [0.36, 1.03, 0.34], 0.014, steel);
    for (const side of [-1, 1]) {
      tube(g, [0.36, 1.03, 0.26 * side], [0.36, 1.03, 0.35 * side], 0.022, black);
      tube(g, [0.34, 1.03, 0.22 * side], [0.3, 1.2, 0.3 * side], 0.008, steel);
      blob(g, [0.015, 0.045, 0.065], [0.3, 1.23, 0.31 * side], black);
    }
    // the windscreen: a clear sheet rising from the headset, leaning back, in a black mount
    const tilt = 0.35;
    const glass = std({ color: 0xd4ebf2, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.35, depthWrite: false });
    block(g, [0.006, 0.42, 0.5], [0.44 - 0.21 * Math.sin(tilt), 1.02 + 0.21 * Math.cos(tilt), 0], glass, tilt);
    block(g, [0.03, 0.06, 0.52], [0.44 - 0.02 * Math.sin(tilt), 1.02 + 0.02 * Math.cos(tilt), 0], black, tilt);
    // rack, top box, rear light and the blue number plate, exhaust, centre stand
    block(g, [0.22, 0.02, 0.24], [-0.82, 0.66, 0], black);
    for (const side of [-1, 1]) tube(g, [-0.7, 0.55, 0.1 * side], [-0.85, 0.65, 0.1 * side], 0.01, black);
    block(g, [0.34, 0.28, 0.38], [-0.82, 0.81, 0], std({ color: 0xf0efe9, roughness: 0.5 }));
    block(g, [0.36, 0.04, 0.4], [-0.82, 0.97, 0], black);
    block(g, [0.03, 0.05, 0.12], [-0.895, 0.6, 0], red);
    block(g, [0.012, 0.1, 0.15], [-0.905, 0.42, 0], std({ color: 0x2f5fbf, roughness: 0.5 }));
    tube(g, [-0.82, 0.2, 0.24], [-0.38, 0.15, 0.2], 0.035, steel, 8);
    for (const side of [-1, 1]) tube(g, [-0.15, 0.22, 0.1 * side], [-0.2, 0.0, 0.13 * side], 0.015, black);

    const parts = [
      [[-0.76, 0, -0.06], [0.97, 0.42, 0.06]], // the wheels
      [[-0.9, 0.2, -0.22], [0.42, 0.72, 0.22]], // the back and the floorboard
      [[0.3, 0.27, -0.22], [0.5, 1.42, 0.22]], // leg shield and windscreen
      [[0.3, 0.98, -0.34], [0.42, 1.08, 0.34]], // handlebars
      [[-0.99, 0.72, -0.19], [-0.65, 0.99, 0.19]], // top box
      [[-0.25, 0, -0.14], [-0.15, 0.2, 0.14]], // centre stand
    ];
    const { at, turn } = place(1.02, 1.0, spot);
    loose.add(parent, parts, { mass: 40, surface: { kind: 'moped', sound: 'metal' }, look: g, at, turn });
  }

  bicycle({ s: 1, color: 0x1e1e1e, saddle: std({ color: 0x6b4226, roughness: 0.6 }), crate: true, spot: { lean: -0.1, yaw: 0.25, out: 0.2, gap: 0.35 } });
  bicycle({ s: 1, color: 0x2c4f7c, spot: { lean: -0.13, yaw: -0.15, gap: 0.15 } });
  bicycle({ s: 0.74, color: 0xe75a9b, spot: { lean: -0.11, yaw: 0.55, out: 0.5, gap: 0.45 } });
  bicycle({ s: 0.58, color: 0x6dbb3c, spot: { lean: -0.12, yaw: -0.25, out: 0.25, gap: 0.3 } });
  moped({ yaw: 0.4, out: 0.45 });
}
