/* ============================================================
   ALPACA — simulations
   Orbit Jumps: Bohr's atom on canvas. Excite an electron and it
   jumps to a higher shell; relax it and it emits a photon.
   Supply & Demand: drag the curve; watch the crossing point.
   Prisoner's Dilemma: one round against a scripted partner.
   ============================================================ */

(function () {
  'use strict';

  // shell radii (fraction of canvas half-size), base levels 1..3
  const SHELLS = [0.28, 0.5, 0.74];
  const N_ELECTRONS = 3;

  const PHOTON_COLORS = {
    1: { from: '#C99A57', to: '#D97A46', label: 'orange photon' },
    2: { from: '#93A884', to: '#7FA56B', label: 'green photon' },
    3: { from: '#7FA8C9', to: '#5F8FC9', label: 'blue photon' }
  };

  /* ------------------------- shared helpers ------------------------- */

  function simCanvas(shellEl, statusEl) {
    const canvas = document.createElement('canvas');
    canvas.className = 'sim-canvas';
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    function resize() {
      const w = canvas.clientWidth || 640;
      const h = canvas.clientHeight || 340;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);
    if (!shellEl.contains(statusEl)) shellEl.appendChild(statusEl);
    shellEl.insertBefore(canvas, statusEl);
    return {
      canvas, ctx,
      w() { return canvas.clientWidth || 640; },
      h() { return canvas.clientHeight || 340; },
      destroy() { window.removeEventListener('resize', resize); }
    };
  }

  function simControls(shellEl, html) {
    const controls = document.createElement('div');
    controls.className = 'sim-controls';
    controls.innerHTML = html;
    const head = shellEl.querySelector('.sim-head');
    if (head) head.appendChild(controls);
    return controls;
  }

  function simStatus(statusEl, html) {
    if (statusEl) statusEl.innerHTML = html;
  }

  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* ------------------------- orbit jumps ------------------------- */

  function startSimulation(shellEl, statusEl) {
    const canvas = document.createElement('canvas');
    canvas.className = 'sim-canvas';
    const controls = document.createElement('div');
    controls.className = 'sim-controls';
    controls.innerHTML =
      '<button class="btn" data-action="excite">Kick ↑</button>' +
      '<button class="btn btn-accent" data-action="relax">Relax ↓</button>';
    const head = shellEl.querySelector('.sim-head');
    if (head) head.appendChild(controls);
    if (!shellEl.contains(statusEl)) shellEl.appendChild(statusEl);
    shellEl.insertBefore(canvas, statusEl);

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    const electrons = [];
    for (let i = 0; i < N_ELECTRONS; i++) {
      electrons.push({
        shell: i + 1,               // occupied shell (1..3)
        angle: (i / N_ELECTRONS) * Math.PI * 2,
        speed: 0.6 + i * 0.22,
        target: null,               // shell being animated toward
        from: null,
        t: 0,
        photon: null                // emitted photon while dropping
      });
    }

    let raf = null;
    let now = 0;

    function resize() {
      const w = canvas.clientWidth || 640;
      const h = canvas.clientHeight || 340;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function setStatus(html) {
      if (statusEl) statusEl.innerHTML = html;
    }

    function announce(html) {
      setStatus(html);
      if (statusEl) statusEl.classList.add('photon-tag-active');
    }

    function excite() {
      for (const e of electrons) {
        if (e.target !== null) continue;      // already moving
        if (e.shell < SHELLS.length) {
          e.target = e.shell + 1;
          e.from = e.shell;
          e.t = 0;
          announce('Electron kicked to shell ' + e.target + ' — it absorbs one quantum of light.');
          return;
        }
      }
      setStatus('Every electron is already at its outermost shell. Nothing left to kick.');
    }

    function relax() {
      for (const e of electrons) {
        if (e.target !== null) continue;
        if (e.shell > 1) {
          e.target = e.shell - 1;
          e.from = e.shell;
          e.t = 0;
          // photon flies outward from the old shell
          const c = PHOTON_COLORS[e.shell];
          e.photon = {
            r0: SHELLS[e.shell - 1],
            progress: 0,
            color: c
          };
          announce('Electron falls to shell ' + e.target + ' — emitting one <span class="photon-tag">' + c.label + '</span>.');
          return;
        }
      }
      setStatus('All electrons rest on the innermost shell. There is no lower stair.');
    }

    function drawBackground() {
      ctx.fillStyle = '#120D0A';
      ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    }

    function drawNucleus(cx, cy, rMax) {
      const r = rMax * 0.075;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = '#D97A46';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.45, 0, Math.PI * 2);
      ctx.fillStyle = '#F0A878';
      ctx.fill();
    }

    function drawShells(cx, cy, rMax) {
      ctx.strokeStyle = 'rgba(237,228,214,0.16)';
      ctx.lineWidth = 1;
      for (const s of SHELLS) {
        ctx.beginPath();
        ctx.arc(cx, cy, rMax * s, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    function shellRadius(e) {
      const s = e.target !== null ? e.from : e.shell;
      return SHELLS[s - 1];
    }

    function drawElectrons(cx, cy, rMax) {
      for (const e of electrons) {
        const r = shellRadius(e);
        // ease toward target shell
        if (e.target !== null) {
          e.t += 0.028;
          const eased = 1 - Math.pow(1 - Math.min(e.t, 1), 3);
          const targetR = SHELLS[e.target - 1];
          const rr = r + (targetR - r) * eased;
          if (e.t >= 1) { e.shell = e.target; e.target = null; }
          const x = cx + Math.cos(e.angle) * rMax * rr;
          const y = cy + Math.sin(e.angle) * rMax * rr;
          drawDot(x, y, 3.4, '#E6DAC4');
          continue;
        }
        e.angle += e.speed * 0.012;
        const x = cx + Math.cos(e.angle) * rMax * r;
        const y = cy + Math.sin(e.angle) * rMax * r;
        drawDot(x, y, 3.4, '#E6DAC4');
      }
    }

    function drawDot(x, y, r, color) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y, r * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fill();
    }

    function drawPhotons(cx, cy, rMax) {
      for (const e of electrons) {
        if (!e.photon) continue;
        e.photon.progress += 0.045;
        const p = Math.min(e.photon.progress, 1);
        const rr = e.photon.r0 + p * 0.5;
        const x = cx + Math.cos(e.angle) * rMax * rr;
        const y = cy + Math.sin(e.angle) * rMax * rr;
        const a = 1 - p;
        ctx.globalAlpha = Math.max(a, 0.05);
        ctx.beginPath();
        ctx.arc(x, y, 3.2, 0, Math.PI * 2);
        ctx.fillStyle = e.photon.color.from;
        ctx.fill();
        ctx.globalAlpha = 1;
        if (p >= 1) e.photon = null;
      }
    }

    function frame() {
      const w = canvas.clientWidth || 640;
      const h = canvas.clientHeight || 340;
      const cx = w / 2, cy = h / 2;
      const rMax = Math.min(w, h) / 2 * 0.92;

      drawBackground();
      drawShells(cx, cy, rMax);
      drawNucleus(cx, cy, rMax);
      drawPhotons(cx, cy, rMax);
      drawElectrons(cx, cy, rMax);

      raf = requestAnimationFrame(frame);
    }

    resize();
    window.addEventListener('resize', resize);
    setStatus('A settled hydrogen-ish atom: three electrons, three shells, nothing happening yet.');

    // wire controls
    if (shellEl) {
      const exciteBtn = shellEl.querySelector('[data-action="excite"]');
      const relaxBtn = shellEl.querySelector('[data-action="relax"]');
      if (exciteBtn) exciteBtn.addEventListener('click', excite);
      if (relaxBtn) relaxBtn.addEventListener('click', relax);
    }

    raf = requestAnimationFrame(frame);

    return {
      destroy() {
        cancelAnimationFrame(raf);
        window.removeEventListener('resize', resize);
      }
    };
  }

  /* ------------------------- supply & demand ------------------------- */

  // Canvas-based: a fixed supply curve, a draggable demand curve,
  // and the crossing point that emerges without anyone deciding it.
  function supplyDemandSim(shellEl, statusEl) {
    const canvas = document.createElement('canvas');
    canvas.className = 'sim-canvas';
    const controls = document.createElement('div');
    controls.className = 'sim-controls';
    controls.innerHTML =
      '<button class="btn" data-action="reset">Reset</button>' +
      '<span class="sim-hint">drag the demand curve</span>';
    const head = shellEl.querySelector('.sim-head');
    if (head) head.appendChild(controls);
    if (!shellEl.contains(statusEl)) shellEl.appendChild(statusEl);
    shellEl.insertBefore(canvas, statusEl);

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    // demand: price = a - b*q. drag changes intercept.
    let demandIntercept = 0.72;
    let dragging = false;

    function resize() {
      const w = canvas.clientWidth || 640;
      const h = canvas.clientHeight || 340;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function pxOf(xFrac) { return 44 + xFrac * (canvas.clientWidth - 88); }
    function pyOf(yFrac) { return canvas.clientHeight - 40 - yFrac * (canvas.clientHeight - 80); }

    function demandPrice(q) { return demandIntercept * (1 - q); }
    function supplyPrice(q) { return 0.12 + 0.6 * q; }

    function draw() {
      ctx.fillStyle = '#120D0A';
      ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);

      // grid lines + axis labels
      ctx.strokeStyle = 'rgba(237,228,214,0.08)';
      ctx.lineWidth = 1;
      for (let i = 1; i < 5; i++) {
        const y = pyOf(i / 5);
        ctx.beginPath(); ctx.moveTo(44, y); ctx.lineTo(canvas.clientWidth - 44, y); ctx.stroke();
      }

      // supply curve (fixed)
      ctx.strokeStyle = '#93A884';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let q = 0; q <= 1; q += 0.02) {
        const x = pxOf(q), y = pyOf(supplyPrice(q));
        q === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();

      // demand curve (draggable)
      ctx.strokeStyle = '#D97A46';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let q = 0; q <= 1; q += 0.02) {
        const x = pxOf(q), y = pyOf(demandPrice(q));
        q === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();

      // equilibrium
      let lo = 0, hi = 1;
      for (let i = 0; i < 40; i++) {
        const mid = (lo + hi) / 2;
        if (demandPrice(mid) > supplyPrice(mid)) lo = mid; else hi = mid;
      }
      const qe = (lo + hi) / 2;
      const pe = demandPrice(qe);
      const ex = pxOf(qe), ey = pyOf(pe);

      // surplus / shortage shading
      ctx.fillStyle = 'rgba(217,122,70,0.12)';
      ctx.fillRect(pxOf(qe), pyOf(1), pxOf(1) - pxOf(qe), pyOf(0) - pyOf(1));

      ctx.strokeStyle = '#E6DAC4';
      ctx.lineWidth = 1.4;
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(ex, pyOf(0)); ctx.lineTo(ex, ey); ctx.lineTo(pxOf(0), ey); ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#F6D76F';
      ctx.beginPath(); ctx.arc(ex, ey, 5, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = '#E6DAC4';
      ctx.font = '12px IBM Plex Mono, monospace';
      ctx.fillText('Q*', ex + 8, ey - 8);
      ctx.fillText('P*', 30, ey + 4);
      ctx.fillText('quantity →', pxOf(0.82), canvas.clientHeight - 16);
      ctx.fillText('↑ price', 12, pyOf(0.85));

      const statusText = 'The curves cross at quantity ' + Math.round(qe * 100) + '%, price ' + Math.round(pe * 100) + '%. Nobody decided it — the crossing point emerged.';
      if (statusEl) statusEl.innerHTML = statusText;
    }

    function toFrac(clientX) {
      const rect = canvas.getBoundingClientRect();
      return Math.max(0, Math.min(1, (clientX - rect.left - 44) / (rect.width - 88)));
    }

    canvas.addEventListener('pointerdown', e => {
      const q = toFrac(e.clientX);
      const y = (e.clientY - 40) / (canvas.clientHeight - 80);
      if (Math.abs(y - (1 - demandPrice(q))) < 0.12) dragging = true;
    });
    window.addEventListener('pointermove', e => {
      if (!dragging) return;
      const q = toFrac(e.clientX);
      demandIntercept = Math.max(0.25, Math.min(1.0, demandPrice(q) + 0.2));
      draw();
    });
    window.addEventListener('pointerup', () => { dragging = false; });
    const resetBtn = shellEl.querySelector('[data-action="reset"]');
    if (resetBtn) resetBtn.addEventListener('click', () => { demandIntercept = 0.72; draw(); });

    resize();
    window.addEventListener('resize', resize);
    draw();

    return {
      destroy() {
        window.removeEventListener('resize', resize);
      }
    };
  }

  /* ------------------------- prisoner's dilemma ------------------------- */

  // One shot against a scripted partner. Two buttons; the matrix
  // explains the four possible outcomes before you choose.
  function prisonersDilemmaSim(shellEl, statusEl) {
    const box = document.createElement('div');
    box.className = 'pd-wrap';
    if (!shellEl.contains(statusEl)) shellEl.appendChild(statusEl);
    shellEl.insertBefore(box, statusEl);

    // payoff matrix: rows = you, cols = partner
    const payoffs = {
      'CC': { you: 1, them: 1, note: 'Both silent — both serve one year. Best shared outcome.' },
      'CD': { you: 0, them: 3, note: 'You stay silent, they confess. You take the blame alone.' },
      'DC': { you: 3, them: 0, note: 'You confess, they stay silent. You walk free.' },
      'DD': { you: 2, them: 2, note: 'Both confess — both serve two years. The rational trap.' }
    };

    box.innerHTML =
      '<div class="pd-matrix">' +
        '<div class="pd-cell pd-corner"></div>' +
        '<div class="pd-cell pd-colh">partner: silent</div>' +
        '<div class="pd-cell pd-colh">partner: confesses</div>' +
        '<div class="pd-cell pd-rowh">you: silent</div>' +
        '<div class="pd-cell pd-data" data-k="CC">1 / 1</div>' +
        '<div class="pd-cell pd-data" data-k="CD">0 / 3</div>' +
        '<div class="pd-cell pd-rowh">you: confess</div>' +
        '<div class="pd-cell pd-data" data-k="DC">3 / 0</div>' +
        '<div class="pd-cell pd-data" data-k="DD">2 / 2</div>' +
      '</div>' +
      '<div class="pd-actions">' +
        '<button class="btn" data-choice="silent">Stay silent</button>' +
        '<button class="btn btn-accent" data-choice="confess">Confess</button>' +
      '</div>';

    const statusText = el => {
      if (!statusEl) return;
      statusEl.innerHTML = el;
    };
statusText("The matrix shows years each side serves. The partner's choice is already written — go.");

    box.querySelectorAll('[data-choice]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (box.dataset.done) return;
        box.dataset.done = '1';
        const you = btn.dataset.choice === 'confess' ? 'C' : 'S';
        const partner = Math.random() < 0.5 ? 'C' : 'S';
        const k = you + partner;
        const p = payoffs[k];
        box.querySelectorAll('[data-k]').forEach(cell => {
          if (cell.dataset.k === k) cell.classList.add('hl');
        });
        statusText('You ' + (you === 'C' ? 'confessed' : 'stayed silent') + '; your partner ' + (partner === 'C' ? 'confessed' : 'stayed silent') + '. ' + p.note + ' <button class="btn pd-again" data-again>again</button>');
        const again = box.querySelector('.pd-again');
        if (again) again.addEventListener('click', () => {
          box.dataset.done = '';
          box.querySelectorAll('[data-k]').forEach(cell => cell.classList.remove('hl'));
statusText("The matrix shows years each side serves. The partner's choice is already written — go.");
        });
      });
    });

    return { destroy() {} };
  }

  /* ------------------------- bisect (binary-search the history) ------------------------- */

  function bisectSim(shellEl, statusEl) {
    const S = simCanvas(shellEl, statusEl);
    const ctx = S.ctx;
    const N = 16;
    let bug, lo, hi, found, probes;
    const controls = simControls(shellEl, '<button class="btn" data-a="reset">Reset</button><span class="sim-hint">click a commit — always cut at the midpoint</span>');
    controls.querySelector('[data-a="reset"]').addEventListener('click', reset);
    function reset() {
      bug = 1 + Math.floor(Math.random() * (N - 2));
      lo = 0; hi = N - 1; found = false; probes = 0;
      draw();
      simStatus(statusEl, 'The bug entered history at one of ' + N + ' commits. Click a commit; the archive will say whether the bug is before or after it. Cut at the dashed midpoint and the search halves every probe.');
    }
    function draw() {
      const w = S.w(), h = S.h();
      const m = 46, top = h * 0.32, bottom = h * 0.62, mid = (top + bottom) / 2;
      ctx.fillStyle = '#120D0A'; ctx.fillRect(0, 0, w, h);
      const bw = (w - m * 2) / N;
      for (let i = 0; i < N; i++) {
        const x = m + i * bw;
        ctx.fillStyle = (i >= lo && i <= hi) ? 'rgba(201,154,87,0.12)' : 'rgba(237,228,214,0.04)';
        ctx.fillRect(x, top, bw, bottom - top);
        const isBug = found && i === bug;
        ctx.fillStyle = isBug ? '#D97A46' : '#3A2F22';
        rr(ctx, x + bw / 2 - 9, mid - 9, 18, 18, 4);
        ctx.fill();
        ctx.fillStyle = isBug ? '#F6D76F' : '#8A7C68';
        ctx.font = '9px IBM Plex Mono, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(String(i), x + bw / 2, mid + 3.5);
      }
      const midIdx = Math.floor((lo + hi) / 2);
      const mx = m + (midIdx + 0.5) * bw;
      ctx.strokeStyle = '#C99A57';
      ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.moveTo(mx, top - 12); ctx.lineTo(mx, bottom + 12); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#C99A57'; ctx.font = '10px IBM Plex Mono, monospace'; ctx.textAlign = 'left';
      ctx.fillText('cut here', mx + 5, top - 16);
      ctx.fillStyle = '#E6DAC4';
      ctx.font = '11px IBM Plex Mono, monospace';
      ctx.textAlign = 'left';
      ctx.fillText('scope: commits ' + lo + '\u2013' + hi + '  (' + (hi - lo + 1) + ' suspects)', m, h - 16);
    }
    S.canvas.addEventListener('click', e => {
      if (found) return;
      const rect = S.canvas.getBoundingClientRect();
      const bw = (S.w() - 92) / N;
      const i = Math.floor((e.clientX - rect.left - 46) / bw);
      if (i < 0 || i > N - 1) return;
      probes++;
      if (i === bug) { found = true; finish(); return; }
      if (i > bug) hi = i - 1; else lo = i + 1;
      if (lo >= hi) { found = true; finish(); return; }
      draw();
      simStatus(statusEl, 'Probe ' + probes + ': the archive says the bug is ' + (i > bug ? 'before commit ' + i : 'after commit ' + i) + '. Suspects left: ' + (hi - lo + 1) + '.');
    });
    function finish() {
      draw();
      simStatus(statusEl, 'Commit ' + bug + ' introduced the bug — found in ' + probes + ' probes. The bound is ceil(log\u2082 ' + N + ') = ' + Math.ceil(Math.log2(N)) + ' because each probe halves the search space. <button class="btn btn-accent" data-bisect-again>run again</button>');
      const again = statusEl.querySelector('[data-bisect-again]');
      if (again) again.addEventListener('click', reset);
    }
    reset();
    return { destroy() { S.destroy(); } };
  }

  /* ------------------------- version control (commit / branch / merge) ------------------------- */

  function versionControlSim(shellEl, statusEl) {
    const S = simCanvas(shellEl, statusEl);
    const ctx = S.ctx;
    let seq = 0, trunkCount = 1, br = null;
    const controls = simControls(shellEl, '<button class="btn" data-a="commit">Commit</button><button class="btn" data-a="branch">Branch</button><button class="btn btn-accent" data-a="merge">Merge</button><button class="btn" data-a="reset">Reset</button>');
    controls.querySelector('[data-a="commit"]').addEventListener('click', () => { commit(); draw(); });
    controls.querySelector('[data-a="branch"]').addEventListener('click', () => { branch(); draw(); });
    controls.querySelector('[data-a="merge"]').addEventListener('click', () => { merge(); draw(); });
    controls.querySelector('[data-a="reset"]').addEventListener('click', reset);
    function commit() { if (br && br.open) br.points.push(seq++); else trunkCount++; }
    function branch() { if (!br) br = { base: trunkCount - 1, points: [], open: true }; }
    function merge() { if (br && br.open && br.points.length) { trunkCount += br.points.length; br.open = false; } }
    function reset() { seq = 0; trunkCount = 1; br = null; draw(); }
    function draw() {
      const w = S.w(), h = S.h();
      ctx.fillStyle = '#120D0A'; ctx.fillRect(0, 0, w, h);
      const m = 46, yTrunk = h * 0.66, yBranch = h * 0.30;
      const n = trunkCount + (br ? br.points.length : 0);
      const dx = (w - m * 2) / Math.max(n, 3);
      const cx = i => m + i * dx + dx / 2;
      if (trunkCount > 1) {
        ctx.strokeStyle = 'rgba(201,154,87,0.6)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(cx(0), yTrunk);
        for (let i = 1; i < trunkCount; i++) ctx.lineTo(cx(i), yTrunk);
        ctx.stroke();
      }
      for (let i = 0; i < trunkCount; i++) {
        const isHead = i === trunkCount - 1;
        ctx.fillStyle = isHead ? '#C99A57' : '#5C4A37';
        ctx.beginPath(); ctx.arc(cx(i), yTrunk, isHead ? 9 : 6, 0, Math.PI * 2); ctx.fill();
      }
      if (br) {
        ctx.strokeStyle = 'rgba(237,228,214,0.25)'; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(cx(br.base), yTrunk); ctx.lineTo(cx(br.base), yBranch); ctx.stroke();
        ctx.setLineDash([]);
        const pts = br.points.map((_, k) => br.base + 1 + k);
        for (let i = 0; i < pts.length; i++) {
          const x = cx(pts[i]), y = yBranch + (i % 2 ? 12 : 0);
          const isHead = br.open && i === pts.length - 1;
          ctx.fillStyle = isHead ? '#D97A46' : '#7A4A34';
          ctx.beginPath(); ctx.arc(x, y, isHead ? 8 : 5, 0, Math.PI * 2); ctx.fill();
          if (i > 0) {
            ctx.strokeStyle = 'rgba(217,122,70,0.5)'; ctx.lineWidth = 1.2;
            ctx.beginPath(); ctx.moveTo(cx(pts[i - 1]), yBranch + ((i - 1) % 2 ? 12 : 0)); ctx.lineTo(x, y); ctx.stroke();
          }
        }
        if (!br.open && br.points.length) {
          ctx.strokeStyle = 'rgba(147,168,132,0.7)'; ctx.setLineDash([3, 3]); ctx.lineWidth = 1.3;
          ctx.beginPath(); ctx.moveTo(cx(br.base + br.points.length), yBranch); ctx.lineTo(cx(br.base + br.points.length), yTrunk); ctx.stroke();
          ctx.setLineDash([]);
        }
      }
      ctx.fillStyle = '#E6DAC4'; ctx.font = '11px IBM Plex Mono, monospace'; ctx.textAlign = 'left';
      ctx.fillText('trunk', m, yTrunk + 24);
      if (br && br.open) { ctx.fillStyle = '#D97A46'; ctx.fillText('branch', m, yBranch - 14); }
      const msg = (br && br.open)
        ? 'A branch is open, forked at commit ' + br.base + ' with ' + br.points.length + ' new commit(s). Histories have diverged — the trunk goes on without it.'
        : (trunkCount > 1
          ? 'The trunk holds ' + trunkCount + ' commits, each a child of the last. Commit to grow it, branch to fork it, merge to rejoin.'
          : 'A single initial commit. Every future commit is a child of this one — that chain is the archive.');
      simStatus(statusEl, msg);
    }
    reset();
    return { destroy() { S.destroy(); } };
  }

  /* ------------------------- tdd loop (red / green / refactor) ------------------------- */

  function tddLoopSim(shellEl, statusEl) {
    const box = document.createElement('div');
    box.className = 'tdd-wrap';
    if (!shellEl.contains(statusEl)) shellEl.appendChild(statusEl);
    shellEl.insertBefore(box, statusEl);
    let phase = 'none', loops = 0, passing = 0;
    box.innerHTML =
      '<div class="tdd-lamps">' +
        '<div class="lamp" data-l="red"><span class="lamp-dot"></span>RED</div>' +
        '<div class="lamp" data-l="green"><span class="lamp-dot"></span>GREEN</div>' +
        '<div class="lamp" data-l="ref"><span class="lamp-dot"></span>REFACTOR</div>' +
      '</div>' +
      '<div class="tdd-actions">' +
        '<button class="btn" data-a="test">Write a failing test</button>' +
        '<button class="btn btn-accent" data-a="pass">Make it pass</button>' +
        '<button class="btn" data-a="refactor">Refactor</button>' +
      '</div>' +
      '<div class="tdd-score"><span>loop</span><b class="t-loop">0</b> <span>&nbsp;\u00B7&nbsp;</span> <span>suite</span><b class="t-suite">0 passing</b></div>';
    const lampOf = l => box.querySelector('[data-l="' + l + '"]');
    const testBtn = box.querySelector('[data-a="test"]');
    const passBtn = box.querySelector('[data-a="pass"]');
    const refBtn = box.querySelector('[data-a="refactor"]');
    function setLamp(l) {
      box.querySelectorAll('.lamp').forEach(la => la.classList.remove('on-red', 'on-green', 'on-ref'));
      const x = lampOf(l);
      if (x) x.classList.add(l === 'red' ? 'on-red' : l === 'green' ? 'on-green' : 'on-ref');
    }
    function updateScore() {
      box.querySelector('.t-loop').textContent = loops;
      box.querySelector('.t-suite').textContent = passing + ' passing';
    }
    function doTest() { setLamp('red'); phase = 'red'; simStatus(statusEl, 'RED — you write a failing test first. It fails exactly as expected: the failure is a contract, stating precisely what the code must soon do.'); }
    function doPass() {
      if (phase !== 'red') { simStatus(statusEl, 'Nothing to make pass yet — write the failing test first.'); return; }
      setLamp('green'); phase = 'green'; passing++; updateScore();
      simStatus(statusEl, 'GREEN — the smallest possible code that satisfies the test. No refactoring yet: just make the suite go green. Tests now passing: ' + passing + '.');
    }
    function doRefactor() {
      if (phase !== 'green') { simStatus(statusEl, 'Refactor comes after green — the tests must be holding the behaviour still.'); return; }
      setLamp('ref'); phase = 'none'; loops++; updateScore();
      simStatus(statusEl, 'REFACTOR — improve the design without changing behaviour. The tests are the safety net. Loop complete. On to the next failing test.');
    }
    testBtn.addEventListener('click', doTest);
    passBtn.addEventListener('click', doPass);
    refBtn.addEventListener('click', doRefactor);
    updateScore();
    simStatus(statusEl, 'The test-driven loop: red, green, refactor. Write the failing test first — the failure is the specification.');
    return { destroy() {} };
  }

  /* ------------------------- phases vs iterations (waterfall against agile) ------------------------- */

  function phasesVsIterationsSim(shellEl, statusEl) {
    const S = simCanvas(shellEl, statusEl);
    const ctx = S.ctx;
    const controls = simControls(shellEl, '<button class="btn btn-accent" data-a="play">Play</button><button class="btn" data-a="reset">Reset</button>');
    const playBtn = controls.querySelector('[data-a="play"]');
    let week = 0, playing = false, raf = null;
    const WEEKS = 17, CHANGE = 8;
    const COLORS = { requirements: '#8A7C68', design: '#93A884', code: '#7FA8C9', test: '#D97A46', ship: '#C99A57', rework: 'rgba(217,122,70,0.55)' };
    function reset() {
      playing = false; if (raf) cancelAnimationFrame(raf); raf = null; week = 0; playBtn.textContent = 'Play';
      draw();
      simStatus(statusEl, 'Two ways to build the same thing over 16 weeks. A change request arrives in week 8 — play and watch each camp respond.');
    }
    function draw() {
      const w = S.w(), h = S.h();
      ctx.fillStyle = '#120D0A'; ctx.fillRect(0, 0, w, h);
      const m = 46, top = 34, rowH = (h - top - 46) / 2;
      const X = f => m + (f / WEEKS) * (w - 2 * m);
      const band = (label, y) => {
        ctx.fillStyle = 'rgba(237,228,214,0.03)';
        ctx.fillRect(m, y, w - 2 * m, rowH - 14);
        ctx.fillStyle = '#8A7C68'; ctx.font = '11px IBM Plex Mono, monospace'; ctx.textAlign = 'left';
        ctx.fillText(label, m, y - 6);
      };
      band('waterfall \u2014 phases, once, in order', top);
      {
        let segs = [[0, 3, 'requirements'], [3, 3, 'design'], [6, 3, 'code'], [9, 2, 'test'], [11, 2, 'ship']];
        if (week >= CHANGE) segs = [[0, 3, 'requirements'], [3, 3, 'design'], [6, 3, 'code'], [9, 1, 'test'], [10, 2, 'rework'], [12, 2, 'test'], [14, 3, 'ship']];
        for (const [s, len, name] of segs) {
          const x0 = X(s), x1 = X(s + len);
          ctx.fillStyle = week > s ? COLORS[name] : 'rgba(237,228,214,0.05)';
          ctx.fillRect(x0, top + 12, x1 - x0 - 1, 10);
        }
        ctx.fillStyle = week >= CHANGE ? '#D97A46' : '#8A7C68';
        ctx.font = '9px IBM Plex Mono, monospace';
        ctx.fillText(week >= CHANGE ? 'the change forces rework + the ship slides' : 'change request lands at week 8', m, top + rowH - 2);
      }
      band('agile \u2014 a slice of everything, every 4 weeks', top + rowH);
      {
        const slices = [[0, 4], [4, 4], [8, 4]];
        for (const [s, len] of slices) {
          const x0 = X(s), x1 = X(s + len);
          ctx.fillStyle = week > s ? 'rgba(147,168,132,0.4)' : 'rgba(237,228,214,0.05)';
          ctx.fillRect(x0, top + rowH + 12, x1 - x0 - 1, 10);
          ctx.fillStyle = 'rgba(237,228,214,0.5)';
          for (let k = 1; k < 4; k++) ctx.fillRect(x0 + ((x1 - x0) / 4) * k - 0.5, top + rowH + 13, 1, 8);
        }
        ctx.fillStyle = '#93A884'; ctx.font = '9px IBM Plex Mono, monospace';
        ctx.fillText('slices ship at weeks 4, 8 and 12 \u2014 the change joins slice 3', m, top + rowH + rowH - 2);
      }
      const cxr = X(CHANGE);
      ctx.fillStyle = '#F6D76F';
      ctx.beginPath(); ctx.moveTo(cxr, top + 6); ctx.lineTo(cxr - 4, top + 13); ctx.lineTo(cxr + 4, top + 13); ctx.closePath(); ctx.fill();
      const wx = X(Math.min(week, WEEKS));
      ctx.strokeStyle = '#E6DAC4'; ctx.setLineDash([2, 3]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(wx, 26); ctx.lineTo(wx, h - 22); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#E6DAC4'; ctx.font = '10px IBM Plex Mono, monospace'; ctx.textAlign = 'left';
      ctx.fillText('week ' + Math.min(week, WEEKS), 8, h - 6);
      if (week >= 14) simStatus(statusEl, 'Waterfall ships, four weeks late: the late change forced a rework block through the frozen phases. Agile shipped slices at weeks 4, 8 and 12 — the change was just slice three\u2019s input. Same requirement, different outcome.');
      else if (week >= 11) simStatus(statusEl, 'Agile has shipped two slices and the week-8 change is queued into slice three. Waterfall is still test-fixing, with rework ahead of it.');
      else if (week >= CHANGE) simStatus(statusEl, 'Week 8 — a change request arrives. Waterfall faces the frozen spec: the plan said what it said. Agile treats the change as the next slice\u2019s backlog.');
      else simStatus(statusEl, 'Week ' + week + '. Above: waterfall, one phase at a time, in order. Below: agile, all phases, sliced, shipped frequently.');
    }
    playBtn.addEventListener('click', () => {
      if (playing) { playing = false; if (raf) cancelAnimationFrame(raf); raf = null; playBtn.textContent = 'Play'; return; }
      playing = true; playBtn.textContent = 'Pause';
      const step = () => {
        if (!playing) return;
        week++; draw();
        if (week < WEEKS) raf = requestAnimationFrame(step);
        else { playing = false; playBtn.textContent = 'Play'; }
      };
      raf = requestAnimationFrame(step);
    });
    controls.querySelector('[data-a="reset"]').addEventListener('click', reset);
    reset();
    return { destroy() { if (raf) cancelAnimationFrame(raf); raf = null; S.destroy(); } };
  }

  /* ------------------------- price war (Bertrand undercutting) ------------------------- */

  function priceWarSim(shellEl, statusEl) {
    const S = simCanvas(shellEl, statusEl);
    const ctx = S.ctx;
    let price = 1.0, turns = 0, timers = [];
    const FLOOR = 0.22;
    const controls = simControls(shellEl, '<button class="btn btn-accent" data-a="cut">Undercut 10%</button><button class="btn" data-a="reset">Reset</button><span class="sim-hint">the rival matches after a beat</span>');
    controls.querySelector('[data-a="cut"]').addEventListener('click', cut);
    controls.querySelector('[data-a="reset"]').addEventListener('click', reset);
    function clearTimers() { timers.forEach(t => clearTimeout(t)); timers = []; }
    function reset() { clearTimers(); price = 1.0; turns = 0; draw(); simStatus(statusEl, 'Two firms, identical goods. Price 100 cents, cost 22. The only way to steal the market is to be cheaper — and the other firm can always match you.'); }
    function cut() {
      turns++;
      price = Math.max(FLOOR, Number((price * 0.9).toFixed(3)));
      draw();
      if (price <= FLOOR + 0.02) { simStatus(statusEl, 'The floor: price equals marginal cost. Neither firm can profit by undercutting, because neither can profit at all — the Bertrand outcome, reached in ' + turns + ' rounds.'); return; }
      simStatus(statusEl, 'You undercut to ' + Math.round(price * 100) + '\u00A2. The rival will match you in a moment.');
      const t = setTimeout(() => {
        price = Math.max(FLOOR, Number((price * 0.92).toFixed(3)));
        turns++;
        draw();
        if (price <= FLOOR + 0.02) simStatus(statusEl, 'The rival matched, down to cost. Price ' + Math.round(price * 100) + '\u00A2 = marginal cost, profit zero — the Bertrand outcome, reached in ' + turns + ' rounds.');
        else simStatus(statusEl, 'Rival matches you: price ' + Math.round(price * 100) + '\u00A2, margin ' + Math.round((price - FLOOR) * 100) + '\u00A2 a unit. Undercut again?');
      }, 650);
      timers.push(t);
    }
    function draw() {
      const w = S.w(), h = S.h();
      ctx.fillStyle = '#120D0A'; ctx.fillRect(0, 0, w, h);
      const m = 50, top = 30, bottom = h - 34;
      const yOf = v => bottom - v * (bottom - top);
      const x0 = m + 60, x1 = w - m;
      const fy = yOf(FLOOR), ly = yOf(price);
      ctx.fillStyle = 'rgba(147,168,132,0.15)'; ctx.fillRect(x0, fy, x1 - x0, bottom - fy);
      ctx.strokeStyle = '#93A884'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(x0, fy); ctx.lineTo(x1, fy); ctx.stroke();
      ctx.fillStyle = '#93A884'; ctx.font = '10px IBM Plex Mono, monospace'; ctx.textAlign = 'left';
      ctx.fillText('marginal cost 22\u00A2', x0 + 8, fy - 5);
      const profit = Math.max(0, price - FLOOR);
      if (profit > 0.001) {
        ctx.fillStyle = 'rgba(246,215,111,0.22)';
        ctx.fillRect(x0, ly, x1 - x0, fy - ly);
      }
      ctx.strokeStyle = '#D97A46'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x0, ly); ctx.lineTo(x1, ly); ctx.stroke();
      ctx.fillStyle = '#D97A46';
      ctx.beginPath(); ctx.arc(x0, ly, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#E6DAC4'; ctx.font = '13px IBM Plex Mono, monospace'; ctx.textAlign = 'right';
      ctx.fillText(Math.round(price * 100) + '\u00A2', x0 - 12, ly + 4);
      ctx.strokeStyle = 'rgba(237,228,214,0.15)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x0, top - 8); ctx.lineTo(x0, bottom + 8); ctx.stroke();
      ctx.save(); ctx.translate(16, (top + bottom) / 2); ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = '#8A7C68'; ctx.font = '11px IBM Plex Mono, monospace'; ctx.textAlign = 'center';
      ctx.fillText('price', 0, 0); ctx.restore();
      ctx.fillStyle = '#E6DAC4'; ctx.font = '10px IBM Plex Mono, monospace'; ctx.textAlign = 'right';
      ctx.fillText('margin: ' + Math.round(profit * 100) + '\u00A2', w - m, h - 10);
    }
    reset();
    return { destroy() { clearTimers(); S.destroy(); } };
  }

  /* ------------------------- best responses (Cournot) ------------------------- */

  function bestResponseSim(shellEl, statusEl) {
    const S = simCanvas(shellEl, statusEl);
    const ctx = S.ctx;
    const EQ = { q1: 1 / 3, q2: 1 / 3 };
    let q = { q1: 0.12, q2: 0.66 }, dragging = false;
    const br1 = q2 => Math.max(0, (1 - q2) / 2);
    const br2 = q1 => Math.max(0, (1 - q1) / 2);
    const controls = simControls(shellEl, '<button class="btn" data-a="eq">Set to equilibrium</button><button class="btn" data-a="reset">Scatter</button><span class="sim-hint">drag the point</span>');
    controls.querySelector('[data-a="eq"]').addEventListener('click', () => { q = { q1: EQ.q1, q2: EQ.q2 }; draw(); });
    controls.querySelector('[data-a="reset"]').addEventListener('click', () => { q = { q1: 0.1 + Math.random() * 0.4, q2: 0.3 + Math.random() * 0.5 }; draw(); });
    S.canvas.addEventListener('pointerdown', e => { dragging = true; move(e); });
    window.addEventListener('pointermove', e => { if (dragging) move(e); });
    window.addEventListener('pointerup', () => { dragging = false; });
    function move(e) {
      const rect = S.canvas.getBoundingClientRect();
      q.q1 = Math.max(0, Math.min(1, (e.clientX - rect.left - 46) / (S.w() - 92)));
      q.q2 = Math.max(0, Math.min(1, (e.clientY - rect.top - 40) / (S.h() - 90)));
      draw();
    }
    function draw() {
      const w = S.w(), h = S.h();
      ctx.fillStyle = '#120D0A'; ctx.fillRect(0, 0, w, h);
      const mX = 46, mY = h - 46;
      const dim = Math.min(w - mX - 24, mY - 24);
      const PX = t => mX + t * dim;
      const PY = t => mY - t * dim;
      ctx.strokeStyle = 'rgba(237,228,214,0.25)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(mX, mY); ctx.lineTo(mX + dim, mY); ctx.moveTo(mX, mY); ctx.lineTo(mX, mY - dim); ctx.stroke();
      ctx.fillStyle = '#8A7C68'; ctx.font = '11px IBM Plex Mono, monospace'; ctx.textAlign = 'center';
      ctx.fillText('firm 1 output \u2192', mX + dim / 2, mY + 16);
      ctx.save(); ctx.translate(18, mY - dim / 2); ctx.rotate(-Math.PI / 2); ctx.fillText('firm 2 output \u2192', 0, 0); ctx.restore();
      ctx.strokeStyle = '#7FA8C9'; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let t = 0; t <= 1; t += 0.02) { const x = br1(t), y = t; t === 0 ? ctx.moveTo(PX(x), PY(y)) : ctx.lineTo(PX(x), PY(y)); }
      ctx.stroke();
      ctx.strokeStyle = '#D97A46'; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let t = 0; t <= 1; t += 0.02) { const x = t, y = br2(t); t === 0 ? ctx.moveTo(PX(x), PY(y)) : ctx.lineTo(PX(x), PY(y)); }
      ctx.stroke();
      ctx.fillStyle = '#7FA8C9'; ctx.font = '10px IBM Plex Mono, monospace'; ctx.textAlign = 'left';
      ctx.fillText('firm 1\u2019s best reply', PX(br1(0.9)), PY(0.12));
      ctx.fillStyle = '#D97A46';
      ctx.fillText('firm 2\u2019s', PX(0.7), PY(br2(0.7)) + 14);
      ctx.fillStyle = '#F6D76F';
      ctx.beginPath(); ctx.arc(PX(EQ.q1), PY(EQ.q2), 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#E6DAC4'; ctx.font = '9px IBM Plex Mono, monospace'; ctx.textAlign = 'right';
      ctx.fillText('Cournot\u2013Nash', PX(EQ.q1) - 9, PY(EQ.q2) - 8);
      const px = PX(q.q1), py = PY(q.q2);
      const t1 = br1(q.q2), t2 = br2(q.q1);
      ctx.setLineDash([4, 3]); ctx.lineWidth = 1;
      ctx.strokeStyle = '#7FA8C9';
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(PX(t1), PY(q.q2)); ctx.stroke();
      ctx.strokeStyle = '#D97A46';
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(PX(q.q1), PY(t2)); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#E6DAC4';
      ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#120D0A';
      ctx.beginPath(); ctx.arc(px, py, 2.5, 0, Math.PI * 2); ctx.fill();
      const atEq = Math.abs(q.q1 - EQ.q1) < 0.03 && Math.abs(q.q2 - EQ.q2) < 0.03;
      simStatus(statusEl, atEq
        ? 'Cournot\u2013Nash. At outputs (' + q.q1.toFixed(2) + ', ' + q.q2.toFixed(2) + ') each firm is playing its best reply to the other — neither gains by moving alone.'
        : 'Firm outputs: (' + q.q1.toFixed(2) + ', ' + q.q2.toFixed(2) + '). Firm 1\u2019s best reply to ' + q.q2.toFixed(2) + ' is ' + t1.toFixed(2) + ' (blue guide); firm 2\u2019s best reply to ' + q.q1.toFixed(2) + ' is ' + t2.toFixed(2) + ' (red guide). Follow both guides and the point settles where the curves cross.');
    }
    draw();
    return { destroy() { S.destroy(); } };
  }

  /* ------------------------- natural selection (population drift) ------------------------- */

  function naturalSelectionSim(shellEl, statusEl) {
    const S = simCanvas(shellEl, statusEl);
    const ctx = S.ctx;
    const N = 140;
    const controls = simControls(shellEl, '<button class="btn btn-accent" data-a="step">One generation</button><button class="btn" data-a="run">Run</button><button class="btn" data-a="flip">Flip gradient</button><button class="btn" data-a="reset">Reset</button>');
    const stepBtn = controls.querySelector('[data-a="step"]'), runBtn = controls.querySelector('[data-a="run"]');
    let pop = [], gen = 0, gradient = 'left', running = false, raf = null;
    function fresh() { pop = []; for (let i = 0; i < N; i++) pop.push({ t: Math.random() }); gen = 0; }
    function fitness(t) { return 0.15 + 0.85 * (gradient === 'left' ? (1 - t) : t); }
    function step() {
      let sum = 0;
      const weighted = pop.map(p => { const f = fitness(p.t); sum += f; return { p, f }; });
      const next = [];
      for (let i = 0; i < N; i++) {
        let r = Math.random() * sum, pick = weighted[weighted.length - 1];
        for (const w of weighted) { r -= w.f; if (r <= 0) { pick = w; break; } }
        next.push({ t: Math.max(0, Math.min(1, pick.p.t + (Math.random() - 0.5) * 0.04)) });
      }
      pop = next; gen++;
    }
    function run() {
      if (running) { running = false; if (raf) cancelAnimationFrame(raf); raf = null; runBtn.textContent = 'Run'; return; }
      running = true; runBtn.textContent = 'Pause';
      const tick = () => { if (!running) return; step(); draw(); raf = requestAnimationFrame(tick); };
      raf = requestAnimationFrame(tick);
    }
    function reset() {
      running = false; if (raf) cancelAnimationFrame(raf); raf = null; runBtn.textContent = 'Run';
      fresh(); draw();
      simStatus(statusEl, 'A population of ' + N + ', each with a trait for where it lives. The ' + gradient + ' is favoured — fitter individuals leave more offspring; a little mutation keeps the variation alive.');
    }
    stepBtn.addEventListener('click', () => { step(); draw(); });
    runBtn.addEventListener('click', run);
    controls.querySelector('[data-a="flip"]').addEventListener('click', () => {
      gradient = gradient === 'left' ? 'right' : 'left';
      draw();
      simStatus(statusEl, 'Gradient flipped — survival now favours the ' + gradient + '. Selection pressure reverses and the population will drift back.');
    });
    controls.querySelector('[data-a="reset"]').addEventListener('click', reset);
    function draw() {
      const w = S.w(), h = S.h();
      ctx.fillStyle = '#120D0A'; ctx.fillRect(0, 0, w, h);
      const m = 46, top = 30, bottom = h - 40;
      const half = w - 2 * m;
      const xOf = t => m + t * half;
      const g = ctx.createLinearGradient(m, 0, m + half, 0);
      if (gradient === 'left') { g.addColorStop(0, 'rgba(147,168,132,0.3)'); g.addColorStop(1, 'rgba(217,122,70,0.08)'); }
      else { g.addColorStop(0, 'rgba(217,122,70,0.08)'); g.addColorStop(1, 'rgba(147,168,132,0.3)'); }
      ctx.fillStyle = g;
      ctx.fillRect(m, top, half, bottom - top);
      ctx.strokeStyle = 'rgba(237,228,214,0.2)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(m, bottom); ctx.lineTo(m + half, bottom); ctx.stroke();
      for (const p of pop) {
        const x = xOf(p.t), y = top + Math.random() * (bottom - top);
        const fit = gradient === 'left' ? p.t < 0.5 : p.t > 0.5;
        ctx.fillStyle = fit ? 'rgba(246,215,111,0.85)' : 'rgba(237,228,214,0.35)';
        ctx.beginPath(); ctx.arc(x, y, 2.6, 0, Math.PI * 2); ctx.fill();
      }
      const mean = pop.reduce((a, p) => a + p.t, 0) / pop.length;
      ctx.fillStyle = '#F6D76F';
      ctx.beginPath(); ctx.arc(xOf(mean), (top + bottom) / 2, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#120D0A'; ctx.font = 'bold 10px IBM Plex Mono, monospace'; ctx.textAlign = 'center';
      ctx.fillText('M', xOf(mean), (top + bottom) / 2 + 3.5);
      ctx.fillStyle = '#E6DAC4'; ctx.font = '10px IBM Plex Mono, monospace'; ctx.textAlign = 'left';
      ctx.fillText('gradient \u2192 ' + gradient + '    generation ' + gen + '    mean trait ' + mean.toFixed(2), m, h - 10);
      simStatus(statusEl, 'Generation ' + gen + ': the mean trait is ' + mean.toFixed(2) + '. Selection favours the ' + gradient + ' — keep pressing it and the population follows, against the noise of mutation.');
    }
    fresh(); draw();
    return { destroy() { if (raf) cancelAnimationFrame(raf); raf = null; S.destroy(); } };
  }

  /* ------------------------- ledger balance (double entry) ------------------------- */

  function ledgerBalanceSim(shellEl, statusEl) {
    const box = document.createElement('div');
    box.className = 'ledger-wrap';
    if (!shellEl.contains(statusEl)) shellEl.appendChild(statusEl);
    shellEl.insertBefore(box, statusEl);
    const ACCOUNTS = [
      { id: 'cash', n: 'Cash', side: 'debit' },
      { id: 'inventory', n: 'Inventory', side: 'debit' },
      { id: 'equipment', n: 'Equipment', side: 'debit' },
      { id: 'expenses', n: 'Expenses', side: 'debit' },
      { id: 'revenue', n: 'Revenue', side: 'credit' },
      { id: 'loans', n: 'Loans payable', side: 'credit' },
      { id: 'equity', n: 'Owner\u2019s equity', side: 'credit' },
    ];
    const balances = {};
    ACCOUNTS.forEach(a => balances[a.id] = 0);
    const form = document.createElement('div');
    form.className = 'ledger-form';
    form.innerHTML =
      '<select data-f="debit">' + ACCOUNTS.map(a => '<option value="' + a.id + '">' + a.n + '</option>').join('') + '</select>' +
      '<span class="ledger-arrow">\u2192</span>' +
      '<select data-f="credit">' + ACCOUNTS.map(a => '<option value="' + a.id + '">' + a.n + '</option>').join('') + '</select>' +
      '<input data-f="amount" type="number" min="1" max="99999" value="500" aria-label="Amount">' +
      '<button class="btn btn-accent" data-f="record">Record</button>' +
      '<button class="btn" data-f="audit">Audit</button>';
    box.appendChild(form);
    const rowsEl = document.createElement('div');
    rowsEl.className = 'ledger-rows';
    box.appendChild(rowsEl);
    const grand = document.createElement('div');
    grand.className = 'ledger-grand';
    box.appendChild(grand);
    let rowCount = 0, debits = 0, credits = 0;
    const acct = id => ACCOUNTS.find(a => a.id === id);
    function redraw() {
      rowsEl.innerHTML = '';
      ACCOUNTS.forEach(a => {
        if (balances[a.id]) {
          const row = document.createElement('div');
          row.className = 'ledger-row';
          row.innerHTML = '<span class="lr-acct">' + a.n + '</span><span class="lr-side ' + a.side + '">' + a.side + '</span><span class="lr-amt">' + balances[a.id].toLocaleString() + '</span>';
          rowsEl.appendChild(row);
        }
      });
      grand.innerHTML = '<span>total debits</span><b>' + debits.toLocaleString() + '</b><span>total credits</span><b>' + credits.toLocaleString() + '</b><span>difference</span><b class="' + (debits === credits ? 'balanced' : 'off') + '">' + Math.abs(debits - credits).toLocaleString() + '</b>';
    }
    form.querySelector('[data-f="record"]').addEventListener('click', () => {
      const d = form.querySelector('[data-f="debit"]').value;
      const c = form.querySelector('[data-f="credit"]').value;
      const amt = parseInt(form.querySelector('[data-f="amount"]').value, 10) || 0;
      if (amt <= 0) { simStatus(statusEl, 'Enter an amount first. Every entry is written twice — once on each side of the ledger.'); return; }
      balances[d] += amt; balances[c] += amt;
      debits += amt; credits += amt; rowCount++;
      redraw();
      simStatus(statusEl, 'Entry ' + rowCount + ': ' + amt.toLocaleString() + ' to ' + acct(d).n + ' (debit) and ' + acct(c).n + ' (credit). The books stay balanced because every debit is a credit somewhere else.');
    });
    form.querySelector('[data-f="audit"]').addEventListener('click', () => {
      simStatus(statusEl, 'Audited ' + rowCount + ' entr' + (rowCount === 1 ? 'y' : 'ies') + ': total debits ' + debits.toLocaleString() + ' = total credits ' + credits.toLocaleString() + '. The ledger holds — ' + (debits === credits ? 'it cannot not balance.' : 'and something would be off.'));
    });
    redraw();
    simStatus(statusEl, 'Record a transaction. Pick a debit account and a credit account, give it an amount — every debit must be matched by a credit, so the difference is always zero.');
    return { destroy() {} };
  }

  /* ------------------------- event horizon (gravity well) ------------------------- */

  function blackHoleSim(shellEl, statusEl) {
    const S = simCanvas(shellEl, statusEl);
    const ctx = S.ctx;
    const V_CIRC = 6.5;
    let raf = null, running = false, particle = null;
    const controls = simControls(shellEl,
      '<label class="sim-slider">speed' +
        '<input data-a="speed" type="range" min="0" max="14" step="0.1" value="7" aria-label="launch speed">' +
        '<output data-o="speed">7</output>' +
      '</label>' +
      '<button class="btn btn-accent" data-a="throw">Throw</button>' +
      '<button class="btn" data-a="reset">Reset</button>' +
      '<span class="sim-hint">too slow spirals in · fast enough escapes</span>');
    const speedEl = controls.querySelector('[data-a="speed"]');
    const outEl = controls.querySelector('[data-o="speed"]');
    speedEl.addEventListener('input', () => { outEl.value = speedEl.value; });

    function geom() {
      const w = S.w(), h = S.h();
      const R = Math.max(60, 0.42 * Math.min(w, h));
      const rH = Math.max(10, R * 0.10);
      return { cx: w / 2, cy: h / 2, R, rH, K: V_CIRC * V_CIRC * R };
    }

    function launch() {
      if (running) return;
      const g = geom();
      const s = parseFloat(speedEl.value) || 0;
      particle = { x: g.cx, y: g.cy - g.R, vx: s, vy: 0, trail: [], state: 'free' };
      running = true;
      simStatus(statusEl, 'Throw at ' + s.toFixed(1) + '. Escape speed here is ' + (V_CIRC * Math.SQRT2).toFixed(1) + ' — throw past it and the object climbs out of the well; throw below it and the hole pulls it in.');
      loop();
    }

    function reset(brief) {
      running = false; if (raf) cancelAnimationFrame(raf); raf = null; particle = null;
      draw();
      simStatus(statusEl, brief || 'Two fates await a thrown object: spiral past the event horizon and it is gone from the universe\u2019s conversation — cross the rim fast enough and it escapes. Find the boundary.');
    }

    function summary(p) {
      const g = geom();
      const speed = Math.hypot(p.vx, p.vy);
      if (p.state === 'swallowed') {
        simStatus(statusEl, 'Swallowed. It crossed the event horizon at ' + speed.toFixed(1) + ' px/frame — inside that ring the escape speed would exceed light itself, so nothing that crosses ever comes back.');
      } else {
        simStatus(statusEl, 'Escaped. Above escape speed (√2 × the circular speed here, about ' + (V_CIRC * Math.SQRT2).toFixed(1) + '), the object climbed out of the well and flew away. That boundary is the horizon\u2019s shadow.');
      }
    }

    function step() {
      if (!particle) return;
      const g = geom();
      const p = particle;
      const dx = p.x - g.cx, dy = p.y - g.cy;
      const r = Math.hypot(dx, dy);
      if (p.state === 'free') {
        const soft = Math.max(2, g.rH * 0.5);
        const a = r > 0.001 ? (g.K / (r * r + soft * soft)) : 0;
        const dt = 0.5;
        p.vx += (-a * (dx / r)) * dt;
        p.vy += (-a * (dy / r)) * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.trail.push({ x: p.x, y: p.y });
        if (p.trail.length > 90) p.trail.shift();
        if (r < g.rH) { p.state = 'swallowed'; running = false; summary(p); }
        else if (r > g.R * 1.6 && (dx * p.vx + dy * p.vy) > 0) { p.state = 'escaped'; running = false; summary(p); }
      }
    }

    function loop() {
      step();
      draw();
      if (running) raf = requestAnimationFrame(loop);
    }

    function draw() {
      const w = S.w(), h = S.h();
      const g = geom();
      ctx.fillStyle = '#120D0A';
      ctx.fillRect(0, 0, w, h);
      const { cx, cy, R, rH } = g;
      ctx.strokeStyle = 'rgba(237,228,214,0.07)';
      ctx.lineWidth = 1;
      for (const rr of [rH, R * 0.6, R, R * 1.35]) {
        ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.stroke();
      }
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, rH * 2.6);
      glow.addColorStop(0, 'rgba(217,122,70,0.5)');
      glow.addColorStop(1, 'rgba(217,122,70,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(cx, cy, rH * 2.6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx, cy, rH, 0, Math.PI * 2);
      ctx.fillStyle = '#000';
      ctx.fill();
      ctx.strokeStyle = '#D97A46'; ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#D97A46'; ctx.font = '10px IBM Plex Mono, monospace'; ctx.textAlign = 'left';
      ctx.fillText('event horizon', cx + rH + 8, cy - 4);
      ctx.fillStyle = 'rgba(237,228,214,0.45)'; ctx.font = '10px IBM Plex Mono, monospace';
      ctx.fillText('the rim — escape speed measured here', cx - R - 66, cy - R - 12);
      if (particle) {
        ctx.strokeStyle = 'rgba(246,215,111,0.4)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        particle.trail.forEach((t, i) => i ? ctx.lineTo(t.x, t.y) : ctx.moveTo(t.x, t.y));
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = particle.state === 'swallowed' ? '#D97A46' : particle.state === 'escaped' ? '#93A884' : '#F6D76F';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, 2.4, 0, Math.PI * 2);
        ctx.fillStyle = '#120D0A';
        ctx.fill();
      }
    }

    controls.querySelector('[data-a="throw"]').addEventListener('click', launch);
    controls.querySelector('[data-a="reset"]').addEventListener('click', () => reset());
    reset('An object falls toward the hole. Slow throws spiral in and cross the event horizon; throws past escape speed fly over the rim. Drag the speed, throw, and find the boundary.');

    return {
      destroy() { running = false; if (raf) cancelAnimationFrame(raf); raf = null; S.destroy(); }
    };
  }

  /* ------------------------- chain reaction (critical mass) ------------------------- */

  function chainReactionSim(shellEl, statusEl) {
    const S = simCanvas(shellEl, statusEl);
    const ctx = S.ctx;
    const controls = simControls(shellEl,
      '<label class="sim-slider">density' +
        '<input data-a="density" type="range" min="1" max="140" step="1" value="64" aria-label="core density">' +
        '<output data-o="density">64</output>' +
      '</label>' +
      '<button class="btn btn-accent" data-a="inject">Inject a neutron</button>' +
      '<button class="btn" data-a="pulse">Pulse ×8</button>' +
      '<button class="btn" data-a="reset">Reset</button>' +
      '<span class="sim-hint">pack the cores until the chain refuses to die</span>');
    const densityEl = controls.querySelector('[data-a="density"]');
    const outEl = controls.querySelector('[data-o="density"]');
    densityEl.addEventListener('input', () => { outEl.value = densityEl.value; });

    const SPEED = 3.2, MAX_AGE = 300;
    let raf = null, running = false, nuclei = [], neutrons = [], flashes = [], fissions = 0, W = 0, H = 0;

    function geom() {
      W = S.w(); H = S.h();
      return { m: 42, rw: W - 84, rh: H - 84 };
    }

    function seed() {
      const { m, rw, rh } = geom();
      const n = parseInt(densityEl.value, 10) || 60;
      nuclei = [];
      let guard = 0;
      while (nuclei.length < n && guard < 4000) {
        guard++;
        const x = m + 8 + Math.random() * (rw - 16);
        const y = m + 8 + Math.random() * (rh - 16);
        let ok = true;
        for (const c of nuclei) {
          if (Math.hypot(c.x - x, c.y - y) < 12) { ok = false; break; }
        }
        if (ok) nuclei.push({ x, y, r: 6, hit: false });
      }
      neutrons = []; flashes = []; fissions = 0;
      if (!running) draw();
    }

    function inject(count) {
      if (running) return;
      running = true;
      const { m, rw, rh } = geom();
      for (let i = 0; i < count; i++) {
        const edge = Math.floor(Math.random() * 4);
        const x = edge === 0 ? m + 2 : edge === 1 ? m + rw - 2 : m + 6 + Math.random() * (rw - 12);
        const y = edge === 2 ? m + 2 : edge === 3 ? m + rh - 2 : m + 6 + Math.random() * (rh - 12);
        const ang = Math.random() * Math.PI * 2;
        neutrons.push({ x, y, vx: Math.cos(ang) * SPEED, vy: Math.sin(ang) * SPEED, age: 0 });
      }
      loop();
    }

    function reset(brief) {
      running = false; if (raf) cancelAnimationFrame(raf); raf = null;
      seed();
      simStatus(statusEl, brief || 'Fissile cores packed at density ' + (densityEl.value || 60) + '. Inject a neutron: chain or fizzle? Keep packing until a single neutron can split the whole slab — that is the critical mass.');
    }

    function step() {
      const { m, rw, rh } = geom();
      neutrons.forEach(n => { n.x += n.vx; n.y += n.vy; n.age++; });
      flashes.forEach(f => { f.r += 2.6; f.a *= 0.88; });
      flashes = flashes.filter(f => f.a > 0.02);

      const next = [];
      for (const n of neutrons) {
        if (n.age > MAX_AGE || n.x < m || n.y < m || n.x > m + rw || n.y > m + rh) continue;
        let split = false;
        for (const c of nuclei) {
          if (c.hit) continue;
          if (Math.hypot(c.x - n.x, c.y - n.y) < c.r + 4) {
            c.hit = true; fissions++;
            flashes.push({ x: c.x, y: c.y, r: 4, a: 0.9 });
            const kids = Math.random() < 0.3 ? 3 : 2;
            for (let k = 0; k < kids; k++) {
              const ang = Math.random() * Math.PI * 2;
              next.push({ x: c.x, y: c.y, vx: Math.cos(ang) * SPEED, vy: Math.sin(ang) * SPEED, age: 0 });
            }
            split = true;
            break;
          }
        }
        if (!split) next.push(n);
      }
      neutrons = next;
      if (!neutrons.length) {
        running = false;
        settle();
      }
    }

    function settle() {
      const total = nuclei.length;
      const frac = total ? fissions / total : 0;
      let verdict;
      if (frac >= 0.85) verdict = 'RUNAWAY — super-critical. Neutrons multiplied until every core split: the flash of a bomb.';
      else if (frac >= 0.3) verdict = 'Critical — the chain sustained while fuel held, then burned out. That is a working reactor, not a bomb.';
      else verdict = 'Sub-critical — the chain fizzled. Neutrons leaked out of the slab faster than they found cores; the mass was simply too small. ' + (densityEl.value < 70 ? 'Slide density up and try again.' : '');
      simStatus(statusEl, 'Fissions: ' + fissions + ' of ' + total + ' cores. ' + verdict);
    }

    function draw() {
      ctx.fillStyle = '#120D0A';
      ctx.fillRect(0, 0, S.w(), S.h());
      const { m, rw, rh } = geom();
      ctx.strokeStyle = 'rgba(147,168,132,0.25)';
      ctx.lineWidth = 1;
      ctx.strokeRect(m, m, rw, rh);
      ctx.fillStyle = 'rgba(237,228,214,0.5)';
      ctx.font = '10px IBM Plex Mono, monospace';
      ctx.textAlign = 'left';
      ctx.fillText('the slab', m, m - 8);
      for (const c of nuclei) {
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
        ctx.fillStyle = c.hit ? 'rgba(237,228,214,0.12)' : 'rgba(201,154,87,0.95)';
        ctx.fill();
        if (!c.hit) {
          ctx.beginPath();
          ctx.arc(c.x, c.y, c.r * 0.45, 0, Math.PI * 2);
          ctx.fillStyle = '#F6D76F';
          ctx.fill();
        }
      }
      for (const f of flashes) {
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(217,122,70,' + f.a.toFixed(3) + ')';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      for (const n of neutrons) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, 2.4, 0, Math.PI * 2);
        ctx.fillStyle = '#F6D76F';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(n.x, n.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(246,215,111,0.15)';
        ctx.fill();
      }
      ctx.fillStyle = '#E6DAC4';
      ctx.font = '11px IBM Plex Mono, monospace';
      ctx.textAlign = 'right';
      ctx.fillText('live ' + neutrons.length + ' · fissioned ' + fissions + '/' + nuclei.length, S.w() - m, S.h() - 12);
    }

    function loop() {
      step();
      draw();
      if (running) raf = requestAnimationFrame(loop);
    }

    controls.querySelector('[data-a="inject"]').addEventListener('click', () => inject(1));
    controls.querySelector('[data-a="pulse"]').addEventListener('click', () => inject(8));
    controls.querySelector('[data-a="reset"]').addEventListener('click', () => reset());
    densityEl.addEventListener('change', () => reset());

    reset();
    return {
      destroy() { running = false; if (raf) cancelAnimationFrame(raf); raf = null; S.destroy(); }
    };
  }

  /* ------------------------- idea spread (a network) ------------------------- */

  function ideaSpreadSim(shellEl, statusEl) {
    const S = simCanvas(shellEl, statusEl);
    const ctx = S.ctx;
    const N = 26;
    const controls = simControls(shellEl,
      '<label class="sim-slider">openness' +
        '<input data-a="open" type="range" min="0" max="100" step="1" value="34" aria-label="how open the crowd is to the idea">' +
        '<output data-o="open">34</output>' +
      '</label>' +
      '<button class="btn btn-accent" data-a="seed">Seed the idea</button>' +
      '<button class="btn" data-a="run">Run</button>' +
      '<button class="btn" data-a="reset">Reset</button>');
    const openEl = controls.querySelector('[data-a="open"]');
    const outEl = controls.querySelector('[data-o="open"]');
    openEl.addEventListener('input', () => { outEl.value = openEl.value; });
    let nodes = [], edges = [], running = false, raf = null;

    function fresh() {
      nodes = [];
      for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2;
        const r = 0.8 + (Math.random() - 0.5) * 0.3;
        nodes.push({ x: Math.cos(a) * r, y: Math.sin(a) * r, taken: false, seed: false });
      }
      edges = [];
      nodes.forEach((n, i) => {
        for (const d of [1, 2, 4]) {
          const j = (i + d) % N;
          if (j > i) edges.push({ a: nodes[i], b: nodes[j] });
        }
      });
    }

    function spreadStep() {
      const p = (parseFloat(openEl.value) || 0) / 100;
      let adopted = 0;
      for (const n of nodes) {
        if (n.taken) { adopted++; continue; }
        let m = 0;
        for (const e of edges) {
          if (e.a === n && e.b.taken) m++;
          else if (e.b === n && e.a.taken) m++;
        }
        const rate = p * (m / 4);
        if (rate > 0 && Math.random() < Math.min(0.2, rate)) n.taken = true;
      }
      return adopted;
    }

    function seed() {
      const i = Math.floor(Math.random() * nodes.length);
      nodes[i].taken = true; nodes[i].seed = true;
      draw();
      simStatus(statusEl, 'One person starts to believe. The idea only crosses into a neighbour who is listening \u2014 and only a fraction of those conversations land. At openness ' + (parseFloat(openEl.value) / 100).toFixed(2) + ', watch whether it dies or sweeps.');
    }

    function run() {
      if (running) {
        running = false; if (raf) cancelAnimationFrame(raf); raf = null;
        controls.querySelector('[data-a="run"]').textContent = 'Run';
        return;
      }
      running = true;
      controls.querySelector('[data-a="run"]').textContent = 'Pause';
      let last = -1;
      const tick = () => {
        if (!running) return;
        const adopted = spreadStep();
        draw();
        if (adopted !== last) {
          last = adopted;
          const pct = Math.round(adopted / N * 100);
          simStatus(statusEl, adopted + '/' + N + ' now carry the idea (' + pct + '%). ' +
            (adopted === N
              ? 'It swept the whole network. Past the tipping point an idea stops needing effort \u2014 it carries itself.'
              : 'Openness ' + (parseFloat(openEl.value) / 100).toFixed(2) + '. Cross enough thresholds and the crowd flips.'));
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }

    function reset() {
      running = false; if (raf) cancelAnimationFrame(raf); raf = null;
      controls.querySelector('[data-a="run"]').textContent = 'Run';
      fresh(); draw();
      simStatus(statusEl, 'A network of ' + N + ' people. Ideas travel edge by edge: the more neighbours already hold one, the likelier the next person hears it. Set the openness low and the idea dies out; push it past the tipping point and it takes the whole network.');
    }

    function draw() {
      const w = S.w(), h = S.h();
      ctx.fillStyle = '#120D0A'; ctx.fillRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2 + 8, R = Math.min(w, h) * 0.36;
      for (const e of edges) {
        ctx.strokeStyle = (e.a.taken || e.b.taken) ? 'rgba(201,154,87,0.35)' : 'rgba(74,59,44,0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx + e.a.x * R, cy + e.a.y * R);
        ctx.lineTo(cx + e.b.x * R, cy + e.b.y * R);
        ctx.stroke();
      }
      let count = 0;
      for (const n of nodes) {
        const x = cx + n.x * R, y = cy + n.y * R;
        ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fillStyle = n.seed ? '#F6D76F' : n.taken ? '#C99A57' : 'rgba(237,228,214,0.28)';
        ctx.fill();
        if (n.taken) {
          ctx.strokeStyle = 'rgba(246,215,111,0.5)'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.stroke();
          count++;
        }
      }
      ctx.fillStyle = 'rgba(237,228,214,0.5)'; ctx.font = '10px IBM Plex Mono, monospace'; ctx.textAlign = 'center';
      ctx.fillText('people \u00B7 conversations \u00B7 contagion    ' + count + '/' + N, cx, h - 12);
    }

    controls.querySelector('[data-a="seed"]').addEventListener('click', seed);
    controls.querySelector('[data-a="run"]').addEventListener('click', run);
    controls.querySelector('[data-a="reset"]').addEventListener('click', reset);
    reset();
    return { destroy() { running = false; if (raf) cancelAnimationFrame(raf); raf = null; S.destroy(); } };
  }

  /* ------------------------- generation drift (the telephone game) ------------------------- */

  function generationDriftSim(shellEl, statusEl) {
    const S = simCanvas(shellEl, statusEl);
    const ctx = S.ctx;
    const CHAIN = 6;
    const WORDS = ['fraction', 'nucleus', 'gravity', 'credit', 'species', 'algorithm', 'quantum', 'cell'];
    const controls = simControls(shellEl,
      '<label class="sim-slider">clarity' +
        '<input data-a="clarity" type="range" min="0" max="100" step="1" value="72" aria-label="how carefully each generation listens">' +
        '<output data-o="clarity">72</output>' +
      '</label>' +
      '<button class="btn btn-accent" data-a="pass">Pass it down</button>' +
      '<button class="btn" data-a="reset">Reset</button>');
    const clearEl = controls.querySelector('[data-a="clarity"]');
    const outEl = controls.querySelector('[data-o="clarity"]');
    clearEl.addEventListener('input', () => { outEl.value = clearEl.value; });
    let bubbles = [], word = '', root = '', drift = 0, highlighted = -1;

    function fresh() {
      root = WORDS[Math.floor(Math.random() * WORDS.length)];
      word = root;
      bubbles = [];
      for (let i = 0; i < CHAIN; i++) bubbles.push({ text: i === 0 ? word : '\u00B7 \u00B7 \u00B7', muted: false });
      drift = 0; highlighted = -1;
    }

    function mutate(s) {
      const a = s.split('');
      const kind = Math.floor(Math.random() * 3);
      if (kind === 0) {
        const i = Math.floor(Math.random() * a.length);
        a[i] = 'aeiouaeioubcdfghjklmnpqrstvwxyz'[Math.floor(Math.random() * 30)];
      } else if (kind === 1 && a.length > 3) {
        a.splice(Math.floor(Math.random() * a.length), 1);
      } else if (a.length < 13) {
        const i = Math.floor(Math.random() * a.length);
        a.splice(i, 0, a[i]);
      }
      return a.join('');
    }

    function pass() {
      const chance = 0.5 * (1 - (parseFloat(clearEl.value) || 0) / 100);
      for (let i = CHAIN - 1; i >= 1; i--) bubbles[i] = { text: bubbles[i - 1].text, muted: false };
      let next = word;
      if (Math.random() < chance) { next = mutate(word); drift++; highlighted = 0; }
      else highlighted = -1;
      bubbles[0] = { text: next, muted: false };
      word = next;
      draw();
      const warning = next === root ? ' \u2014 the word arrives exactly as it left.' : '';
      simStatus(statusEl, 'A generation hands it on. So far ' + drift + ' change' + (drift === 1 ? '' : 's') + ' has crept in. At clarity ' + clearEl.value + ', every handoff carries a ' + Math.round(chance * 100) + '% chance of being misheard' + warning + '. Run it to the end of the chain and see how far the root has drifted.');
    }

    function reset() {
      fresh(); draw();
      simStatus(statusEl, 'The word "' + root + '" is about to be whispered down ' + CHAIN + ' generations. Speech-to-speech transmission is lossy: each handoff can drop, swap, or double a sound. Watch the root drift \u2014 and notice that the word everyone ends up saying can be beautiful and utterly unrelated.');
    }

    function draw() {
      const w = S.w(), h = S.h();
      ctx.fillStyle = '#120D0A'; ctx.fillRect(0, 0, w, h);
      const gap = Math.min(w / CHAIN, 150);
      const x0 = (w - gap * (CHAIN - 1)) / 2, cy = h / 2;
      const R = Math.min(58, gap * 0.42);
      ctx.strokeStyle = 'rgba(237,228,214,0.18)'; ctx.lineWidth = 1.5;
      for (let i = 0; i < CHAIN - 1; i++) {
        const x1 = x0 + i * gap + R, x2 = x0 + (i + 1) * gap - R;
        ctx.beginPath(); ctx.moveTo(x1, cy); ctx.lineTo(x2, cy); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x2, cy); ctx.lineTo(x2 - 7, cy - 5); ctx.lineTo(x2 - 7, cy + 5); ctx.closePath(); ctx.fill();
      }
      bubbles.forEach((b, i) => {
        const x = x0 + i * gap;
        const hl = i === 0 && highlighted === 0;
        ctx.beginPath(); ctx.arc(x, cy, R, 0, Math.PI * 2);
        ctx.fillStyle = hl ? 'rgba(217,122,70,0.16)' : 'rgba(42,33,26,0.9)';
        ctx.fill();
        ctx.strokeStyle = hl ? '#D97A46' : i === 0 ? '#C99A57' : '#4A3B2C';
        ctx.lineWidth = hl ? 2 : 1;
        ctx.stroke();
        if (i === 0) {
          ctx.fillStyle = '#F6D76F';
          ctx.beginPath(); ctx.arc(x, cy - R + 10, 3, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = hl ? '#F6D76F' : 'rgba(237,228,214,0.85)';
        ctx.font = 'bold 12px IBM Plex Mono, monospace'; ctx.textAlign = 'center';
        ctx.fillText(b.text.length > 10 ? b.text.slice(0, 9) + '\u2026' : b.text, x, cy + 4);
        ctx.fillStyle = 'rgba(138,124,104,0.8)'; ctx.font = '9px IBM Plex Mono, monospace';
        ctx.fillText('gen ' + (i + 1), x, cy + R + 14);
      });
      ctx.fillStyle = 'rgba(138,124,104,0.6)'; ctx.font = '10px IBM Plex Mono, monospace'; ctx.textAlign = 'center';
      ctx.fillText('root: "' + root + '"   \u00B7   ' + drift + ' change' + (drift === 1 ? '' : 's') + ' so far', w / 2, h - 14);
    }

    controls.querySelector('[data-a="pass"]').addEventListener('click', pass);
    controls.querySelector('[data-a="reset"]').addEventListener('click', reset);
    reset();
    return { destroy() { S.destroy(); } };
  }

  /* ------------------------- contingency (the turning point) ------------------------- */

  function contingencySim(shellEl, statusEl) {
    const S = simCanvas(shellEl, statusEl);
    const ctx = S.ctx;
    const controls = simControls(shellEl,
      '<label class="sim-slider">tilt' +
        '<input data-a="tilt" type="range" min="-1" max="1" step="0.05" value="0" aria-label="bias of the turning point">' +
        '<output data-o="tilt">0</output>' +
      '</label>' +
      '<button class="btn btn-accent" data-a="roll">Roll the years</button>' +
      '<button class="btn" data-a="run">Run \u00D712</button>' +
      '<button class="btn" data-a="reset">Reset</button>');
    const tiltEl = controls.querySelector('[data-a="tilt"]');
    const outEl = controls.querySelector('[data-o="tilt"]');
    tiltEl.addEventListener('input', () => { outEl.value = tiltEl.value; });
    let outcomes = [], ball = null, busy = false, raf = null;

    function geom() {
      const w = S.w(), h = S.h();
      return { cx: w / 2, cy: h / 2, base: h - 40, half: Math.min(w, h) * 0.36 };
    }

    function roll() {
      if (busy) return;
      const g = geom();
      const tilt = parseFloat(tiltEl.value) || 0;
      const left = tilt + (Math.random() - 0.5) * 0.8 < 0;
      ball = { x: g.cx, y: g.cy - 60, tx: g.cx + (left ? -1 : 1) * g.half * 0.7, ty: g.base - 18, t: 0, left };
      busy = true;
      const start = performance.now(), dur = 900;
      const tick = (now) => {
        const t = Math.min(1, (now - start) / dur);
        const e = t * t * (3 - 2 * t);
        ball.x = g.cx + (ball.tx - g.cx) * e;
        ball.y = g.cy - 60 + (ball.ty - (g.cy - 60)) * e;
        draw();
        if (t < 1) { raf = requestAnimationFrame(tick); return; }
        busy = false;
        outcomes.push(ball.left);
        simStatus(statusEl, (ball.left ? 'Left path taken.' : 'Right path taken.') + ' ' + tally());
      };
      raf = requestAnimationFrame(tick);
    }

    function run12() {
      if (busy) return;
      busy = true;
      let i = 0;
      const step = () => {
        const tilt = parseFloat(tiltEl.value) || 0;
        outcomes.push(tilt + (Math.random() - 0.5) * 0.8 < 0);
        i++;
        draw();
        if (i < 12) { raf = requestAnimationFrame(step); return; }
        busy = false;
        simStatus(statusEl, 'Twelve rolls of the same turning point, same tilt. ' + tally());
      };
      raf = requestAnimationFrame(step);
    }

    function tally() {
      const L = outcomes.filter(o => o).length, R = outcomes.length - L;
      const tilt = parseFloat(tiltEl.value) || 0;
      return 'The scale tips \u2014 but the noise never fully disappears. Left ' + L + '/' + outcomes.length + ', right ' + R + '/' + outcomes.length + '. With tilt ' + tilt.toFixed(2) + ', history at a turning point behaves like a weighted coin, not a law.';
    }

    function reset() {
      if (raf) cancelAnimationFrame(raf); raf = null;
      busy = false; outcomes = []; ball = null; draw();
      simStatus(statusEl, 'A single turning point \u2014 a decision, a letter, a meeting that could have gone two ways. Drag the tilt to bias the scale, then roll. Small noise wins single rounds; rolled many times, the tilt becomes a pattern.');
    }

    function draw() {
      const w = S.w(), h = S.h();
      ctx.fillStyle = '#120D0A'; ctx.fillRect(0, 0, w, h);
      const g = geom();
      ctx.strokeStyle = 'rgba(237,228,214,0.15)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(g.cx, g.cy - 46); ctx.lineTo(g.cx, g.base); ctx.stroke();
      ctx.strokeStyle = 'rgba(201,154,87,0.55)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(g.cx - g.half, g.base);
      ctx.quadraticCurveTo(g.cx - g.half * 0.6, g.cy - 30, g.cx, g.base);
      ctx.stroke();
      ctx.beginPath(); ctx.moveTo(g.cx, g.base);
      ctx.quadraticCurveTo(g.cx + g.half * 0.6, g.cy - 30, g.cx + g.half, g.base);
      ctx.stroke();
      const L = outcomes.filter(o => o).length, R = outcomes.length - L;
      const total = outcomes.length || 1;
      const bw = 14, lBar = (L / total) * g.half * 0.55, rBar = (R / total) * g.half * 0.55;
      ctx.fillStyle = 'rgba(201,154,87,0.35)';
      ctx.fillRect(g.cx - g.half, g.base - lBar, bw, lBar);
      ctx.fillRect(g.cx + g.half - bw, g.base - rBar, bw, rBar);
      ctx.fillStyle = '#EDE4D6'; ctx.font = '10px IBM Plex Mono, monospace'; ctx.textAlign = 'center';
      ctx.fillText('L ' + L, g.cx - g.half + bw / 2, g.base - lBar - 6);
      ctx.fillText('R ' + R, g.cx + g.half - bw / 2, g.base - rBar - 6);
      ctx.fillStyle = 'rgba(138,124,104,0.7)';
      ctx.fillText('left', g.cx - g.half, g.base + 16);
      ctx.fillText('right', g.cx + g.half, g.base + 16);
      if (ball) {
        ctx.beginPath(); ctx.arc(ball.x, ball.y, 8, 0, Math.PI * 2);
        ctx.fillStyle = ball.left ? '#D97A46' : '#7FA56B';
        ctx.fill();
        ctx.strokeStyle = 'rgba(237,228,214,0.3)';
        ctx.beginPath(); ctx.arc(ball.x, ball.y, 8, 0, Math.PI * 2); ctx.stroke();
      }
    }

    controls.querySelector('[data-a="roll"]').addEventListener('click', roll);
    controls.querySelector('[data-a="run"]').addEventListener('click', run12);
    controls.querySelector('[data-a="reset"]').addEventListener('click', reset);
    reset();
    return { destroy() { if (raf) cancelAnimationFrame(raf); raf = null; S.destroy(); } };
  }

  /* ------------------------- period placement (dates & events) ------------------------- */

  function periodPlaceSim(shellEl, statusEl) {
    const S = simCanvas(shellEl, statusEl);
    const ctx = S.ctx;
    const controls = simControls(shellEl,
      '<label class="sim-slider">your guess' +
        '<input data-a="guess" type="range" min="0" max="100" step="1" value="50" aria-label="where you think the moment sits in time">' +
        '<output data-o="guess">50</output>' +
      '</label>' +
      '<button class="btn btn-accent" data-a="check">Reveal</button>' +
      '<button class="btn" data-a="next">Next round</button>' +
      '<button class="btn" data-a="reset">Reset</button>');
    const guessEl = controls.querySelector('[data-a="guess"]');
    const outEl = controls.querySelector('[data-o="guess"]');
    guessEl.addEventListener('input', () => { outEl.value = guessEl.value; });

    const FALLBACK = [
      { label: 'Newton\u2019s Principia', year: 1687 },
      { label: 'The double entry ledger', year: 1494 },
      { label: 'Maxwell\u2019s equations', year: 1865 },
      { label: 'The Manhattan Project', year: 1945 },
      { label: 'The World Wide Web', year: 1989 }
    ];
    let moments = [], mystery = null, round = 0, score = 0, best = 0, minY = 0, maxY = 0, revealed = false;

    function gather() {
      const arr = [];
      try {
        const id = new URLSearchParams(location.search).get('topic');
        const A = window.Alpaca;
        if (id && A && A.nodeById) {
          const me = A.nodeById(id);
          if (me && me.dates && me.dates.length) {
            me.dates.forEach(y => arr.push({ label: me.label, year: y, self: true }));
          }
          if (A.nearest) {
            for (const { node } of A.nearest(id, { count: 8 })) {
              if (node.dates && node.dates.length && arr.length < 8) {
                arr.push({ label: node.label, year: node.dates[0], self: false });
              }
            }
          }
        }
      } catch (e) { /* fallback */ }
      if (arr.length < 3) arr.push(...FALLBACK.map(m => ({ label: m.label, year: m.year, self: false })));
      const seen = new Set();
      moments = arr.filter(m => { if (seen.has(m.year)) return false; seen.add(m.year); return true; }).slice(0, 8);
    }

    function reset() {
      gather();
      minY = Math.min(...moments.map(m => m.year));
      maxY = Math.max(...moments.map(m => m.year));
      round = 0; score = 0; best = 0; revealed = false;
      pick();
      draw();
      simStatus(statusEl, 'A period ' + minY + '\u2013' + maxY + ' sits in front of you, and somewhere inside it hides one moment. Drag the marker to where you think it happened, then reveal. ' + moments.length + ' moments live in this set; only one is being asked for.');
    }

    function pick() {
      const others = moments.filter(m => !m.self);
      mystery = (others.length ? others : moments)[Math.floor(Math.random() * (others.length || moments.length))];
      revealed = false;
    }

    function check() {
      if (revealed) return;
      revealed = true;
      const guessYear = Math.round(minY + (parseFloat(guessEl.value) || 0) / 100 * (maxY - minY));
      const span = Math.max(1, maxY - minY);
      const closeness = Math.max(0, 1 - Math.abs(guessYear - mystery.year) / span);
      const pts = Math.round(closeness * 100);
      score += pts; best = Math.max(best, pts);
      round++;
      draw();
      simStatus(statusEl, 'Reveal: ' + mystery.label + ', ' + mystery.year + '. You placed it in ' + guessYear + ' \u2014 off by ' + Math.abs(guessYear - mystery.year) + ' year' + (Math.abs(guessYear - mystery.year) === 1 ? '' : 's') + ', scoring ' + pts + '. ' + (pts >= 70 ? 'Close enough that the era felt right.' : pts >= 35 ? 'In the right neighbourhood.' : 'The period fooled you.') + ' Round ' + round + ' \u00B7 best ' + best + '.');
    }

    function next() {
      if (!revealed) return;
      pick();
      draw();
    }

    function draw() {
      const w = S.w(), h = S.h();
      ctx.fillStyle = '#120D0A'; ctx.fillRect(0, 0, w, h);
      const m = 60, y = h / 2, len = w - 2 * m;
      const xOf = year => m + (year - minY) / Math.max(1, maxY - minY) * len;
      ctx.strokeStyle = 'rgba(237,228,214,0.25)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(m, y); ctx.lineTo(m + len, y); ctx.stroke();
      ctx.fillStyle = 'rgba(138,124,104,0.9)'; ctx.font = '10px IBM Plex Mono, monospace'; ctx.textAlign = 'center';
      ctx.fillText(String(minY), m, y + 22);
      ctx.fillText(String(maxY), m + len, y + 22);
      for (const mom of moments) {
        ctx.fillStyle = 'rgba(138,124,104,0.35)';
        ctx.fillRect(xOf(mom.year) - 1, y - 6, 2, 12);
      }
      ctx.fillStyle = '#F6D76F'; ctx.textAlign = 'left';
      ctx.fillText('which moment? \u2014', m, y - 40);
      ctx.font = 'bold 13px IBM Plex Mono, monospace';
      ctx.fillText(mystery ? mystery.label : '', m + 92, y - 40);
      const gx = m + (parseFloat(guessEl.value) || 0) / 100 * len;
      ctx.fillStyle = '#D97A46';
      ctx.beginPath(); ctx.arc(gx, y, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#120D0A'; ctx.font = 'bold 9px IBM Plex Mono, monospace'; ctx.textAlign = 'center';
      ctx.fillText('?', gx, y + 3);
      if (revealed && mystery) {
        const tx = xOf(mystery.year);
        ctx.strokeStyle = '#7FA56B'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(tx, y - 14); ctx.lineTo(tx, y + 14); ctx.stroke();
        ctx.fillStyle = '#7FA56B'; ctx.font = '10px IBM Plex Mono, monospace'; ctx.textAlign = 'center';
        ctx.fillText(mystery.year, tx, y - 20);
      }
      ctx.fillStyle = 'rgba(237,228,214,0.5)'; ctx.font = '10px IBM Plex Mono, monospace'; ctx.textAlign = 'center';
      ctx.fillText('round ' + round + '   \u00B7   score ' + score + '   \u00B7   best ' + best, w / 2, h - 14);
    }

    controls.querySelector('[data-a="check"]').addEventListener('click', check);
    controls.querySelector('[data-a="next"]').addEventListener('click', next);
    controls.querySelector('[data-a="reset"]').addEventListener('click', reset);
    reset();
    return { destroy() { S.destroy(); } };
  }

  /* ------------------------- dispatcher ------------------------- */

  function run(kind, shellEl, statusEl) {
    switch (kind) {
      case 'supply-demand': return supplyDemandSim(shellEl, statusEl);
      case 'prisoners-dilemma': return prisonersDilemmaSim(shellEl, statusEl);
      case 'bisect': return bisectSim(shellEl, statusEl);
      case 'version-control': return versionControlSim(shellEl, statusEl);
      case 'tdd-loop': return tddLoopSim(shellEl, statusEl);
      case 'phases-vs-iterations': return phasesVsIterationsSim(shellEl, statusEl);
      case 'price-war': return priceWarSim(shellEl, statusEl);
      case 'best-response': return bestResponseSim(shellEl, statusEl);
      case 'natural-selection': return naturalSelectionSim(shellEl, statusEl);
      case 'ledger-balance': return ledgerBalanceSim(shellEl, statusEl);
      case 'black-hole': return blackHoleSim(shellEl, statusEl);
      case 'chain-reaction': return chainReactionSim(shellEl, statusEl);
      case 'idea-spread': return ideaSpreadSim(shellEl, statusEl);
      case 'generation-drift': return generationDriftSim(shellEl, statusEl);
      case 'contingency': return contingencySim(shellEl, statusEl);
      case 'period-place': return periodPlaceSim(shellEl, statusEl);
      default: return startSimulation(shellEl, statusEl);
    }
  }

  window.AlpacaSim = { start: startSimulation, run };
})();
