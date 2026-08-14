/* ============================================================
   ALPACA — application controller
   Home: search + intersections. Facts: topic page + proximity shelf.
   Auth: ?key= URL parameter validated against data/keys.json.
   PWA: install prompt + service worker registration.
   ============================================================ */

(function () {
  'use strict';

  const A = window.Alpaca;
  const $ = (sel, root) => (root || document).querySelector(sel);

  const state = {
    page: location.pathname.split('/').pop().toLowerCase().startsWith('facts') ? 'facts' : 'home',
    topicId: null,
    grants: new Set(),
  };

  /* ---------------- auth ---------------- */

  function readAuth() {
    const params = new URLSearchParams(location.search);
    const key = params.get('key');
    let usedKey = false;
    if (key) {
      const entry = A.store().keys.keys.find(k => k.key === key);
      if (entry) {
        entry.grants.forEach(g => state.grants.add(g));
        sessionStorage.setItem('alpaca_grants', JSON.stringify(Array.from(state.grants)));
        usedKey = true;
      }
    }
    if (usedKey) {
      // surface the key is used, keep any other params (e.g. ?q=, ?topic=)
      const show = (() => { const s = []; for (const [k, v] of params) if (k !== 'key') s.push(k + '=' + v); return s; })();
      history.replaceState(null, '', location.pathname + (show.length ? '?' + show.join('&') : ''));
    }
    try {
      const saved = JSON.parse(sessionStorage.getItem('alpaca_grants') || '[]');
      saved.forEach(g => state.grants.add(g));
    } catch (e) { /* ignore */ }
  }

  function hasGrant(name) {
    return state.grants.has(name);
  }

  function subscribeUrl() {
    const k = A.store().keys;
    return (k && k.subscribeUrl) || '#';
  }

  /* Every card in the app — search rows, intersection cards, shelf tiles,
     etymology links — lands on the facts page for the node. */
  function goToNode(id) {
    location.href = 'facts.html?topic=' + encodeURIComponent(id);
  }

  /* ---------------- shared chrome ---------------- */

  function buildSearchIcon() {
    const d = document.createElement('div');
    d.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>';
    return d.firstChild;
  }

  /* Gated nodes still get a facts page; the lock renders inline per-section. */

  function paywallFragment() {
    const el = document.createElement('div');
    el.innerHTML =
      '<div class="paywall" style="border-width:1px">' +
        '<div class="eyebrow">Gated archive</div>' +
        '<h3 style="font-size:1.15rem">This document is archived.</h3>' +
        '<p>Unlocked with a reader key passed as <code>?key=…</code> in the URL, or by subscribing.</p>' +
        '<a class="btn btn-accent m-subscribe-link" href="#" target="_blank" rel="noopener">Subscribe</a>' +
        '<div class="lock-row">keys.json · grant system</div>' +
      '</div>';
    return el;
  }

  /* ---------------- home page ---------------- */

  function renderIntersections() {
    const grid = $('#intersections');
    if (!grid) return;
    const picks = [
      'bohr-einstein-debates',
      'double-entry-bookkeeping',
      'supply-and-demand',
      'the-stored-program-computer',
      'the-graphical-user-interface',
      'the-calculus',
      'dna-structure',
      'the-manhattan-project',
      'quantum-mechanics',
      'lise-meitner'
    ];
    picks.forEach(id => {
      const node = A.nodeById(id);
      if (!node) return;
      const card = document.createElement('div');
      card.className = 'intersection-card';
      card.innerHTML =
        '<div class="i-eyebrow">' + A.typeLabel(node.type) + '</div>' +
        '<h4>' + node.label + '</h4>' +
        '<span class="tag">' + (node.tag || '') + '</span>';
      card.addEventListener('click', () => goToNode(id));
      grid.appendChild(card);
    });
  }

  const PLURAL = { person: 'people', topic: 'topics', concept: 'concepts', event: 'events', object: 'objects', news: 'news', date: 'periods', perspective: 'perspectives', etymology: 'words' };

  function renderSearchResults(query, type) {
    const box = $('#results');
    if (!box) return;
    let results = A.search(query);
    if (type) results = results.filter(r => r.node.type === type);
    const wrap = $('#results-wrap');
    if (wrap) wrap.classList.remove('hidden');
    const meta = $('#results-meta');
    if (meta) {
      meta.innerHTML =
        (type ? '<span class="result-filter">' + A.typeLabel(type) + '</span> ' : '') +
        (results.length
          ? results.length + ' ' + (type ? (PLURAL[type] || type + 's') : 'nodes') + ' · ranked by vector proximity'
          : 'nothing adjacent — try a broader term') +
        (type ? ' <a class="clear-filter" href="index.html?q=' + encodeURIComponent(query) + '">clear filter</a>' : '');
    }
    box.innerHTML = '';
    if (!results.length) return;
    results.forEach(({ node, proximity }) => {
      const row = document.createElement('div');
      row.className = 'result';
      const locked = node.requiresAuth && !hasGrant(node.requiresAuth);
      const pos = A.graphPosition(node.id);
      row.innerHTML =
        '<div class="meta">' +
          '<div class="prox">' + proximity + '% proximate</div>' +
          '<div class="tag" style="margin-top:0.35rem">' + A.typeLabel(node.type) + '</div>' +
          '<div class="com">' + (pos.community ? '\u25C8 ' + pos.community : '') + (pos.hub ? ' <span class="hub">\u00B7 HUB</span>' : '') + '</div>' +
        '</div>' +
        '<div style="flex:1;min-width:0">' +
          '<h3>' + node.label + '</h3>' +
          '<p>' + (node.summary ? node.summary.split('. ').slice(0, 2).join('. ') + '.' : '') + '</p>' +
        '</div>' +
        (locked ? '<span class="tag">locked</span>' : '<span class="tag">' + (node.tag || '') + '</span>');
      row.addEventListener('click', () => goToNode(node.id));
      box.appendChild(row);
    });
  }

  function wireHome() {
    const form = $('#home-search');
    if (!form) return;
    const input = $('#home-q', form);
    const params = new URLSearchParams(location.search);
    const type = params.get('type');

    // alpaca mark inside the search spinner (reused from the hero, no path duplication)
    const sp = $('#search-spinner');
    if (sp) {
      const mark = document.querySelector('.mark svg, .brand svg');
      const al = sp.querySelector('.sp-alpaca');
      if (mark && al) {
        al.innerHTML = mark.innerHTML;
        al.setAttribute('viewBox', mark.getAttribute('viewBox') || '0 0 512 512');
      }
    }

    let spinTimer = null;
    function runSearchWithSpinner(query, qtype) {
      const done = () => { renderSearchResults(query, qtype); if (sp) sp.hidden = true; };
      if (sp) {
        sp.hidden = false;
        if (spinTimer) clearTimeout(spinTimer);
        spinTimer = setTimeout(done, 550);
      } else {
        done();
      }
    }

    form.addEventListener('submit', e => {
      e.preventDefault();
      runSearchWithSpinner(input.value, type);
    });
    const q = params.get('q');
    if (q) {
      input.value = q;
      runSearchWithSpinner(q, type);
    }
    renderIntersections();
  }

  /* ---------------- facts page ---------------- */

  /* Combined navigation actions row: shelf toggle + Spark + Sharing out (placeholders) */
  function renderPageActions(topic) {
    const row = $('#page-actions');
    if (!row) return;
    row.innerHTML = '';
    const mkButton = (label, note, icon) => {
      const b = document.createElement('button');
      b.className = 'act-btn' + (note ? '' : ' is-edge');
      b.disabled = true;
      b.title = note || label;
      b.innerHTML = '<span class="act-icon">' + icon + '</span><span>' + label + (note ? '<em>' + note + '</em>' : '') + '</span>';
      return b;
    };
    // context shelf toggle (primary on mobile, still handy on desktop)
    const toggle = document.createElement('button');
    toggle.className = 'btn btn-accent shelf-toggle';
    toggle.id = 'shelf-toggle';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7h18M3 12h18M3 17h18"/></svg>' +
      '<span>Context · shelf</span>';
    row.appendChild(toggle);

    // search the web — the one action that leaves the archive
    const web = document.createElement('button');
    web.className = 'act-btn act-live';
    web.title = 'Search Google for this topic';
    web.innerHTML =
      '<span class="act-icon"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></svg></span>' +
      '<span>Search the web</span>';
    web.addEventListener('click', () => {
      const q = topic.label + (topic.tag ? ' \u00B7 ' + topic.tag : '');
      window.open('https://www.google.com/search?q=' + encodeURIComponent(q), '_blank', 'noopener');
    });
    row.appendChild(web);

    row.appendChild(mkButton('Run the Spark', '(coming soon)', '⚡'));
    row.appendChild(mkButton('Sharing out', '(coming soon)', '↗'));

    const shelf = $('#shelf-wrap');
    const backdrop = $('#shelf-backdrop');
    const setDrawer = (open) => {
      shelf.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', String(open));
      const label = toggle.querySelector('span');
      if (label) label.textContent = open ? 'Close shelf' : 'Context · shelf';
      if (backdrop) backdrop.classList.toggle('show', open);
      document.body.style.overflow = open ? 'hidden' : '';
      if (open) shelf.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    if (toggle) toggle.addEventListener('click', () => {
      if (!shelf) return;
      setDrawer(!shelf.classList.contains('open'));
    });
    if (backdrop) backdrop.addEventListener('click', () => setDrawer(false));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') setDrawer(false); });
  }

  /* Proximity chip for page media: aligns section vector with the topic vector */
  function mediaChip(topic, section) {
    if (!topic || !topic.vector || !section.vector) return '';
    const p = A.proximityToVector(topic.vector, section.vector);
    return '<span class="media-chip">aligned ' + A.proximityLabel(p) + ' <b>' + Math.round(p * 100) + '%</b></span>';
  }

  /* drag-to-resize embedded videos; keeps 16:9 and 8px padding, clamps to the container */
  function wireResize(card) {
    const wrap = card.querySelector('.iframe-wrap');
    const frame = wrap.querySelector('iframe');
    const handle = wrap.querySelector('.resize-handle');
    if (!wrap || !frame || !handle) return;

    let dragging = false;
    let startX = 0;
    let startW = 0;

    const minW = 160;
    const maxW = function () {
      const pad = parseFloat(getComputedStyle(wrap).paddingLeft) + parseFloat(getComputedStyle(wrap).paddingRight);
      return wrap.clientWidth - pad;
    };

    function apply(w) {
      const clamped = Math.max(minW, Math.min(w, maxW()));
      frame.style.width = clamped + 'px';
    }

    handle.addEventListener('pointerdown', function (e) {
      dragging = true;
      startX = e.clientX;
      startW = frame.getBoundingClientRect().width;
      wrap.classList.add('resizing');
      handle.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    handle.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      apply(startW + (e.clientX - startX));
    });
    function stop() {
      dragging = false;
      wrap.classList.remove('resizing');
    }
    handle.addEventListener('pointerup', stop);
    handle.addEventListener('pointercancel', stop);

    // keep the player within bounds on rotation / viewport resize
    window.addEventListener('resize', function () {
      const w = frame.style.width ? parseFloat(frame.style.width) : NaN;
      if (!isNaN(w) && w > maxW()) apply(maxW());
    });
  }

  function renderTopic() {
    const topic = A.nodeById(state.topicId);
    if (!topic) {
      const main = $('#topic-body');
      if (main) main.innerHTML = '<div class="panel" style="padding:2rem">Unknown node. <a href="index.html">Back to search.</a></div>';
      return;
    }
    const page = A.store().pages[state.topicId];

    // header
    $('#topic-eyebrow').textContent = A.typeLabel(topic.type) + '  ·  ' + (topic.location || '');
    $('#topic-title').textContent = topic.label;
    const metaLine = $('.meta-line');
    if (metaLine) {
      const old = metaLine.querySelector('.node-badges');
      if (old) old.remove();
      const pos = A.graphPosition(state.topicId);
      const badges = document.createElement('span');
      badges.className = 'node-badges';
      badges.innerHTML =
        (pos.community ? '<span class="n-badge">\u25C8 ' + pos.community + '</span>' : '') +
        (pos.hub
          ? '<span class="n-badge hub">HUB \u00B7 ' + pos.degree + ' connections</span>'
          : '<span class="n-badge">' + pos.degree + ' connections</span>');
      metaLine.appendChild(badges);
    }
    $('#topic-loc').textContent = topic.location || '';
    $('#topic-dates').textContent = topic.dates ? topic.dates.join('\u2013') : '';
    $('#topic-tag').textContent = topic.tag || '';
    renderPageActions(topic);

    // body sections: custom page when present, otherwise a generated one
    const body = $('#topic-body');
    body.innerHTML = '';
    const sections = page && page.sections && page.sections.length ? page.sections : generatedSections(topic);
    sections.forEach(section => body.appendChild(renderSection(section, topic)));

    // shelf
    renderShelf(topic);

    document.title = topic.label + ' — Alpaca';
  }

  /* Build a facts body from the node itself when no curators' page exists.
     Every type gets a full encyclopedia: proem, key facts, story or mechanism,
     why it matters, voices, a timeline, sources — plus views and etymology. */
  function paraHTML(text) {
    return String(text || '')
      .split(/\n{2,}/)
      .map(p => '<p>' + p.trim() + '</p>')
      .join('');
  }

  function generatedSections(topic) {
    const sections = [];

    // 1 · proem — the lead, in the right voice for the type
    const leadStyle = {
      person: 'The person', etymology: 'The word', event: 'What happened',
      perspective: 'A view from the era', object: 'The object',
      date: 'The moment', news: 'The report', topic: 'The subject',
    }[topic.type] || 'The idea';
    sections.push({ kind: 'text', heading: leadStyle, html: paraHTML(topic.summary || 'A node in Alpaca\u2019s concept space, still being written.') });

    // 1b · watch — a curated pick when recorded, otherwise a live search
    {
      const topAxes = Object.entries(topic.vector || {})
        .sort((a, b) => b[1] - a[1]).slice(0, 4)
        .reduce((acc, [k, v]) => { acc[k] = v; return acc; }, {});
      sections.push({
        kind: 'video',
        title: topic.label + (topic.tag ? ' \u2014 ' + topic.tag : ''),
        provider: 'youtube',
        query: (topic.label + ' ' + (topic.tag || '') + ' explained').trim(),
        caption: topic.videoCaption || ('Watch how this ' + (topic.type || 'node') + ' fits the era \u2014 an open search, plays in a new tab'),
        embed: topic.videoEmbed || null,
        vector: topAxes
      });
    }

    // 1c · the news of the day, when the node carries a headline
    if (topic.clipping) {
      sections.push({
        kind: 'clipping',
        newspaper: topic.clipping.newspaper || 'The Daily Ledger',
        date: topic.clipping.date || '',
        headline: topic.clipping.headline || topic.label,
        body: topic.clipping.body || ''
      });
    }

    // 2 · at a glance — structured key facts (dictionary fast, encyclopedia deep)
    const facts = [];
    if (topic.dates && topic.dates.length) facts.push({ k: 'years', v: topic.dates.join('\u2013') });
    if (topic.location) facts.push({ k: 'place', v: topic.location });
    if (topic.term) facts.push({ k: 'term', v: topic.term });
    if (topic.coinedBy) facts.push({ k: 'coined by', v: topic.coinedBy });
    if (topic.gift) facts.push({ k: 'gift', v: topic.gift });
    if (topic.tag) facts.push({ k: 'field', v: topic.tag });
    if (topic.origin) facts.push({ k: 'origin', v: topic.origin });
    if (Array.isArray(topic.keyfacts)) {
      topic.keyfacts.forEach(f => facts.push({ k: f.k || f.label || 'fact', v: f.v || f.value || '' }));
    }
    if (facts.length) {
      sections.push({
        kind: 'text',
        heading: 'At a glance',
        html: '<dl class="keyfacts">' + facts.map(f =>
          '<div class="kf-row"><dt>' + f.k + '</dt><dd>' + f.v + '</dd></div>'
        ).join('') + '</dl>',
      });
    }

    // 3 · the story / the life
    if (topic.story) {
      sections.push({
        kind: 'text',
        heading: topic.type === 'person' ? 'The life' : 'The story',
        html: paraHTML(topic.story),
      });
    }

    // 4 · how it works
    if (topic.mechanism) {
      sections.push({ kind: 'text', heading: 'How it works', html: paraHTML(topic.mechanism) });
    }

    // 5 · why it matters
    if (topic.significance) {
      sections.push({ kind: 'text', heading: 'Why it matters', html: paraHTML(topic.significance) });
    }

    // 6 · in their own words
    if (Array.isArray(topic.quotes) && topic.quotes.length) {
      sections.push({
        kind: 'text',
        heading: topic.type === 'person' ? 'In their own words' : 'Voices & quotation',
        html: topic.quotes.map(q =>
          '<blockquote class="vquote"><p>' + q.quote + '</p>' +
          '<footer>— ' + (q.said || '') + (q.context ? ', ' + q.context : '') + '</footer></blockquote>'
        ).join(''),
      });
    }

    // 7 · moments along the way
    if (Array.isArray(topic.timeline) && topic.timeline.length) {
      sections.push({
        kind: 'text',
        heading: 'Moments along the way',
        html: '<ol class="tl-list">' + topic.timeline.map(t =>
          '<li><b>' + (t.year || '') + '</b>' + t.what + '</li>'
        ).join('') + '</ol>',
      });
    }

    // 8 · sources & further reading
    if (Array.isArray(topic.sources) && topic.sources.length) {
      sections.push({
        kind: 'text',
        heading: 'Sources & further reading',
        html: '<ul class="src-list">' + topic.sources.map(s =>
          '<li>' + (s.title || '') + (s.by ? ' \u2014 ' + s.by : '') + (s.year ? ' (' + s.year + ')' : '') + '</li>'
        ).join('') + '</ul>',
      });
    }

    // 8b · run — a hands-on sim when the node carries one
    if (topic.sim && topic.sim.id) {
      sections.push({
        kind: 'simulation',
        id: topic.sim.id,
        label: topic.sim.label || 'Simulation',
        caption: topic.sim.caption || '',
        vector: topic.sim.vector || topic.vector || {}
      });
    }

    // 8c · keep searching — type-filtered links into the home search
    const keep = [
      ['person', 'People'], ['topic', 'Topics'], ['concept', 'Concepts'],
      ['event', 'Events'], ['object', 'Objects'], ['news', 'News'],
    ];
    sections.push({
      kind: 'text',
      heading: 'Keep searching',
      html: '<div class="keep-searching">' +
        '<div class="ks-hint">find the people, topics &amp; moments behind this node</div>' +
        '<div class="ks-chips">' + keep.map(([t, label]) =>
          '<a class="chip" href="index.html?q=' + encodeURIComponent(topic.label) + '&amp;type=' + t + '">' + label + '</a>'
        ).join('') + '</div></div>',
    });

    // 9 · views (multi-domain aspects) for people and concepts that carry them
    if (topic.views && topic.views.length) {
      const html = topic.views.map(v =>
        '<div class="viewbar"><span class="vb-lbl">' + v.label + '</span><span class="vb-dom">' + (v.domain || '') + '</span></div>'
      ).join('');
      sections.push({ kind: 'text', heading: 'Aspects — multi-domain views', html: html });
    }

    // 10 · etymology link for any node that names its word
    const ety = topic.etymologyId ? A.nodeById(topic.etymologyId) : null;
    if (ety) {
      sections.push({
        kind: 'text',
        heading: 'Etymology — who coined the word',
        html: '<div class="etymology-card" style="cursor:pointer"><div class="ec-term">' + ety.term + '</div>' +
          '<div class="ec-by">coined by <em>' + ety.coinedBy + '</em> — ' + (ety.coinYear || '') + '</div>' +
          '<div class="ec-origin">' + ety.origin + '</div><p>' + ety.summary + '</p></div>'
      });
    }

    return sections;
  }

  function renderSection(section, topic) {
    switch (section.kind) {
      case 'text': {
        const wrap = document.createElement('div');
        wrap.className = 'prose';
        wrap.innerHTML = '<h3>' + (section.heading || '') + '</h3>' + section.html;
        return wrap;
      }
      case 'clipping': {
        const el = document.createElement('div');
        el.className = 'clipping';
        el.innerHTML =
          '<div class="masthead"><span>' + section.newspaper + '</span><span>' + section.date + '</span></div>' +
          '<h3>' + section.headline + '</h3>' +
          '<p>' + section.body + '</p>';
        return el;
      }
      case 'simulation': {
        const el = document.createElement('div');
        el.className = 'sim-shell';
        el.innerHTML =
          '<div class="sim-head">' +
            '<span class="eyebrow">' + section.label + '</span>' +
            mediaChip(topic, section) +
          '</div>';
        const status = document.createElement('div');
        status.className = 'sim-status';
        el.appendChild(status);
        requestAnimationFrame(() => window.AlpacaSim.run(section.id || 'orbit-jumps', el, status));
        return el;
      }
      case 'quiz': {
        const el = document.createElement('div');
        el.className = 'quiz';
        el.dataset.quiz = section.id;
        el.innerHTML =
          '<div class="q-head">' +
            '<div class="q-num">Thought experiment</div>' +
            '<h3>' + section.question + '</h3>' +
          '</div>' +
          '<div class="options">' +
            section.options.map((o, i) => '<button class="option" data-i="' + i + '">' + String.fromCharCode(65 + i) + ') ' + o + '</button>').join('') +
          '</div>' +
          '<div class="verdict"><div class="line"></div><p></p></div>';
        el.querySelectorAll('.option').forEach(btn => {
          btn.addEventListener('click', () => {
            const i = parseInt(btn.dataset.i, 10);
            const ok = i === section.answer;
            el.querySelectorAll('.option').forEach(b => { b.disabled = true; });
            el.querySelectorAll('.option').forEach(b => {
              if (parseInt(b.dataset.i, 10) === section.answer) b.classList.add('correct');
            });
            if (!ok) btn.classList.add('incorrect');
            const verdict = el.querySelector('.verdict');
            verdict.classList.add('show');
            const line = verdict.querySelector('.line');
            line.classList.add(ok ? 'ok' : 'no');
            line.textContent = ok ? 'Correct' : 'Not quite';
            verdict.querySelector('p').textContent = section.explanation;
          });
        });
        return el;
      }
      case 'video': {
        const locked = section.requiresAuth && !hasGrant(section.requiresAuth);
        const el = document.createElement('div');
        el.className = 'video-card' + (locked ? ' locked' : '');
        const url = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(section.query || section.title);
        if (section.embed) {
          // real embedded video when a curators' pick exists
          el.innerHTML =
            '<div class="iframe-wrap">' +
              (locked
                ? '<div class="eyebrow" style="padding:1rem 0">This pick is behind a key.</div>'
                : '<iframe src="https://www.youtube-nocookie.com/embed/' + section.embed + '?rel=0" title="' + (section.title || '').replace(/"/g, '&quot;') + '" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe>' +
                  '<span class="resize-handle" title="Drag to resize video" aria-hidden="true"></span>') +
            '</div>' +
            '<div style="flex:1;min-width:0">' +
              '<h4>' + section.title + '</h4>' +
              '<p>' + (section.caption || '') + '</p>' +
              mediaChip(topic, section) +
            '</div>' +
            (locked ? '<span class="lock">gated · key</span>' : '');
          if (locked) el.addEventListener('click', () => openPaywall());
          if (!locked) wireResize(el);
          return el;
        }
        el.innerHTML =
          '<div class="thumb"></div>' +
          '<div style="flex:1;min-width:0">' +
            '<h4>' + section.title + '</h4>' +
            '<p>' + (section.caption || '') + '</p>' +
          mediaChip(topic, section) +
          '</div>' +
          (locked ? '<span class="lock">gated · key</span>' : '');
        el.addEventListener('click', () => {
          if (locked) { openPaywall(); return; }
          window.open(url, '_blank', 'noopener');
        });
        return el;
      }
      default:
        return document.createElement('div');
    }
  }

  function openPaywall() {
    const el = $('.video-card.locked');
    if (!el) return;
    const frag = paywallFragment();
    $('.m-subscribe-link', frag).href = subscribeUrl();
    el.appendChild(frag);
    el.classList.remove('locked');
    el.querySelector('.lock').textContent = 'key required';
  }

  /* A reachable trail from the current node to a notable hub of the archive. */
  function walkTrail(id) {
    const box = document.createElement('div');
    const HUBS = ['quantum-mechanics', 'supply-and-demand', 'game-theory', 'the-internet', 'the-calculus', 'double-entry-bookkeeping', 'dna-structure'];
    let found = null;
    for (const h of HUBS) {
      if (h === id) continue;
      const p = A.pathBetween(id, h);
      if (p.length >= 2) { found = { hub: h, path: p }; break; }
    }
    if (!found) {
      box.className = 'placeholder-box';
      box.textContent = 'No bridge yet to the main hubs of the archive.';
      return box;
    }
    const hub = A.nodeById(found.hub);
    found.path.forEach((stepId, i) => {
      const step = A.nodeById(stepId);
      const btn = document.createElement('button');
      btn.className = 'trail-step' + (i === 0 ? ' here' : '');
      btn.innerHTML =
        '<span class="t-num">' + String(i + 1).padStart(2, '0') + '</span>' +
        '<span class="t-label">' + step.label + '</span>' +
        (i === found.path.length - 1 ? '<span class="t-hub">\u2192 ' + hub.id + '</span>' : '');
      btn.addEventListener('click', () => goToNode(stepId));
      box.appendChild(btn);
    });
    return box;
  }

  function renderShelf(topic) {
    const shelf = $('#shelf');
    if (!shelf) return;
    shelf.innerHTML = '';
    const near = A.nearest(topic.id, { count: 8 });
    near.forEach(({ node, proximity }, idx) => {
      const locked = node.requiresAuth && !hasGrant(node.requiresAuth);
      const btn = document.createElement('button');
      btn.className = 'shelf' + (locked ? ' locked' : '');
      btn.innerHTML =
        '<span class="num">' + String(idx + 1).padStart(2, '0') + '</span>' +
        '<span class="s-body">' +
          '<span class="s-type">' + A.typeLabel(node.type) + '</span><br>' +
          '<span class="s-label">' + node.label + '</span><br>' +
          '<span class="s-sub">' + (node.gift || node.tag || '') + '</span>' +
        '</span>' +
        '<span class="s-prox">' + proximity + '%</span>';
      btn.addEventListener('click', () => goToNode(node.id));
      shelf.appendChild(btn);
    });

    // ---- The join · named connections (typed edges of the graph) ----
    const conn = document.createElement('section');
    conn.className = 'shelf-section';
    conn.innerHTML = '<div class="shelf-subhead">The join · named connections</div>';
    const edges = A.neighbors(topic.id);
    if (edges.length) {
      edges.slice(0, 10).forEach(({ node, kind }) => {
        const row = document.createElement('button');
        row.className = 'conn-row';
        row.innerHTML = '<span class="c-kind">' + A.edgeKindLabel(kind) + '</span><span class="c-label">' + node.label + '</span>';
        row.addEventListener('click', () => goToNode(node.id));
        conn.appendChild(row);
      });
    } else {
      const hint = document.createElement('div');
      hint.className = 'placeholder-box';
      hint.textContent = 'This node\u2019s edges are still being catalogued.';
      conn.appendChild(hint);
    }
    shelf.appendChild(conn);

    // ---- Reach · a trail between this node and a hub of the graph ----
    const pos = A.graphPosition(topic.id);
    const reach = document.createElement('section');
    reach.className = 'shelf-section';
    reach.innerHTML = '<div class="shelf-subhead">Reach \u00B7 walk the graph</div>';
    reach.appendChild(walkTrail(topic.id, pos));
    shelf.appendChild(reach);

    // ---- Aspects · multi-domain views ----
    const aspects = document.createElement('section');
    aspects.className = 'shelf-section';
    aspects.innerHTML = '<div class="shelf-subhead">Aspects — multi-domain views</div>';
    if (topic.views && topic.views.length) {
      topic.views.forEach(v => {
        const p = A.proximityToVector(topic.vector || {}, v.vector || {});
        const row = document.createElement('div');
        row.className = 'view-bar';
        row.innerHTML =
          '<div class="vb-head"><span>' + v.label + '</span><span class="vb-pct">' + Math.round(p * 100) + '%</span></div>' +
          '<div class="vb-track"><div class="vb-fill" style="width:' + Math.round(p * 100) + '%"></div></div>' +
          '<div class="vb-sub">' + v.domain + '</div>';
        aspects.appendChild(row);
      });
    } else {
      const hint = document.createElement('div');
      hint.className = 'placeholder-box';
      hint.textContent = 'This node speaks in one voice. For multi-domain aspects, open a Person who saw the world from several angles.';
      aspects.appendChild(hint);
    }
    shelf.appendChild(aspects);

    // ---- The Spark ─ placeholder ----
    const spark = document.createElement('section');
    spark.className = 'shelf-section';
    spark.innerHTML =
      '<div class="shelf-subhead">⚡ The Spark</div>' +
      '<div class="placeholder-box">Run this node like a living thing — walk its neighbourhood breath by breath. <span class="issue">(feature coming soon)</span></div>' +
      '<button class="btn act-btn disabled" disabled>Run the Spark <em>(coming soon)</em></button>';
    shelf.appendChild(spark);

    // ---- Sharing out ─ placeholder ----
    const share = document.createElement('section');
    share.className = 'shelf-section';
    share.innerHTML =
      '<div class="shelf-subhead">↗ Sharing out</div>' +
      '<div class="placeholder-box">Cut a card of this node and hand it to someone who never asked for it. <span class="issue">(feature coming soon)</span></div>' +
      '<button class="btn act-btn disabled" disabled>Share a citation <em>(coming soon)</em></button>';
    shelf.appendChild(share);

    // ---- Etymology · who coined the word ----
    const ety = document.createElement('section');
    ety.className = 'shelf-section';
    ety.innerHTML = '<div class="shelf-subhead">Etymology — who coined the word</div>';
    let et = null;
    if (topic.etymologyId) et = A.nodeById(topic.etymologyId);
    if (!et) {
      // fall back to the nearest etymology node in the concept space
      const etys = A.store().nodes.filter(n => n.type === 'etymology');
      let best = null, bp = 0;
      for (const e of etys) {
        const p = A.proximityToVector(topic.vector || {}, e.vector || {});
        if (p > bp) { bp = p; best = e; }
      }
      if (best && bp > 0.15) et = best;
    }
    const card = document.createElement('div');
    if (et) {
      card.className = 'etymology-card';
      card.innerHTML =
        '<div class="ec-term">' + et.term + '</div>' +
        '<div class="ec-by">coined by <em>' + et.coinedBy + '</em> — ' + (et.coinYear || '') + '</div>' +
        '<div class="ec-origin">' + et.origin + '</div>' +
        '<p>' + et.summary + '</p>';
      card.addEventListener('click', () => goToNode(et.id));
    } else {
      card.className = 'placeholder-box';
      card.textContent = 'No confirmed coining nearby. The library is still crowding toward a word root for this node.';
    }
    ety.appendChild(card);
    shelf.appendChild(ety);
  }

  function wireFacts() {
    const params = new URLSearchParams(location.search);
    state.topicId = params.get('topic') || 'the-atom';
    renderTopic();

    // mini search
    const mini = $('#mini-search');
    if (mini) {
      mini.addEventListener('submit', e => {
        e.preventDefault();
        const q = $('#mini-q', mini).value;
        location.href = 'index.html?q=' + encodeURIComponent(q);
      });
    }
  }

  /* ---------------- subscribe button ---------------- */

  function wireSubscribe() {
    document.querySelectorAll('[data-subscribe]').forEach(btn => {
      btn.href = subscribeUrl();
    });
  }

  /* ---------------- install prompt (PWA) ---------------- */

  let deferredPrompt = null;

  function wireInstall() {
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      deferredPrompt = e;
      const banner = $('#install-banner');
      if (banner) banner.classList.add('show');
      const top = $('#install-btn');
      if (top) top.style.display = '';
    });

    const doInstall = $('#install-btn');
    const bannerInstall = $('#install-banner-btn');
    const triggerInstall = async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      const banner = $('#install-banner');
      if (banner) banner.classList.remove('show');
    };
    if (doInstall) doInstall.addEventListener('click', triggerInstall);
    if (bannerInstall) bannerInstall.addEventListener('click', triggerInstall);
    const dismiss = $('#install-dismiss');
    if (dismiss) dismiss.addEventListener('click', () => {
      const banner = $('#install-banner');
      if (banner) banner.classList.remove('show');
    });
    window.addEventListener('appinstalled', () => {
      const banner = $('#install-banner');
      if (banner) banner.classList.remove('show');
      const top = $('#install-btn');
      if (top) top.style.display = 'none';
    });
  }

  function wireSW() {
    if ('serviceWorker' in navigator && (location.protocol === 'http:' || location.protocol === 'https:')) {
      navigator.serviceWorker.register('sw.js').catch(() => { /* fine */ });
    }
  }

  /* ---------------- alpaca loading animation ---------------- */

  let loaderTimer = null;
  let loaderShownAt = 0;
  const LOADER_LINES = ['assembling the library', 'herding the vectors', 'fetching nodes', 'lighting the shelf'];
  const LOADER_MIN_MS = 900;   // minimum time the loader stays on screen
  const LOADER_FADE_MS = 400;  // keep in step with the CSS transition (0.35s)

  function showLoader() {
    if ($('#alpaca-loader')) return;
    loaderShownAt = Date.now();
    const overlay = document.createElement('div');
    overlay.className = 'alpaca-loader';
    overlay.id = 'alpaca-loader';
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-live', 'polite');
    overlay.innerHTML =
      '<div class="al-anim">' +
        '<div class="al-orbit">' +
          '<span class="al-dot d1"></span><span class="al-dot d2"></span>' +
          '<span class="al-dot d3"></span><span class="al-dot d4"></span>' +
        '</div>' +
        '<svg class="al-mark" viewBox="0 0 512 512" aria-hidden="true"></svg>' +
      '</div>' +
      '<div class="al-caption"><span class="al-line"></span><span class="al-dots">\u2026</span></div>';
    const brand = document.querySelector('.brand svg, .mark svg');
    if (brand) {
      const svg = overlay.querySelector('.al-mark');
      svg.innerHTML = brand.innerHTML;
      svg.setAttribute('viewBox', brand.getAttribute('viewBox') || '0 0 512 512');
    }
    document.body.appendChild(overlay);
    const line = overlay.querySelector('.al-line');
    let i = 0;
    line.textContent = LOADER_LINES[0];
    loaderTimer = setInterval(() => {
      i = (i + 1) % LOADER_LINES.length;
      line.textContent = LOADER_LINES[i];
    }, 1400);
  }

  function hideLoader() {
    if (loaderTimer) { clearInterval(loaderTimer); loaderTimer = null; }
    const overlay = $('#alpaca-loader');
    if (!overlay) return;
    // keep the loader a beat after the content arrives, then fade it out
    const wait = Math.max(0, LOADER_MIN_MS - (Date.now() - loaderShownAt));
    setTimeout(() => {
      overlay.classList.add('done');
      setTimeout(() => { overlay.remove(); }, LOADER_FADE_MS);
    }, wait);
  }

  /* ---------------- boot ---------------- */

  (async function boot() {
    showLoader();
    await A.load();
    readAuth();

    if (state.page === 'home') wireHome();
    else wireFacts();

    wireSubscribe();
    wireInstall();
    wireSW();
    hideLoader();
  })();
})();
