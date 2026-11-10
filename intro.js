(() => {
  const intro = document.querySelector('#prologue');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  if (motion.matches || !intro.showModal) return;

  const canvas = intro.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const flower = new Image();
  flower.src = './assets/nebula-flower.png';
  flower.decode().then(play).catch(() => {
    if (intro.open) intro.close();
  });

  function play() {
    if (motion.matches) return;

    const texture = document.createElement('canvas');
    texture.width = 900;
    texture.height = Math.round(900 * flower.height / flower.width);
    const paint = texture.getContext('2d', {willReadFrequently: true});
    const w = texture.width;
    const h = texture.height;
    const cx = w * .505;
    const cy = h * .455;
    paint.drawImage(flower, 0, 0, w, h);
    const {data} = paint.getImageData(0, 0, w, h);

    // Feather overlapping bands of the actual photo so the clouds can travel at different speeds.
    const clouds = [
      [[0, 1], [.16, 1], [.33, 0]],
      [[0, 0], [.14, 0], [.32, 1], [.45, 1], [.63, 0]],
      [[0, 0], [.32, 0], [.54, 1], [.83, .65], [1, 0]]
    ].map(stops => {
      const layer = texture.cloneNode();
      const layerContext = layer.getContext('2d');
      layerContext.drawImage(texture, 0, 0);
      layerContext.globalCompositeOperation = 'destination-in';
      const fade = layerContext.createRadialGradient(cx, cy, 0, cx, cy, h * .94);
      for (const [at, alpha] of stops) fade.addColorStop(at, `rgba(255,255,255,${alpha})`);
      layerContext.fillStyle = fade;
      layerContext.fillRect(0, 0, w, h);
      return layer;
    });

    let seed = 471;
    const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
    const stars = Array.from({length: 320}, () => [random(), random(), random()]);
    const dust = [];
    for (let i = 0; i < 4800; i++) {
      const x = Math.floor(random() * w);
      const y = Math.floor(random() * h);
      const pixel = (y * w + x) * 4;
      const r = data[pixel], g = data[pixel + 1], b = data[pixel + 2];
      if (Math.max(r, g, b) < 118 || Math.hypot(x - cx, y - cy) > h * .65) continue;
      dust.push({x: x - cx, y: y - cy, color: `rgb(${r},${g},${b})`, drift: random()});
    }

    const smooth = (a, b, t) => {
      const x = Math.max(0, Math.min(1, (t - a) / (b - a)));
      return x * x * (3 - 2 * x);
    };
    let frame;
    let start;
    let width;
    let height;
    function resize() {
      width = intro.clientWidth;
      height = intro.clientHeight;
      const density = Math.min(devicePixelRatio, 1.5);
      canvas.width = Math.round(width * density);
      canvas.height = Math.round(height * density);
      ctx.setTransform(density, 0, 0, density, 0, 0);
    }

    function finish() {
      cancelAnimationFrame(frame);
      intro.close();
      removeEventListener('resize', resize);
      motion.removeEventListener('change', finish);
    }

    function render(now) {
      start ??= now;
      const t = (now - start) / 1000;
      if (t >= 6.2) {
        finish();
        return;
      }
      const travel = smooth(.25, 5.6, t);
      const x = width * .5;
      const y = height * .455;
      const size = Math.min(width / (w * .69), height / (h * .88));
      ctx.fillStyle = '#030611';
      ctx.fillRect(0, 0, width, height);
      for (const [sx, sy, depth] of stars) {
        ctx.fillStyle = `rgba(171,199,239,${(.12 + depth * .6) * smooth(0, 2.2, t)})`;
        const parallax = 1 + travel * depth * .16;
        const point = .5 + depth * depth * .95;
        ctx.fillRect(x + (sx * width - x) * parallax, y + (sy * height - y) * parallax, point, point);
      }

      ctx.globalCompositeOperation = 'screen';
      clouds.forEach((layer, i) => {
        const unfold = smooth(.2 + i * .35, 4.6 + i * .35, t);
        const scale = size * (.16 + unfold * (.64 + i * .073) + travel * .12);
        ctx.save();
        ctx.translate(x + (i - 1) * travel * 9, y + (1 - i) * travel * 5);
        ctx.rotate((i - 1) * travel * .047 + .085 * (1 - unfold));
        ctx.globalAlpha = unfold * (i === 2 ? .91 : .98);
        ctx.drawImage(layer, -cx * scale, -cy * scale, w * scale, h * scale);
        ctx.restore();
      });

      const radius = Math.min(width, height) * (.058 + travel * .14);
      const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
      const light = smooth(0, .8, t) * (1 - .68 * smooth(1.4, 4.8, t));
      glow.addColorStop(0, `rgba(217,244,255,${light})`);
      glow.addColorStop(.1, `rgba(100,192,255,${light * .43})`);
      glow.addColorStop(1, 'rgba(53,94,214,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);

      ctx.globalAlpha = smooth(1.3, 3.4, t) * (1 - .55 * smooth(4.2, 6.2, t)) * .8;
      for (const p of dust) {
        const scale = size * (.49 + travel * (p.drift * .54 + .4));
        const px = p.x + p.y * travel * .09;
        const py = p.y - p.x * travel * .09;
        ctx.fillStyle = p.color;
        ctx.fillRect(x + px * scale, y + py * scale, .55 + p.drift, .55 + p.drift);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      intro.style.opacity = String(1 - smooth(5.15, 6.2, t));
      frame = requestAnimationFrame(render);
    }

    intro.showModal();
    resize();
    addEventListener('resize', resize);
    motion.addEventListener('change', finish);
    intro.querySelector('button').addEventListener('click', finish, {once: true});
    intro.addEventListener('cancel', event => {
      event.preventDefault();
      finish();
    }, {once: true});
    frame = requestAnimationFrame(render);
  }
})();
