// The mouse pointers: a cartoon glove that opens over Lennie and closes into a
// fist while you hold him, and a target in aim mode. They're small SVG pictures
// the browser draws as the real pointer, so they cost the game nothing and never
// lag behind the mouse. Each falls back to the browser's own pointer.
//
// They're drawn on a 32-unit grid and shown at SIZE pixels. The outline of a
// shape is drawn twice under its fill: a thick white edge (so the pointer shows
// on a dark wall too), then a dark one. Shapes that touch share one outline.

const SIZE = 24;
const INK = '#2b2433';

// Light from the top left: the glove goes from white to a soft lilac shadow,
// the cuff from candy pink to a deeper pink.
const DEFS = '<defs>'
  + '<linearGradient id="g" gradientUnits="userSpaceOnUse" x1="8" y1="4" x2="24" y2="28">'
  + '<stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#fff3ea"/><stop offset="1" stop-color="#e5d2dd"/></linearGradient>'
  + '<linearGradient id="f" x1="0" y1="0" x2="1" y2="1">'
  + '<stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="#fff3ea"/><stop offset="1" stop-color="#e2cdd9"/></linearGradient>'
  + '<linearGradient id="c" x1="0" y1="0" x2="0" y2="1">'
  + '<stop offset="0" stop-color="#ff86b0"/><stop offset="1" stop-color="#e0357a"/></linearGradient>'
  + '</defs>';

function outline(shapes) {
  const all = shapes.join('');
  return `<g fill="#fff" stroke="#fff" stroke-width="7" stroke-linejoin="round">${all}</g>`
    + `<g fill="${INK}" stroke="${INK}" stroke-width="4" stroke-linejoin="round">${all}</g>`;
}

// A part drawn over the others with its own thin outline (a curled finger, a thumb).
function onTop(shapes, fill) {
  return `<g fill="${fill}" stroke="${INK}" stroke-width="1.6">${shapes.join('')}</g>`;
}

function pointer(body, x, y, fallback, turn = 0) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 32 32">${DEFS}`
    + `<g transform="translate(16 16) scale(.88) rotate(${turn}) translate(-16 -16)">${body}</g></svg>`;
  const k = SIZE / 32;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${Math.round(x * k)} ${Math.round(y * k)}, ${fallback}`;
}

const cuff = '<rect x="8.5" y="24" width="16" height="6.2" rx="3"/>';
const cuffFill = `<g fill="url(#c)">${cuff}</g>`
  + '<path d="M11 25.6h11" stroke="#ffc2d7" stroke-width="1.1" stroke-linecap="round"/>';

// Open glove: four chubby fingers spread, thumb out to the left.
const fingers = [
  '<rect x="7.2" y="6" width="4.4" height="11" rx="2.2" transform="rotate(-12 9.4 16)"/>',
  '<rect x="12.6" y="3.4" width="4.4" height="12.6" rx="2.2"/>',
  '<rect x="18" y="4.6" width="4.4" height="11.6" rx="2.2" transform="rotate(8 20.2 16)"/>',
  '<rect x="23" y="8.8" width="4" height="9" rx="2" transform="rotate(19 25 17)"/>',
];
const palm = '<rect x="7.5" y="12.5" width="18" height="13" rx="5.5"/>';
const thumb = '<rect x="5.4" y="13.4" width="4.6" height="9.6" rx="2.3" transform="rotate(-34 9.7 22.5)"/>';
const open = outline([...fingers, thumb, palm, cuff])
  // the fingers' fill stops short of the palm, so the dark gaps between them
  // run down into it a little
  + `<g fill="url(#g)">${thumb}${palm}</g>`
  + `<g stroke="${INK}" stroke-width="1.2" stroke-linecap="round">`
  + '<path d="M12.1 12.6v2.4M17.8 12.6v2.6M23.4 13.8v2"/></g>'
  + `<g fill="url(#g)">${fingers.join('')}</g>`
  + cuffFill;

// Fist, seen from the front: four curled fingers in a row, the thumb across them.
const body = '<rect x="7.2" y="11" width="18.6" height="14.5" rx="6"/>';
const curled = [
  '<rect x="7.4" y="8.6" width="4.8" height="8.6" rx="2.4"/>',
  '<rect x="12.2" y="7.6" width="4.8" height="9" rx="2.4"/>',
  '<rect x="17" y="7.8" width="4.8" height="8.8" rx="2.4"/>',
  '<rect x="21.8" y="9.4" width="4.4" height="8" rx="2.2"/>',
];
const thumbOver = '<rect x="6" y="15.6" width="13.6" height="5.4" rx="2.7" transform="rotate(-10 12.8 18.3)"/>';
const fist = outline([body, ...curled, cuff])
  + `<g fill="url(#g)">${body}</g>`
  + onTop(curled, 'url(#f)')
  + onTop([thumbOver], 'url(#f)')
  + cuffFill;

// Aim: a red ring with a dot in the middle (the hot spot) and four ticks.
const ticks = 'M16 3v5M16 24v5M3 16h5M24 16h5';
const target = '<g fill="none" stroke-linecap="round">'
  + `<g stroke="#fff" stroke-width="6.4"><circle cx="16" cy="16" r="8.5"/><path d="${ticks}"/></g>`
  + `<g stroke="${INK}" stroke-width="4"><circle cx="16" cy="16" r="8.5"/><path d="${ticks}"/></g>`
  + '<g stroke="#ff5a3c" stroke-width="2.2"><circle cx="16" cy="16" r="8.5"/>'
  + '<path d="M16 3.6v3.8M16 24.6v3.8M3.6 16h3.8M24.6 16h3.8"/></g>'
  + '<circle cx="16" cy="16" r="6.4" stroke="#fff" stroke-width="1.2" opacity=".7"/></g>'
  + `<circle cx="16" cy="16" r="2.8" fill="#ff5a3c" stroke="${INK}" stroke-width="1.4"/>`;

export const CURSORS = {
  grab: pointer(open, 16, 17, 'grab', -8),
  grabbing: pointer(fist, 16, 16, 'grabbing'),
  aim: pointer(target, 16, 16, 'crosshair'),
};
