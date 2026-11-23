(() => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ---------- Nav: solid on scroll, mobile menu, current link ---------- */
  const nav = $('#nav');
  const hero = $('.hero');
  const burger = $('#burger');
  const onScrollNav = () => nav.classList.toggle('is-solid', window.scrollY > hero.offsetHeight - 80);
  onScrollNav();
  window.addEventListener('scroll', onScrollNav, { passive: true });

  const closeMenu = () => { nav.classList.remove('is-open'); burger.setAttribute('aria-expanded', 'false'); burger.setAttribute('aria-label', 'Open menu'); };
  burger.addEventListener('click', () => {
    const open = !nav.classList.contains('is-open');
    nav.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  });
  $$('#navLinks a').forEach(a => a.addEventListener('click', closeMenu));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });

  const navMap = new Map($$('#navLinks a').map(a => [a.getAttribute('href').slice(1), a]));
  const secObs = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      navMap.forEach(a => a.classList.remove('is-current'));
      navMap.get(en.target.id)?.classList.add('is-current');
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  navMap.forEach((_, id) => { const el = document.getElementById(id); if (el) secObs.observe(el); });

  /* ---------- Reveal on scroll ---------- */
  const revealObs = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (en.isIntersecting) { en.target.classList.add('is-in'); revealObs.unobserve(en.target); }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
  $$('.reveal, .fan, .hl, .browser--hero').forEach(el => revealObs.observe(el));

  /* ---------- Count-up ---------- */
  const countObs = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      const el = en.target, to = +el.dataset.to;
      countObs.unobserve(el);
      if (reduce) { el.textContent = to; return; }
      const t0 = performance.now(), dur = 1600;
      const tick = now => {
        const p = Math.min(1, (now - t0) / dur);
        el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(tick);
      };
      setTimeout(() => requestAnimationFrame(tick), 500);
    });
  }, { threshold: 0.5 });
  $$('.count').forEach(el => countObs.observe(el));

  /* ---------- Hero parallax + magnetic buttons (fine pointers only) ---------- */
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (!reduce && finePointer) {
    const stage = $('#heroStage');
    const stickers = $$('[data-depth]', stage);
    let raf = 0, mx = 0, my = 0;
    hero.addEventListener('pointermove', e => {
      mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5;
      if (!raf) raf = requestAnimationFrame(() => {
        stickers.forEach(s => { const d = +s.dataset.depth; s.style.transform = `translate(${mx * d}px, ${my * d}px)`; });
        raf = 0;
      });
    });

    $$('.magnetic').forEach(btn => {
      btn.addEventListener('pointermove', e => {
        const r = btn.getBoundingClientRect();
        const x = (e.clientX - r.left - r.width / 2) * 0.18, y = (e.clientY - r.top - r.height / 2) * 0.25;
        btn.style.translate = `${x}px ${y}px`;
      });
      btn.addEventListener('pointerleave', () => { btn.style.translate = ''; });
    });
  }

  /* ---------- Demo: gather voices -> vote leader ---------- */
  const COLORS = ['#F89B44', '#FFD93B', '#8f9cff', '#ffffff', '#0A07C0'];
  const GOAL = 10;
  const demo = {
    count: 0,
    crowd: $('#demoCrowd'), meter: $('#demoMeter'), countEl: $('#demoCount'),
    step: $('#demoStep'), agree: $('#demoAgree'),
    panels: { gather: $('#demoGather'), vote: $('#demoVote'), done: $('#demoDone') },
  };
  const showPanel = name => {
    Object.entries(demo.panels).forEach(([k, el]) => el.classList.toggle('is-active', k === name));
    demo.step.textContent = name === 'gather' ? 'Step 1 of 2 · Gather' : name === 'vote' ? 'Step 2 of 2 · Vote' : 'Done · Leader chosen';
  };
  demo.agree.addEventListener('click', () => {
    if (demo.count >= GOAL) return;
    const add = demo.count === 0 ? 1 : Math.min(GOAL - demo.count, 1 + Math.floor(Math.random() * 2));
    for (let i = 0; i < add; i++) {
      const s = document.createElement('span');
      s.style.setProperty('--c', COLORS[(demo.count + i) % COLORS.length]);
      demo.crowd.appendChild(s);
    }
    demo.count += add;
    demo.countEl.textContent = demo.count;
    demo.meter.style.setProperty('--p', demo.count / GOAL);
    if (demo.count >= GOAL) {
      demo.agree.disabled = true;
      setTimeout(() => { showPanel('vote'); $('.cand', demo.panels.vote)?.focus({ preventScroll: true }); }, reduce ? 0 : 700);
    }
  });
  $$('.cand').forEach(b => b.addEventListener('click', () => {
    $('#demoLeader').textContent = b.dataset.name;
    showPanel('done');
    $('#demoReset').focus({ preventScroll: true });
  }));
  $('#demoReset').addEventListener('click', () => {
    demo.count = 0; demo.crowd.innerHTML = ''; demo.countEl.textContent = '0';
    demo.meter.style.setProperty('--p', 0); demo.agree.disabled = false;
    showPanel('gather'); demo.agree.focus({ preventScroll: true });
  });

  /* ---------- How it works: active step drives sticky screen ---------- */
  const steps = $$('.step');
  const screens = $$('.screen');
  const howUrl = $('#howUrl');
  const urls = ['aio · new protest', 'aio · protests / library-hours', 'aio · library-hours / vote', 'aio · library-hours / plan', 'aio · library-hours / meet-up'];
  const setStep = i => {
    steps.forEach((s, k) => s.classList.toggle('is-active', k === i));
    screens.forEach((s, k) => s.classList.toggle('is-active', k === i));
    howUrl.textContent = urls[i];
  };
  // A step only takes over once its top edge reaches the middle of the screen,
  // i.e. once the previous step has scrolled up to the centre line.
  let curStep = -1, stepRaf = 0;
  const updateSteps = () => {
    stepRaf = 0;
    const mid = innerHeight / 2;
    let i = 0;
    steps.forEach((s, k) => { if (s.getBoundingClientRect().top <= mid) i = k; });
    if (i !== curStep) { curStep = i; setStep(i); }
  };
  window.addEventListener('scroll', () => { if (!stepRaf) stepRaf = requestAnimationFrame(updateSteps); }, { passive: true });
  window.addEventListener('resize', updateSteps);
  updateSteps();

  /* ---------- Flip cards ---------- */
  $$('.flip').forEach(card => card.addEventListener('click', () => {
    card.setAttribute('aria-pressed', String(card.getAttribute('aria-pressed') !== 'true'));
  }));

  /* ---------- Story: pinned horizontal scroll ---------- */
  const story = $('#story');
  const track = $('#storyTrack');
  const line = $('#storyLine');
  const desktopMQ = window.matchMedia('(min-width: 881px)');
  let distance = 0;
  const sizeStory = () => {
    if (!desktopMQ.matches || reduce) { story.style.height = ''; track.style.transform = ''; line.style.transform = ''; return; }
    distance = Math.max(0, track.scrollWidth - innerWidth);
    story.style.height = `${innerHeight + distance}px`;
    updateStory();
  };
  const updateStory = () => {
    if (!desktopMQ.matches || reduce) return;
    const r = story.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, -r.top / (story.offsetHeight - innerHeight || 1)));
    track.style.transform = `translate3d(${-p * distance}px,0,0)`;
    line.style.transform = `scaleX(${p})`;
  };
  window.addEventListener('scroll', () => requestAnimationFrame(updateStory), { passive: true });
  window.addEventListener('resize', sizeStory);
  desktopMQ.addEventListener?.('change', sizeStory);
  window.addEventListener('load', sizeStory);
  document.fonts?.ready.then(sizeStory);
  sizeStory();

  /* ---------- Start form + live sign ---------- */
  const form = $('#startForm');
  const slogan = $('#slogan');
  const left = $('#sloganLeft');
  const err = $('#sloganErr');
  const ok = $('#formOk');
  const signText = $('#signText');
  const signWhere = $('#signWhere');
  const board = $('#signBoard');
  const DEFAULT = 'Make it louder';
  const MAX = +slogan.maxLength;

  const contrastFor = bg => (bg.toLowerCase() === '#0a07c0' ? '#ffffff' : '#0B0A1F');
  const render = () => {
    const v = slogan.value.trim();
    signText.textContent = v || DEFAULT;
    left.textContent = MAX - slogan.value.length;
  };
  slogan.addEventListener('input', () => {
    render();
    if (slogan.getAttribute('aria-invalid') === 'true' && slogan.value.trim()) { slogan.removeAttribute('aria-invalid'); err.textContent = ''; }
  });
  slogan.addEventListener('blur', () => {
    if (slogan.value && slogan.value.trim().length < 3) { slogan.setAttribute('aria-invalid', 'true'); err.textContent = 'Make your slogan at least 3 characters so people can read it.'; return; }
    const bad = window.AioFilter?.check(slogan.value);
    if (bad) { slogan.setAttribute('aria-invalid', 'true'); err.textContent = bad.message; }
  });
  form.addEventListener('change', e => {
    if (e.target.name === 'where') signWhere.textContent = e.target.value;
    if (e.target.name === 'color') { board.style.setProperty('--sign-bg', e.target.value); board.style.setProperty('--sign-fg', contrastFor(e.target.value)); }
    signText.classList.remove('is-pop'); void signText.offsetWidth; signText.classList.add('is-pop');
  });
  form.addEventListener('submit', e => {
    e.preventDefault();
    ok.textContent = '';
    const v = slogan.value.trim();
    if (v.length < 3) {
      slogan.setAttribute('aria-invalid', 'true');
      err.textContent = v ? 'Make your slogan at least 3 characters so people can read it.' : 'Write a slogan first. What do you want them to hear?';
      slogan.focus();
      return;
    }
    const bad = window.AioFilter?.check(v);
    if (bad) { slogan.setAttribute('aria-invalid', 'true'); err.textContent = bad.message; slogan.focus(); return; }
    const btn = $('#startBtn');
    const label = btn.textContent;
    btn.disabled = true; btn.textContent = 'Saving…';
    const draft = { id: editingId, slogan: v, place: form.where.value, color: form.color.value };
    window.Aio.saveDraft(draft).then(res => {
      editingId = res.draft.id;
      btn.textContent = 'Save changes';
      ok.textContent = res.synced
        ? `"${v}" is saved to your drafts.`
        : `"${v}" is saved to your drafts on this device. Log in to keep it everywhere.`;
    }).catch(e2 => {
      btn.textContent = label;
      ok.textContent = '';
      err.textContent = e2.message || 'Could not save your draft. Try again.';
    }).finally(() => { btn.disabled = false; });
  });

  /* Load a draft back into the form (called from the drafts panel) */
  let editingId = null;
  const fillForm = d => {
    editingId = d?.id || null;
    slogan.value = d?.slogan || '';
    const place = d?.place || 'School', color = d?.color || '#ffffff';
    const w = form.querySelector(`input[name="where"][value="${place}"]`); if (w) w.checked = true;
    const c = form.querySelector(`input[name="color"][value="${color}"]`); if (c) c.checked = true;
    signWhere.textContent = place;
    board.style.setProperty('--sign-bg', color); board.style.setProperty('--sign-fg', contrastFor(color));
    $('#startBtn').textContent = editingId ? 'Save changes' : 'Create my protest';
    ok.textContent = ''; err.textContent = ''; slogan.removeAttribute('aria-invalid');
    render();
  };
  window.Aio.fillForm = fillForm;
  window.Aio.isEditing = id => id === editingId;
  window.Aio.stopEditing = () => { editingId = null; $('#startBtn').textContent = 'Create my protest'; };
  render();
})();
