const prologue = (() => {
  const dialog = document.querySelector('#prologue');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const canvas = dialog.querySelector('canvas');
  const root = document.documentElement;
  const gatherAt = 1.75;
  const settledAt = 3.05;
  const revealAt = 5.8;
  const endAt = 6.45;
  const letterWidth = 420;
  const letterHeight = 190;
  const letterColor = '#f4f6ff';
  const serif = '"Prologue Serif", "Songti SC", "Noto Serif CJK SC", Georgia, serif';
  const title = dialog.querySelector('h2').textContent;
  const subtitle = dialog.querySelector('[lang=en]').textContent;
  let context, grains, lettering, fontReady, startedAt, timeout;

  function close() {
    clearTimeout(timeout);
    dialog.close();
    root.classList.remove('prologue-active');
    root.style.removeProperty('--atlas-reveal');
    motion.removeEventListener('change', close);
  }

  if (!motion.matches && dialog.showModal) {
    dialog.showModal();
    fontReady = document.fonts.load(`400 104px ${serif}`, title + subtitle).catch(() => []);
    root.classList.add('prologue-active');
    motion.addEventListener('change', close);
    dialog.querySelector('button').addEventListener('click', close, {once: true});
    dialog.addEventListener('cancel', event => {
      event.preventDefault();
      close();
    }, {once: true});
    timeout = setTimeout(close, 6500);
  }

  async function start() {
    if (!dialog.open) return;
    await fontReady;
    if (!dialog.open) return;
    context = canvas.getContext('2d');
    if (!context) {
      close();
      return;
    }
    prepareLetters();
    drawLetters(settledAt - .25);
    drawLetters(settledAt);
    context.resetTransform();
    context.clearRect(0, 0, canvas.width, canvas.height);
    clearTimeout(timeout);
  }

  function prepareLetters() {
    const mask = document.createElement('canvas');
    mask.width = letterWidth * 2;
    mask.height = letterHeight * 2;
    const ink = mask.getContext('2d', {willReadFrequently: true});
    ink.scale(2, 2);
    ink.fillStyle = letterColor;
    ink.textAlign = 'center';
    ink.textBaseline = 'middle';
    ink.font = `400 104px ${serif}`;
    [...title].forEach((letter, i) => ink.fillText(letter, letterWidth / 2 + (i - (title.length - 1) / 2) * 130, 76));
    ink.font = `400 19px ${serif}`;
    const tracking = 7;
    const letters = [...subtitle].map(letter => ({letter, width: ink.measureText(letter).width}));
    const subtitleWidth = letters.reduce((total, {width}) => total + width, 0) + (letters.length - 1) * tracking;
    let left = (letterWidth - subtitleWidth) / 2;
    for (const {letter, width} of letters) {
      ink.fillText(letter, left + width / 2, 151);
      left += width + tracking;
    }
    const pixels = ink.getImageData(0, 0, mask.width, mask.height).data;

    let seed = 531;
    const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
    grains = [];
    for (let y = 0; y < mask.height; y += 4) {
      for (let x = 0; x < mask.width; x += 4) {
        if (pixels[(y * mask.width + x) * 4 + 3] < 85) continue;
        const angle = random() * Math.PI * 2;
        const radius = .36 + random() * .53;
        grains.push({
          x: (x - mask.width / 2) / 2 + random() - .5,
          y: y / 2 - 101 + random() - .5,
          dx: Math.cos(angle) * radius, dy: Math.sin(angle) * radius,
          delay: random() * .30, size: .54 + random() * .69,
          spark: random() > .97
        });
      }
    }
    lettering = document.createElement('canvas');
    lettering.width = mask.width;
    lettering.height = mask.height;
    const glow = lettering.getContext('2d');
    glow.shadowColor = 'rgba(244,246,255,.58)';
    glow.shadowBlur = 26;
    glow.drawImage(mask, 0, 0);
    glow.shadowColor = 'rgba(244,246,255,.34)';
    glow.shadowBlur = 8;
    glow.drawImage(mask, 0, 0);
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
    const solid = ease(settledAt - .35, settledAt, t);
    if (solid < 1) {
      context.globalAlpha = opacity * (1 - solid);
      context.fillStyle = letterColor;
      context.beginPath();
      for (const p of grains) {
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
    if (solid > 0) {
      context.globalAlpha = solid;
      context.drawImage(lettering, -letterWidth / 2 * scale, -101 * scale, letterWidth * scale, letterHeight * scale);
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
      opening: ease(0, 1.9, t),
      scale: 1.07,
      orbit: t * .49,
      light: (1 - .82 * ease(gatherAt, settledAt - .15, t)) * (1 - reveal),
      reveal
    };
  }

  return {start, frame, close, get waiting() { return dialog.open && !grains; }};
})();
