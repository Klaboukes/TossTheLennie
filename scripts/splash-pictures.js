// Takes the opening screen's two pictures (img/splash-head.webp and
// img/splash-hand.webp) from the game itself: Lennie's own head, face on, and
// the fingers of his hand, each cut out on a see-through background. So the
// Lennie peeking over the logo is the one in the game, not a drawing of him.
//
// Run it again after a change to how his head or hands look (ragdoll.js):
// open the game on localhost, press Play, don't touch Lennie (he should still
// be sitting in his chair, as the light on his face is the light there), and
// paste this file in the browser's console, or run there:
//   eval(await (await fetch('scripts/splash-pictures.js')).text())
// The two pictures are downloaded; put them in img/. (With
// window.splashPicturesTo set to an address, they're posted there instead.)
(async () => {
  const THREE = await import('three');
  const { lennie: rag, renderer } = window.lennie;
  let scene = rag.parts.head.group;
  while (scene.parent) scene = scene.parent;
  const LAYER = 7; // (a layer nothing else is on: only what's being photographed is drawn)
  const buffer = renderer.getDrawingBufferSize(new THREE.Vector2());

  /** The game's picture of `things` alone, seen from `dir` (up is `up`), `span` metres from top to bottom. */
  function shoot(things, centre, dir, up, span, cut) {
    const marked = [];
    for (const t of things) t.traverse((o) => { o.layers.enable(LAYER); marked.push(o); });
    scene.traverse((o) => { if (o.isLight) { o.layers.enable(LAYER); marked.push(o); } });
    const dist = 3;
    const cam = new THREE.PerspectiveCamera((2 * Math.atan(span / 2 / dist) * 180) / Math.PI, buffer.x / buffer.y, 0.5, 10);
    cam.position.copy(centre).addScaledVector(dir, dist);
    cam.up.copy(up);
    cam.lookAt(centre);
    cam.layers.set(LAYER);
    cam.updateMatrixWorld(true);
    const keep = { background: scene.background, fog: scene.fog };
    scene.fog = null;
    renderer.clippingPlanes = cut ? [cut] : [];
    // Once on black and once on white: the difference between the two is how see-through each pixel is.
    const shots = [0x000000, 0xffffff].map((colour) => {
      scene.background = new THREE.Color(colour);
      renderer.render(scene, cam);
      const c = document.createElement('canvas');
      c.width = buffer.x;
      c.height = buffer.y;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(renderer.domElement, 0, 0);
      return g.getImageData(0, 0, c.width, c.height);
    });
    scene.background = keep.background;
    scene.fog = keep.fog;
    renderer.clippingPlanes = [];
    for (const o of marked) o.layers.disable(LAYER);

    const [black, white] = shots;
    const out = new ImageData(buffer.x, buffer.y);
    const range = white.data[0] - black.data[0]; // (the corner pixel: background in both)
    for (let i = 0; i < out.data.length; i += 4) {
      let diff = 0;
      for (let k = 0; k < 3; k++) diff += white.data[i + k] - black.data[i + k];
      const a = Math.min(1, Math.max(0, 1 - diff / 3 / range));
      for (let k = 0; k < 3; k++) out.data[i + k] = a > 0 ? Math.min(255, black.data[i + k] / a) : 0;
      out.data[i + 3] = Math.round(a * 255);
    }
    return { image: out, cam };
  }

  /** The part of `image` that isn't see-through (between rows `top` and `bottom`, if given), scaled to `width` pixels wide. */
  function crop(image, width, { square = false, top = 0, bottom = image.height } = {}) {
    let x0 = image.width, x1 = 0, y0 = image.height, y1 = 0;
    for (let y = Math.max(0, Math.round(top)); y < Math.min(image.height, Math.round(bottom)); y++) {
      for (let x = 0; x < image.width; x++) {
        if (image.data[(y * image.width + x) * 4 + 3] > 8) {
          x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
        }
      }
    }
    let w = x1 - x0 + 1, h = y1 - y0 + 1;
    if (square) { // (the same margin all round, the head in the middle)
      const side = Math.max(w, h) + 4;
      x0 -= (side - w) / 2; y0 -= (side - h) / 2; w = h = side;
    }
    const full = document.createElement('canvas');
    full.width = image.width;
    full.height = image.height;
    full.getContext('2d').putImageData(image, 0, 0);
    const c = document.createElement('canvas');
    c.width = width;
    c.height = Math.round((width * h) / w);
    const g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(full, x0, y0, w, h, 0, 0, c.width, c.height);
    return c;
  }

  async function save(name, canvas) {
    const blob = await new Promise((done) => canvas.toBlob(done, 'image/webp', 0.92));
    if (window.splashPicturesTo) {
      await fetch(window.splashPicturesTo + name, { method: 'POST', body: blob });
    } else {
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name });
      a.click();
    }
    return `${name}: ${canvas.width} x ${canvas.height}, ${Math.round(blob.size / 1024)} kB`;
  }

  const axes = (object) => {
    const q = object.getWorldQuaternion(new THREE.Quaternion());
    return (x, y, z) => new THREE.Vector3(x, y, z).applyQuaternion(q);
  };
  const report = [];

  // His head, face on. Cut off just under the chin, so his neck isn't in the picture.
  {
    const head = rag.parts.head.group;
    const ax = axes(head);
    const centre = head.getWorldPosition(new THREE.Vector3());
    const under = new THREE.Plane(ax(0, 1, 0), -ax(0, 1, 0).dot(centre.clone().addScaledVector(ax(0, 1, 0), -0.147)));
    const { image } = shoot([head], centre, ax(0, 0, 1), ax(0, 1, 0), 0.4, under);
    report.push(await save('splash-head.webp', crop(image, 320, { square: true })));
  }

  // The fingers of his left hand, from the outside, hanging down: from where
  // they leave his palm to their tips (the opening screen lays them over the
  // logo's edge, and mirrors them for his other hand).
  {
    const arm = rag.parts.lowerArmL.group;
    const hand = arm.children.find((c) => c.isMesh && c.material.color?.getHexString() === 'f0bfa2');
    const ax = axes(hand);
    hand.geometry.computeBoundingBox();
    const box = hand.geometry.boundingBox;
    const knuckles = box.min.y + 0.054; // (the fingers are 5.6 cm at their longest)
    const at = (y) => hand.localToWorld(new THREE.Vector3(0, y, (box.min.z + box.max.z) / 2));
    const { image, cam } = shoot([hand], at((knuckles + box.min.y) / 2), ax(1, 0, 0), ax(0, 1, 0), 0.2);
    const row = (y) => ((1 - at(y).project(cam).y) / 2) * buffer.y;
    report.push(await save('splash-hand.webp', crop(image, 160, { top: row(knuckles), bottom: buffer.y })));
  }
  return report.join('\n');
})();
