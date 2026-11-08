// SilicoGraft page script: the hero's film loop and the model section's stage clips.
// Without JS the hero keeps its still and every stage clip shows its poster: both are plain HTML
// and need nothing from this file.
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');

  // ---------------------------------------------------------------------------------------------
  // Hero: the film loop behind the headline. The figure names the files in data-video-*. The video is
  // attached only when motion is allowed and the visitor does not save data; it stays paused off-screen
  // and in a background tab. It has no pause control: the owner removed it on 2026-11-08, knowing that
  // Hallmark gate 18 / WCAG 2.2.2 ask for one. Under reduced motion the still shows instead.
  // ---------------------------------------------------------------------------------------------
  const heroFig = document.querySelector('.hero__canvas[data-video-src]');
  const saveData = !!(navigator.connection && navigator.connection.saveData);

  const attachHeroVideo = () => {
    const d = heroFig.dataset;
    const big = matchMedia('(min-width: 60rem)').matches && innerWidth * (devicePixelRatio || 1) > 1400;
    const v = document.createElement('video');
    v.muted = true;
    v.defaultMuted = true;
    v.loop = true;
    v.playsInline = true;
    ['muted', 'loop', 'playsinline', 'data-keep'].forEach((a) => v.setAttribute(a, ''));
    v.setAttribute('preload', 'none');
    v.setAttribute('aria-hidden', 'true');
    v.tabIndex = -1;
    if (d.videoPoster) v.poster = d.videoPoster;
    const add = (src, type) => {
      if (!src) return;
      const s = document.createElement('source');
      s.src = src;
      s.type = type;
      v.append(s);
    };
    // A phone held upright gets the portrait recording (720x1440); AV1 (1080p, about a third of the H.264
    // size) goes to large screens, H.264 720p to everything else and to browsers without AV1. The browser
    // skips a <source> whose type it cannot play and falls through to the next when a file is missing.
    if (matchMedia('(max-width: 40rem) and (orientation: portrait)').matches) add(d.videoPortrait, 'video/mp4');
    if (big) add(d.videoAv1, 'video/mp4; codecs="av01.0.08M.08"');
    add(d.videoSrc, 'video/mp4');
    const sources = v.querySelectorAll('source');
    sources[sources.length - 1].addEventListener('error', () => v.remove(), { once: true });
    // the portrait recording is framed in full; the landscape one keeps its 3D stage in view (styles.css)
    v.addEventListener('loadedmetadata', () => v.classList.toggle('is-portrait', v.videoHeight > v.videoWidth));
    heroFig.append(v);

    const s = { seen: false, hidden: document.hidden };
    const sync = () => {
      if (s.seen && !s.hidden && !reduce.matches) v.play().catch(() => {});
      else v.pause();
    };
    v.addEventListener('playing', () => v.classList.add('is-shown'), { once: true });
    document.addEventListener('visibilitychange', () => { s.hidden = document.hidden; sync(); });
    reduce.addEventListener('change', sync);
    new IntersectionObserver(([e]) => { s.seen = e.isIntersecting; sync(); }).observe(heroFig);
  };

  // The loop starts after the page has loaded and the browser is idle, so the still, the headline and the
  // fonts get the bandwidth first. A missing file removes the video (the error handler above), so no
  // HEAD request is needed before it.
  const afterLoad = (fn) => {
    const idle = () => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 2000 }) : setTimeout(fn, 300));
    if (document.readyState === 'complete') idle();
    else addEventListener('load', idle, { once: true });
  };
  if (heroFig && !reduce.matches && !saveData && 'IntersectionObserver' in window) afterLoad(attachHeroVideo);

  // ---------------------------------------------------------------------------------------------
  // Phones (under 40rem): the masthead's Menu button opens the section links as a full-screen modal
  // <dialog>. Esc, the Close button and following a link close it; showModal() moves focus into it and
  // keeps the page behind inert, and on close focus goes back to the button. The page does not scroll
  // while it is open (html.is-locked).
  // ---------------------------------------------------------------------------------------------
  const menu = document.getElementById('menu');
  const menuBtn = document.querySelector('.mast__menu');
  if (menu && menuBtn && typeof menu.showModal === 'function') {
    const mark = (open) => {
      menuBtn.setAttribute('aria-expanded', String(open));
      document.documentElement.classList.toggle('is-locked', open);
    };
    const shut = () => { mark(false); if (menu.open) menu.close(); };
    menuBtn.addEventListener('click', () => { menu.showModal(); mark(true); });
    menu.addEventListener('close', () => { mark(false); menuBtn.focus({ preventScroll: true }); });
    menu.querySelector('.menu__close').addEventListener('click', shut);
    // unlock before the browser follows the link, so it can scroll to the section
    menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', shut));
    matchMedia('(max-width: 40rem)').addEventListener('change', (e) => { if (!e.matches) shut(); });
  }

  // ---------------------------------------------------------------------------------------------
  // Model: the seven stages pinned to the full screen (the owner's pick, 2026-11-08). The page holds
  // a plain list (no JS: every clip shows its poster). Here it becomes a tall track with a sticky,
  // full-screen pin: the stage texts share one place on the left, the clips one 16:9 deck on the
  // right. Each 80vh of scroll is one stage: the clip slides out to the left and the next comes in
  // from the right; after stage 7 the track ends and the page scrolls on. Scrolling only picks the
  // stage, the clips play at their own speed. Only the current clip plays, from its start, while the
  // pin is on screen; the icon in the deck's corner holds it (Hallmark gate 18, WCAG 2.2.2). Under
  // reduced motion nothing plays until that button is pressed, and the slides switch without motion.
  //
  // Phones (under 40rem, styles.css) see the same pin as a story card: seven thin segments on top
  // (done ones full, upcoming ones empty, the current one filling with its clip), the 4:5 portrait
  // clip edge to edge under them and the stage text below. A horizontal swipe on the card scrolls the
  // page to the next or previous stage's place, so scrolling stays the one source of truth.
  // ---------------------------------------------------------------------------------------------
  const list = document.querySelector('[data-clips]');
  if (!list || !('IntersectionObserver' in window)) return;
  const phone = matchMedia('(max-width: 40rem)');
  const items = [...list.querySelectorAll('.stage')];
  const N = items.length;
  const make = (tag, cls) => { const e = document.createElement(tag); e.className = cls; return e; };
  const track = make('div', 'stages-track');
  track.style.setProperty('--n', N);
  const pin = make('div', 'stages-pin');
  const bar = make('span', 'stages-pin__bar');
  const segs = make('div', 'stages-pin__segs');  // shown on phones only
  segs.setAttribute('aria-hidden', 'true');
  const texts = make('div', 'stages-pin__texts');
  const deck = make('div', 'stages-pin__deck');
  const btn = make('button', 'stages-pin__toggle');
  btn.type = 'button';
  btn.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path class="i-pause" d="M4.5 3h2.5v10H4.5zM9 3h2.5v10H9z"/><path class="i-play" d="M5 2.8v10.4L13 8z"/></svg>';
  const snaps = [];
  const stages = items.map((li, i) => {
    const text = li.querySelector('.stage__text');
    const media = li.querySelector('.stage__media');
    text.id = li.id;  // the stage anchors keep working
    text.dataset.of = N;  // phones show the stage as "3 / 7"
    texts.append(text);
    deck.append(media);
    const snap = make('span', 'stages-track__snap');
    snap.style.top = `calc(${i} * var(--step))`;
    track.append(snap);
    snaps.push(snap);
    const seg = make('span', 'stages-pin__seg');
    segs.append(seg);
    return { text, media, seg, v: media.querySelector('video'), img: media.querySelector('img') };
  });
  deck.append(btn);
  pin.append(bar, segs, texts, deck);
  track.append(pin);
  list.replaceWith(track);
  document.documentElement.classList.add('has-pin');

  let cur = -1;
  let inView = false;
  let held = reduce.matches;  // under reduced motion the clips wait for the button
  const sync = () => {
    stages.forEach((s, j) => {
      const run = j === cur && inView && !held && !document.hidden;
      if (run) { if (s.v.paused) s.v.play().catch(() => {}); }
      else if (!s.v.paused) s.v.pause();
    });
    btn.dataset.state = held ? 'paused' : 'playing';
    btn.setAttribute('aria-label', (held ? 'Play' : 'Pause') + ' stage ' + (cur + 1));
  };
  // the current segment follows its clip, one animation frame at a time and only while the clip plays
  let raf = 0;
  const fill = () => {
    raf = 0;
    const s = stages[cur];
    if (!s || !phone.matches) return;
    const d = s.v.duration;
    s.seg.style.setProperty('--f', d > 0 ? Math.min(1, s.v.currentTime / d).toFixed(4) : '0');
    if (!s.v.paused) raf = requestAnimationFrame(fill);
  };
  const tick = () => { if (!raf) raf = requestAnimationFrame(fill); };
  // the poster under a clip is lazy; the stages next to the current one load theirs, so a swipe shows them
  const poster = (s) => { if (s && s.img && s.img.loading === 'lazy') s.img.loading = 'eager'; };
  const warm = (s) => { if (!s) return; poster(s); if (s.v.preload !== 'auto') { s.v.preload = 'auto'; if (s.v.readyState === 0) s.v.load(); } };
  const show = (i) => {
    if (i === cur) return;
    cur = i;
    stages.forEach((s, j) => {
      s.media.classList.toggle('is-before', j < i);
      s.media.classList.toggle('is-after', j > i);
      s.text.classList.toggle('is-current', j === i);
      s.text.inert = j !== i;
      s.seg.classList.toggle('is-current', j === i);
      s.seg.style.setProperty('--f', j < i ? '1' : '0');
      if (j !== i && !s.v.paused) s.v.pause();
    });
    const s = stages[i];
    if (s.v.currentTime > 0) s.v.currentTime = 0;  // each stage starts its clip from the beginning
    if (inView) { warm(s); warm(stages[i + 1]); poster(stages[i - 1]); }
    sync();
    tick();
  };
  stages.forEach((s) => {
    s.v.addEventListener('playing', () => s.v.classList.add('is-shown'), { once: true });
    s.v.addEventListener('playing', () => { if (s === stages[cur]) tick(); });
  });
  btn.addEventListener('click', () => { held = !held; sync(); });

  // ---------------------------------------------------------------------------------------------
  // One stage per gesture, on every device (the owner's request, 2026-11-08): the page LOCKS inside the
  // deck. Fighting native scrolling did not work on real devices (a desktop browser's smooth wheel
  // scrolling, trackpad inertia and finger flings keep moving the page after the input), so while the
  // deck is in charge the page does not scroll natively at all: html gets .deck-locked (overflow hidden,
  // no overscroll), which also stops a smooth scroll or a fling under way, and the page is held at the
  // shown stage's place. Two states:
  //  FREE    native scrolling. Coming down across stage 1's place (or up across stage 7's), by any input,
  //          locks the page at stage 1 (or 7), wherever the gesture would have carried it.
  //  LOCKED  the wheel, vertical touch drags and the scroll keys are read as gestures; each new gesture
  //          moves one stage (a slide), at most one per STEP_MS. A gesture is new after a pause in the
  //          wheel, on a clear rise in its deltas (a new swipe during a trackpad's inertia), on a change
  //          of direction, or for each touch and key press. A new gesture down at stage 7 (or up at
  //          stage 1) unlocks and moves the page on; the rest of that gesture scrolls the page.
  // In-page links (the masthead, the hero's buttons) pass through the deck without locking, and so does
  // the page while a modal (the phone menu) is open.
  // ---------------------------------------------------------------------------------------------
  const root = document.documentElement;
  const STEP_MS = 900;    // the slide (700 ms in styles.css) and a margin
  const TOUCH_MS = 600;   // between two touch steps
  const KEY_MS = 350;     // between two key steps
  const QUIET_MS = 220;   // a pause in wheel events that ends a gesture
  let locked = false;
  let lastStep = -1e9;
  let lastWheel = -1e9;
  let lastDir = 0;
  const recent = [];      // the last wheel events' [time, size], for telling a new swipe from inertia
  let cool = null;        // after leaving the deck: { dir, until } (the rest of that gesture is the page's)
  let prevY = null;
  let navUntil = performance.now() + 1200;  // the browser restoring the scroll position on reload is not a gesture
  const stepPx = () => (snaps[1] ? snaps[1].offsetTop - snaps[0].offsetTop : innerHeight * 0.8);  // 80vh, as the CSS lays it out
  const trackTop = () => track.getBoundingClientRect().top + scrollY;
  const placeOf = (i) => trackTop() + snaps[i].offsetTop;
  const nearest = (y) => Math.max(0, Math.min(N - 1, Math.round((y - placeOf(0)) / stepPx())));
  const jump = (top) => scrollTo({ top: Math.round(top), behavior: 'auto' });
  const modal = () => root.classList.contains('is-locked') || !!document.querySelector('dialog[open]');
  const lock = (i) => {
    locked = true;
    cool = null;
    root.classList.add('deck-locked');
    lastStep = performance.now();
    show(i);
    jump(placeOf(i));
  };
  const unlock = () => { locked = false; root.classList.remove('deck-locked'); };
  // one gesture's worth of movement: the next stage, or out of the deck at its ends
  const move = (dir) => {
    const now = performance.now();
    lastStep = now;
    if ((dir > 0 && cur >= N - 1) || (dir < 0 && cur <= 0)) {
      unlock();
      cool = { dir, until: now + STEP_MS };
      scrollBy({ top: dir * 0.35 * innerHeight, behavior: reduce.matches ? 'auto' : 'smooth' });
      return;
    }
    show(cur + dir);
    jump(placeOf(cur));
  };

  const update = () => {
    const y = scrollY;
    const p0 = placeOf(0);
    const pN = placeOf(N - 1);
    pin.style.setProperty('--p', Math.max(0, Math.min(1, (y - p0) / (pN - p0))).toFixed(4));
    const now = performance.now();
    if (locked) {
      const off = Math.abs(y - placeOf(cur));
      if (off <= 2) { prevY = y; return; }
      // a script, find-in-page or the browser jumped the page away (user input cannot move it now): follow
      if (now < navUntil || modal() || off > stepPx() * 1.5) { unlock(); cool = { dir: 0, until: now + STEP_MS }; }
      else { jump(placeOf(cur)); prevY = placeOf(cur); return; }  // a fling the browser still delivers: hold
    }
    if (cool && now > cool.until) cool = null;
    const free = now < navUntil || modal() || prevY === null;
    if (!free) {
      if (prevY < p0 - 1 && y >= p0 - 1 && y <= pN + 1) { lock(0); prevY = scrollY; return; }       // in from above
      if (prevY > pN + 1 && y <= pN + 1 && y >= p0 - 1) { lock(N - 1); prevY = scrollY; return; }   // in from below
      if (!cool && y > p0 + 1 && y < pN - 1) { lock(nearest(y)); prevY = scrollY; return; }         // already inside
    }
    show(y < p0 ? 0 : y > pN ? N - 1 : nearest(y));
    prevY = y;
  };
  // a step asked for by a swipe on the card
  const go = (i) => {
    i = Math.max(0, Math.min(N - 1, i));
    if (i === cur || modal()) return;
    if (!locked) { lock(i); return; }
    const now = performance.now();
    if (now - lastStep < TOUCH_MS) return;
    lastStep = now;
    show(i);
    jump(placeOf(i));
  };
  const nav = () => { navUntil = performance.now() + 2500; if (locked) unlock(); };
  document.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('a[href^="#"]')) nav(); });
  addEventListener('hashchange', nav);
  // keyboard focus leaving the deck (Tab) takes the page with it
  document.addEventListener('focusin', (e) => { if (locked && !pin.contains(e.target)) { unlock(); cool = { dir: 0, until: performance.now() + STEP_MS }; } });

  // Phones: swipe left for the next stage, right for the previous one. A horizontal drag moves the clips
  // with the finger and, past 40 px, goes to the next stage; a shorter one springs back. Vertical drags
  // are the deck's gestures below (or the page's, when it is free).
  let drag = null;
  pin.addEventListener('pointerdown', (e) => {
    if (!phone.matches || e.pointerType === 'mouse' || !e.isPrimary || e.target.closest('button, a')) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, on: false };
  });
  pin.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.on) {
      if (Math.abs(dy) > 10 && Math.abs(dy) >= Math.abs(dx)) { drag = null; return; }
      if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      drag.on = true;
      deck.classList.add('is-dragging');
    }
    drag.dx = dx;
    const edge = (dx > 0 && cur === 0) || (dx < 0 && cur === N - 1);  // nothing beyond: resist
    deck.style.setProperty('--dx', `${Math.round(edge ? dx / 4 : dx)}px`);
  });
  const drop = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const { on, dx } = drag;
    drag = null;
    if (!on) return;
    deck.classList.remove('is-dragging');
    deck.style.removeProperty('--dx');
    if (e.type === 'pointerup' && Math.abs(dx) > 40) go(cur + (dx < 0 ? 1 : -1));
  };
  pin.addEventListener('pointerup', drop);
  pin.addEventListener('pointercancel', drop);

  const editing = (t) => t && t.closest && t.closest('input, textarea, select, [contenteditable], dialog[open]');

  // wheel: mouse notches, free-spinning wheels and trackpads (with their inertia)
  addEventListener('wheel', (e) => {
    if (e.ctrlKey) return;  // pinch-zoom
    const now = performance.now();
    const sideways = Math.abs(e.deltaX) > Math.abs(e.deltaY);
    const dir = sideways ? 0 : Math.sign(e.deltaY);
    const d = Math.abs(e.deltaY) * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1);
    const quiet = now - lastWheel;
    lastWheel = now;
    // a new swipe during a trackpad's inertia: the size jumps well above the tail's smallest recent event.
    // Even mouse notches and a free-spinning wheel (steady or slowly speeding up) never do that.
    while (recent.length && now - recent[0][0] > 200) recent.shift();
    const floor = recent.length >= 3 ? Math.min(...recent.map((r) => r[1])) : Infinity;
    const rising = d >= 16 && d > floor * 3 + 8;
    recent.push([now, d]);
    const fresh = quiet >= QUIET_MS || rising || (dir !== 0 && dir !== lastDir);
    if (dir) lastDir = dir;
    if (!locked) {
      if (!dir || now < navUntil || modal()) return;
      if (cool && now < cool.until && (cool.dir === dir || cool.dir === 0)) return;  // the leaving gesture goes on
      const y = scrollY;
      const p0 = placeOf(0);
      const pN = placeOf(N - 1);
      if (y > p0 + 1 && y < pN - 1) { e.preventDefault(); lock(nearest(y)); return; }  // the page sits inside the deck
      // this event would carry the page across the first (or last) stage's place: stop there
      if (dir > 0 && y < p0 - 1 && y + d >= p0 - 1) { e.preventDefault(); lock(0); return; }
      if (dir < 0 && y > pN + 1 && y - d <= pN + 1) { e.preventDefault(); lock(N - 1); return; }
      return;
    }
    e.preventDefault();
    if (!dir || !fresh || now - lastStep < STEP_MS) return;
    move(dir);
  }, { passive: false });

  // touch: a vertical drag that starts on the locked deck is one gesture, read when the finger lifts
  let touch = null;
  addEventListener('touchstart', (e) => {
    touch = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY, on: locked } : null;
  }, { passive: true });
  addEventListener('touchmove', (e) => {
    if (locked && e.cancelable) e.preventDefault();  // the page never pans while locked
  }, { passive: false });
  addEventListener('touchend', (e) => {
    const t = touch;
    touch = null;
    if (!t || !t.on || !locked) return;
    const p = e.changedTouches[0];
    const dy = t.y - p.clientY;  // positive: the finger went up, the page would go down
    const dx = p.clientX - t.x;
    if (Math.abs(dy) > 30 && Math.abs(dy) > Math.abs(dx) * 1.2 && performance.now() - lastStep >= TOUCH_MS) move(Math.sign(dy));
  }, { passive: true });
  addEventListener('touchcancel', () => { touch = null; }, { passive: true });

  // keys: one step per press while locked, auto-repeat ignored
  addEventListener('keydown', (e) => {
    if (!locked || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || editing(e.target)) return;
    const k = e.key;
    let dir = 0;
    if (k === 'ArrowDown' || k === 'PageDown' || (k === ' ' && !e.shiftKey)) dir = 1;
    else if (k === 'ArrowUp' || k === 'PageUp' || (k === ' ' && e.shiftKey)) dir = -1;
    else if (k === 'Home' || k === 'End') { unlock(); cool = { dir: k === 'End' ? 1 : -1, until: performance.now() + STEP_MS }; return; }
    if (!dir) return;
    if (k === ' ' && e.target.closest && e.target.closest('button, a, summary')) return;  // Space presses those
    e.preventDefault();
    if (!e.repeat && performance.now() - lastStep >= KEY_MS) move(dir);
  });

  // the pin is on screen: play; a screen before it: start loading the first clips
  new IntersectionObserver(([e]) => { inView = e.isIntersecting; if (inView) { warm(stages[cur]); warm(stages[cur + 1]); } sync(); }).observe(pin);
  new IntersectionObserver(([e]) => { if (e.isIntersecting) { warm(stages[cur]); } }, { rootMargin: '100% 0px 0px 0px' }).observe(track);
  let queued = false;
  addEventListener('scroll', () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; update(); });
  }, { passive: true });
  addEventListener('resize', () => { if (locked) jump(placeOf(cur)); update(); });
  document.addEventListener('visibilitychange', sync);
  reduce.addEventListener('change', () => { if (reduce.matches) held = true; sync(); });
  phone.addEventListener('change', tick);
  update();
})();
