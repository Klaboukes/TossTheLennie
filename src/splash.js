// The opening screen's pixel art (index.html, #splash): Lennie flung out of his
// smashed bedroom window, tumbling along the aiming dots across the street, and
// crash-landing at the supermarket for points. A plain script, not a module, so
// it runs straight away, long before the game (main.js) has loaded: it's what's
// on screen while that happens. main.js shows the Play button once the game is
// ready and takes the screen away.
//
// The pictures are SVG, one path per colour, drawn from little maps of letters
// (one letter a pixel), so they stay crisp at any size. What moves (Lennie, the
// glass, the bang and the score) are separate elements that only move and fade
// (style.css), which the browser does without redrawing anything, even while
// it's busy building the game.
(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';

  /** Pixel maps to SVG paths: `rows` of letters, `colors` from letter to colour ('.' is empty). */
  function pixels(rows, colors, ox, oy) {
    var d = {};
    for (var y = 0; y < rows.length; y++) {
      for (var x = 0; x < rows[y].length; x++) {
        var c = rows[y][x];
        if (colors[c]) (d[c] = d[c] || []).push('M' + (ox + x) + ' ' + (oy + y) + 'h1v1h-1z');
      }
    }
    var out = '';
    for (var k in d) out += '<path fill="' + colors[k] + '" d="' + d[k].join('') + '"/>';
    return out;
  }
  /** Filled rectangles: [x, y, w, h, colour] each. */
  function blocks(list) {
    var out = '';
    for (var i = 0; i < list.length; i++) {
      var b = list[i];
      out += '<rect x="' + b[0] + '" y="' + b[1] + '" width="' + b[2] + '" height="' + b[3] + '" fill="' + b[4] + '"/>';
    }
    return out;
  }
  function draw(svg, content) {
    if (svg) svg.innerHTML = content;
  }

  // Lennie's colours, as in ragdoll.js
  var LENNIE = {
    H: '#3a281d', // hair
    S: '#f0bfa2', // skin
    G: '#30343a', // glasses
    g: '#cfe3ee', // lenses
    B: '#4d3d33', // beard
    W: '#fbf7ee', // teeth
    R: '#b14a3e', // hoodie
    D: '#963d33', // hoodie's pocket and strings
    J: '#6c6f77', // joggers
    K: '#30343f', // shoes
  };
  // Arms and legs flung wide, mid-toss (17 × 16)
  var RAGDOLL = [
    '......HHHHH......',
    '.SS..HHHHHHH..SS.',
    '.SS..HSSSSSH..SS.',
    '..R..GgGGGgG..R..',
    '..RR.SSSSSSS.RR..',
    '...R.BBWWWBB.R...',
    '...RR.BBBBB.RR...',
    '....RRRRRRRRR....',
    '......RRRRR......',
    '......RDRDR......',
    '......RRRRR......',
    '......JJJJJ......',
    '.....JJJ.JJJ.....',
    '....JJJ...JJJ....',
    '...JJJ.....JJJ...',
    '..KKK.......KKK..',
  ];

  // The bang where he lands (13 × 11)
  var BANG = [
    '......Y......',
    '..Y...Y...Y..',
    '...Y..O..Y...',
    '....YOOOY....',
    '....OOWOO....',
    'YYOOOWWWOOOYY',
    '....OOWOO....',
    '....YOOOY....',
    '...Y..O..Y...',
    '..Y...Y...Y..',
    '......Y......',
  ];

  // Bits of window glass flying out (12 × 12)
  var GLASS = [
    '..g.......g.',
    '.gg.......w.',
    '............',
    'w....g......',
    '.........gg.',
    '............',
    '.g..........',
    'gg......w...',
    '.....g......',
    '............',
    '..w.....g...',
    '.......gg...',
  ];

  // The street, 160 × 72 art pixels: Lennie's rowhouse on the left (his
  // neighbours' edge beside it), the supermarket on the right, and the
  // aiming dots of the toss between them.
  var brick = '#a5533f';
  var brickDark = '#8f4836';
  var trim = '#f4efe6';
  var glass = '#fff3cf';
  var roof = '#5b3d38';
  var roofDark = '#4a302c';
  var scene = blocks([
    // clouds
    [16, 6, 8, 2, '#ffffff'], [14, 8, 14, 3, '#ffffff'], [18, 4, 4, 2, '#ffffff'],
    [100, 3, 10, 2, '#ffffff'], [97, 5, 16, 3, '#ffffff'], [102, 1, 4, 2, '#ffffff'],
    [138, 16, 8, 2, '#ffffff'], [136, 18, 12, 2, '#ffffff'],
    // the roof, over Lennie's and the neighbours' on the left, where the block ends
    // (the picture runs on past its edges on a wide screen)
    [-54, 12, 104, 2, roof], [-56, 14, 108, 4, roof], [-58, 18, 112, 4, roof], [-60, 22, 116, 4, roof],
    [-56, 17, 108, 1, roofDark], [-58, 21, 112, 1, roofDark], [-60, 25, 116, 1, roofDark],
    // the dormers
    [22, 13, 14, 11, trim], [24, 15, 10, 7, glass], [28, 15, 2, 7, trim],
    [-34, 13, 14, 11, trim], [-32, 15, 10, 7, glass], [-28, 15, 2, 7, trim],
    // the fronts: the neighbours', then Lennie's
    [-58, 26, 114, 46, brick], [-58, 26, 58, 46, brickDark], [-58, 26, 2, 46, '#7d3e2f'], [0, 26, 1, 46, '#84402f'],
    // the neighbours' windows and door
    [-52, 31, 16, 13, trim], [-51, 32, 14, 11, glass], [-45, 32, 2, 11, trim], [-53, 44, 18, 1, '#d9d2c6'],
    [-26, 31, 16, 13, trim], [-25, 32, 14, 11, glass], [-19, 32, 2, 11, trim], [-27, 44, 18, 1, '#d9d2c6'],
    [-52, 50, 22, 15, trim], [-51, 51, 20, 13, glass], [-42, 51, 2, 13, trim], [-53, 65, 24, 1, '#d9d2c6'],
    [-21, 49, 12, 23, trim], [-20, 50, 10, 22, '#4a5d8f'], [-18, 52, 6, 5, glass], [-12, 61, 1, 1, '#ffc94a'],
    // a few darker bricks
    [12, 46, 3, 1, brickDark], [44, 28, 3, 1, brickDark], [30, 40, 3, 1, brickDark], [50, 60, 3, 1, brickDark],
    [14, 68, 3, 1, brickDark], [26, 47, 3, 1, brickDark], [2, 40, 3, 1, '#7d3e2f'], [3, 58, 3, 1, '#7d3e2f'],
    // upstairs: the left window whole...
    [12, 31, 16, 13, trim], [13, 32, 14, 11, glass], [19, 32, 2, 11, trim], [11, 44, 18, 1, '#d9d2c6'],
    // ...and the right one smashed, the room dark behind it
    [34, 31, 16, 13, trim], [35, 32, 14, 11, '#2b2433'], [33, 44, 18, 1, '#d9d2c6'],
    [35, 32, 3, 2, '#cfe3ee'], [35, 34, 1, 2, '#cfe3ee'], [46, 32, 3, 1, '#cfe3ee'], [48, 33, 1, 3, '#cfe3ee'],
    [35, 40, 1, 3, '#cfe3ee'], [36, 42, 2, 1, '#cfe3ee'], [45, 42, 4, 1, '#cfe3ee'], [48, 39, 1, 3, '#cfe3ee'],
    // downstairs: the big window and the front door
    [10, 50, 22, 15, trim], [11, 51, 20, 13, glass], [20, 51, 2, 13, trim], [9, 65, 24, 1, '#d9d2c6'],
    [37, 49, 12, 23, trim], [38, 50, 10, 22, '#2f5d50'], [40, 52, 6, 5, glass], [46, 61, 1, 1, '#ffc94a'],
    // the supermarket: its walls, flat roof and red sign
    [112, 34, 96, 38, '#e9e4da'], [110, 32, 98, 3, '#4a4f5a'],
    [114, 36, 92, 8, '#d93a32'], [114, 43, 92, 1, '#a82a24'],
    [160, 46, 46, 26, '#9fd3ee'], [160, 53, 46, 1, '#7f8a96'], [160, 60, 46, 1, '#7f8a96'], [160, 67, 46, 1, '#7f8a96'],
    [164, 50, 2, 3, '#ff4f8b'], [167, 51, 2, 2, '#3ddc97'], [170, 50, 2, 3, '#ffc94a'], [164, 57, 2, 3, '#7b93ff'],
    [167, 58, 2, 2, '#e8553f'], [170, 57, 2, 3, '#3ddc97'], [164, 64, 2, 3, '#ffc94a'], [167, 65, 2, 2, '#ff4f8b'],
    [176, 39, 14, 2, '#ffe9a8'],
    // the trolley on the sign
    [128, 37, 1, 1, '#ffc94a'], [129, 38, 9, 1, '#ffc94a'], [130, 39, 8, 1, '#ffc94a'], [130, 40, 7, 1, '#ffc94a'],
    [131, 41, 6, 1, '#ffc94a'], [131, 42, 1, 1, '#ffc94a'], [136, 42, 1, 1, '#ffc94a'],
    [142, 39, 12, 2, '#ffe9a8'], [117, 39, 8, 2, '#ffe9a8'],
    // the shop window, shelves full of colour behind it
    [114, 46, 46, 26, '#9fd3ee'],
    [114, 53, 46, 1, '#7f8a96'], [114, 60, 46, 1, '#7f8a96'], [114, 67, 46, 1, '#7f8a96'],
    [115, 50, 2, 3, '#e8553f'], [118, 51, 2, 2, '#ffc94a'], [121, 50, 2, 3, '#3ddc97'], [124, 51, 2, 2, '#7b93ff'],
    [127, 50, 2, 3, '#ff4f8b'], [146, 50, 2, 3, '#ffc94a'], [149, 51, 2, 2, '#e8553f'], [152, 50, 2, 3, '#7b93ff'],
    [155, 51, 2, 2, '#3ddc97'], [115, 57, 2, 3, '#ffc94a'], [118, 58, 2, 2, '#7b93ff'], [121, 57, 2, 3, '#e8553f'],
    [124, 58, 2, 2, '#3ddc97'], [146, 57, 2, 3, '#ff4f8b'], [149, 58, 2, 2, '#3ddc97'], [152, 57, 2, 3, '#ffc94a'],
    [155, 58, 2, 2, '#e8553f'], [146, 64, 2, 3, '#7b93ff'], [149, 65, 2, 2, '#ffc94a'], [152, 64, 2, 3, '#ff4f8b'],
    // the sliding doors
    [132, 46, 1, 26, '#4a4f5a'], [143, 46, 1, 26, '#4a4f5a'], [137, 47, 1, 25, '#4a4f5a'], [133, 47, 4, 25, '#bfe3f5'], [138, 47, 5, 25, '#bfe3f5'],
  ]);
  // The aiming dots: the arc from the smashed window to the shop (as the
  // flight in style.css: x = 41 + 87t, y = 38 − 134.4t + 160.4t²).
  var dots = [];
  for (var t = 0.1; t < 0.95; t += 0.075) {
    var x = Math.round(41 + 87 * t);
    var y = Math.round(38 - 134.4 * t + 160.4 * t * t);
    dots.push([x - 1, y - 1, 2, 2, 'rgba(255, 255, 255, 0.85)']);
  }
  scene += blocks(dots);

  var root = document.getElementById('splash');
  if (!root) return;
  draw(root.querySelector('.splash-scene'), scene);
  draw(root.querySelector('.splash-lennie svg'), pixels(RAGDOLL, LENNIE, 0, 0));
  draw(root.querySelector('.splash-bang svg'), pixels(BANG, { Y: '#ffc94a', O: '#ff8a4c', W: '#fff6ec' }, 0, 0));
  draw(root.querySelector('.splash-glass svg'), pixels(GLASS, { g: '#cfe3ee', w: '#ffffff' }, 0, 0));

  // Its texts. The game's own (i18n.js) haven't arrived yet, so both languages are right here.
  var nl = false;
  try {
    var saved = localStorage.getItem('toss-the-lennie:lang');
    nl = saved ? saved === 'nl' : (navigator.languages || [navigator.language]).some(function (l) { return /^nl\b/i.test(l || ''); });
  } catch (e) { /* storage unavailable */ }
  var status = document.getElementById('splash-status');
  if (nl) {
    document.getElementById('splash-tagline').textContent = 'Slinger Lennie door zijn huis en de supermarkt in!';
    status.textContent = 'Lennie komt eraan…';
    document.getElementById('splash-play').textContent = 'Spelen!';
  }

  // If the game can't start at all (no internet for three.js, no WebGL), it
  // says so instead of waiting for ever.
  window.lennieFailed = function () {
    // The game is running: whatever went wrong later, it isn't this
    if (!root.isConnected || root.classList.contains('ready')) return;
    root.classList.add('failed');
    status.textContent = nl
      ? 'Het spel kon niet starten. Controleer de internetverbinding en laad de pagina opnieuw.'
      : "The game couldn't start. Check the internet connection and load the page again.";
  };
  window.addEventListener('error', window.lennieFailed);
})();
