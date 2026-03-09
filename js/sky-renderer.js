/**
 * Night Sky Renderer
 * Renders an interactive star field from a list of books.
 *
 * Usage:
 *   renderSky(container, books, { title, subtitle, seed })
 *
 * Books: [{ t, a, g, c? }, ...]
 */

function renderSky(container, books, opts = {}) {
  const {
    title = "Night Sky",
    subtitle = "hover to reveal \u00b7 drag to explore",
    seed: initialSeed = 42,
    showMakeYourOwn = false,
  } = opts;

  // Seeded random
  let seed = initialSeed;
  function rand() {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  }

  // --- Build DOM ---
  const sky = document.createElement('div');
  sky.id = 'sky';
  container.appendChild(sky);

  // Title bar
  let titleEl = null;
  if (title) {
    titleEl = document.createElement('div');
    titleEl.id = 'title';
    titleEl.innerHTML =
      '<h1>' + title + '</h1>' +
      '<div class="sub">' + subtitle + '</div>' +
      '<button id="show-all">Show All</button>';
    container.appendChild(titleEl);
  }

  if (showMakeYourOwn) {
    const makeBtn = document.createElement('a');
    makeBtn.href = '/onboard';
    makeBtn.className = 'make-own';
    makeBtn.textContent = 'Make Your Own';
    container.appendChild(makeBtn);
  }

  // Modal
  const mbg = document.createElement('div');
  mbg.className = 'modal-bg';
  mbg.id = 'mbg';
  mbg.innerHTML = '<div class="modal" id="modal"></div>';
  container.appendChild(mbg);

  // Layout
  const COLS = Math.max(6, Math.ceil(Math.sqrt(books.length * 1.4)));
  const ROWS = Math.ceil(books.length / COLS);
  const CELL_W = 140;
  const CELL_H = 140;
  const SKY_W = COLS * CELL_W + 200;
  const SKY_H = ROWS * CELL_H + 200;

  sky.style.width = SKY_W + 'px';
  sky.style.height = SKY_H + 'px';

  // Background atmosphere stars
  for (let i = 0; i < 250; i++) {
    const s = document.createElement('div');
    s.className = 'bg-star';
    s.style.left = (rand() * SKY_W) + 'px';
    s.style.top = (rand() * SKY_H) + 'px';
    const size = 1 + rand() * 1.5;
    s.style.width = size + 'px';
    s.style.height = size + 'px';
    s.style.animationDuration = (4 + rand() * 8) + 's';
    s.style.animationDelay = (rand() * 6) + 's';
    sky.appendChild(s);
  }

  // Shuffle books
  const shuffled = [...books];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // Place book stars
  const starEls = [];
  shuffled.forEach((book, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);

    const baseX = 100 + col * CELL_W + CELL_W / 2;
    const baseY = 100 + row * CELL_H + CELL_H / 2;
    const jitterX = (rand() - 0.5) * 80;
    const jitterY = (rand() - 0.5) * 70;

    const dotSize = 3 + rand() * 3;
    const brightness = 0.5 + rand() * 0.5;
    const twinkleDuration = 3 + rand() * 5;
    const twinkleDelay = rand() * 6;

    const star = document.createElement('div');
    star.className = rand() < 0.3 ? 'star sparkle' : 'star';
    star.style.left = (baseX + jitterX) + 'px';
    star.style.top = (baseY + jitterY) + 'px';

    const coverHTML = book.c
      ? '<img src="' + book.c + '" alt="" loading="lazy">'
      : '<div class="ph">' + book.t + '</div>';

    star.innerHTML =
      '<div class="dot" style="--size:' + dotSize.toFixed(1) + 'px;--brightness:' + brightness.toFixed(2) + ';--duration:' + twinkleDuration.toFixed(1) + 's;--delay:' + twinkleDelay.toFixed(1) + 's"></div>' +
      '<div class="reveal">' +
        coverHTML +
        '<div class="label">' + book.t + (book.a ? '<br><span>' + book.a + '</span>' : '') + '</div>' +
      '</div>';

    star.addEventListener('click', () => openModal(book));

    star.addEventListener('mouseenter', () => {
      const cx = parseFloat(star.style.left);
      const cy = parseFloat(star.style.top);
      starEls.forEach(other => {
        if (other.el === star) return;
        const dx = other.x - cx;
        const dy = other.y - cy;
        if (dx * dx + dy * dy < 40000) {
          other.el.classList.add('dimmed');
        }
      });
    });
    star.addEventListener('mouseleave', () => {
      starEls.forEach(other => other.el.classList.remove('dimmed'));
    });

    sky.appendChild(star);
    starEls.push({ el: star, x: baseX + jitterX, y: baseY + jitterY });
  });

  // Proximity glow
  let proxFrame = 0;
  document.addEventListener('mousemove', e => {
    if (proxFrame) return;
    proxFrame = requestAnimationFrame(() => {
      proxFrame = 0;
      if (dragging) return;
      const skyRect = sky.getBoundingClientRect();
      const mx = e.clientX - skyRect.left;
      const my = e.clientY - skyRect.top;
      const RADIUS = 120;
      const R2 = RADIUS * RADIUS;
      for (let i = 0; i < starEls.length; i++) {
        const s = starEls[i];
        const dx = s.x - mx;
        const dy = s.y - my;
        const d2 = dx * dx + dy * dy;
        if (d2 < R2) {
          const t = 1 - Math.sqrt(d2) / RADIUS;
          s.el.classList.add('near');
          s.el.style.setProperty('--prox-scale', (1 + t * 1.5).toFixed(2));
          s.el.style.setProperty('--prox-bright', (1 + t * 0.8).toFixed(2));
        } else if (s.el.classList.contains('near')) {
          s.el.classList.remove('near');
        }
      }
    });
  });

  // Auto-reveal
  let autoRevealTimer = null;
  let allRevealed = false;

  function startAutoReveal() {
    function revealRandom() {
      if (allRevealed) return;
      const idx = Math.floor(Math.random() * starEls.length);
      const s = starEls[idx];
      if (!s.el.classList.contains('auto-reveal')) {
        s.el.classList.add('auto-reveal');
        const showDuration = 1500 + Math.random() * 1000;
        setTimeout(() => s.el.classList.remove('auto-reveal'), showDuration);
      }
      const nextDelay = 1500 + Math.random() * 2500;
      autoRevealTimer = setTimeout(revealRandom, nextDelay);
    }
    autoRevealTimer = setTimeout(revealRandom, 800);
  }
  startAutoReveal();

  // Center sky
  let px = -(SKY_W / 2 - window.innerWidth / 2);
  let py = -(SKY_H / 2 - window.innerHeight / 2);

  function clamp() {
    const minX = -(SKY_W - window.innerWidth);
    const minY = -(SKY_H - window.innerHeight);
    if (SKY_W <= window.innerWidth) px = -(SKY_W - window.innerWidth) / 2;
    else px = Math.min(0, Math.max(minX, px));
    if (SKY_H <= window.innerHeight) py = -(SKY_H - window.innerHeight) / 2;
    else py = Math.min(0, Math.max(minY, py));
  }
  function renderPos() { clamp(); sky.style.transform = 'translate(' + px + 'px,' + py + 'px)'; }
  renderPos();

  // Drag to pan
  let dragging = false, sx, sy, didDrag = false;
  document.addEventListener('mousedown', e => {
    if (e.target.closest('.modal-bg')) return;
    if (e.target.closest('.star .reveal')) return;
    if (e.target.closest('#title')) return;
    dragging = true; didDrag = false;
    sx = e.clientX - px; sy = e.clientY - py;
  });
  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    didDrag = true;
    px = e.clientX - sx; py = e.clientY - sy; renderPos();
  });
  document.addEventListener('mouseup', () => { dragging = false; });

  document.addEventListener('touchstart', e => {
    if (e.target.closest('.modal-bg')) return;
    if (e.target.closest('.star .reveal')) return;
    if (e.target.closest('#title')) return;
    dragging = true; didDrag = false;
    sx = e.touches[0].clientX - px; sy = e.touches[0].clientY - py;
  }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (!dragging) return;
    didDrag = true;
    px = e.touches[0].clientX - sx; py = e.touches[0].clientY - sy; renderPos();
  }, { passive: true });
  document.addEventListener('touchend', () => { dragging = false; });

  document.addEventListener('wheel', e => {
    if (document.querySelector('.modal-bg.open')) return;
    px -= e.deltaX; py -= e.deltaY; renderPos();
  }, { passive: true });

  // Modal
  function openModal(book) {
    if (didDrag) return;
    const m = document.getElementById('modal');
    m.innerHTML =
      '<button class="modal-x" onclick="document.getElementById(\'mbg\').classList.remove(\'open\')">&times;</button>' +
      (book.c
        ? '<img class="modal-img" src="' + book.c + '" alt="">'
        : '<div class="modal-ph">' + book.t + '</div>') +
      '<h2>' + book.t + '</h2>' +
      (book.a ? '<div class="ma">' + book.a + '</div>' : '<div class="ma"></div>') +
      '<div class="mg">' + book.g + '</div>';
    document.getElementById('mbg').classList.add('open');
  }

  mbg.addEventListener('click', e => {
    if (e.target === mbg) mbg.classList.remove('open');
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') mbg.classList.remove('open');
  });

  // Show All toggle
  const showBtn = document.getElementById('show-all');
  if (!showBtn) return;
  const GRID_CELL_W = 120;
  const GRID_CELL_H = 160;
  const GRID_COLS = Math.ceil(Math.sqrt(starEls.length * (GRID_CELL_H / GRID_CELL_W)));
  const GRID_ROWS = Math.ceil(starEls.length / GRID_COLS);

  showBtn.addEventListener('click', () => {
    allRevealed = !allRevealed;
    sky.classList.toggle('sky-revealed', allRevealed);
    showBtn.textContent = allRevealed ? 'Hide All' : 'Show All';

    if (allRevealed) {
      const totalGridW = GRID_COLS * GRID_CELL_W;
      const totalGridH = GRID_ROWS * GRID_CELL_H + 200;
      const newW = Math.max(SKY_W, totalGridW + 200);
      const newH = Math.max(SKY_H, totalGridH);
      sky.style.width = newW + 'px';
      sky.style.height = newH + 'px';
      const offsetX = (newW - totalGridW) / 2;
      const offsetY = 100;
      starEls.forEach((s, i) => {
        const col = i % GRID_COLS;
        const row = Math.floor(i / GRID_COLS);
        const gx = offsetX + col * GRID_CELL_W + GRID_CELL_W / 2;
        const gy = offsetY + row * GRID_CELL_H + GRID_CELL_H / 2;
        s.el.style.left = gx + 'px';
        s.el.style.top = gy + 'px';
      });
    } else {
      sky.style.width = SKY_W + 'px';
      sky.style.height = SKY_H + 'px';
      starEls.forEach(s => {
        s.el.style.left = s.x + 'px';
        s.el.style.top = s.y + 'px';
      });
    }
    const sw = parseInt(sky.style.width);
    const sh = parseInt(sky.style.height);
    px = -(sw / 2 - window.innerWidth / 2);
    py = -(sh / 2 - window.innerHeight / 2);
    renderPos();
  });
}
