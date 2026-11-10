(() => {
  const intro = document.querySelector('#prologue');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  if (motion.matches || !intro.showModal) return;

  const canvas = intro.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const title = intro.querySelector('.prologue-copy');
  if (!ctx) return;

  const duration = 3.55;
  const revealAt = 3.1;
  let frame;
  const loadTimeout = setTimeout(finish, 5000);

  function finish() {
    clearTimeout(loadTimeout);
    cancelAnimationFrame(frame);
    intro.close();
    motion.removeEventListener('change', finish);
  }

  intro.showModal();
  motion.addEventListener('change', finish);
  intro.querySelector('button').addEventListener('click', finish, {once: true});
  intro.addEventListener('cancel', event => {
    event.preventDefault();
    finish();
  }, {once: true});

  const flower = new Image();
  flower.src = './assets/nebula-flower.png';
  flower.decode().then(play).catch(finish);

  function play() {
    if (!intro.open) return;
    clearTimeout(loadTimeout);

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

    // The outer cloud releases first. Particles inherit their source band's transform and color.
    const clouds = [
      [[0, 1], [.16, 1], [.33, 0]],
      [[0, 0], [.14, 0], [.32, 1], [.45, 1], [.63, 0]],
      [[0, 0], [.32, 0], [.54, 1], [.83, .65], [1, 0]]
    ].map((stops, index) => {
      const layer = texture.cloneNode();
      const layerContext = layer.getContext('2d');
      layerContext.drawImage(texture, 0, 0);
      layerContext.globalCompositeOperation = 'destination-in';
      const fade = layerContext.createRadialGradient(cx, cy, 0, cx, cy, h * .94);
      for (const [at, alpha] of stops) fade.addColorStop(at, `rgba(255,255,255,${alpha})`);
      layerContext.fillStyle = fade;
      layerContext.fillRect(0, 0, w, h);
      return {layer, releaseAt: 1.48 - index * .14, particles: []};
    });

    let seed = 471;
    const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
    const stars = Array.from({length: 320}, () => [random(), random(), random()]);
    for (let i = 0; i < 25000; i++) {
      const x = Math.floor(random() * w);
      const y = Math.floor(random() * h);
      const pixel = (y * w + x) * 4;
      const r = data[pixel], g = data[pixel + 1], b = data[pixel + 2];
      const light = Math.max(r, g, b);
      const dx = x - cx;
      const dy = y - cy;
      const radius = Math.hypot(dx, dy) / h;
      if (radius > .74 || light < 64 || random() > (light - 52) / 205) continue;
      const band = radius < .22 ? 0 : radius < .45 ? 1 : 2;
      const drift = random();
      clouds[band].particles.push({
        x: dx, y: dy, drift,
        color: `rgb(${r},${g},${b})`,
        size: .68 + drift * .84 + light / 600
      });
    }

    const smooth = (a, b, t) => {
      const x = Math.max(0, Math.min(1, (t - a) / (b - a)));
      return x * x * (3 - 2 * x);
    };
    let start;
    function render(now) {
      start ??= now;
      const t = (now - start) / 1000;
      if (t >= duration) {
        finish();
        return;
      }

      const width = intro.clientWidth;
      const height = intro.clientHeight;
      const density = Math.min(devicePixelRatio, 1.5);
      const pixelsWide = Math.round(width * density);
      const pixelsHigh = Math.round(height * density);
      if (canvas.width !== pixelsWide || canvas.height !== pixelsHigh) {
        canvas.width = pixelsWide;
        canvas.height = pixelsHigh;
      }
      ctx.setTransform(density, 0, 0, density, 0, 0);

      const travel = smooth(.12, 2.7, t);
      const x = width * .5;
      const y = height * .455;
      const size = Math.min(width / (w * .69), height / (h * .88));
      ctx.fillStyle = '#030611';
      ctx.fillRect(0, 0, width, height);
      for (const [sx, sy, depth] of stars) {
        ctx.fillStyle = `rgba(171,199,239,${(.12 + depth * .6) * smooth(0, 1.25, t)})`;
        const parallax = 1 + travel * depth * .16;
        const point = .5 + depth * depth * .95;
        ctx.fillRect(x + (sx * width - x) * parallax, y + (sy * height - y) * parallax, point, point);
      }

      ctx.globalCompositeOperation = 'screen';
      clouds.forEach(({layer, releaseAt, particles}, index) => {
        const unfold = smooth(.08 + index * .11, 1.02 + index * .1, t);
        const released = smooth(releaseAt, releaseAt + .84, t);
        const scale = size * (.16 + unfold * (.64 + index * .073) + travel * .12);
        ctx.save();
        ctx.translate(x + (index - 1) * travel * 9, y + (1 - index) * travel * 5);
        ctx.rotate((index - 1) * travel * .047 + .085 * (1 - unfold));
        if (released < 1) {
          ctx.globalAlpha = unfold * (1 - released) * (index === 2 ? .91 : .98);
          ctx.drawImage(layer, -cx * scale, -cy * scale, w * scale, h * scale);
        }
        if (released > 0) {
          const flight = smooth(releaseAt + .08, duration + .25, t);
          ctx.globalAlpha = smooth(0, .78, released) * .92;
          for (const grain of particles) {
            const stretch = scale * (1 + flight * (.42 + grain.drift * 1.25));
            const turn = flight * (.14 + grain.drift * .22);
            const gx = (grain.x + grain.y * turn) * stretch;
            const gy = (grain.y - grain.x * turn) * stretch;
            ctx.fillStyle = grain.color;
            if (grain.drift > .985) ctx.fillRect(gx - 1.1, gy + .5, grain.size + 2.2, .65);
            ctx.fillRect(gx, gy, grain.size, grain.size);
          }
        }
        ctx.restore();
      });

      const radius = Math.min(width, height) * (.058 + travel * .14);
      const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
      const light = smooth(0, .42, t) * (1 - smooth(.82, 2.42, t));
      glow.addColorStop(0, `rgba(217,244,255,${light})`);
      glow.addColorStop(.1, `rgba(100,192,255,${light * .43})`);
      glow.addColorStop(1, 'rgba(53,94,214,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);

      ctx.globalCompositeOperation = 'source-over';
      title.style.opacity = String(smooth(2.28, 2.79, t));
      intro.style.opacity = String(1 - smooth(revealAt, duration, t));
      frame = requestAnimationFrame(render);
    }

    frame = requestAnimationFrame(render);
  }
})();
