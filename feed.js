/* Aio feed: Threads-style list of posted problems with Join, Like and Report. */
(() => {
  const A = window.Aio || {};
  const sb = A.sb;
  const $ = (s, r = document) => r.querySelector(s);
  const PAGE = 15;
  const COLS = 'id, author_id, author_name, is_sample, slogan, body, place, color, like_count, join_count, created_at';
  const AVATAR = ['#F89B44', '#FFD93B', '#8f9cff', '#0A07C0', '#ff8fb1', '#7ed6a5'];

  const list = $('#posts');
  const state = $('#feedState');
  const moreBtn = $('#feedMore');
  let offset = 0, ticket = 0;
  let liked = new Set(), joined = new Set();

  const user = () => A.getUser?.() || null;
  const needLogin = () => { A.openAuth?.('signup'); };
  const hue = s => AVATAR[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR.length];
  const ago = iso => {
    const s = (Date.now() - new Date(iso)) / 1000;
    if (s < 60) return 'now';
    if (s < 3600) return `${Math.floor(s / 60)}m`;
    if (s < 86400) return `${Math.floor(s / 3600)}h`;
    if (s < 604800) return `${Math.floor(s / 86400)}d`;
    return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  };
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const icon = path => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', '20'); s.setAttribute('height', '20'); s.setAttribute('aria-hidden', 'true'); s.innerHTML = path; return s; };
  const HEART = '<path d="M12 20.5s-7.5-4.6-9.3-9.1C1.5 8.2 3.6 4.5 7.2 4.5c2 0 3.6 1.1 4.8 2.8 1.2-1.7 2.8-2.8 4.8-2.8 3.6 0 5.7 3.7 4.5 6.9-1.8 4.5-9.3 9.1-9.3 9.1z" fill="var(--fill, none)" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>';
  const FLAG = '<path d="M5 21V4m0 0h11l-2 4 2 4H5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
  const PEOPLE = '<path d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zm-6 9c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5M16 4.5a3.3 3.3 0 0 1 0 6.4M18 14.8c1.9.7 3 2.5 3 5.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>';

  /* ---------- Render one post ---------- */
  const render = p => {
    const li = el('li', 'post');
    li.dataset.id = p.id;
    const av = el('span', 'avatar', (p.author_name || '?').trim()[0].toUpperCase());
    av.style.setProperty('--c', hue(p.author_name || '?'));
    av.setAttribute('aria-hidden', 'true');

    const main = el('div', 'post__main');
    const head = el('div', 'post__head');
    head.append(el('strong', 'post__name', p.author_name));
    if (p.is_sample) head.append(el('span', 'tag tag--sample', 'Sample'));
    head.append(el('span', 'tag', p.place));
    const t = el('time', 'post__time', ago(p.created_at)); t.dateTime = p.created_at; t.title = new Date(p.created_at).toLocaleString();
    head.append(t);

    const slogan = el('p', 'post__slogan', p.slogan);
    slogan.style.setProperty('--bg', p.color);
    const body = p.body ? el('p', 'post__body', p.body) : null;

    const actions = el('div', 'post__actions');
    // Join
    const join = el('button', 'btn btn--sm post__join');
    join.type = 'button';
    const setJoin = () => {
      const on = joined.has(p.id);
      join.classList.toggle('is-on', on);
      join.setAttribute('aria-pressed', String(on));
      join.replaceChildren(icon(PEOPLE), document.createTextNode(on ? ' Joined' : ' Join'), el('span', 'post__n', String(p.join_count)));
      join.setAttribute('aria-label', `${on ? 'Leave' : 'Join'} this protest, ${p.join_count} joined`);
    };
    setJoin();
    join.addEventListener('click', () => toggle('aio_joins', joined, p, 'join_count', setJoin, join));

    // Like
    const like = el('button', 'post__icon post__like');
    like.type = 'button';
    const setLike = () => {
      const on = liked.has(p.id);
      like.classList.toggle('is-on', on);
      like.setAttribute('aria-pressed', String(on));
      like.replaceChildren(icon(HEART), el('span', 'post__n', String(p.like_count)));
      like.setAttribute('aria-label', `${on ? 'Unlike' : 'Like'}, ${p.like_count} likes`);
    };
    setLike();
    like.addEventListener('click', () => toggle('aio_likes', liked, p, 'like_count', setLike, like));

    actions.append(join, like);

    // Report (or delete for your own post)
    const mine = user() && p.author_id === user().id;
    const rep = el('button', 'post__icon post__report');
    rep.type = 'button';
    const resetRep = () => { rep.dataset.confirm = ''; rep.classList.remove('is-confirm'); rep.replaceChildren(icon(FLAG), el('span', 'post__label', mine ? 'Delete' : 'Report')); rep.setAttribute('aria-label', mine ? 'Delete your post' : 'Report this post'); };
    resetRep();
    rep.addEventListener('click', async () => {
      if (!user()) return needLogin();
      if (String(p.id).startsWith('sample-')) return flash(li, 'This is an example post. Real posts load on the live site.');
      if (rep.dataset.confirm !== '1') {
        rep.dataset.confirm = '1'; rep.classList.add('is-confirm');
        rep.replaceChildren(icon(FLAG), el('span', 'post__label', mine ? 'Tap again to delete' : 'Tap again to report'));
        setTimeout(() => { if (rep.isConnected && rep.dataset.confirm === '1') resetRep(); }, 3500);
        return;
      }
      rep.disabled = true;
      const { error } = mine
        ? await sb.from('aio_posts').delete().eq('id', p.id)
        : await sb.from('aio_reports').insert({ post_id: p.id });
      if (error && error.code !== '23505') { rep.disabled = false; resetRep(); return flash(li, 'Could not send that. Try again.'); }
      li.classList.add('is-gone');
      li.replaceChildren(el('p', 'post__gone', mine ? 'Your post was deleted.' : 'Thanks. This post is hidden while Aio reviews it.'));
    });
    actions.append(rep);

    main.append(head, slogan);
    if (body) main.append(body);
    main.append(actions);
    li.append(av, main);
    return li;
  };

  const flash = (li, msg) => {
    let n = li.querySelector('.post__flash');
    if (!n) { n = el('p', 'post__flash'); n.setAttribute('role', 'status'); li.querySelector('.post__main').append(n); }
    n.textContent = msg; setTimeout(() => n.remove(), 3500);
  };

  // Optimistic like/join toggle
  const toggle = async (table, set, p, key, paint, btn) => {
    if (!user()) return needLogin();
    if (String(p.id).startsWith('sample-')) return flash(btn.closest('.post'), 'This is an example post. Real posts load on the live site.');
    const on = set.has(p.id);
    on ? set.delete(p.id) : set.add(p.id);
    p[key] += on ? -1 : 1; paint();
    if (!on) { btn.classList.remove('is-pop'); void btn.offsetWidth; btn.classList.add('is-pop'); }
    const { error } = on
      ? await sb.from(table).delete().eq('post_id', p.id).eq('user_id', user().id)
      : await sb.from(table).insert({ post_id: p.id });
    if (error && error.code !== '23505') {
      on ? set.add(p.id) : set.delete(p.id);
      p[key] += on ? 1 : -1; paint();
      flash(btn.closest('.post'), 'Could not save that. Check your connection.');
    }
  };

  /* ---------- Built-in samples: shown whenever the live feed can't be reached ---------- */
  const H = 3600e3;
  const SAMPLES = [
    ['Keep the library open till 10', 'Our library closes at 6pm during exam season. Most of us work after class and have nowhere quiet to study at night.', 'College', '#FFD93B', 48, 23, 2],
    ['Fix the broken heaters', 'Three classrooms in the B block have had no heating since November. We are sitting in coats for six hours a day.', 'School', '#ffffff', 31, 17, 5],
    ['Pay us for overtime', 'Shift leads keep asking us to stay 30 minutes late to close up, but it never shows up on our payslips.', 'Workplace', '#0A07C0', 92, 40, 9],
    ['Real food in the canteen', 'Prices went up 20% this term and the portions got smaller. Students on a budget are skipping lunch.', 'School', '#FFD93B', 64, 29, 24],
    ['Water fountains that work', 'Only one of the five water fountains on campus works. Bottled water from the vending machine costs 2 dollars.', 'College', '#ffffff', 27, 12, 28],
    ['Breaks are a right', 'We get one 10-minute break in an 8-hour shift. The law says we should get more, and managers know it.', 'Workplace', '#ffffff', 110, 57, 48],
    ['Safe crossing at the gate', 'Cars speed past the main school gate every morning. We need a crossing guard or a zebra crossing before someone gets hurt.', 'School', '#0A07C0', 73, 38, 54],
    ['Publish the grading rubric', 'Our final project is worth 40% of the grade and nobody has seen how it is marked. We just want it written down.', 'College', '#FFD93B', 39, 21, 72],
    ['Schedules a week ahead', 'We find out our shifts the night before. Nobody can plan childcare, classes, or a second job like that.', 'Workplace', '#FFD93B', 85, 44, 96],
    ['Open the gym after school', 'The gym sits locked from 3pm. Clubs and teams have nowhere to practise, so they train in the car park.', 'School', '#ffffff', 22, 9, 120],
  ].map(([slogan, body, place, color, like_count, join_count, hrs], i) => ({
    id: `sample-${i}`, author_id: null, author_name: 'Aio team', is_sample: true, slogan, body, place, color, like_count, join_count,
    created_at: new Date(Date.now() - hrs * H).toISOString(),
  }));
  const showSamples = () => {
    list.replaceChildren(...SAMPLES.map(render));
    list.setAttribute('aria-busy', 'false');
    state.textContent = '';
    moreBtn.hidden = true;
  };

  /* ---------- Load ---------- */
  const load = async (reset = false) => {
    if (!sb) return showSamples();
    if (reset) { offset = 0; list.replaceChildren(); }
    const mine = ++ticket;
    list.setAttribute('aria-busy', 'true');
    moreBtn.hidden = true;
    state.textContent = offset ? '' : 'Loading the feed…';
    const { data, error } = await sb.from('aio_posts').select(COLS).eq('hidden', false)
      .order('created_at', { ascending: false }).range(offset, offset + PAGE - 1);
    if (mine !== ticket) return; // a newer load replaced this one
    list.setAttribute('aria-busy', 'false');
    if (error) { if (!offset) showSamples(); return; }
    if (user() && data.length) {
      const ids = data.map(p => p.id);
      const [l, j] = await Promise.all([
        sb.from('aio_likes').select('post_id').in('post_id', ids),
        sb.from('aio_joins').select('post_id').in('post_id', ids),
      ]);
      (l.data || []).forEach(r => liked.add(r.post_id));
      (j.data || []).forEach(r => joined.add(r.post_id));
    }
    if (!offset && !data.length) return showSamples();
    data.forEach(p => list.append(render(p)));
    offset += data.length;
    state.textContent = list.children.length ? '' : 'No problems posted yet. Be the first to speak up.';
    moreBtn.hidden = data.length < PAGE;
  };
  moreBtn.addEventListener('click', () => load());

  /* ---------- Composer ---------- */
  const form = $('#composeForm');
  const slogan = $('#composeSlogan');
  const body = $('#composeBody');
  const more = $('#composeMore');
  const err = $('#composeErr');
  const left = $('#composeLeft');
  const btn = $('#composeBtn');
  let color = '#ffffff';

  const paintWho = () => {
    const u = user();
    const name = u?.user_metadata?.display_name || u?.email?.split('@')[0] || '';
    $('#composeWho').textContent = u ? name : 'Log in to post a problem';
    const av = $('#composeAvatar');
    av.textContent = u ? name[0].toUpperCase() : '?';
    av.style.setProperty('--c', u ? hue(name) : '#fff');
  };
  slogan.addEventListener('focus', () => { if (!user()) { slogan.blur(); return needLogin(); } more.hidden = false; });
  body.addEventListener('input', () => { left.textContent = 280 - body.value.length; });
  form.addEventListener('submit', async e => {
    e.preventDefault();
    err.textContent = '';
    if (!user()) return needLogin();
    const s = slogan.value.trim();
    if (s.length < 3) { err.textContent = 'Write the problem in at least 3 characters.'; slogan.focus(); return; }
    const bad = window.AioFilter?.check(s) || window.AioFilter?.check(body.value);
    if (bad) { err.textContent = bad.message; (window.AioFilter.check(s) ? slogan : body).focus(); return; }
    btn.disabled = true; btn.textContent = 'Posting…';
    const place = form.querySelector('input[name="cplace"]:checked').value;
    const { error } = await sb.from('aio_posts').insert({ slogan: s, body: body.value.trim(), place, color });
    btn.disabled = false; btn.textContent = 'Post';
    if (error) { err.textContent = error.message.includes('aio_filter') ? window.AioFilter.MESSAGES.offensive : error.message.includes('limit') ? error.message : 'Could not post that. Try again.'; return; }
    slogan.value = ''; body.value = ''; left.textContent = '280'; color = '#ffffff'; more.hidden = true;
    await load(true);
    list.firstElementChild?.classList.add('is-new');
  });

  // Called from the drafts panel: prefill the composer with a draft.
  A.composeFrom = d => {
    document.getElementById('feed').scrollIntoView({ behavior: 'smooth' });
    if (!user()) return setTimeout(needLogin, 400);
    slogan.value = d.slogan; color = d.color || '#ffffff';
    const r = form.querySelector(`input[name="cplace"][value="${d.place}"]`); if (r) r.checked = true;
    more.hidden = false;
    setTimeout(() => body.focus({ preventScroll: true }), 600);
  };

  document.addEventListener('aio:user', () => { liked = new Set(); joined = new Set(); paintWho(); load(true); });
  paintWho();

  // Load when the feed first comes near the screen.
  const io = new IntersectionObserver(en => { if (en[0].isIntersecting) { io.disconnect(); load(true); } }, { rootMargin: '600px 0px' });
  io.observe(document.getElementById('feed'));
})();
