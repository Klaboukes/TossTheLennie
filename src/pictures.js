import * as THREE from 'three';

// Pictures that are only in memory once.
//
// Every picture in the game (brick, labels, posters, the kids' drawings) is
// drawn on a canvas while the game is built, and goes to the graphics chip the
// first time it's seen. The canvas used to stay after that, a second copy of
// every picture: some 40 megapixels of them. On an Android tablet a canvas
// lives in graphics memory itself, so that was 170 MB of the scarcest memory
// there is (see docs/memory.md), on a tablet that closes the tab when it runs out.
//
// A picture made here lets go of its canvas as soon as the chip has it, and
// remembers how it was drawn instead. When three.js asks for the canvas again
// it's drawn again on the spot. That happens when a weak device drops its
// graphics context and wants everything sent anew (it does, now and then), or
// when a picture is needed to compose another one (products.js). Nothing here
// knows about lost contexts: whoever reads `texture.image` gets the picture.
//
// So: make every canvas texture with picture() or drawn(), never with
// `new THREE.CanvasTexture` (only the TV's, which is drawn on all the time,
// keeps its canvas), and read a picture's size with sizeOf(), not from its
// canvas: asking for `texture.image` draws it again if it was let go.

const entries = new WeakMap(); // texture → { size, release, take }

/** For measuring (scripts/tablet/memory.mjs): how many pictures there are, how many hold a canvas right now (and the most pixels they ever held at once), and how often one was drawn on demand. */
export const pictureCount = { made: 0, held: 0, heldPixels: 0, mostPixels: 0, drawnOnDemand: 0 };

/**
 * A texture of the picture on `first` (a canvas), which is let go of once the
 * graphics chip has it. `again()` must give the same picture once more: a
 * canvas, or a texture made the same way (so a function that draws a picture
 * can simply call itself). Give `first` as `{ width, height }` for a picture
 * that isn't drawn at all until it's needed.
 */
export function picture(first, again) {
  const size = { width: first.width, height: first.height };
  const pixels = size.width * size.height;
  let canvas = null;
  const hold = (c) => {
    canvas = c;
    pictureCount.held++;
    pictureCount.heldPixels += pixels;
    pictureCount.mostPixels = Math.max(pictureCount.mostPixels, pictureCount.heldPixels);
  };
  /** Hands the canvas over without clearing it. */
  const take = () => {
    const c = canvas;
    if (c) {
      canvas = null;
      pictureCount.held--;
      pictureCount.heldPixels -= pixels;
    }
    return c;
  };
  const release = () => {
    const c = take();
    // (a canvas of no size gives its memory back right away; one that's merely
    // forgotten keeps it until the garbage collector comes round, which can take minutes)
    if (c) c.width = c.height = 0;
  };
  if (first.getContext) hold(first);
  const texture = new THREE.CanvasTexture();
  // three.js reads a texture's picture as `texture.image`, which is its source's `data`.
  Object.defineProperty(texture.source, 'data', {
    configurable: true,
    enumerable: true,
    get() {
      if (!canvas) {
        const made = again();
        // (a texture made the same way holds the canvas itself: take it over)
        hold(entries.get(made)?.take() ?? (made.isTexture ? made.image : made));
        pictureCount.drawnOnDemand++;
      }
      return canvas;
    },
    set() { /* the picture is whatever `again` draws */ },
  });
  texture.onUpdate = release; // (three.js calls this when it has sent the picture to the chip)
  texture.needsUpdate = true;
  entries.set(texture, { size, release, take });
  pictureCount.made++;
  return texture;
}

/**
 * A picture `width` × `height` px that `draw(g, width, height)` paints on a
 * canvas's 2D context `g`. `draw` runs again whenever the picture is needed
 * again, so it must paint the same thing every time: start a seeded random
 * generator inside it, not before. With `lazy` it isn't drawn until it's needed.
 */
export function drawn(width, height, draw, { lazy = false } = {}) {
  const paint = () => {
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    draw(c.getContext('2d'), width, height);
    return c;
  };
  return picture(lazy ? { width, height } : paint(), paint);
}

/** Lets go of a picture's canvas now (after composing another picture from it). It's drawn again if anything asks for it. */
export function letGo(texture) {
  entries.get(texture)?.release();
}

/** A texture's size in pixels ({ width, height }), without drawing it again. */
export function sizeOf(texture) {
  return entries.get(texture)?.size ?? texture.image;
}
