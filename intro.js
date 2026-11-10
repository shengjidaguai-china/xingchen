const prologue = (() => {
  const dialog = document.querySelector('#prologue');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const canvas = dialog.querySelector('canvas');
  const root = document.documentElement;
  const gatherAt = 2.5;
  const settledAt = 3.8;
  const revealAt = 5.2;
  const endAt = 5.8;
  let context, grains, startedAt, timeout;

  function close() {
    clearTimeout(timeout);
    dialog.close();
    root.classList.remove('prologue-active');
    root.style.removeProperty('--atlas-reveal');
    motion.removeEventListener('change', close);
  }

  if (!motion.matches && dialog.showModal) {
    dialog.showModal();
    root.classList.add('prologue-active');
    motion.addEventListener('change', close);
    dialog.querySelector('button').addEventListener('click', close, {once: true});
    dialog.addEventListener('cancel', event => {
      event.preventDefault();
      close();
    }, {once: true});
    timeout = setTimeout(close, 6500);
  }

  function start() {
    if (!dialog.open) return;
    context = canvas.getContext('2d');
    if (!context) {
      close();
      return;
    }
    grains = sampleLetters();
    drawLetters(settledAt);
    context.resetTransform();
    context.clearRect(0, 0, canvas.width, canvas.height);
    clearTimeout(timeout);
  }

  function sampleLetters() {
    const mask = document.createElement('canvas');
    mask.width = 420;
    mask.height = 190;
    const ink = mask.getContext('2d', {willReadFrequently: true});
    const title = dialog.querySelector('h2').textContent;
    const subtitle = dialog.querySelector('[lang=en]').textContent;
    ink.fillStyle = '#fff';
    ink.textAlign = 'center';
    ink.textBaseline = 'middle';
    ink.font = '104px "Songti SC", "Noto Serif CJK SC", Georgia, serif';
    [...title].forEach((letter, i) => ink.fillText(letter, 210 + (i - (title.length - 1) / 2) * 119, 77));
    ink.font = '600 22px Georgia, serif';
    [...subtitle].forEach((letter, i) => ink.fillText(letter, 210 + (i - (subtitle.length - 1) / 2) * 24, 154));
    const pixels = ink.getImageData(0, 0, mask.width, mask.height).data;

    let seed = 531;
    const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
    const groups = [[], [], []];
    for (let y = 0; y < mask.height; y += 2) {
      for (let x = 0; x < mask.width; x += 2) {
        if (pixels[(y * mask.width + x) * 4 + 3] < 85) continue;
        const angle = random() * Math.PI * 2;
        const radius = .36 + random() * .53;
        const band = random();
        groups[band < .58 ? 0 : band < .84 ? 1 : 2].push({
          x: x - 210 + random() - .5, y: y - 101 + random() - .5,
          dx: Math.cos(angle) * radius, dy: Math.sin(angle) * radius,
          delay: random() * .30, size: .54 + random() * .69,
          spark: random() > .97
        });
      }
    }
    return groups;
  }

  const ease = (from, to, t) => {
    const p = Math.max(0, Math.min(1, (t - from) / (to - from)));
    return p * p * (3 - 2 * p);
  };

  function drawLetters(t) {
    const w = dialog.clientWidth;
    const h = dialog.clientHeight;
    const density = Math.min(devicePixelRatio, 1.5);
    if (canvas.width !== Math.round(w * density) || canvas.height !== Math.round(h * density)) {
      canvas.width = Math.round(w * density);
      canvas.height = Math.round(h * density);
    }
    context.setTransform(density, 0, 0, density, 0, 0);
    context.clearRect(0, 0, w, h);
    context.translate(w / 2, h * .46);
    const scale = Math.min(w / 435, h / 455, 1.3);
    const opacity = ease(gatherAt, gatherAt + .28, t);
    const sourceWidth = Math.min(w * .68, h * .83);
    const sourceHeight = h * .60;
    const colors = ['#fff7e8', '#c9ecff', '#efcc93'];
    context.globalAlpha = opacity;
    for (let i = 0; i < grains.length; i++) {
      context.fillStyle = colors[i];
      context.beginPath();
      for (const p of grains[i]) {
        const settled = ease(gatherAt + p.delay, settledAt, t);
        const floating = 1 - settled;
        const arc = settled * floating * .9;
        const x = (p.dx - p.dy * arc) * sourceWidth * floating + p.x * scale * settled;
        const y = (p.dy + p.dx * arc) * sourceHeight * floating + p.y * scale * settled;
        const dot = p.size * (.63 + scale * .30) * (.75 + .25 * settled);
        context.moveTo(x + dot, y);
        context.arc(x, y, dot, 0, Math.PI * 2);
        if (p.spark) {
          if (settled > .03 && settled < .98) {
            const tail = 20 * settled * floating;
            context.moveTo(x, y - .45);
            context.lineTo(x + p.dx * tail * 3, y + p.dy * tail * 2);
            context.lineTo(x, y + .45);
            context.closePath();
          }
          const ray = dot * (1.7 + .6 * Math.sin(t * 3 + p.x));
          context.rect(x - ray, y - .26, ray * 2, .52);
          context.rect(x - .26, y - ray, .52, ray * 2);
        }
      }
      context.fill();
    }
  }

  function frame(ms) {
    if (!dialog.open || !grains) return null;
    if (startedAt === undefined) {
      startedAt = ms;
      dialog.classList.add('playing');
    }
    const t = (ms - startedAt) / 1000;
    if (t >= endAt) {
      close();
      return null;
    }
    const reveal = ease(revealAt, endAt, t);
    if (t > gatherAt) drawLetters(t);
    if (reveal > 0) {
      dialog.style.opacity = String(1 - reveal);
      root.style.setProperty('--atlas-reveal', String(reveal));
    }
    return {
      opening: ease(.92, 2.62, t),
      scale: .33 + .67 * ease(0, 1.19, t) + .15 * ease(1.3, 2.72, t),
      orbit: Math.max(0, t - .9) * .49,
      light: ease(0, .64, t) * (1 - .82 * ease(gatherAt, 3.45, t)) * (1 - reveal),
      reveal
    };
  }

  return {start, frame, close, get waiting() { return dialog.open && !grains; }};
})();
