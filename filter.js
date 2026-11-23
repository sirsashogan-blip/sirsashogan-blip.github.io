/* Aio text filter: blocks violence, swearing, gibberish and offensive wording
   in anything people write for a protest (slogans, feed posts, drafts).
   Usage: AioFilter.check(text) -> null when fine, or { reason, message }. */
(() => {
  'use strict';

  const MESSAGES = {
    violence: 'Aio is for peaceful protest. Please take out words about hurting people.',
    curse: 'Please keep it clean. Take out the swear words and try again.',
    offensive: 'That wording could hurt or insult people. Please say it respectfully.',
    gibberish: "That doesn't look like real words. Write it so people can read it."
  };

  /* ---------- Word lists ---------- */
  // Exact words (after cleanup). Plurals/-ing forms are listed or caught by ROOTS.
  const CURSE = new Set(`fuck fucks fucked fucker fuckers fucking fuckin fck fk fuk fuking fukin fcking fkn fuq wtf stfu gtfo
    shit shits shitty shite shitting shithead bullshit horseshit apeshit
    bitch bitches bitchy bastard bastards ass asses arse arses asshole assholes arsehole arseholes dumbass jackass smartass badass
    cunt cunts twat twats dick dicks dickhead dickheads cock cocks cocksucker prick pricks pussy pussies
    wank wanker wankers wanking tosser tossers bollocks bellend knob knobhead minge
    damn damned dammit goddamn goddamnit crap crappy piss pissed pissing slut sluts whore whores skank tits titties
    motherfucker motherfuckers mofo douche douchebag jerkoff milf`.split(/\s+/));

  // Slurs and dehumanising words. Always blocked, no matter the context.
  // (Words people reclaim or use against hate, like "queer" or "No Nazis", are left out on purpose.)
  const OFFENSIVE = new Set(`nigger niggers nigga niggas negro negroes coon coons darkie darky jigaboo
    chink chinks gook gooks jap japs zipperhead
    spic spics spick wetback wetbacks beaner beaners
    kike kikes yid yids heeb
    paki pakis raghead ragheads towelhead towelheads sandnigger
    gyp gypo gyppo pikey pikeys
    fag fags faggot faggots fagot dyke dykes tranny trannies shemale poof poofter
    retard retards retarded tard spaz spastic mong mongoloid
    subhuman untermensch heil 1488`.split(/\s+/));

  // Roots that are offensive wherever they appear inside a word (e.g. "motherf*cking"),
  // with guards for innocent words like "snigger", "Scunthorpe", "swank" and "Fukushima".
  const ROOTS_CURSE = /fuck|^fuk(?!ush)|shit|bitch|(^|[^s])cunt|(^|[^s])wank|whore|asshol|arsehol|dickhead|cocksuck/;
  const ROOTS_OFFENSIVE = /(^|[^s])nigg|faggot|^kike|^chink|spastic|raghead|towelhead|wetback/;

  // Hateful phrases (checked on the whole sentence).
  const HATE_PHRASES = [
    /\bgo back to (your|their|ur) (own )?(country|countries)\b/,
    /\b(white|black|brown) power\b/, /\bwhite (pride|supremacy|genocide)\b/,
    /\bsieg heil\b/, /\bheil hitler\b/, /\bgas the\b/, /\bhitler (was )?right\b/, /\bcamel jockeys?\b/,
    /\b(are|is|they re|theyre) (all )?(animals|vermin|parasites|cockroaches|rats|savages|subhuman|scum|filth|apes|monkeys|pigs|dogs)\b/,
    /\b(jews|muslims|christians|immigrants|migrants|refugees|gays|blacks|whites|asians|arabs|women|men) (are|r) (evil|the problem|a disease|a plague|disgusting|inferior)\b/,
    /\bkill (all )?(the )?(jews|muslims|christians|gays|blacks|whites|immigrants)\b/
  ];

  // Violent words and phrases. Allowed only when the sentence is against them
  // ("Stop the killing", "End knife crime", "No one should die waiting").
  // Naming a problem is fine ("Pollution kills", "End domestic violence");
  // calling for harm is not ("Kill them", "Burn it down", "Death to ...").
  const PEOPLE = '(them|him|her|em|us|you|everyone|everybody|people|all of them|cops|police|the police|politicians|the rich|landlords|the mayor|the government)';
  const VIOLENCE = [
    /\bkill\b/, new RegExp(`\\bkill(ing)? ${PEOPLE}\\b`), /\bkill (all|every|each)\b/,
    /\bmurder(ed|ing|er|ers)?\b/, new RegExp(`\\bshoot ${PEOPLE}\\b`), /\bshoot (it|the place|the \w+) up\b/, /\bshoot up\b/,
    /\bshootings?\b/, /\bstab(bed|bing|bings)?\b/, new RegExp(`\\bstab ${PEOPLE}\\b`), /\bbomb(ed|ing|ings)?\b/,
    /\bblow (it|them|him|her|this|the \w+) up\b/, /\bblow up (the|their|his|her)\b/,
    /\bbehead(s|ed|ing)?\b/, /\blynch(ed|ing)?\b/, new RegExp(`\\bhang ${PEOPLE}\\b`), /\bstring (them|him|her|em) up\b/,
    /\bmassacre(s|d)?\b/, /\bslaughter(ed|ing)?\b/, /\bassassinat(e|ed|ing|ion)\b/, /\bexterminat(e|ed|ing|ion)\b/,
    /\brap(e|ed|ing|ist|ists)\b/, /\btortur(e|ed|ing)\b/, /\bstrangl(e|ed|ing)\b/,
    /\bburn (it|them|him|her|this|the \w+|\w+) down\b/, /\bburn (them|him|her|em) alive\b/, /\bset (them|him|her|em|it) on fire\b/,
    new RegExp(`\\bbeat ${PEOPLE}( up)?\\b`), /\bbeat up\b/, new RegExp(`\\bpunch(es|ed|ing)? ${PEOPLE}\\b`),
    /\bgun (them|him|her|em)? ?down\b/, /\bdeath to\b/, /\b(should|must|deserve to|deserves to|ought to|needs to|need to|gonna|going to) die\b/,
    /\bdie in a fire\b/, /\bput a bullet\b/, /\bwipe (them|him|her|em) out\b/, /\bwipe out (the|all)\b/,
    new RegExp(`\\battack ${PEOPLE}\\b`), /\briot(ing)?\b/, /\bterror(ist|ists)\b/,
    new RegExp(`\\bhurt ${PEOPLE}\\b`), /\bmolotov\b/, /\barson\b/, /\bloot(ing)?\b/, /\bkidnap(ped|ping)?\b/,
    /\bbloodbath\b/, /\b(go|going) to war\b/, /\bdeclare war\b/, /\btake up arms\b/, /\bby any means necessary\b/,
    /\bsmash (their|his|her) (face|faces|head|heads|skull|skulls)\b/, /\bcrack (their|his|her) skull/, /\bshank\b/,
    /\bbreak (their|his|her) (legs|necks?|bones|arms)\b/, /\bknock (them|him|her|em) out\b/, /\bget (the|our) guns\b/
  ];
  // Words just before a violent word that show the message is against violence.
  const NEGATORS = /\b(stop|stops|stopping|end|ending|ends|no|not|never|nobody|noone|ban|banning|against|anti|prevent|preventing|halt|ceasefire|protect|protecting|save|saving|victims?|survivors?|justice|reduce|tackle|tackling|fight|fighting|without|zero|free|safe|safer|less|fewer|condemn|oppose|report|reporting)\b/;
  // Words just after one that show it's about the issue ("rape crisis centre", "stabbing victims").
  const AFTER_OK = /^\s*(victims?|survivors?|crisis|culture|kits?|cases?|centres?|centers?|charges?|laws?|reports?|prevention|awareness|rates?|statistics|epidemic|crimes?|support)\b/;

  /* ---------- Cleanup ---------- */
  const LEET = { '0': 'o', '1': 'i', '!': 'i', '|': 'i', '3': 'e', '4': 'a', '@': 'a', '5': 's', '$': 's', '7': 't', '+': 't', '8': 'b', '9': 'g' };

  const clean = raw => {
    let t = String(raw || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
    // Turn look-alike symbols into letters when they sit inside a word (sh1t, @ss, f$ck).
    t = t.replace(/[0-9!|@$+]+/g, (m, i, s) => {
      const before = /[a-z]/.test(s[i - 1] || ''), after = /[a-z]/.test(s[i + m.length] || '');
      return before || after ? m.replace(/./g, c => LEET[c] || c) : m;
    });
    // Join letters split by dots, dashes or spaces: "f.u.c.k", "s h i t".
    t = t.replace(/\b(?:[a-z][\s._\-*]+){2,}[a-z]\b/g, m => m.replace(/[\s._\-*]+/g, ''));
    t = t.replace(/['’]/g, '');
    return t;
  };
  const words = t => t.replace(/[^a-z0-9*#\s]/g, ' ').split(/\s+/).filter(Boolean);
  // "fuuuuck" -> try "fuuck" and "fuck".
  const variants = w => {
    const two = w.replace(/([a-z])\1{2,}/g, '$1$1');
    return [...new Set([w, two, w.replace(/([a-z])\1+/g, '$1'), two.replace(/([a-z])\1+/g, '$1')])];
  };
  // "f*ck", "sh#t": let * and # stand in for a hidden letter.
  const maskMatches = (w, list) => {
    if (!/[*#]/.test(w) || !/[a-z]/.test(w)) return false;
    const re = new RegExp('^' + w.replace(/[*#]/g, '[a-z]?') + '$');
    for (const bad of list) if (bad.length >= 3 && re.test(bad)) return true;
    return false;
  };

  const wordHit = (ws, set, roots) => ws.some(w => {
    if (maskMatches(w, set)) return true;
    return variants(w.replace(/[*#]/g, '')).some(v => set.has(v) || roots.test(v));
  });

  /* ---------- Gibberish ---------- */
  const MASH = /(qwer|wert|asdf|sdfg|dfgh|fghj|ghjk|hjkl|jkl|zxcv|xcvb|cvbn|vbnm|poiu|lkjh|mnbv|jkjk|fjfj|dkdk)/;
  const VOWELS = /[aeiouy]/;
  const isGibberish = raw => {
    const text = String(raw || '').trim();
    const visible = text.replace(/\s/g, '');
    if (!visible) return false;
    const letters = visible.match(/\p{L}/gu) || [];
    if (letters.length < visible.length * 0.5) return true;           // mostly symbols: "!!!???###"
    const t = text.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
    if (/([a-z])\1{3,}/.test(t)) return true;                          // "aaaaa"
    if (/([a-z]{2,3})\1{3,}/.test(t)) return true;                     // "lalalalala", "asdasdasdasd"
    const all = t.replace(/[^a-z]/g, '');
    if (all.length >= 8) {
      const v = (all.match(/[aeiouy]/g) || []).length;
      if (v / all.length < 0.12) return true;                         // almost no vowels
    }
    const orig = text.split(/\s+/);
    return t.split(/\s+/).some((w, i) => {
      w = w.replace(/[^a-z]/g, '');
      if (!w) return false;
      const acronym = /^[A-Z]{2,6}s?$/.test(orig[i]?.replace(/[^A-Za-z]/g, '') || '');
      if (w.length >= 5 && !VOWELS.test(w) && !acronym) return true;  // "sdfgh"
      if (/[bcdfghjklmnpqrstvwxz]{6,}/.test(w)) return true;          // "kjsdfhg"
      if (MASH.test(w) && w.length >= 4) return true;                  // keyboard mash
      if (w.length > 25) return true;                                  // one endless "word"
      return false;
    });
  };

  /* ---------- Violence ---------- */
  const violent = t => {
    const s = ' ' + t.replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ') + ' ';
    return VIOLENCE.some(re => {
      const g = new RegExp(re.source, 'g');
      let m;
      while ((m = g.exec(s))) {
        // Look at the few words just before the match for "stop", "end", "no" etc.
        const before = s.slice(0, m.index).trim().split(' ').slice(-4).join(' ');
        const after = s.slice(m.index + m[0].length);
        if (!NEGATORS.test(before) && !AFTER_OK.test(after)) return true;
        g.lastIndex = m.index + 1;
      }
      return false;
    });
  };

  const check = raw => {
    const text = String(raw || '');
    if (!text.trim()) return null;
    const t = clean(text);
    const ws = words(t);
    const flat = t.replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ');
    if (wordHit(ws, OFFENSIVE, ROOTS_OFFENSIVE) || HATE_PHRASES.some(re => re.test(flat))) return { reason: 'offensive', message: MESSAGES.offensive };
    if (wordHit(ws, CURSE, ROOTS_CURSE)) return { reason: 'curse', message: MESSAGES.curse };
    if (violent(t)) return { reason: 'violence', message: MESSAGES.violence };
    if (isGibberish(text)) return { reason: 'gibberish', message: MESSAGES.gibberish };
    return null;
  };

  // Check several fields at once; returns the first problem.
  const checkAll = (...texts) => { for (const x of texts) { const r = check(x); if (r) return r; } return null; };

  window.AioFilter = { check, checkAll, MESSAGES };
})();
