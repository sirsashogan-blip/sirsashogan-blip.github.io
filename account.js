/* Aio accounts + drafts
 * - Sign up / log in with a 6-digit email code (no passwords) behind a Cloudflare Turnstile bot check.
 * - Drafts live in Supabase when logged in, or on this device when not; local drafts move to the
 *   account on first login.
 */
(() => {
  const SUPABASE_URL = 'https://zwnqtohgsxjlwlmbmnbl.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_R4BijYAOQQX3KvTDwkuT-g_CNW63NoH';
  // Cloudflare's public "always passes" test key. Replace with your own Turnstile site key.
  const TURNSTILE_SITEKEY = '1x00000000000000000000AA';
  const LOCAL_KEY = 'aio:drafts';
  const RESEND_SECONDS = 60;
  const DISPOSABLE = ['mailinator.com', 'guerrillamail.com', '10minutemail.com', 'tempmail.com', 'temp-mail.org', 'yopmail.com',
    'trashmail.com', 'sharklasers.com', 'getnada.com', 'dispostable.com', 'maildrop.cc', 'throwawaymail.com', 'fakeinbox.com', 'mailnesia.com'];

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const sb = window.supabase?.createClient ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

  let user = null;
  let drafts = [];

  /* ---------- Local storage helpers ---------- */
  const readLocal = () => {
    try {
      let list = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
      const old = JSON.parse(localStorage.getItem('aio:draft') || 'null'); // single draft from the earlier version
      if (old?.slogan) {
        list.unshift({ id: 'l' + Date.now(), slogan: old.slogan, place: old.where || 'School', color: old.color || '#ffffff', updated_at: old.created || new Date().toISOString() });
        localStorage.removeItem('aio:draft');
        localStorage.setItem(LOCAL_KEY, JSON.stringify(list));
      }
      return Array.isArray(list) ? list : [];
    } catch (_) { return []; }
  };
  const writeLocal = list => { try { localStorage.setItem(LOCAL_KEY, JSON.stringify(list)); } catch (_) { /* storage unavailable */ } };

  /* ---------- Drafts API (used by main.js) ---------- */
  const COLS = 'id, slogan, place, color, updated_at';
  const loadDrafts = async () => {
    if (user && sb) {
      const { data, error } = await sb.from('aio_drafts').select(COLS).order('updated_at', { ascending: false });
      drafts = error ? [] : data;
    } else {
      drafts = readLocal().sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    }
    renderDrafts();
  };

  const saveDraft = async d => {
    const row = { slogan: d.slogan, place: d.place, color: d.color };
    if (user && sb) {
      const isRemote = d.id && !String(d.id).startsWith('l');
      const q = isRemote
        ? sb.from('aio_drafts').update(row).eq('id', d.id).select(COLS).single()
        : sb.from('aio_drafts').insert(row).select(COLS).single();
      const { data, error } = await q;
      if (error) throw new Error(error.message.includes('limit') ? error.message : 'Could not save your draft. Check your connection and try again.');
      await loadDrafts();
      return { draft: data, synced: true };
    }
    const list = readLocal();
    const now = new Date().toISOString();
    let saved = list.find(x => x.id === d.id);
    if (saved) Object.assign(saved, row, { updated_at: now });
    else { saved = { id: 'l' + Date.now(), ...row, updated_at: now }; list.unshift(saved); }
    writeLocal(list.slice(0, 50));
    await loadDrafts();
    return { draft: saved, synced: false };
  };

  const deleteDraft = async id => {
    if (user && sb) {
      const { error } = await sb.from('aio_drafts').delete().eq('id', id);
      if (error) throw new Error('Could not delete that draft. Try again.');
    } else {
      writeLocal(readLocal().filter(x => x.id !== id));
    }
    if (window.Aio.isEditing?.(id)) window.Aio.stopEditing?.();
    await loadDrafts();
  };

  // Move drafts made while logged out into the account.
  const syncLocalUp = async () => {
    const local = readLocal();
    if (!local.length || !user || !sb) return;
    const { error } = await sb.from('aio_drafts').insert(local.map(({ slogan, place, color }) => ({ slogan, place, color })));
    if (!error) writeLocal([]);
  };

  window.Aio = {
    saveDraft, deleteDraft, sb,
    openDrafts: () => openDrawer(),
    openAuth: m => openAuth(m),
    getUser: () => user,
  };

  /* ---------- Drafts drawer ---------- */
  const drawer = $('#draftsDrawer');
  const list = $('#draftsList');
  const empty = $('#draftsEmpty');
  const where = $('#draftsWhere');
  const ago = iso => {
    const s = (Date.now() - new Date(iso)) / 1000;
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)} min ago`;
    if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
    return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  };
  const fg = c => (c.toLowerCase() === '#0a07c0' ? '#fff' : '#0B0A1F');

  function renderDrafts() {
    $$('[data-drafts-count]').forEach(el => { el.textContent = drafts.length; });
    where.textContent = user ? `Saved to ${user.email}` : 'Saved on this device. Log in to keep them on every device.';
    $('#draftsLogin').hidden = !!user;
    empty.hidden = drafts.length > 0;
    list.replaceChildren(...drafts.map(d => {
      const li = document.createElement('li');
      li.className = 'draft';
      const sign = document.createElement('div');
      sign.className = 'draft__sign';
      sign.style.setProperty('--bg', d.color); sign.style.setProperty('--fg', fg(d.color));
      const txt = document.createElement('p'); txt.textContent = d.slogan; sign.append(txt);
      const meta = document.createElement('p');
      meta.className = 'draft__meta';
      meta.textContent = `${d.place} · ${ago(d.updated_at)}`;
      const row = document.createElement('div');
      row.className = 'draft__actions';
      const open = document.createElement('button');
      open.type = 'button'; open.className = 'btn btn--sm btn--orange'; open.textContent = 'Open';
      open.setAttribute('aria-label', `Open draft: ${d.slogan}`);
      open.addEventListener('click', () => {
        window.Aio.fillForm?.(d);
        closeDrawer();
        document.getElementById('start').scrollIntoView({ behavior: 'smooth' });
        setTimeout(() => $('#slogan').focus({ preventScroll: true }), 500);
      });
      const del = document.createElement('button');
      del.type = 'button'; del.className = 'btn btn--sm'; del.textContent = 'Delete';
      del.setAttribute('aria-label', `Delete draft: ${d.slogan}`);
      del.addEventListener('click', async () => {
        if (del.dataset.confirm !== '1') {
          del.dataset.confirm = '1'; del.textContent = 'Tap again to delete'; del.classList.add('btn--danger');
          setTimeout(() => { if (del.isConnected) { del.dataset.confirm = ''; del.textContent = 'Delete'; del.classList.remove('btn--danger'); } }, 3500);
          return;
        }
        del.disabled = true;
        try { await deleteDraft(d.id); } catch (e) { del.disabled = false; alertIn(where, e.message); }
      });
      const post = document.createElement('button');
      post.type = 'button'; post.className = 'btn btn--sm btn--ink'; post.textContent = 'Post to feed';
      post.setAttribute('aria-label', `Post to feed: ${d.slogan}`);
      post.addEventListener('click', () => { closeDrawer(); window.Aio.composeFrom?.(d); });
      row.append(open, post, del);
      li.append(sign, meta, row);
      return li;
    }));
  }
  const alertIn = (el, msg) => { el.textContent = msg; };

  let lastFocus = null;
  function openDrawer() {
    lastFocus = document.activeElement;
    loadDrafts();
    drawer.showModal();
  }
  function closeDrawer() { drawer.close(); }
  drawer.addEventListener('close', () => lastFocus?.focus?.({ preventScroll: true }));
  $$('[data-open="drafts"]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); openDrawer(); }));
  $('#draftsNew').addEventListener('click', () => {
    window.Aio.fillForm?.(null); closeDrawer();
    document.getElementById('start').scrollIntoView({ behavior: 'smooth' });
    setTimeout(() => $('#slogan').focus({ preventScroll: true }), 500);
  });
  $('#draftsLogin').addEventListener('click', () => { closeDrawer(); openAuth('login'); });

  /* ---------- Auth modal ---------- */
  const modal = $('#authModal');
  const emailForm = $('#authEmailForm');
  const codeForm = $('#authCodeForm');
  const doneView = $('#authDone');
  const nameField = $('#authNameField');
  const emailIn = $('#authEmail');
  const nameIn = $('#authName');
  const rulesIn = $('#authRules');
  const codeIn = $('#authCode');
  const emailErr = $('#authEmailErr');
  const codeErr = $('#authCodeErr');
  const sendBtn = $('#authSend');
  const resendBtn = $('#authResend');
  let mode = 'login', pendingEmail = '', widgetId = null, captchaToken = null, resendTimer = 0;

  const COPY = {
    login: { title: 'Welcome back.', sub: 'Log in to see your drafts on any device.', send: 'Log in' },
    signup: { title: 'Join the crowd.', sub: 'Make an account to keep your protests in one place.', send: 'Create account' },
  };

  const setMode = m => {
    mode = m;
    $$('.auth__tab').forEach(t => { const on = t.dataset.mode === m; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; });
    $('#authTitle').textContent = COPY[m].title;
    $('#authSub').textContent = COPY[m].sub;
    sendBtn.textContent = COPY[m].send;
    nameField.hidden = m !== 'signup';
    $('#authRulesField').hidden = m !== 'signup';
    nameIn.required = m === 'signup';
    emailErr.textContent = '';
  };
  const show = view => {
    emailForm.hidden = view !== 'email';
    codeForm.hidden = view !== 'code';
    doneView.hidden = view !== 'done';
    $('#authTabs').hidden = view === 'done';
    if (view === 'done') { $('#authTitle').textContent = 'You\'re in.'; $('#authSub').textContent = ''; }
  };

  const renderCaptcha = () => {
    if (!window.turnstile || widgetId !== null) return;
    widgetId = window.turnstile.render('#authCaptcha', {
      sitekey: TURNSTILE_SITEKEY, theme: 'light', appearance: 'interaction-only',
      callback: t => { captchaToken = t; },
      'expired-callback': () => { captchaToken = null; },
      'error-callback': () => { captchaToken = null; },
    });
  };
  const resetCaptcha = () => { captchaToken = null; if (window.turnstile && widgetId !== null) window.turnstile.reset(widgetId); };

  function openAuth(m) {
    lastFocus = document.activeElement;
    if (user) { show('done'); }
    else { setMode(m || 'login'); show('email'); }
    modal.showModal();
    renderCaptcha();
    (user ? $('#authLogout') : (mode === 'signup' ? nameIn : emailIn)).focus();
  }
  modal.addEventListener('close', () => lastFocus?.focus?.({ preventScroll: true }));
  window.onAioTurnstile = renderCaptcha; // Turnstile's onload callback

  $$('.auth__tab').forEach(t => t.addEventListener('click', () => setMode(t.dataset.mode)));
  $('#authTabs').addEventListener('keydown', e => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const next = mode === 'login' ? 'signup' : 'login';
    setMode(next); $(`.auth__tab[data-mode="${next}"]`).focus();
  });
  $$('[data-open="auth"]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); openAuth(b.dataset.mode); }));
  $$('[data-close]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
  [modal, drawer].forEach(d => d.addEventListener('click', e => { if (e.target === d) d.close(); }));

  const fail = (el, input, msg) => { el.textContent = msg; if (input) { input.setAttribute('aria-invalid', 'true'); input.focus(); } };
  [emailIn, nameIn, codeIn].forEach(i => i.addEventListener('input', () => i.removeAttribute('aria-invalid')));

  const startResendTimer = () => {
    let left = RESEND_SECONDS;
    resendBtn.disabled = true;
    clearInterval(resendTimer);
    const tick = () => { resendBtn.textContent = left > 0 ? `Resend code in ${left}s` : 'Resend code'; if (left-- <= 0) { clearInterval(resendTimer); resendBtn.disabled = false; } };
    tick(); resendTimer = setInterval(tick, 1000);
  };

  const sendCode = async () => {
    const { error } = await sb.auth.signInWithOtp({
      email: pendingEmail,
      options: {
        shouldCreateUser: mode === 'signup',
        data: mode === 'signup' ? { display_name: nameIn.value.trim() } : undefined,
        captchaToken: captchaToken || undefined,
        emailRedirectTo: location.origin + location.pathname,
      },
    });
    resetCaptcha();
    return error;
  };

  emailForm.addEventListener('submit', async e => {
    e.preventDefault();
    emailErr.textContent = '';
    if ($('#authHp').value) { show('code'); return; } // honeypot: bots fill hidden fields
    const email = emailIn.value.trim().toLowerCase();
    if (mode === 'signup' && nameIn.value.trim().length < 2) return fail(emailErr, nameIn, 'Add your name (at least 2 letters) so your group knows who you are.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return fail(emailErr, emailIn, 'That email doesn\'t look right. Check it and try again.');
    if (DISPOSABLE.includes(email.split('@')[1])) return fail(emailErr, emailIn, 'Throwaway email addresses can\'t join Aio. Use an email you check.');
    if (mode === 'signup' && !rulesIn.checked) return fail(emailErr, rulesIn, 'Please agree to keep protests peaceful before joining.');
    if (!sb) return fail(emailErr, null, 'We couldn\'t reach the sign-in service. Check your connection and refresh.');

    const passIn = $('#authPass');
    const password = passIn.value;
    if (password.length < 8) return fail(emailErr, passIn, 'Your password needs at least 8 characters.');

    sendBtn.disabled = true; sendBtn.textContent = mode === 'signup' ? 'Creating…' : 'Logging in…';
    const opts = { captchaToken: captchaToken || undefined };
    const { data, error } = mode === 'signup'
      ? await sb.auth.signUp({ email, password, options: { ...opts, data: { display_name: nameIn.value.trim() } } })
      : await sb.auth.signInWithPassword({ email, password, options: opts });
    resetCaptcha();
    sendBtn.disabled = false; sendBtn.textContent = COPY[mode].send;
    if (error) {
      const m = (error.message || '').toLowerCase();
      if (m.includes('invalid login')) return fail(emailErr, passIn, 'Wrong email or password. No account yet? Switch to Sign up.');
      if (m.includes('already registered')) return fail(emailErr, emailIn, 'That email already has an account. Switch to Log in.');
      if (m.includes('captcha')) return fail(emailErr, null, 'The bot check didn\'t pass. Wait a second and try again.');
      if (error.status === 429 || m.includes('rate')) return fail(emailErr, null, 'Too many tries. Wait a minute, then try again.');
      if (m.includes('password')) return fail(emailErr, passIn, error.message);
      if (!error.status || m.includes('fetch') || m.includes('network')) {
        console.warn('Aio sign-in request blocked:', error);
        return fail(emailErr, null, 'We couldn\'t reach the sign-in server from this page. If you\'re on the preview link, sign-up only works on the live website. Otherwise check your connection and try again.');
      }
      console.warn('Aio sign-in error:', error);
      return fail(emailErr, null, `Something went wrong: ${error.message}`);
    }
    if (mode === 'signup' && !data.session) return fail(emailErr, null, 'Account created, but email confirmation is still switched on in Supabase, so you can\'t log in yet.');
    passIn.value = '';
    show('done');
  });

  codeForm.addEventListener('submit', async e => {
    e.preventDefault();
    const token = codeIn.value.replace(/\D/g, '');
    if (token.length < 6) return fail(codeErr, codeIn, 'Enter the 6-digit code from your email.');
    const btn = $('#authVerify');
    btn.disabled = true; btn.textContent = 'Checking…';
    const { error } = await sb.auth.verifyOtp({ email: pendingEmail, token, type: 'email' });
    btn.disabled = false; btn.textContent = 'Verify';
    if (error) return fail(codeErr, codeIn, 'That code is wrong or has expired. Check the latest email, or resend a new code.');
    show('done');
  });
  codeIn.addEventListener('input', () => {
    codeIn.value = codeIn.value.replace(/\D/g, '').slice(0, 8);
    if (codeIn.value.length === 6) codeForm.requestSubmit();
  });
  resendBtn.addEventListener('click', async () => {
    codeErr.textContent = '';
    const error = await sendCode();
    if (error) return fail(codeErr, null, 'Couldn\'t resend yet. Wait a minute and try again.');
    codeErr.textContent = ''; $('#authResent').textContent = 'New code sent.'; startResendTimer();
  });
  $('#authBack').addEventListener('click', () => { show('email'); emailIn.focus(); });
  $('#authLogout').addEventListener('click', async () => { await sb?.auth.signOut(); modal.close(); });
  $('#authToDrafts').addEventListener('click', () => { modal.close(); openDrawer(); });

  /* ---------- Session state -> UI ---------- */
  const acctBtns = $$('[data-acct-label]');
  const onUser = async u => {
    const was = user?.id;
    user = u;
    const name = u?.user_metadata?.display_name || u?.email?.split('@')[0] || '';
    acctBtns.forEach(b => { b.textContent = u ? name : 'Log in'; b.dataset.mode = 'login'; });
    $('#authWho').textContent = u ? `Signed in as ${u.email}` : '';
    if (u && u.id !== was) await syncLocalUp();
    await loadDrafts();
    if (u?.id !== was) document.dispatchEvent(new CustomEvent('aio:user', { detail: u }));
  };
  if (sb) {
    sb.auth.onAuthStateChange((_evt, session) => { setTimeout(() => onUser(session?.user || null), 0); });
  } else {
    onUser(null);
  }
})();
