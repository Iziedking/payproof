// Payproof landing: tab showcase, cycling note stack, stacking deck.
(() => {
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Nav hairline once the page scrolls.
  const nav = document.querySelector('.nav');
  const onScrollNav = () => nav.classList.toggle('scrolled', scrollY > 8);
  addEventListener('scroll', onScrollNav, { passive: true }); onScrollNav();

  // Tabs: a pill slides to the selected tab; views auto-advance every 6 s
  // until the visitor picks one.
  const tablist = document.querySelector('.tabs');
  const tabs = [...tablist.querySelectorAll('[role="tab"]')];
  const pill = tablist.querySelector('.tab-pill');
  const rail = [...document.querySelectorAll('.rail-i')];
  let current = 0, timer = null;

  function place() {
    const b = tabs[current];
    pill.style.width = b.offsetWidth + 'px';
    pill.style.transform = `translateX(${b.offsetLeft}px)`;
  }
  function select(i, focus = false) {
    current = (i + tabs.length) % tabs.length;
    tabs.forEach((t, k) => {
      const on = k === current;
      t.setAttribute('aria-selected', on);
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
      rail[k]?.classList.toggle('on', on);
    });
    place();
    if (focus) tabs[current].focus();
  }
  function stopAuto() { clearInterval(timer); timer = null; }
  tabs.forEach((t, k) => t.addEventListener('click', () => { stopAuto(); select(k); }));
  tablist.addEventListener('keydown', (e) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (step) { e.preventDefault(); stopAuto(); select(current + step, true); }
    if (e.key === 'Home') { e.preventDefault(); stopAuto(); select(0, true); }
    if (e.key === 'End') { e.preventDefault(); stopAuto(); select(tabs.length - 1, true); }
  });
  addEventListener('resize', place);
  document.fonts?.ready.then(place);
  place();

  // Auto-advance only while the showcase is on screen.
  if (!still) {
    const stage = document.querySelector('.showcase');
    new IntersectionObserver(([e]) => {
      if (e.isIntersecting && timer === null && !stage.dataset.picked) timer = setInterval(() => select(current + 1), 6000);
      if (!e.isIntersecting) { clearInterval(timer); timer = null; }
    }, { threshold: 0.4 }).observe(stage);
    tabs.forEach((t) => t.addEventListener('click', () => { stage.dataset.picked = '1'; }));
  }

  // Note stack: every 2.4 s the top card slides down and fades, the rest move up.
  const stack = document.querySelector('.stack');
  const notes = [...stack.querySelectorAll('.note')];
  const slots = [{ y: 16, r: 1.5 }, { y: 108, r: -1 }, { y: 200, r: 1 }];
  let order = notes.map((_, i) => i);
  function layout() {
    order.forEach((n, slot) => {
      const s = slots[slot];
      notes[n].style.transform = `translateY(${s.y}px) rotate(${s.r}deg)`;
      notes[n].style.opacity = 1;
      notes[n].style.zIndex = 3 - slot;
    });
  }
  layout();
  if (!still) {
    setInterval(() => {
      if (document.hidden) return;
      const top = notes[order[0]];
      top.style.transform = `translateY(320px) rotate(4deg)`;
      top.style.opacity = 0;
      setTimeout(() => {
        order.push(order.shift());
        // Park the old top card above the stack, then let it settle in last place.
        top.style.transition = 'none';
        top.style.transform = `translateY(-80px)`;
        top.offsetHeight;
        top.style.transition = '';
        layout();
      }, 450);
    }, 2400);
  }

  // Film: plays muted and on a loop while on screen, pauses off screen.
  // With reduced motion it stays on the still poster frame.
  const frame = document.querySelector('.film-frame');
  if (frame) {
    const video = frame.querySelector('video');
    const bar = frame.querySelector('.film-progress i');
    const sound = frame.querySelector('.film-sound');
    if (still) {
      frame.classList.add('film-still');
    } else {
      video.muted = true;
      // Some hosts serve the file without byte ranges, which iPhone Safari will not play. If the
      // film cannot play, keep the poster frame and hide the sound and progress controls.
      const giveUp = () => frame.classList.add('film-still');
      video.addEventListener('error', giveUp);
      video.querySelector('source')?.addEventListener('error', giveUp);
      let inView = false;
      const start = () => {
        if (!inView) return;
        video.play().catch(() => {
          video.addEventListener('canplay', () => { if (inView) video.play().catch(() => {}); }, { once: true });
          if (video.readyState === 0) video.load();
        });
      };
      new IntersectionObserver(([e]) => {
        inView = e.isIntersecting;
        if (inView) start(); else if (!video.paused) video.pause();
      }, { threshold: 0.35 }).observe(frame);
      const tick = () => {
        if (video.duration) bar.style.transform = `scaleX(${video.currentTime / video.duration})`;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      sound.addEventListener('click', () => {
        video.muted = !video.muted;
        sound.setAttribute('aria-pressed', String(!video.muted));
        if (!video.muted && video.paused) video.play().catch(() => {});
      });
    }
  }

  // Stacking deck: the card underneath scales to 0.96 and dims as the next one covers it.
  const cards = [...document.querySelectorAll('.dcard')];
  if (!still && cards.length > 1) {
    let ticking = false;
    const update = () => {
      ticking = false;
      if (getComputedStyle(cards[0]).position !== 'sticky') { cards.forEach((c) => { c.style.transform = ''; c.style.filter = ''; }); return; }
      cards.forEach((c, i) => {
        const next = cards[i + 1];
        if (!next) return;
        const top = c.getBoundingClientRect().top;
        const nTop = next.getBoundingClientRect().top;
        const h = c.offsetHeight;
        const p = Math.min(1, Math.max(0, 1 - (nTop - top) / h)); // 0 = apart, 1 = fully covered
        c.style.transform = `scale(${1 - 0.04 * p})`;
        c.style.filter = `brightness(${1 - 0.08 * p})`;
      });
    };
    addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    addEventListener('resize', update);
    update();
  }
})();
