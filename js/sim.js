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

  /* ------------------------- unit circle (trigonometry) ------------------------- */

  function unitCircleSim(shellEl, statusEl) {
    const S = simCanvas(shellEl, statusEl);
    const ctx = S.ctx;
    let ang = 0.6, dragging = false;
    const controls = simControls(shellEl, '<button class="btn" data-a="reset">Reset angle</button><span class="sim-hint">drag the point around the circle</span>');
    controls.querySelector('[data-a="reset"]').addEventListener('click', () => { ang = 0.6; draw(); });
    S.canvas.addEventListener('pointerdown', e => { dragging = true; move(e); });
    window.addEventListener('pointermove', e => { if (dragging) move(e); });
    window.addEventListener('pointerup', () => { dragging = false; });
    function move(e) {
      const rect = S.canvas.getBoundingClientRect();
      const cx = rect.left + S.w() / 2, cy = rect.top + S.h() * 0.42;
      ang = Math.atan2(e.clientY - cy, e.clientX - cx);
      draw();
    }
    function draw() {
      const w = S.w(), h = S.h();
      ctx.fillStyle = '#120D0A'; ctx.fillRect(0, 0, w, h);
      const cx = w / 2, cy = h * 0.42;
      const R = Math.min(w, h) * 0.32;
      const sin = Math.sin(ang), cos = Math.cos(ang);
      const px = cx + R * cos, py = cy - R * sin;
      // axes
      ctx.strokeStyle = 'rgba(237,228,214,0.28)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(w, cy); ctx.moveTo(cx, 0); ctx.lineTo(cx, h); ctx.stroke();
      // circle
      ctx.strokeStyle = 'rgba(201,154,87,0.8)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
      // radius line + labels
      ctx.fillStyle = '#F6D76F';
      ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#120D0A';
      ctx.beginPath(); ctx.arc(px, py, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#F6D76F'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(px, py); ctx.stroke();
      // cosine (x), sine (y) projection lines
      ctx.setLineDash([4, 3]); ctx.lineWidth = 1;
      ctx.strokeStyle = '#7FA8C9';
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, cy); ctx.stroke();
      ctx.fillStyle = '#7FA8C9'; ctx.font = '12px IBM Plex Mono, monospace'; ctx.textAlign = 'center';
      ctx.fillText('cos \u03B8 = ' + cos.toFixed(2), px, cy + 22);
      ctx.strokeStyle = '#D97A46';
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(cx, py); ctx.stroke();
      ctx.fillStyle = '#D97A46'; ctx.font = '12px IBM Plex Mono, monospace'; ctx.textAlign = 'left';
      ctx.fillText('sin \u03B8 = ' + sin.toFixed(2), cx + 12, py + 4);
      ctx.setLineDash([]);
      // angle arc
      ctx.strokeStyle = '#93A884'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(cx, cy, R * 0.3, 0, -ang, true); ctx.stroke();
      ctx.fillStyle = '#93A884'; ctx.font = '11px IBM Plex Mono, monospace';
      ctx.fillText((ang * 180 / Math.PI).toFixed(0) + '\u00B0', cx + R * 0.38, cy - R * 0.26);
      // tan hint
      const tan = Math.tan(ang);
      ctx.fillStyle = '#8A7C68'; ctx.font = '10px IBM Plex Mono, monospace'; ctx.textAlign = 'center';
      ctx.fillText('tan \u03B8 = sin/cos = ' + (isFinite(tan) ? tan.toFixed(2) : '\u221E'), w / 2, h - 10);
      simStatus(statusEl, 'On the unit circle the radius is 1, so the point\u2019s coordinates ARE the cosine and sine of the angle. Drag it: at ' + (ang * 180 / Math.PI).toFixed(0) + '\u00B0, cos = ' + cos.toFixed(2) + ', sin = ' + sin.toFixed(2) + '.');
    }
    draw();
    return { destroy() { S.destroy(); } };
  }

  /* ------------------------- tangent slope (the derivative) ------------------------- */

  function tangentSlopeSim(shellEl, statusEl) {
    const S = simCanvas(shellEl, statusEl);
    const ctx = S.ctx;
    const f = x => 0.35 * x * x + 0.15 * x + 0.25;
    const df = x => 0.7 * x + 0.15;
    let x = 0.5, h = 0.45, dragging = false, dragAxis = null;
    const controls = simControls(shellEl,
      '<label class="sim-slider">interval h' +
        '<input data-a="h" type="range" min="0.02" max="0.9" step="0.01" value="0.45" aria-label="secant interval">' +
        '<output data-o="h">0.45</output>' +
      '</label>' +
      '<button class="btn" data-a="reset">Reset</button><span class="sim-hint">drag the point along the curve</span>');
    const hEl = controls.querySelector('[data-a="h"]');
    const outEl = controls.querySelector('[data-o="h"]');
    hEl.addEventListener('input', () => { h = parseFloat(hEl.value); outEl.value = h.toFixed(2); draw(); });
    controls.querySelector('[data-a="reset"]').addEventListener('click', () => { x = 0.5; h = 0.45; hEl.value = h; outEl.value = h.toFixed(2); draw(); });
    S.canvas.addEventListener('pointerdown', e => { dragging = true; move(e); });
    window.addEventListener('pointermove', e => { if (dragging) move(e); });
    window.addEventListener('pointerup', () => { dragging = false; });
    function move(e) {
      const rect = S.canvas.getBoundingClientRect();
      const mX = 60, mY = S.h() - 44;
      const dim = Math.min(S.w() - mX - 30, mY - 30);
      const PX = t => mX + t * dim;
      const PY = t => mY - t * dim;
      x = Math.max(0.04, Math.min(0.96, (e.clientX - rect.left - mX) / dim));
      draw();
    }
    function draw() {
      const w = S.w(), h = S.h();
      ctx.fillStyle = '#120D0A'; ctx.fillRect(0, 0, w, h);
      const mX = 60, mY = h - 44;
      const dim = Math.min(w - mX - 30, mY - 30);
      const PX = t => mX + t * dim;
      const PY = t => mY - t * dim;
      // axes
      ctx.strokeStyle = 'rgba(237,228,214,0.28)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(mX, mY); ctx.lineTo(mX + dim, mY); ctx.moveTo(mX, mY); ctx.lineTo(mX, mY - dim); ctx.stroke();
      // curve
      ctx.strokeStyle = '#7FA8C9'; ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let t = 0; t <= 1.001; t += 0.01) {
        const X = PX(t), Y = PY(f(t));
        t === 0 ? ctx.moveTo(X, Y) : ctx.lineTo(X, Y);
      }
      ctx.stroke();
      // secant endpoints
      const x1 = Math.max(0.01, x - h / 2), x2 = Math.min(0.99, x + h / 2);
      const y1 = f(x1), y2 = f(x2);
      // secant
      ctx.strokeStyle = '#D97A46'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(PX(x1), PY(y1)); ctx.lineTo(PX(x2), PY(y2)); ctx.stroke();
      // rise/run triangle
      ctx.strokeStyle = 'rgba(217,122,70,0.6)'; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(PX(x1), PY(y1)); ctx.lineTo(PX(x2), PY(y1)); ctx.lineTo(PX(x2), PY(y2)); ctx.stroke();
      ctx.setLineDash([]);
      // secant slope
      const secSlope = (y2 - y1) / (x2 - x1);
      // tangent at x
      const tx = x, ty = f(x), mtan = df(x);
      const tx2 = Math.max(0.01, x + 0.12), ty2 = ty + mtan * (tx2 - x);
      ctx.strokeStyle = '#F6D76F'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(PX(x - 0.12), PY(ty - mtan * 0.12)); ctx.lineTo(PX(tx2), PY(ty2)); ctx.stroke();
      ctx.fillStyle = '#F6D76F';
      ctx.beginPath(); ctx.arc(PX(x), PY(ty), 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#120D0A';
      ctx.beginPath(); ctx.arc(PX(x), PY(ty), 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#E6DAC4'; ctx.font = '10px IBM Plex Mono, monospace'; ctx.textAlign = 'left';
      ctx.fillText('tangent slope = ' + mtan.toFixed(2) + '  (the derivative at x = ' + x.toFixed(2) + ')', mX + 4, 18);
      ctx.fillStyle = '#D97A46';
      ctx.fillText('secant slope = ' + secSlope.toFixed(2) + '  over [' + x1.toFixed(2) + ', ' + x2.toFixed(2) + ']', mX + 4, 34);
      simStatus(statusEl, 'The secant (orange) cuts the curve at two points; its slope is the average rate of change. Shrink h and the secant tightens onto the tangent (gold) — whose slope is the instantaneous rate of change, the derivative. Secant slope ' + secSlope.toFixed(2) + ' vs tangent ' + mtan.toFixed(2) + '.');
    }
    draw();
    return { destroy() { S.destroy(); } };
  }

  /* ------------------------- limit vision ------------------------- */

  function limitVisionSim(shellEl, statusEl) {
    const S = simCanvas(shellEl, statusEl);
    const ctx = S.ctx;
    const f = x => 0.35 * x * x + 0.15 * x + 0.25;
    const df = x => 0.7 * x + 0.15;
    const x = 0.5;
    let h = 0.5, playing = false, raf = null, dir = -1;
    const controls = simControls(shellEl,
      '<button class="btn btn-accent" data-a="play">Approach the limit</button>' +
      '<button class="btn" data-a="reset">Reset</button><span class="sim-hint">h shrinks toward zero — but never arrives</span>');
    controls.querySelector('[data-a="play"]').addEventListener('click', () => {
      playing = !playing;
      if (playing) { dir = -1; loop(); }
    });
    controls.querySelector('[data-a="reset"]').addEventListener('click', () => { playing = false; h = 0.5; if (raf) cancelAnimationFrame(raf); draw(); });
    function loop() {
      if (!playing) return;
      h = Math.max(0.01, h + dir * 0.004);
      if (h <= 0.012) dir = 1;
      if (h >= 0.5) dir = -1;
      draw();
      raf = requestAnimationFrame(loop);
    }
    function draw() {
      const w = S.w(), hh = S.h();
      ctx.fillStyle = '#120D0A'; ctx.fillRect(0, 0, w, hh);
      const mX = 60, mY = hh - 44;
      const dim = Math.min(w - mX - 30, mY - 30);
      const PX = t => mX + t * dim;
      const PY = t => mY - t * dim;
      ctx.strokeStyle = 'rgba(237,228,214,0.28)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(mX, mY); ctx.lineTo(mX + dim, mY); ctx.moveTo(mX, mY); ctx.lineTo(mX, mY - dim); ctx.stroke();
      ctx.strokeStyle = '#7FA8C9'; ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let t = 0; t <= 1.001; t += 0.01) { const X = PX(t), Y = PY(f(t)); t === 0 ? ctx.moveTo(X, Y) : ctx.lineTo(X, Y); }
      ctx.stroke();
      const x1 = Math.max(0.01, x - h / 2), x2 = Math.min(0.99, x + h / 2);
      const y1 = f(x1), y2 = f(x2);
      const secSlope = (y2 - y1) / (x2 - x1);
      const mtan = df(x);
      ctx.strokeStyle = '#D97A46'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(PX(x1), PY(y1)); ctx.lineTo(PX(x2), PY(y2)); ctx.stroke();
      // gap marker at x
      ctx.strokeStyle = 'rgba(217,122,70,0.55)'; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(PX(x), PY(0)); ctx.lineTo(PX(x), PY(1)); ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = '#F6D76F'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(PX(x - 0.1), PY(f(x) - mtan * 0.1)); ctx.lineTo(PX(x + 0.1), PY(f(x) + mtan * 0.1)); ctx.stroke();
      ctx.fillStyle = '#F6D76F'; ctx.font = '12px IBM Plex Mono, monospace'; ctx.textAlign = 'center';
      ctx.fillText('h = ' + h.toFixed(3), w / 2, 18);
      ctx.fillStyle = '#D97A46'; ctx.font = '11px IBM Plex Mono, monospace';
      ctx.fillText('secant slope = ' + secSlope.toFixed(4), w / 2, 34);
      ctx.fillStyle = '#F6D76F';
      ctx.fillText('limit = ' + mtan.toFixed(4), w / 2, 50);
      const gap = Math.abs(secSlope - mtan);
      simStatus(statusEl, 'The limit is the number the secant slopes approach as h gets arbitrarily small. h = ' + h.toFixed(3) + ': secant ' + secSlope.toFixed(4) + ' vs the limit ' + mtan.toFixed(4) + ' — they are ' + gap.toFixed(4) + ' apart. h never reaches zero; the limit is where the chase is heading.');
    }
    draw();
    return { destroy() { S.destroy(); cancelAnimationFrame(raf); } };
  }

  /* ------------------------- rutherford gold foil ------------------------- */

  function rutherfordScatterSim(shellEl, statusEl) {
    const S = simCanvas(shellEl, statusEl);
    const ctx = S.ctx;
    const NUCLEI = [0.18, 0.34, 0.5, 0.66, 0.82];
    const shots = [];
    let fired = 0;
    const controls = simControls(shellEl,
      '<button class="btn btn-accent" data-a="fire">Fire alpha particle</button>' +
      '<button class="btn" data-a="burst">Fire 10</button>' +
      '<button class="btn" data-a="reset">Reset</button>' +
      '<span class="sim-hint">most pass straight · a few bend · almost none come back</span>');
    function typeFor(b) {
      if (Math.abs(b) < 0.06) return 'bounce';
      if (Math.abs(b) < 0.18) return 'deflect';
      return 'straight';
    }
    function fire() {
      const i = Math.floor(Math.random() * NUCLEI.length);
      const b = (Math.random() * 2 - 1) * 0.55;
      shots.push({ nucleus: i, b, type: typeFor(b) });
      fired++;
      draw();
    }
    function fireBurst() { for (let k = 0; k < 10; k++) fire(); }
    function reset() { shots.length = 0; fired = 0; draw(); }
    controls.querySelector('[data-a="fire"]').addEventListener('click', fire);
    controls.querySelector('[data-a="burst"]').addEventListener('click', fireBurst);
    controls.querySelector('[data-a="reset"]').addEventListener('click', reset);
    function draw() {
      const w = S.w(), h = S.h();
      ctx.fillStyle = '#120D0A'; ctx.fillRect(0, 0, w, h);
      const fx = w * 0.58;
      const gap = h * 0.16;
      ctx.fillStyle = '#E6DAC4'; ctx.font = '10px IBM Plex Mono, monospace'; ctx.textAlign = 'left';
      ctx.fillText('gold foil — a single atom thick', fx + 12, 16);
      ctx.fillStyle = '#7FA8C9';
      ctx.fillRect(w * 0.07, h * 0.42, 12, 20);
      ctx.fillText('alpha source', w * 0.055, h * 0.40);
      ctx.strokeStyle = 'rgba(237,228,214,0.14)';
      ctx.beginPath(); ctx.moveTo(w * 0.14, h * 0.5); ctx.lineTo(w * 0.14, h * 0.5); ctx.stroke();
      ctx.fillStyle = '#C99A57';
      NUCLEI.forEach((t, i) => {
        ctx.beginPath(); ctx.arc(fx, h * t, 4.5, 0, Math.PI * 2); ctx.fill();
      });
      let straight = 0, deflect = 0, bounce = 0;
      for (const sh of shots) {
        straight += sh.type === 'straight' ? 1 : 0;
        deflect += sh.type === 'deflect' ? 1 : 0;
        bounce += sh.type === 'bounce' ? 1 : 0;
        const yN = h * NUCLEI[sh.nucleus];
        const y0 = yN + sh.b * 0.34 * h;
        ctx.strokeStyle = sh.type === 'bounce' ? 'rgba(217,122,70,0.85)'
          : sh.type === 'deflect' ? 'rgba(246,215,111,0.85)'
          : 'rgba(122,197,140,0.5)';
        ctx.lineWidth = sh.type === 'bounce' ? 2 : 1.4;
        ctx.beginPath();
        if (sh.type === 'straight') {
          ctx.moveTo(w * 0.14, y0);
          ctx.lineTo(w * 0.96, y0 + sh.b * 0.05 * h);
        } else {
          const away = sh.b >= 0 ? -1 : 1;
          const kick = sh.type === 'bounce' ? 0.8 * h : 0.32 * h;
          ctx.moveTo(w * 0.14, y0);
          ctx.lineTo(fx, y0);
          ctx.lineTo(fx + 8, y0 + away * kick * 0.16);
          if (sh.type === 'bounce') {
            ctx.lineTo(fx + 2, y0 + away * kick);
            ctx.lineTo(w * 0.14, y0 + away * kick * 0.86);
          } else {
            ctx.lineTo(w * 0.96, y0 + away * kick);
          }
        }
        ctx.stroke();
      }
      const n = shots.length;
      let msg;
      if (n === 0) {
        msg = 'Fire particles at the foil. Alpha particles are tiny, heavy, and positively charged — if the atom were a solid ball of positive pudding, every one of them should plow through or scatter noticeably. Geiger and Marsden found nearly all pass straight through, a few bend sharply, and a handful come straight back.';
      } else {
        const pct = p => (100 * p / n).toFixed(1) + '%';
        msg = n + ' fired — ' + pct(straight) + ' passed straight through, ' + pct(deflect) + ' deflected, ' + pct(bounce) + ' bounced back. Most of the atom is empty space; the rare violent rebounds mean the positive charge is crammed into a tiny central nucleus.';
      }
      simStatus(statusEl, msg);
    }
    draw();
    return { destroy() { S.destroy(); } };
  }

  /* ------------------------- thomson cathode ray ------------------------- */

  function cathodeRaySim(shellEl, statusEl) {
    const S = simCanvas(shellEl, statusEl);
    const ctx = S.ctx;
    let E = 0, B = 0;
    const controls = simControls(shellEl,
      '<label class="sim-slider">electric field (E)<input data-a="e" type="range" min="-10" max="10" step="0.5" value="0" aria-label="electric field strength"><output data-o="e">0</output></label>' +
      '<label class="sim-slider">magnetic field (B)<input data-a="b" type="range" min="-10" max="10" step="0.5" value="0" aria-label="magnetic field strength"><output data-o="b">0</output></label>' +
      '<button class="btn btn-accent" data-a="balance">Balance (E = B)</button>' +
      '<button class="btn" data-a="reset">Reset</button><span class="sim-hint">both fields bend the beam; tune them to cancel</span>');
    const eEl = controls.querySelector('[data-a="e"]');
    const oE = controls.querySelector('[data-o="e"]');
    const bEl = controls.querySelector('[data-a="b"]');
    const oB = controls.querySelector('[data-o="b"]');
    eEl.addEventListener('input', () => { E = parseFloat(eEl.value); oE.value = E; draw(); });
    bEl.addEventListener('input', () => { B = parseFloat(bEl.value); oB.value = B; draw(); });
    controls.querySelector('[data-a="balance"]').addEventListener('click', () => {
      E = 7; B = 7; eEl.value = E; bEl.value = B; oE.value = E; oB.value = B; draw();
    });
    controls.querySelector('[data-a="reset"]').addEventListener('click', () => {
      E = 0; B = 0; eEl.value = E; bEl.value = B; oE.value = E; oB.value = B; draw();
    });
    function draw() {
      const w = S.w(), h = S.h();
      ctx.fillStyle = '#120D0A'; ctx.fillRect(0, 0, w, h);
      const y = h * 0.5;
      const cx = w * 0.1;
      const sx = w * 0.86;
      // tube
      ctx.strokeStyle = 'rgba(237,228,214,0.3)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx, h * 0.14); ctx.lineTo(sx, h * 0.14); ctx.lineTo(sx, h * 0.86); ctx.lineTo(cx, h * 0.86); ctx.closePath(); ctx.stroke();
      // cathode + anode
      ctx.fillStyle = '#8A7C68';
      ctx.fillRect(cx + 6, h * 0.4, 8, h * 0.2);
      ctx.fillStyle = '#7FA8C9';
      ctx.fillRect(sx - 30, h * 0.46, 8, h * 0.08);
      // deflection plates
      ctx.fillStyle = 'rgba(127,168,201,0.5)';
      ctx.fillRect(w * 0.34, h * 0.24, 8, h * 0.1);
      ctx.fillRect(w * 0.34, h * 0.66, 8, h * 0.1);
      // beam
      const offset = (E - B) * h * 0.045;
      const bend = (E - B) * h * 0.09;
      ctx.strokeStyle = '#93A884'; ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(cx + 14, y);
      ctx.quadraticCurveTo(w * 0.42, y + bend, sx - 24, y + offset);
      ctx.stroke();
      ctx.fillStyle = '#93A884';
      ctx.beginPath(); ctx.arc(sx - 24, y + offset, 4, 0, Math.PI * 2); ctx.fill();
      // screen
      ctx.fillStyle = 'rgba(147,168,132,0.16)';
      ctx.fillRect(sx - 6, h * 0.18, 4, h * 0.64);
      ctx.fillStyle = '#E6DAC4'; ctx.font = '10px IBM Plex Mono, monospace'; ctx.textAlign = 'left';
      ctx.fillText('deflection = ' + (offset / h * 22.2).toFixed(1) + ' cm', w * 0.36, 16);
      const bal = Math.abs(E - B) < 0.01;
      simStatus(statusEl, bal
        ? 'The beam flies straight: the magnetic and electric forces exactly cancel, so qE = qvB and the electron speed is v = E/B. Measure v this way, then switch off B and measure the deflection in E alone — and you have the electron\u2019s charge-to-mass ratio, e/m. That is how Thomson, in 1897, showed the electron is a real particle far smaller than any atom.'
        : 'Electrons leave the cathode and speed toward the screen. The electric field between the plates pushes the beam one way; the magnetic field pushes it the other. Tune B until it cancels E and the beam runs dead straight.');
    }
    draw();
    return { destroy() { S.destroy(); } };
  }

  /* ------------------------- blackbody spectrum (Planck) ------------------------- */

  function blackbodySim(shellEl, statusEl) {
    const S = simCanvas(shellEl, statusEl);
    const ctx = S.ctx;
    let T = 3000;
    const controls = simControls(shellEl,
      '<label class="sim-slider">temperature (K)<input data-a="t" type="range" min="1000" max="6000" step="50" value="3000" aria-label="blackbody temperature"><output data-o="t">3000 K</output></label>' +
      '<button class="btn" data-a="reset">Reset</button><span class="sim-hint">warm it up: peak moves left, light turns from red to white-hot</span>');
    const tEl = controls.querySelector('[data-a="t"]');
    const oT = controls.querySelector('[data-o="t"]');
    tEl.addEventListener('input', () => {
      T = parseFloat(tEl.value);
      oT.value = T + ' K';
      draw();
    });
    controls.querySelector('[data-a="reset"]').addEventListener('click', () => {
      T = 3000; tEl.value = T; oT.value = T + ' K'; draw();
    });
    function planck(lambda) {
      const a = 6.6e-34 * 3e8 / (1.38e-23 * T);
      const x = a / lambda;
      return (lambda < 1e-8) ? 0 : 1 / (lambda * lambda * lambda * lambda * lambda) / (Math.exp(x) - 1);
    }
    function rayleigh(lambda) {
      return 1 / (lambda * lambda * lambda * lambda) / (lambda * 3e-2);
    }
    function draw() {
      const w = S.w(), h = S.h();
      ctx.fillStyle = '#120D0A'; ctx.fillRect(0, 0, w, h);
      const mX = 56, mY = h - 34;
      const dim = Math.min(w - mX - 24, mY - 40);
      const L0 = 1e-7, L1 = 3e-6;
      const PX = L => mX + (Math.log(L) - Math.log(L0)) / (Math.log(L1) - Math.log(L0)) * dim;
      let maxP = 0;
      for (let L = L0; L <= L1; L *= 1.02) maxP = Math.max(maxP, planck(L));
      const PY = v => mY - (v / maxP) * dim;
      // axes + rainbow bar
      ctx.strokeStyle = 'rgba(237,228,214,0.25)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(mX, mY); ctx.lineTo(mX + dim, mY); ctx.moveTo(mX, mY); ctx.lineTo(mX, mY - dim); ctx.stroke();
      ctx.fillStyle = '#E6DAC4'; ctx.font = '10px IBM Plex Mono, monospace'; ctx.textAlign = 'left';
      ctx.fillText('UV', mX, mY + 14);
      ctx.fillText('visible', mX + dim * 0.55, mY + 14);
      ctx.fillText('infrared', mX + dim * 0.82, mY + 14);
      ctx.fillText('intensity', 4, 18);
      // classical curve (blows up)
      ctx.strokeStyle = 'rgba(217,122,70,0.7)'; ctx.lineWidth = 1.4; ctx.setLineDash([4, 4]);
      ctx.beginPath();
      for (let L = L0; L <= L1; L *= 1.02) {
        const X = PX(L), Y = PY(Math.min(rayleigh(L), maxP * 1.05));
        X === mX ? ctx.moveTo(X, Y) : ctx.lineTo(X, Y);
      }
      ctx.stroke(); ctx.setLineDash([]);
      // planck curve
      ctx.strokeStyle = '#F6D76F'; ctx.lineWidth = 2.4;
      ctx.beginPath();
      for (let L = L0; L <= L1; L *= 1.02) {
        const X = PX(L), Y = PY(planck(L));
        X === mX ? ctx.moveTo(X, Y) : ctx.lineTo(X, Y);
      }
      ctx.stroke();
      // area under planck
      const area = ctx.createLinearGradient(0, mY - dim, 0, mY);
      area.addColorStop(0, 'rgba(246,215,111,0.25)'); area.addColorStop(1, 'rgba(246,215,111,0)');
      ctx.fillStyle = area;
      ctx.beginPath(); ctx.moveTo(mX, mY);
      for (let L = L0; L <= L1; L *= 1.02) ctx.lineTo(PX(L), PY(planck(L)));
      ctx.lineTo(mX + dim, mY); ctx.closePath(); ctx.fill();
      // peak marker
      let peakL = L0;
      for (let L = L0; L <= L1; L *= 1.02) if (planck(L) > planck(peakL)) peakL = L;
      ctx.strokeStyle = '#C99A57'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(PX(peakL), mY); ctx.lineTo(PX(peakL), mY - dim); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#C99A57';
      ctx.fillText('peak ' + (peakL * 1e9).toFixed(0) + ' nm', PX(peakL) + 4, 30);
      ctx.fillStyle = 'rgba(217,122,70,0.8)';
      ctx.fillText('classical prediction', mX + 8, mY - 18);
      ctx.fillStyle = '#F6D76F';
      ctx.fillText('Planck\u2019s curve', mX + 8, mY - 6);
      const peakNm = peakL * 1e9;
      const wien = 2.9e6 / T;
      simStatus(statusEl, 'A glowing object gives off light in a smooth, predictable curve. At ' + T + ' K the peak sits near ' + peakNm.toFixed(0) + ' nm (' + (wien).toFixed(0) + ' nm predicted by Wien\u2019s law). Classical physics drew the dashed red curve — endless intensity at short wavelengths, the \u201Cultraviolet catastrophe.\u201D Planck tamed it by assuming light energy only comes in chunks of hf, and his curve matches the furnace exactly.');
    }
    draw();
    return { destroy() { S.destroy(); } };
  }

  /* ------------------------- radioactive decay ------------------------- */

  function radioactiveDecaySim(shellEl, statusEl) {
    const S = simCanvas(shellEl, statusEl);
    const ctx = S.ctx;
    const N0 = 160;
    let nuclei = [], t = 0, raf = null, running = false;
    const HALF = { 'Polonium-218 (3 min)': 0.5, 'Iodine-131 (8 days)': 1.6, 'Carbon-14 (5730 yr)': 6 };
    let half = HALF['Carbon-14 (5730 yr)'];
    function reset(brief) {
      running = false; if (raf) cancelAnimationFrame(raf); raf = null;
      t = 0;
      nuclei = [];
      for (let i = 0; i < N0; i++) nuclei.push({ alive: true });
      draw();
      simStatus(statusEl, brief || 'Watch a population of parent nuclei decay. Each one has the same chance of decaying every instant — no nucleus ages, no nucleus chooses. Step in half-life increments and see the population halve, then halve again.');
    }
    const controls = simControls(shellEl,
      '<button class="btn btn-accent" data-a="step">Step ½</button>' +
      '<button class="btn" data-a="run">Run / Pause</button>' +
      '<button class="btn" data-a="reset">Reset</button>' +
      '<label class="sim-select">isotope<select data-a="iso"><option>Polonium-218 (3 min)</option><option>Iodine-131 (8 days)</option><option selected>Carbon-14 (5730 yr)</option></select></label>');
    const isoEl = controls.querySelector('[data-a="iso"]');
    isoEl.addEventListener('change', () => { half = HALF[isoEl.value]; reset(); });
    function step() {
      const p = 1 - Math.pow(2, -0.5 / half);
      for (const nu of nuclei) if (nu.alive && Math.random() < p) nu.alive = false;
      t += 0.5;
      draw();
    }
    function loop() { if (!running) return; step(); raf = requestAnimationFrame(loop); }
    controls.querySelector('[data-a="step"]').addEventListener('click', step);
    controls.querySelector('[data-a="run"]').addEventListener('click', () => {
      running = !running;
      if (running) loop(); else if (raf) cancelAnimationFrame(raf);
    });
    controls.querySelector('[data-a="reset"]').addEventListener('click', () => reset());
    function draw() {
      const w = S.w(), h = S.h();
      ctx.fillStyle = '#120D0A'; ctx.fillRect(0, 0, w, h);
      const left = 16, top = 40;
      const nAlive = nuclei.filter(n => n.alive).length;
      const cols = 16;
      const cw = Math.min(9, (w * 0.36) / cols);
      const rows = Math.ceil(N0 / cols);
      for (let i = 0; i < nuclei.length; i++) {
        const x = left + (i % cols) * (cw + 1);
        const y = top + Math.floor(i / cols) * (cw + 1);
        ctx.fillStyle = nuclei[i].alive ? '#F6D76F' : 'rgba(127,168,201,0.55)';
        ctx.fillRect(x, y, cw, cw);
      }
      ctx.fillStyle = '#E6DAC4'; ctx.font = '10px IBM Plex Mono, monospace'; ctx.textAlign = 'left';
      ctx.fillText('parent nuclei: ' + nAlive + ' / ' + N0, left, 24);
      ctx.fillText('half-lives elapsed: ' + (t / half).toFixed(1), left, top + rows * (cw + 1) + 16);
      // decay curve panel
      const ax = w * 0.46, ay = h - 30;
      const aw = w - ax - 16;
      const ah = h - 60;
      ctx.strokeStyle = 'rgba(237,228,214,0.25)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + aw, ay); ctx.moveTo(ax, ay); ctx.lineTo(ax, ay - ah); ctx.stroke();
      ctx.fillStyle = 'rgba(237,228,214,0.5)';
      ctx.fillText('remaining fraction', ax + 4, ay - ah - 4);
      ctx.fillText('half-life', ax + 4, ay + 14);
      // theoretical curve N/N0 = 2^(-x)
      ctx.strokeStyle = 'rgba(147,168,132,0.6)'; ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let x = 0; x <= 5.01; x += 0.05) {
        const X = ax + x / 5 * aw;
        const Y = ay - Math.pow(2, -x) * ah;
        x === 0 ? ctx.moveTo(X, Y) : ctx.lineTo(X, Y);
      }
      ctx.stroke();
      // measured point
      const xNow = Math.min(5, t / half);
      const frac = nAlive / N0;
      ctx.fillStyle = '#F6D76F';
      ctx.beginPath(); ctx.arc(ax + xNow / 5 * aw, ay - frac * ah, 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(246,215,111,0.5)';
      ctx.beginPath(); ctx.moveTo(ax + xNow / 5 * aw, ay); ctx.lineTo(ax + xNow / 5 * aw, ay - ah); ctx.stroke();
      simStatus(statusEl, 'At t = ' + (t / half).toFixed(1) + ' half-lives, ' + (100 * frac).toFixed(1) + '% of the parent nuclei remain — the gold dots on the left flip to blue as they decay. The dashed curve is the exact prediction N = N\u2080·2^(−t/t½); your observed point rides on it. Rutherford and Soddy measured exactly this in 1902: decay is statistical and immutable — nothing you do to an individual atom hurries or delays it.');
    }
    reset();
    return { destroy() { S.destroy(); if (raf) cancelAnimationFrame(raf); } };
  }

  /* ------------------------- photoelectric effect ------------------------- */

  function photoelectricSim(shellEl, statusEl) {
    const S = simCanvas(shellEl, statusEl);
    const ctx = S.ctx;
    const THRESH = 0.55;
    const COLORS = ['#D97A46', '#C9A257', '#F6D76F', '#7FA56B', '#7FA8C9', '#6C6BB5', '#B06CB5'];
    let f = 0.5, intensity = 0.6, vs = 0, current = 0;
    const controls = simControls(shellEl,
      '<label class="sim-slider">frequency<input data-a="f" type="range" min="0.2" max="1" step="0.01" value="0.5" aria-label="light frequency"><output data-o="f">red</output></label>' +
      '<label class="sim-slider">intensity<input data-a="i" type="range" min="0" max="1" step="0.05" value="0.6" aria-label="light intensity"><output data-o="i">0.6</output></label>' +
      '<label class="sim-slider">stopping voltage<input data-a="v" type="range" min="0" max="1.4" step="0.02" value="0" aria-label="reverse voltage"><output data-o="v">0 V</output></label>' +
      '<button class="btn" data-a="reset">Reset</button><span class="sim-hint">below the threshold, brighter light is useless</span>');
    const fEl = controls.querySelector('[data-a="f"]');
    const oF = controls.querySelector('[data-o="f"]');
    const iEl = controls.querySelector('[data-a="i"]');
    const oI = controls.querySelector('[data-o="i"]');
    const vEl = controls.querySelector('[data-a="v"]');
    const oV = controls.querySelector('[data-o="v"]');
    const FNAMES = [null, 'red', 'orange', 'yellow', 'green', 'blue', 'violet', 'UV'];
    function refresh() {
      f = parseFloat(fEl.value);
      iEl.value = intensity; oI.value = intensity;
      vs = parseFloat(vEl.value); oV.value = vs.toFixed(2) + ' V';
      const ci = Math.min(COLORS.length - 1, Math.max(0, Math.round((f - 0.2) / 0.8 * (COLORS.length - 1))));
      oF.value = FNAMES[ci + 1] || 'UV';
      draw();
    }
    fEl.addEventListener('input', refresh);
    iEl.addEventListener('input', () => { intensity = parseFloat(iEl.value); oI.value = intensity; draw(); });
    vEl.addEventListener('input', () => { vs = parseFloat(vEl.value); oV.value = vs.toFixed(2) + ' V'; draw(); });
    controls.querySelector('[data-a="reset"]').addEventListener('click', () => { fEl.value = 0.5; intensity = 0.6; vEl.value = 0; refresh(); });
    function draw() {
      const w = S.w(), h = S.h();
      ctx.fillStyle = '#120D0A'; ctx.fillRect(0, 0, w, h);
      const plateX = w * 0.3;
      const color = COLORS[Math.min(COLORS.length - 1, Math.max(0, Math.round((f - 0.2) / 0.8 * (COLORS.length - 1))))];
      const above = f - THRESH;
      const ke = above > 0 ? above * 1.6 : 0;
      const blocked = vs >= ke && above > 0;
      current = above > 0 && !blocked ? intensity * 1 : 0;
      // light beam
      ctx.strokeStyle = color; ctx.globalAlpha = 0.5 + intensity * 0.5; ctx.lineWidth = 2;
      const nRays = 3 + Math.round(intensity * 5);
      for (let r = 0; r < nRays; r++) {
        ctx.beginPath(); ctx.moveTo(8, h * (0.3 + r * 0.12)); ctx.lineTo(plateX, h * (0.3 + r * 0.12)); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // metal plate
      ctx.fillStyle = '#8A7C68';
      ctx.fillRect(plateX, h * 0.18, 12, h * 0.64);
      ctx.fillStyle = '#E6DAC4'; ctx.font = '10px IBM Plex Mono, monospace'; ctx.textAlign = 'left';
      ctx.fillText('metal', plateX + 16, h * 0.5);
      ctx.fillStyle = color;
      ctx.fillText('frequency: ' + (oF.value || ''), 8, h * 0.16);
      // electrons
      if (current > 0) {
        ctx.fillStyle = '#93A884';
        for (let r = 0; r < 6; r++) {
          const off = r * 7;
          ctx.beginPath(); ctx.arc(plateX + 14 + off, h * 0.5, 3, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = '#E6DAC4';
        ctx.fillText('e\u207B electrons', plateX + 56, h * 0.53);
      }
      // collector + meter
      ctx.fillStyle = '#7FA8C9';
      ctx.fillRect(w * 0.86, h * 0.2, 10, h * 0.6);
      const gauge = ctx.createLinearGradient(0, h * 0.6, 0, h * 0.2);
      gauge.addColorStop(0, '#1E2A33'); gauge.addColorStop(1, '#5F8FC9');
      ctx.fillStyle = '#1E2A33';
      ctx.fillRect(w * 0.92, h * 0.6, 8, h * 0.02);
      if (current > 0) {
        ctx.fillStyle = gauge;
        ctx.fillRect(w * 0.92, h * 0.6 - current * 0.4 * h, 8, current * 0.4 * h);
      }
      ctx.fillStyle = '#E6DAC4';
      ctx.fillText('current', w * 0.9, h * 0.16);
      ctx.fillText(current > 0 ? (current * 100).toFixed(0) + '\u00B5A' : '0 \u00B5A', w * 0.9, h * 0.6 + 16);
      if (above <= 0) {
        ctx.fillStyle = '#D97A46'; ctx.textAlign = 'center';
        ctx.fillText('below threshold — no electrons, no matter the brightness', w * 0.56, h * 0.8);
      } else if (blocked) {
        ctx.fillStyle = '#D97A46'; ctx.textAlign = 'center';
        ctx.fillText('stopping voltage ' + vs.toFixed(2) + ' V cuts the current off', w * 0.56, h * 0.8);
      } else {
        ctx.fillStyle = '#93A884'; ctx.textAlign = 'center';
        ctx.fillText('emission! current scales with intensity', w * 0.56, h * 0.8);
      }
      simStatus(statusEl, above <= 0
        ? 'Light is below the threshold frequency — even at full intensity not one electron leaves the plate. In the wave picture more light means more energy, so this should be impossible. It only makes sense if light\u2019s energy comes in indivisible packets: a single photon of energy hf must buy the electron out of the metal. Bright red light has the same red photons as dim red light — just more of them, and none big enough. This is Einstein\u2019s 1905 explanation, confirmed to the digit by Millikan in 1916.'
        : blocked
        ? 'Electrons fly off with energy hf \u2212 W, where W is the work needed to escape. The reverse voltage ' + vs.toFixed(2) + ' V just balances them, and the current stops. The stopping voltage is a direct, measurable readout of hf \u2212 W — and it grows with frequency, not with brightness. Electrons fly off instantly even in dim light; only a packet model explains that.'
        : 'Above the threshold, every absorbed photon ejects an electron. Brighter light means more photons, so more electrons — the current tracks the intensity. Note what never changes: each electron\u2019s energy depends only on the colour (frequency), never on how bright the light is.');
    }
    refresh();
    return { destroy() { S.destroy(); } };
  }

  /* ------------------------- roentgen x-ray tube ------------------------- */

  function xRayTubeSim(shellEl, statusEl) {
    const S = simCanvas(shellEl, statusEl);
    const ctx = S.ctx;
    let kV = 60, exposing = false, exposure = 0, raf = null;
    const controls = simControls(shellEl,
      '<label class="sim-slider">tube voltage (kV)<input data-a="kv" type="range" min="30" max="120" step="5" value="60" aria-label="x-ray tube voltage"><output data-o="kv">60 kV</output></label>' +
      '<button class="btn btn-accent" data-a="expose">Expose plate</button>' +
      '<button class="btn" data-a="reset">Reset</button><span class="sim-hint">faster electrons make harder, more penetrating rays</span>');
    const kvEl = controls.querySelector('[data-a="kv"]');
    const oK = controls.querySelector('[data-o="kv"]');
    kvEl.addEventListener('input', () => { kV = parseFloat(kvEl.value); oK.value = kV + ' kV'; draw(); });
    controls.querySelector('[data-a="expose"]').addEventListener('click', () => {
      if (exposing) return;
      exposing = true; exposure = 0; loop();
    });
    controls.querySelector('[data-a="reset"]').addEventListener('click', () => {
      exposing = false; if (raf) cancelAnimationFrame(raf); raf = null; exposure = 0; draw();
      simStatus(statusEl, 'Roentgen, 1895: inside a glass tube a hot filament releases electrons that an electric field flings at a tungsten target. When they slam to a stop, the energy must go somewhere — it comes out as penetrating X-rays. Electrons at 60 kV strike harder than at 30 kV, so the rays are \u201Charder\u201D and pass through flesh more readily.');
    });
    function loop() {
      if (!exposing) return;
      exposure = Math.min(1, exposure + 0.018);
      draw();
      if (exposure >= 1) { exposing = false; simStatus(statusEl, 'The plate is fully exposed. Bone absorbed more of the rays, so it stands out pale against the flesh\u2019s dark. Crank the voltage and expose again: the harder rays punch through everything more evenly, and the bone\u2019s shadow fades.'); }
      else raf = requestAnimationFrame(loop);
    }
    function draw() {
      const w = S.w(), h = S.h();
      ctx.fillStyle = '#120D0A'; ctx.fillRect(0, 0, w, h);
      // tube
      ctx.strokeStyle = 'rgba(237,228,214,0.3)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(10, h * 0.12); ctx.lineTo(w * 0.42, h * 0.12); ctx.lineTo(w * 0.42, h * 0.88); ctx.lineTo(10, h * 0.88); ctx.closePath(); ctx.stroke();
      ctx.fillStyle = '#E6DAC4'; ctx.font = '10px IBM Plex Mono, monospace'; ctx.textAlign = 'left';
      ctx.fillText('vacuum tube', 14, h * 0.1);
      // filament (cathode)
      ctx.strokeStyle = '#D97A46'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(28, h * 0.38); ctx.lineTo(28, h * 0.62); ctx.stroke();
      // target (anode)
      ctx.fillStyle = '#C99A57';
      ctx.beginPath(); ctx.moveTo(w * 0.38, h * 0.86); ctx.lineTo(w * 0.36, h * 0.5); ctx.lineTo(w * 0.42, h * 0.5); ctx.lineTo(w * 0.44, h * 0.86); ctx.closePath(); ctx.fill();
      // electron beam
      ctx.strokeStyle = '#93A884'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(34, h * 0.5); ctx.lineTo(w * 0.4, h * 0.56); ctx.stroke();
      // x-rays out to the right
      const hard = (kV - 30) / 90;
      const rayN = 7;
      ctx.strokeStyle = '#F6D76F'; ctx.globalAlpha = 0.35 + exposure * 0.3; ctx.lineWidth = 1.6;
      for (let r = 0; r < rayN; r++) {
        ctx.beginPath();
        ctx.moveTo(w * 0.42, h * 0.56);
        ctx.lineTo(w * 0.5, h * (0.14 + r * 0.12));
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // hand silhouette
      ctx.fillStyle = '#6B5B45';
      ctx.beginPath();
      ctx.moveTo(w * 0.52, h * 0.18);
      ctx.lineTo(w * 0.54, h * 0.16); ctx.lineTo(w * 0.55, h * 0.32);
      ctx.lineTo(w * 0.57, h * 0.33); ctx.lineTo(w * 0.56, h * 0.46);
      ctx.lineTo(w * 0.58, h * 0.46); ctx.lineTo(w * 0.56, h * 0.6);
      ctx.lineTo(w * 0.6, h * 0.6); ctx.lineTo(w * 0.58, h * 0.74);
      ctx.lineTo(w * 0.62, h * 0.74); ctx.lineTo(w * 0.6, h * 0.88);
      ctx.lineTo(w * 0.5, h * 0.88);
      ctx.lineTo(w * 0.5, h * 0.84); ctx.lineTo(w * 0.52, h * 0.7);
      ctx.lineTo(w * 0.54, h * 0.6); ctx.lineTo(w * 0.54, h * 0.4);
      ctx.lineTo(w * 0.5, h * 0.4); ctx.closePath();
      ctx.fill();
      // photographic plate
      const px = w * 0.7;
      ctx.fillStyle = '#1E2A33';
      ctx.fillRect(px, h * 0.14, 10, h * 0.72);
      const boneFrac = 0.22 + hard * 0.5;
      const fleshFrac = 0.55 + hard * 0.35;
      if (exposure > 0) {
        const fill = (y0, y1, frac) => {
          ctx.fillStyle = 'rgba(222,196,150,' + (exposure * frac).toFixed(3) + ')';
          ctx.fillRect(px, y0, 10, y1 - y0);
        };
        fill(h * 0.14, h * 0.3, fleshFrac);
        fill(h * 0.3, h * 0.4, boneFrac);
        fill(h * 0.4, h * 0.5, fleshFrac * 0.9);
        fill(h * 0.5, h * 0.86, fleshFrac * 0.95);
      }
      ctx.fillStyle = '#E6DAC4';
      ctx.fillText('photographic plate', px - 4, h * 0.12);
      ctx.fillText('exposure ' + (exposure * 100).toFixed(0) + '%', px - 4, h * 0.9);
      simStatus(statusEl, exposure >= 1
        ? 'Exposure complete at ' + kV + ' kV. The plate is dark where the rays passed through flesh and pale where the bones blocked them — the first X-ray photograph in history was of Roentgen\u2019s own wife\u2019s hand, and the ring on her finger still shows. Try a higher voltage: harder rays penetrate bone too, and the shadow softens.'
        : 'Voltage at ' + kV + ' kV. Electrons crash into the tungsten target and the energy reappears as X-rays fanning out to the right. Press expose and the plate will darken — except where the bones of the hand block the rays.');
    }
    draw();
    return { destroy() { S.destroy(); if (raf) cancelAnimationFrame(raf); } };
  }

  /* ------------------------- double slit ------------------------- */

  function doubleSlitSim(shellEl, statusEl) {
    const S = simCanvas(shellEl, statusEl);
    const ctx = S.ctx;
    const hits = [];
    let observe = false, raf = null, firing = false;
    const controls = simControls(shellEl,
      '<button class="btn btn-accent" data-a="fire">Fire particle</button>' +
      '<button class="btn" data-a="burst">Fire 50</button>' +
      '<label class="sim-check"><input data-a="watch" type="checkbox"> watch which slit (observer)</label>' +
      '<button class="btn" data-a="reset">Reset</button><span class="sim-hint">one particle at a time — yet stripes still form</span>');
    const watchEl = controls.querySelector('[data-a="watch"]');
    watchEl.addEventListener('change', () => { observe = watchEl.checked; draw(); });
    function fire() {
      const w = S.w(), h = S.h();
      const y = h / 2 + scatterY(w, h);
      hits.push(y);
      draw();
    }
    function scatterY(w, h) {
      const D = w * 0.5;   // slit-to-screen distance
      const d = 22;        // slit separation (px)
      const lambda = 3;    // effective wavelength (px)
      let u;
      if (observe) {
        const half = (Math.random() < 0.5) ? -1 : 1;
        u = half * (d / 2) * (0.9 + Math.random() * 0.6) * 0.05 + (Math.random() * 2 - 1) * 8;
      } else {
        let tries = 0, accept = false, y0;
        do {
          y0 = (Math.random() * 2 - 1) * h * 0.5;
          const env = Math.exp(-(y0 * y0) / (2 * 900));
          const p = Math.cos(Math.PI * d * y0 / (lambda * D));
          const prob = env * p * p;
          accept = Math.random() < prob;
          tries++;
        } while (!accept && tries < 400);
        u = y0;
      }
      return u;
    }
    function fireBurst() { for (let i = 0; i < 50; i++) fire(); }
    function loop() {
      if (!firing) return;
      fire();
      raf = requestAnimationFrame(loop);
    }
    controls.querySelector('[data-a="fire"]').addEventListener('click', () => { firing = true; loop(); });
    controls.querySelector('[data-a="burst"]').addEventListener('click', fireBurst);
    controls.querySelector('[data-a="reset"]').addEventListener('click', () => {
      firing = false; if (raf) cancelAnimationFrame(raf); raf = null; hits.length = 0; draw();
    });
    function draw() {
      const w = S.w(), h = S.h();
      ctx.fillStyle = '#120D0A'; ctx.fillRect(0, 0, w, h);
      const slitsX = w * 0.42;
      const screenX = w * 0.8;
      const slitY1 = h / 2 - 11, slitY2 = h / 2 + 11;
      // source
      ctx.fillStyle = '#7FA8C9';
      ctx.fillRect(10, h / 2 - 3, 8, 6);
      // barrier
      ctx.fillStyle = '#8A7C68';
      ctx.fillRect(slitsX - 4, 8, 8, slitY1 - 8);
      ctx.fillRect(slitsX - 4, slitY2, 8, h - slitY2 - 8);
      ctx.fillStyle = '#120D0A';
      ctx.fillRect(slitsX - 4, slitY1, 8, slitY2 - slitY1);
      // screen
      ctx.fillStyle = 'rgba(127,168,201,0.14)';
      ctx.fillRect(screenX, 8, 4, h - 16);
      // hits
      for (const y of hits) {
        ctx.fillStyle = '#F6D76F';
        ctx.fillRect(screenX - 2, y - 2, 3, 4);
      }
      ctx.fillStyle = '#E6DAC4'; ctx.font = '10px IBM Plex Mono, monospace'; ctx.textAlign = 'left';
      ctx.fillText('particles detected: ' + hits.length, 12, 16);
      ctx.fillText(observe ? 'observer ON — which-slit known' : 'no observer — which slit unknown', 12, 30);
      const spread = hits.length ? (Math.max(...hits) - Math.min(...hits)) : 0;
      let msg;
      if (hits.length === 0) {
        msg = 'Fire particles one at a time through the two slits and onto the screen. Each one is a single, localised flash. Keep going and you would expect two fuzzy piles — one behind each slit.';
      } else if (observe) {
        msg = 'Observer on: every particle announces which slit it took, and the screen shows two plain piles — one behind each slit. Knowing the path, the stripes vanish. Firing more particles only makes the two mounds smoother.';
      } else {
        msg = hits.length + ' particles in, and the stripe pattern is building — bright bands and gaps, as if each particle interfered with itself. Switch on the observer and the pattern collapses into two mounds. In this setup the question \u201Cwhich slit?\u201D has no answer; asking it is what destroys the fringes.';
      }
      simStatus(statusEl, msg);
    }
    draw();
    return { destroy() { S.destroy(); if (raf) cancelAnimationFrame(raf); } };
  }

  /* ------------------------- fetch-execute (von Neumann) ------------------------- */

  function fetchExecuteSim(shellEl, statusEl) {
    const S = simCanvas(shellEl, statusEl);
    const ctx = S.ctx;
    const mem = [null, null, null, null, null, 12, 30, 0];
    const prog = [
      { a: 0, op: 'LOAD', arg: 5 },
      { a: 1, op: 'ADD', arg: 6 },
      { a: 2, op: 'STORE', arg: 7 },
      { a: 3, op: 'HALT' }
    ];
    let pc = 0, acc = 0, last = null, running = false, raf = null, busy = false;
    const controls = simControls(shellEl,
      '<button class="btn btn-accent" data-a="step">Step</button>' +
      '<button class="btn" data-a="run">Run</button>' +
      '<button class="btn" data-a="reset">Reset</button><span class="sim-hint">fetch → decode → execute — the von Neumann loop</span>');
    function reset(brief) {
      running = false; busy = false; if (raf) cancelAnimationFrame(raf); raf = null;
      pc = 0; acc = 0; mem[7] = 0; last = null;
      draw();
      simStatus(statusEl, brief || 'The program is just numbers in memory: LOAD 5, ADD 6, STORE 7, HALT. The program counter (PC) says which address to read next. Step through and watch instructions, which live in the same store as data, drive the accumulator.');
    }
    function step() {
      if (busy || pc >= prog.length) return;
      busy = true;
      const ins = prog[pc];
      last = ins.a;
      setTimeout(() => {
        if (ins.op === 'LOAD') { acc = mem[ins.arg]; pc++; }
        else if (ins.op === 'ADD') { acc += mem[ins.arg]; pc++; }
        else if (ins.op === 'STORE') { mem[ins.arg] = acc; pc++; }
        else if (ins.op === 'HALT') { running = false; pc++; }
        busy = false;
        draw();
        simStatus(statusEl, (ins.op === 'HALT' ? 'HALT. The machine stops. 12 + 30 = 42 now sits in address 7, written by the program itself — instructions and data were indistinguishable in the same memory.\n\n' : 'Fetched and decoded ' + ins.op + ' ' + ins.arg + ': the CPU read the instruction at address ' + ins.a + ', acted on it, and advanced the program counter to ' + pc + '. The whole power of the stored-program idea is in this loop.'));
      }, 650);
    }
    function loop() { if (!running) return; step(); }
    controls.querySelector('[data-a="step"]').addEventListener('click', step);
    controls.querySelector('[data-a="run"]').addEventListener('click', () => {
      if (running) return;
      running = true;
      if (raf) cancelAnimationFrame(raf);
      const tick = () => { if (!running) return; step(); raf = setTimeout(tick, 850); };
      raf = setTimeout(tick, 850);
    });
    controls.querySelector('[data-a="reset"]').addEventListener('click', () => reset());
    function draw() {
      const w = S.w(), h = S.h();
      ctx.fillStyle = '#120D0A'; ctx.fillRect(0, 0, w, h);
      // memory grid
      ctx.fillStyle = '#E6DAC4'; ctx.font = '10px IBM Plex Mono, monospace'; ctx.textAlign = 'left';
      ctx.fillText('memory (address : contents)', 12, 18);
      for (let i = 0; i < 8; i++) {
        const x = 12 + (i % 4) * 96, y = 26 + Math.floor(i / 4) * 34;
        ctx.fillStyle = last === i ? 'rgba(246,215,111,0.25)' : 'rgba(237,228,214,0.05)';
        ctx.fillRect(x, y, 88, 26);
        ctx.strokeStyle = last === i ? '#F6D76F' : 'rgba(237,228,214,0.2)';
        ctx.lineWidth = last === i ? 2 : 1;
        ctx.strokeRect(x, y, 88, 26);
        const cell = (i < prog.length) ? prog[i].op + ' ' + prog[i].arg : String(mem[i]);
        ctx.fillStyle = last === i ? '#F6D76F' : '#C99A57';
        ctx.fillText(i + ' : ' + cell, x + 5, y + 17);
        if (pc === i && !busy) {
          ctx.fillStyle = '#D97A46';
          ctx.fillText('← PC', x + 60, y + 17);
        }
      }
      // registers
      const rx = w * 0.56;
      ctx.fillStyle = 'rgba(127,168,201,0.1)';
      ctx.fillRect(rx, 18, 150, 52);
      ctx.strokeStyle = 'rgba(127,168,201,0.4)'; ctx.strokeRect(rx, 18, 150, 52);
      ctx.fillStyle = '#7FA8C9';
      ctx.fillText('PC = ' + pc, rx + 8, 36);
      ctx.fillText('ACC = ' + acc, rx + 8, 54);
      ctx.fillStyle = '#E6DAC4';
      ctx.fillText('fetch → decode → execute', rx, 86);
      ctx.fillText('instructions are data', rx, 100);
      simStatus(statusEl, 'Press Step. Watch the PC point at an address, the CPU read the instruction there, carry it out on the accumulator, and move on — then Step again. Because instructions sit in ordinary memory, a program can move numbers, branch, and even rewrite its own code. That one trick is the entire foundation of every general-purpose computer.');
    }
    reset();
    return { destroy() { S.destroy(); if (raf) clearTimeout(raf); } };
  }

  /* ------------------------- galileo inclined plane ------------------------- */

  function inclinedPlaneSim(shellEl, statusEl) {
    const S = simCanvas(shellEl, statusEl);
    const ctx = S.ctx;
    let angle = 20, t = 0, rolling = false, raf = null, done = false;
    const MARKS = [1, 4, 9, 16];
    const controls = simControls(shellEl,
      '<label class="sim-slider">ramp angle<input data-a="a" type="range" min="10" max="45" step="1" value="20" aria-label="ramp angle"><output data-o="a">20\u00B0</output></label>' +
      '<button class="btn btn-accent" data-a="go">Release both balls</button>' +
      '<button class="btn" data-a="reset">Reset</button><span class="sim-hint">heavy and light roll together — and distance grows as t²</span>');
    const aEl = controls.querySelector('[data-a="a"]');
    const oA = controls.querySelector('[data-o="a"]');
    aEl.addEventListener('input', () => { angle = parseInt(aEl.value); oA.value = angle + '\u00B0'; reset('Angle ' + angle + '\u00B0. Galileo tilted the fall to slow it down, then timed balls rolling the same ramp over and over. The steeper the ramp, the faster the fall — but heavy and light always arrive together.'); });
    function reset(brief) {
      rolling = false; done = false; t = 0; if (raf) cancelAnimationFrame(raf); raf = null;
      draw();
      simStatus(statusEl, brief || 'Watch a heavy ball and a light ball race down the ramp. Galileo could not time free fall with a water clock, so he tilted the fall and slowed it. Press release: both balls start together, and no matter the weight, they finish together — while the distances covered in equal beats grow 1, 4, 9, 16.');
    }
    controls.querySelector('[data-a="go"]').addEventListener('click', () => { if (!rolling) { rolling = true; t = 0; done = false; loop(); } });
    controls.querySelector('[data-a="reset"]').addEventListener('click', () => reset());
    function loop() {
      if (!rolling) return;
      t += 1;
      draw();
      if (t >= 160) { rolling = false; done = true; }
      raf = requestAnimationFrame(loop);
    }
    function draw() {
      const w = S.w(), h = S.h();
      ctx.fillStyle = '#120D0A'; ctx.fillRect(0, 0, w, h);
      const x0 = w * 0.12, y0 = h * 0.16;
      const x1 = w * 0.88, y1 = h * 0.84;
      const L = Math.hypot(x1 - x0, y1 - y0);
      // ramp
      ctx.strokeStyle = '#7FA8C9'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      // marks at t=1,2,3,4 (distances 1/16, 4/16, 9/16, 1)
      ctx.strokeStyle = 'rgba(237,228,214,0.5)'; ctx.lineWidth = 1;
      MARKS.forEach((m, i) => {
        const f = m / 16;
        const mx = x0 + (x1 - x0) * f, my = y0 + (y1 - y0) * f;
        const px = -(y1 - y0) / L, py = (x1 - x0) / L;
        ctx.beginPath(); ctx.moveTo(mx - px * 6, my - py * 6); ctx.lineTo(mx + px * 6, my + py * 6); ctx.stroke();
        ctx.fillStyle = '#E6DAC4'; ctx.font = '9px IBM Plex Mono, monospace'; ctx.textAlign = 'center';
        ctx.fillText('t=' + (i + 1), mx + px * 14, my + py * 14);
      });
      // distance along ramp
      const sinA = Math.sin(angle * Math.PI / 180);
      const T = 160;
      const a = 2 * L / (T * T) * (sinA / Math.sin(20 * Math.PI / 180));
      const d = 0.5 * a * t * t;
      const f = Math.min(1, d / L);
      const bx = x0 + (x1 - x0) * f, by = y0 + (y1 - y0) * f;
      // heavy ball
      ctx.fillStyle = '#D97A46';
      ctx.beginPath(); ctx.arc(bx, by, 9, 0, Math.PI * 2); ctx.fill();
      // light ball
      ctx.fillStyle = '#F6D76F';
      ctx.beginPath(); ctx.arc(bx - 3, by - 3, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#E6DAC4'; ctx.font = '11px IBM Plex Mono, monospace'; ctx.textAlign = 'left';
      ctx.fillText('time: ' + (t / 40).toFixed(2) + ' beats', 12, 16);
      ctx.fillText('distance so far: ' + (f * 16).toFixed(1) + ' / 16 of the ramp', 12, 32);
      if (done) {
        ctx.fillStyle = '#93A884';
        ctx.fillText('both arrived together — weight makes no difference', w / 2 - 60, h * 0.9);
      }
      simStatus(statusEl, done
        ? 'Both balls crossed the line at the same beat. Distances in successive equal times run 1, 4, 9, 16 — a square of the time, not a steady trickle. Galileo had shown that falling speeds up uniformly and, against Aristotle, that heavy and light fall alike. The ramp was the first instrument for measuring motion.'
        : 'Time is running in beats. Notice the marks: distance 4 takes twice the time of distance 1, and distance 16 takes four times. The ball is not moving at constant speed — it is gaining speed at a constant rate. Watch the heavy and light balls keep company all the way down.');
    }
    reset();
    return { destroy() { S.destroy(); if (raf) cancelAnimationFrame(raf); } };
  }

  /* ------------------------- oersted compass ------------------------- */

  function oerstedSim(shellEl, statusEl) {
    const S = simCanvas(shellEl, statusEl);
    const ctx = S.ctx;
    let on = false, dir = 1;
    const controls = simControls(shellEl,
      '<button class="btn btn-accent" data-a="on">Current on / off</button>' +
      '<button class="btn" data-a="flip">Flip direction</button>' +
      '<button class="btn" data-a="reset">Reset</button><span class="sim-hint">the needle swings perpendicular to the wire</span>');
    controls.querySelector('[data-a="on"]').addEventListener('click', () => { on = !on; draw(); });
    controls.querySelector('[data-a="flip"]').addEventListener('click', () => { if (on) { dir = -dir; draw(); } });
    controls.querySelector('[data-a="reset"]').addEventListener('click', () => { on = false; dir = 1; draw(); });
    function draw() {
      const w = S.w(), h = S.h();
      ctx.fillStyle = '#120D0A'; ctx.fillRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2;
      // field circles
      for (const r of [30, 60, 95, 130]) {
        ctx.strokeStyle = on ? 'rgba(127,168,201,' + (0.18 + (on ? 0.22 : 0)) + ')' : 'rgba(127,168,201,0.08)';
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
      }
      // wire
      ctx.strokeStyle = '#C99A57'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cx, 8); ctx.lineTo(cx, h - 8); ctx.stroke();
      if (on) {
        ctx.fillStyle = '#F6D76F';
        const dx = dir * 1;
        for (let y = 30; y < h - 30; y += 26) {
          ctx.beginPath();
          ctx.moveTo(cx - dx * 6, y - dir * 6);
          ctx.lineTo(cx + dx * 0, y);
          ctx.lineTo(cx - dx * 6, y + dir * 6);
          ctx.fill();
        }
        ctx.fillStyle = '#E6DAC4'; ctx.font = '10px IBM Plex Mono, monospace'; ctx.textAlign = 'left';
        ctx.fillText('current flowing ' + (dir > 0 ? 'up' : 'down'), 12, 16);
      }
      // compasses
      const compasses = [
        { x: cx - 100, y: cy },
        { x: cx + 100, y: cy },
        { x: cx, y: cy - 100 },
        { x: cx, y: cy + 100 }
      ];
      compasses.forEach(c => {
        const rx = c.x - cx, ry = c.y - cy;
        const r = Math.hypot(rx, ry) || 1;
        // tangent direction: rotate radius by 90° * dir
        let ang;
        if (!on) {
          ang = -Math.PI / 2; // north = up
        } else {
          ang = Math.atan2(rx, ry) + dir * Math.PI / 2;
        }
        // compass body
        ctx.strokeStyle = 'rgba(237,228,214,0.35)'; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(c.x, c.y, 13, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#E6DAC4';
        ctx.font = '8px IBM Plex Mono, monospace'; ctx.textAlign = 'center';
        ctx.fillText('N', c.x, c.y - 16);
        // needle
        ctx.strokeStyle = '#D97A46'; ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(c.x - Math.sin(ang) * 11, c.y - Math.cos(ang) * 11);
        ctx.lineTo(c.x + Math.sin(ang) * 11, c.y + Math.cos(ang) * 11);
        ctx.stroke();
      });
      simStatus(statusEl, on
        ? 'Current flows' + (dir > 0 ? ' up' : ' down') + ' the wire, and the magnetic field wraps around it in circles. Every compass needle has turned to point along a ring, perpendicular to the wire — the deflection Oersted saw in 1820 that overnight united electricity and magnetism. Flip the current and every needle flips to follow the reversed rings.'
        : 'No current: the needles all point north, as compasses have for centuries. Throw the switch and a compass placed near a wire will swing sideways — a current bends the needle into a ring around the wire, the first proof that electricity makes magnetism.');
    }
    draw();
    return { destroy() { S.destroy(); } };
  }

  /* ------------------------- michelson-morley ------------------------- */

  function michelsonMorleySim(shellEl, statusEl) {
    const S = simCanvas(shellEl, statusEl);
    const ctx = S.ctx;
    let wind = 30, showPredicted = false, measured = false;
    const controls = simControls(shellEl,
      '<label class="sim-slider">aether wind (km/s)<input data-a="v" type="range" min="0" max="30" step="1" value="30" aria-label="assumed aether wind speed"><output data-o="v">30 km/s</output></label>' +
      '<label class="sim-check"><input data-a="pred" type="checkbox"> show the predicted (classical) shift</label>' +
      '<button class="btn btn-accent" data-a="measure">Measure</button>' +
      '<button class="btn" data-a="reset">Reset</button>');
    const vEl = controls.querySelector('[data-a="v"]');
    const oV = controls.querySelector('[data-o="v"]');
    const predEl = controls.querySelector('[data-a="pred"]');
    vEl.addEventListener('input', () => { wind = parseInt(vEl.value); oV.value = wind + ' km/s'; draw(); });
    predEl.addEventListener('change', () => { showPredicted = predEl.checked; draw(); });
    controls.querySelector('[data-a="measure"]').addEventListener('click', () => { measured = true; draw(); });
    controls.querySelector('[data-a="reset"]').addEventListener('click', () => { measured = false; wind = 30; vEl.value = 30; oV.value = '30 km/s'; predEl.checked = false; showPredicted = false; draw(); });
    function draw() {
      const w = S.w(), h = S.h();
      ctx.fillStyle = '#120D0A'; ctx.fillRect(0, 0, w, h);
      const cx = w * 0.34, cy = h * 0.52;
      const arm = Math.min(w, h) * 0.22;
      // splitter
      ctx.strokeStyle = 'rgba(237,228,214,0.5)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx - 8, cy + 8); ctx.lineTo(cx + 8, cy - 8); ctx.stroke();
      // mirrors
      ctx.fillStyle = '#8A7C68';
      ctx.fillRect(cx - 5, cy - arm - 6, 10, 6);
      ctx.fillRect(cx + arm - 3, cy - 6, 6, 12);
      // light paths
      ctx.strokeStyle = '#F6D76F'; ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx, cy - arm);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx + arm, cy);
      ctx.stroke();
      // source + screen
      ctx.fillStyle = '#93A884';
      ctx.fillRect(cx - arm * 1.3 - 10, cy - 3, 10, 6);
      ctx.fillStyle = '#E6DAC4'; ctx.font = '10px IBM Plex Mono, monospace'; ctx.textAlign = 'left';
      ctx.fillText('light source', cx - arm * 1.3 - 12, cy - 12);
      ctx.fillText('beam splitter', cx + 12, cy - 14);
      ctx.fillText('mirrors', cx + arm - 40, cy - 14);
      // wind arrows
      if (wind > 2) {
        ctx.fillStyle = 'rgba(127,168,201,0.7)';
        for (let x = w * 0.66; x < w - 8; x += 24) {
          ctx.beginPath(); ctx.moveTo(x + 8, 14); ctx.lineTo(x - 2, 14); ctx.lineTo(x + 2, 10); ctx.lineTo(x + 2, 18); ctx.fill();
        }
        ctx.fillText('assumed aether wind ' + wind + ' km/s \u2192', w * 0.66, 28);
      }
      // screen with fringes
      const sx = w * 0.78, sy = h * 0.3, sH = h * 0.4;
      ctx.strokeStyle = 'rgba(237,228,214,0.3)'; ctx.lineWidth = 1;
      ctx.strokeRect(sx, sy, 26, sH);
      const shift = 0.44 * (wind / 30) * (wind / 30);
      const fringeCount = 4;
      for (let i = 0; i <= fringeCount * 2; i++) {
        const x = sx + 13 + (showPredicted ? shift * 26 * 0.6 : 0) + (i / (fringeCount * 2) - 0.5) * 26 * 0.9;
        ctx.fillStyle = i % 2 === 0 ? 'rgba(246,215,111,0.8)' : 'rgba(120,110,90,0.4)';
        ctx.fillRect(x, sy, 26 / (fringeCount * 2) * 0.55, sH);
      }
      ctx.fillStyle = '#E6DAC4'; ctx.font = '10px IBM Plex Mono, monospace';
      ctx.fillText('screen', sx + 2, sy - 8);
      const predicted = shift.toFixed(2);
      const frac = '0.00';
      ctx.fillStyle = '#D97A46';
      ctx.fillText('predicted shift: ' + predicted + ' fringe', sx - 90, sy + sH + 18);
      ctx.fillStyle = '#93A884';
      ctx.fillText('measured: ' + frac + ' fringe', sx - 90, sy + sH + 34);
      simStatus(statusEl, measured
        ? 'Measured: the fringes stay put. If light were waves in a medium — the aether — the Earth\u2019s 30 km/s passage should lag one arm behind the other and slide the fringes by ' + predicted + ' of a fringe. Nothing moves, whatever way the table is turned. Light has no medium to ride, and its speed is the same in every direction. That null result, 1887, is the fact special relativity was built on.'
        : 'A beam is split, sent up and across to mirrors, and recombined. If a wind of ' + wind + ' km/s blew through the aether it would slow the light on one leg and shift the fringes by about ' + predicted + ' of a fringe. Toggle the classical prediction to see how far that would be — then measure, as Michelson and Morley did, and watch the fringes refuse to move.');
    }
    draw();
    return { destroy() { S.destroy(); } };
  }

  /* ------------------------- hubble expansion ------------------------- */

  function hubbleRedshiftSim(shellEl, statusEl) {
    const S = simCanvas(shellEl, statusEl);
    const ctx = S.ctx;
    let expand = 0, running = false, raf = null;
    let picked = 0;
    const galaxies = [];
    for (let i = 0; i < 14; i++) {
      const ang = Math.random() * Math.PI * 2;
      const r = 0.15 + Math.random() * 0.75;
      galaxies.push({ ang, r });
    }
    const controls = simControls(shellEl,
      '<button class="btn btn-accent" data-a="run">Run / pause expansion</button>' +
      '<button class="btn" data-a="pick">Pick a galaxy</button>' +
      '<button class="btn" data-a="reset">Reset</button><span class="sim-hint">farther galaxies recede faster — space itself stretches</span>');
    controls.querySelector('[data-a="run"]').addEventListener('click', () => {
      running = !running;
      if (running) loop(); else if (raf) cancelAnimationFrame(raf);
    });
    controls.querySelector('[data-a="pick"]').addEventListener('click', () => { picked = (picked + 1) % galaxies.length; draw(); });
    controls.querySelector('[data-a="reset"]').addEventListener('click', () => { running = false; if (raf) cancelAnimationFrame(raf); raf = null; expand = 0; picked = 0; draw(); });
    function loop() { if (!running) return; expand = Math.min(1, expand + 0.005); draw(); raf = requestAnimationFrame(loop); }
    function draw() {
      const w = S.w(), h = S.h();
      ctx.fillStyle = '#120D0A'; ctx.fillRect(0, 0, w, h);
      const cx = w * 0.3, cy = h * 0.5;
      const R = Math.min(w, h) * 0.34;
      const a = 1 + 0.7 * expand;
      // grid
      ctx.strokeStyle = 'rgba(237,228,214,0.09)'; ctx.lineWidth = 1;
      for (let gx = 1; gx < 6; gx++) {
        const f = gx / 6;
        ctx.beginPath(); ctx.moveTo(cx + (f - 0.5) * 2 * R * a, cy - R * a); ctx.lineTo(cx + (f - 0.5) * 2 * R * a, cy + R * a); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx - R * a, cy + (f - 0.5) * 2 * R * a); ctx.lineTo(cx + R * a, cy + (f - 0.5) * 2 * R * a); ctx.stroke();
      }
      // galaxies
      galaxies.forEach((g, i) => {
        const x = cx + g.r * Math.cos(g.ang) * R * a;
        const y = cy + g.r * Math.sin(g.ang) * R * a;
        const r = 2.2 + g.r * 1.6;
        ctx.fillStyle = i === picked ? '#F6D76F' : '#C99A57';
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      });
      ctx.fillStyle = '#E6DAC4'; ctx.font = '10px IBM Plex Mono, monospace'; ctx.textAlign = 'left';
      ctx.fillText('expansion factor ×' + a.toFixed(2), 12, 16);
      // spectrum panel for picked galaxy
      const g = galaxies[picked];
      const d = g.r;
      const z = 0.7 * expand * d * 3;
      const sx = w * 0.62, sy = h * 0.2;
      ctx.fillStyle = '#1E2A33';
      ctx.fillRect(sx, sy, w * 0.33, h * 0.34);
      ctx.fillStyle = '#E6DAC4';
      ctx.fillText('spectrum of the picked galaxy', sx + 6, sy + 14);
      const base = [0.12, 0.2, 0.28];
      base.forEach((f, i) => {
        ctx.fillStyle = 'rgba(237,228,214,0.2)';
        ctx.fillRect(sx + 10 + f * (w * 0.33 - 20), sy + 20, w * 0.33 - 20, 12);
        const lx = sx + 10 + (f + z * 0.06) * (w * 0.33 - 20);
        ctx.strokeStyle = i === 0 ? '#7FA8C9' : i === 1 ? '#93A884' : '#D97A46';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(lx, sy + 18); ctx.lineTo(lx, sy + 34); ctx.stroke();
      });
      ctx.fillStyle = '#C99A57';
      ctx.fillText('lines shift red by z = ' + z.toFixed(2), sx + 6, sy + 52);
      ctx.fillText('(older light, stretched more)', sx + 6, sy + 66);
      // velocity vs distance plot
      const px = w * 0.62, py = h * 0.72;
      const pw = w * 0.33, ph = h * 0.2;
      ctx.strokeStyle = 'rgba(237,228,214,0.25)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + pw, py); ctx.moveTo(px, py); ctx.lineTo(px, py - ph); ctx.stroke();
      ctx.fillStyle = 'rgba(237,228,214,0.5)'; ctx.font = '9px IBM Plex Mono, monospace';
      ctx.fillText('velocity', px + pw / 2 - 18, py - ph - 4);
      ctx.fillText('distance \u2192', px + pw / 2 - 20, py + 14);
      // line v = H0 d
      ctx.strokeStyle = '#93A884'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + pw, py - ph); ctx.stroke();
      galaxies.forEach(g => {
        const dg = g.r * a;
        const v = Math.min(0.8, dg * expand * 0.5);
        ctx.fillStyle = '#C99A57';
        ctx.fillRect(px + dg * pw * 0.8 - 1.5, py - v * ph - 1.5, 3, 3);
      });
      simStatus(statusEl, expand > 0.01
        ? 'Space is stretching, so every galaxy moves away from every other. The picked galaxy, at ' + d.toFixed(2) + ' units out, recedes faster than near ones — its spectrum lines stretch red by z = ' + z.toFixed(2) + '. Plot velocity against distance and the points lie on one straight line: v = H\u2080d. Hubble read that line off in 1929, and with it the universe\u2019s expansion. It is not matter fleeing through space; it is space itself growing, carrying every island of stars along.'
        : 'Press run. This patch of space grows, and every galaxy rides the stretching grid. Now pick a galaxy and watch its spectral lines creep toward the red end — the more it is stretched, the farther its light has travelled. Farther galaxies recede faster; nearer ones crawl. That is the pattern Hubble discovered.');
    }
    draw();
    return { destroy() { S.destroy(); if (raf) cancelAnimationFrame(raf); } };
  }

  /* ------------------------- cloud chamber ------------------------- */

  function cloudChamberSim(shellEl, statusEl) {
    const S = simCanvas(shellEl, statusEl);
    const ctx = S.ctx;
    let current = null, revealed = false;
    const controls = simControls(shellEl,
      '<button class="btn btn-accent" data-a="gen">Generate a track</button>' +
      '<label class="sim-select">your guess<select data-a="guess"><option>alpha</option><option>electron</option><option>positron</option><option>gamma</option></select></label>' +
      '<button class="btn" data-a="check">Check</button>' +
      '<button class="btn" data-a="reset">Reset</button><span class="sim-hint">thick & straight? thin & curving? no track at all?</span>');
    const guessEl = controls.querySelector('[data-a="guess"]');
    controls.querySelector('[data-a="gen"]').addEventListener('click', () => {
      const kinds = ['alpha', 'alpha', 'electron', 'electron', 'positron', 'gamma'];
      current = kinds[Math.floor(Math.random() * kinds.length)];
      revealed = false;
      draw();
      simStatus(statusEl, 'A particle has passed through the supersaturated vapour. Read the track — then guess what it was and check. Thick, short, straight: a heavy alpha. Thin and curving: a light electron. Curving the other way: an antimatter positron. No track at all: an uncharged gamma.');
    });
    controls.querySelector('[data-a="check"]').addEventListener('click', () => {
      if (!current) return;
      revealed = true;
      draw();
      const guess = guessEl.value;
      const right = guess === current;
      simStatus(statusEl, (right ? 'Right — ' : 'Not quite — ') + 'it was a ' + current + '. ' + describe(current) + (right ? ' Good eye.' : ' Compare the clues: thickness, length, and which way it curls.'));
    });
    controls.querySelector('[data-a="reset"]').addEventListener('click', () => { current = null; revealed = false; draw(); });
    function describe(kind) {
      if (kind === 'alpha') return 'Alpha: two protons and two neutrons, heavy and doubly charged — it ploughs a short, straight, fat trail, like a freight train through fog.';
      if (kind === 'electron') return 'The electron is light, so the chamber\u2019s magnetic field bends it into a thin tight curl.';
      if (kind === 'positron') return 'The positron has the same mass as an electron but opposite charge, so its thin track curves the opposite way in the same field.';
      return 'Gamma: no charge, no track — it rarely disturbs the vapour, and when it does it only nudges a stray electron out of an atom.';
    }
    function draw() {
      const w = S.w(), h = S.h();
      ctx.fillStyle = '#0F1A24'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(237,228,214,0.15)'; ctx.lineWidth = 1;
      ctx.strokeRect(6, 6, w - 12, h - 12);
      ctx.fillStyle = '#E6DAC4'; ctx.font = '10px IBM Plex Mono, monospace'; ctx.textAlign = 'left';
      ctx.fillText('Wilson chamber · magnetic field \u2299 into the page', 12, 18);
      if (!current) {
        ctx.fillStyle = 'rgba(237,228,214,0.4)';
        ctx.fillText('no track yet — generate one', w / 2 - 70, h / 2);
      } else {
        const cx = w * 0.55, cy = h * 0.5;
        if (current === 'alpha') {
          ctx.strokeStyle = 'rgba(122,197,140,0.9)'; ctx.lineWidth = 4.5;
          ctx.beginPath(); ctx.moveTo(cx - 60, cy + 10); ctx.lineTo(cx + 40, cy - 14); ctx.stroke();
        } else if (current === 'electron') {
          ctx.strokeStyle = 'rgba(127,168,201,0.9)'; ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(cx - 50, cy);
          ctx.arc(cx + 20, cy, 70, Math.PI, 0, true);
          ctx.stroke();
        } else if (current === 'positron') {
          ctx.strokeStyle = 'rgba(176,108,181,0.9)'; ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(cx - 50, cy);
          ctx.arc(cx - 40, cy, 90, 0, Math.PI, false);
          ctx.stroke();
        } else {
          ctx.fillStyle = 'rgba(237,228,214,0.25)';
          for (const [ox, oy] of [[-8, 6], [6, -4], [-2, 10], [10, 4]]) {
            ctx.beginPath(); ctx.arc(cx + ox, cy + oy, 1.4, 0, Math.PI * 2); ctx.fill();
          }
          ctx.fillStyle = 'rgba(237,228,214,0.5)';
          ctx.fillText('no track', cx + 16, cy);
        }
        if (revealed) {
          ctx.fillStyle = '#F6D76F';
          ctx.fillText(current.toUpperCase(), cx + 10, cy - (current === 'alpha' ? 20 : 30));
        }
      }
    }
    draw();
    return { destroy() { S.destroy(); } };
  }

  /* ------------------------- peppered moth (natural selection) ------------------------- */

  function pepperedMothSim(shellEl, statusEl) {
    const S = simCanvas(shellEl, statusEl);
    const ctx = S.ctx;
    const N = 220;
    let moths = [], darkBark = false, gen = 0;
    function initMoths() {
      moths = [];
      for (let i = 0; i < N; i++) {
        const g = Math.random() < 0.85 ? 0 : (Math.random() < 0.5 ? 1 : 2);
        moths.push({ g, x: Math.random(), y: Math.random() });
      }
      gen = 0;
    }
    function survival(g) {
      const dark = g >= 1;
      return darkBark ? (dark ? 0.78 : 0.26) : (dark ? 0.26 : 0.78);
    }
    function nextGen() {
      const survivors = moths.filter(m => Math.random() < survival(m.g));
      const pool = survivors.length ? survivors : moths;
      const next = [];
      for (let i = 0; i < N; i++) {
        const p1 = pool[Math.floor(Math.random() * pool.length)];
        const p2 = pool[Math.floor(Math.random() * pool.length)];
        const a1 = p1.g >= 1 ? 'A' : 'a';
        const a2 = p2.g >= 1 ? 'A' : 'a';
        const a = Math.random() < 0.5 ? a1 : a2;
        const b = Math.random() < 0.5 ? a2 : a1;
        const g = a === 'A' && b === 'A' ? 2 : (a === 'A' || b === 'A' ? 1 : 0);
        next.push({ g, x: Math.random(), y: Math.random() });
      }
      moths = next;
      gen++;
      draw();
    }
    const controls = simControls(shellEl,
      '<button class="btn btn-accent" data-a="gen">Next generation</button>' +
      '<button class="btn" data-a="env">Flip environment</button>' +
      '<button class="btn" data-a="reset">Reset</button><span class="sim-hint">the environment, not intention, picks the survivors</span>');
    controls.querySelector('[data-a="gen"]').addEventListener('click', nextGen);
    controls.querySelector('[data-a="env"]').addEventListener('click', () => { darkBark = !darkBark; draw(); simStatus(statusEl, 'Environment flipped to ' + (darkBark ? 'sooted (industrial) bark' : 'clean lichen bark') + '. Now watch which moths survive and breed.'); });
    controls.querySelector('[data-a="reset"]').addEventListener('click', () => { darkBark = false; initMoths(); draw(); simStatus(statusEl, 'A forest of Biston betularia. Most moths are pale (aa); a few carry the dark allele (Aa or AA). Press \u201Cnext generation\u201D and the survivors, chosen by camouflage against the bark, pass their genes on.'); });
    function draw() {
      const w = S.w(), h = S.h();
      ctx.fillStyle = darkBark ? '#3A312A' : '#C8B692';
      ctx.fillRect(0, 0, w, h);
      // bark texture
      ctx.strokeStyle = darkBark ? 'rgba(20,16,12,0.4)' : 'rgba(120,105,80,0.35)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 26; i++) {
        ctx.beginPath();
        ctx.moveTo(Math.random() * w, 0);
        ctx.quadraticCurveTo(Math.random() * w, h / 2, Math.random() * w, h);
        ctx.stroke();
      }
      // moths
      for (const m of moths) {
        ctx.fillStyle = m.g >= 1 ? '#20242B' : '#E8E0C8';
        ctx.beginPath();
        ctx.ellipse(8 + m.x * (w - 16), 8 + m.y * (h - 16), 3.4, 2.4, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // allele bar
      const darkCount = moths.filter(m => m.g >= 1).length;
      const darkAlleles = moths.reduce((acc, m) => acc + m.g, 0);
      const freq = darkAlleles / (moths.length * 2);
      ctx.fillStyle = 'rgba(12,10,8,0.7)';
      ctx.fillRect(10, h - 22, Math.min(w - 20, 240), 12);
      ctx.fillStyle = '#20242B';
      ctx.fillRect(10, h - 22, Math.min(w - 20, 240) * freq, 12);
      ctx.fillStyle = '#F6D76F'; ctx.font = '10px IBM Plex Mono, monospace'; ctx.textAlign = 'left';
      ctx.fillText('dark allele ' + (freq * 100).toFixed(0) + '%   ·   dark moths ' + (100 * darkCount / moths.length).toFixed(0) + '%', 12, h - 30);
      simStatus(statusEl, gen === 0
        ? 'A colony of peppered moths on ' + (darkBark ? 'sooted' : 'lichen') + ' bark. Each generation: every moth\u2019s chance of surviving to breed is set by how well its colour hides it. The better-camouflaged variants quietly out-reproduce the rest — no moth chooses, no design decides.'
        : 'Generation ' + gen + ' on ' + (darkBark ? 'sooted' : 'lichen') + ' bark. ' + (100 * darkCount / moths.length).toFixed(0) + '% of moths are dark. Keep stepping and the population tips toward whichever colour the bark rewards. That is evolution by natural selection in miniature — Kettlewell\u2019s 1953 experiment made it measurable on a real woodland.');
    }
    initMoths();
    draw();
    return { destroy() { S.destroy(); } };
  }

  /* ------------------------- galton board ------------------------- */

  function galtonBoardSim(shellEl, statusEl) {
    const S = simCanvas(shellEl, statusEl);
    const ctx = S.ctx;
    const ROWS = 9;
    const bins = new Array(ROWS + 1).fill(0);
    let total = 0;
    const falling = [];
    let raf = null;
    function drop(n) {
      for (let i = 0; i < n; i++) {
        let bin = 0;
        for (let r = 0; r < ROWS; r++) if (Math.random() < 0.5) bin++;
        falling.push({ bin, y: 0, done: false });
      }
      if (!raf) loop();
    }
    function loop() {
      for (const b of falling) {
        if (b.done) continue;
        if (b.y < ROWS) {
          b.y += 0.22;
        } else {
          b.done = true;
          bins[b.bin]++;
          total++;
        }
      }
      draw();
      if (falling.some(b => !b.done)) raf = requestAnimationFrame(loop);
      else { raf = null; falling.length = 0; }
    }
    const controls = simControls(shellEl,
      '<button class="btn btn-accent" data-a="one">Drop 1</button>' +
      '<button class="btn" data-a="many">Drop 50</button>' +
      '<button class="btn" data-a="reset">Reset</button><span class="sim-hint">each bounce is a coin flip — the crowd makes a bell curve</span>');
    controls.querySelector('[data-a="one"]').addEventListener('click', () => drop(1));
    controls.querySelector('[data-a="many"]').addEventListener('click', () => drop(50));
    controls.querySelector('[data-a="reset"]').addEventListener('click', () => { bins.fill(0); total = 0; falling.length = 0; if (raf) cancelAnimationFrame(raf); raf = null; draw(); });
    function draw() {
      const w = S.w(), h = S.h();
      ctx.fillStyle = '#120D0A'; ctx.fillRect(0, 0, w, h);
      const top = 18, bottom = h - 40;
      const rows = ROWS;
      const rowGap = (bottom - top) / rows;
      const colW = (w - 30) / (rows + 1);
      const cx = w / 2;
      // pegs
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c <= r; c++) {
          const x = cx + (c - r / 2) * colW;
          const y = top + r * rowGap;
          ctx.fillStyle = 'rgba(237,228,214,0.4)';
          ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
        }
      }
      // bins
      const maxBin = Math.max(1, ...bins);
      for (let c = 0; c <= rows; c++) {
        const x = cx + (c - rows / 2) * colW;
        const binH = (bins[c] / maxBin) * (h - bottom - 6);
        ctx.fillStyle = '#C99A57';
        ctx.fillRect(x - colW / 2 + 3, bottom - binH, colW - 6, binH);
        ctx.strokeStyle = 'rgba(237,228,214,0.3)';
        ctx.strokeRect(x - colW / 2 + 3, bottom - binH, colW - 6, binH);
        if (bins[c] > 0) {
          ctx.fillStyle = '#E6DAC4'; ctx.font = '9px IBM Plex Mono, monospace'; ctx.textAlign = 'center';
          ctx.fillText(String(bins[c]), x, bottom - binH - 4);
        }
      }
      // falling balls
      for (const b of falling) {
        if (b.done) continue;
        const x = cx + (b.bin - ROWS / 2) * colW;
        const y = top + b.y * rowGap;
        ctx.fillStyle = '#F6D76F';
        ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
      }
      // ideal binomial curve
      ctx.strokeStyle = 'rgba(147,168,132,0.7)'; ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let c = 0; c <= rows; c++) {
        const p = comb(rows, c) / Math.pow(2, rows);
        const x = cx + (c - rows / 2) * colW;
        const y = bottom - p * (h - bottom - 6);
        c === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.fillStyle = '#E6DAC4'; ctx.font = '10px IBM Plex Mono, monospace'; ctx.textAlign = 'left';
      ctx.fillText('balls: ' + total, 12, 16);
      simStatus(statusEl, 'Every ball stumbles left or right at each peg — a coin flip, nothing more. One ball lands anywhere. But drop enough and the heap swells in the middle and tapers to both edges, matching the ideal curve drawn in green. Add up enough small random steps and a bell appears — the central limit theorem, first shown publicly on Galton\u2019s quincunx board in 1873.');
    }
    function comb(n, k) {
      let r = 1;
      for (let i = 0; i < k; i++) r = r * (n - i) / (i + 1);
      return r;
    }
    draw();
    return { destroy() { S.destroy(); if (raf) cancelAnimationFrame(raf); } };
  }

  /* ------------------------- x-ray diffraction (photo 51) ------------------------- */

  function xRayDiffractionSim(shellEl, statusEl) {
    const S = simCanvas(shellEl, statusEl);
    const ctx = S.ctx;
    let pitch = 0.5, exposed = false;
    const controls = simControls(shellEl,
      '<label class="sim-slider">helix pitch<input data-a="p" type="range" min="0.2" max="1" step="0.05" value="0.5" aria-label="dna helix pitch"><output data-o="p">0.5</output></label>' +
      '<button class="btn btn-accent" data-a="shoot">Shoot X-rays</button>' +
      '<button class="btn" data-a="reset">Reset</button><span class="sim-hint">the cross of spots encodes the helix\u2019s pitch</span>');
    const pEl = controls.querySelector('[data-a="p"]');
    const oP = controls.querySelector('[data-o="p"]');
    pEl.addEventListener('input', () => { pitch = parseFloat(pEl.value); oP.value = pitch; draw(); });
    controls.querySelector('[data-a="shoot"]').addEventListener('click', () => { exposed = true; draw(); });
    controls.querySelector('[data-a="reset"]').addEventListener('click', () => { exposed = false; pitch = 0.5; pEl.value = 0.5; oP.value = '0.5'; draw(); });
    function draw() {
      const w = S.w(), h = S.h();
      ctx.fillStyle = '#120D0A'; ctx.fillRect(0, 0, w, h);
      const mx = w * 0.4, my = h * 0.5;
      const n = 12;
      // DNA strands: two sine helices (side view)
      ctx.strokeStyle = '#7FA8C9'; ctx.lineWidth = 1.6;
      for (const phase of [0, Math.PI]) {
        ctx.beginPath();
        for (let i = 0; i <= n; i++) {
          const t = i / n;
          const y = my - h * 0.16 + t * h * 0.32;
          const x = mx + Math.sin(t * Math.PI * 4 + phase) * 22;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      // rungs
      ctx.strokeStyle = 'rgba(246,215,111,0.5)'; ctx.lineWidth = 1;
      for (let i = 1; i < n; i += 2) {
        const t = i / n;
        const y = my - h * 0.16 + t * h * 0.32;
        const x1 = mx + Math.sin(t * Math.PI * 4) * 22;
        const x2 = mx + Math.sin(t * Math.PI * 4 + Math.PI) * 22;
        ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
      }
      // x-ray beam from left
      ctx.strokeStyle = '#F6D76F'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(8, h / 2); ctx.lineTo(mx - 70, h / 2); ctx.stroke();
      ctx.fillStyle = '#E6DAC4'; ctx.font = '10px IBM Plex Mono, monospace'; ctx.textAlign = 'left';
      ctx.fillText('X-ray beam', 8, h / 2 - 12);
      ctx.fillText('DNA fibre (top view)', mx - 60, my + h * 0.22);
      // detector
      const dx = w * 0.66, dy = h * 0.5;
      const R = Math.min(w, h) * 0.28;
      ctx.fillStyle = '#10140E';
      ctx.beginPath(); ctx.arc(dx, dy, R, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(237,228,214,0.3)'; ctx.stroke();
      ctx.fillStyle = '#E6DAC4'; ctx.font = '10px IBM Plex Mono, monospace'; ctx.textAlign = 'center';
      ctx.fillText('photographic film', dx, dy - R - 8);
      if (exposed) {
        const angle = 22 + pitch * 34;
        const radial = R * 0.9;
        const vert = 0.25 + pitch * 0.5;
        ctx.fillStyle = '#C99A57';
        for (const [sx0, sy0] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
          for (let i = 1; i <= 5; i++) {
            const f = i / 5;
            const x = sx0 * f * radial * Math.cos(angle * Math.PI / 180);
            const y = sy0 * f * radial * Math.sin(angle * Math.PI / 180) * vert;
            ctx.beginPath(); ctx.arc(dx + x, dy + y, 3.2 - f * 0.5, 0, Math.PI * 2); ctx.fill();
          }
        }
        ctx.strokeStyle = 'rgba(201,154,87,0.35)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(dx - radial * Math.cos(angle * Math.PI / 180), dy - radial * Math.sin(angle * Math.PI / 180) * vert); ctx.lineTo(dx + radial * Math.cos(angle * Math.PI / 180), dy + radial * Math.sin(angle * Math.PI / 180) * vert); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(dx - radial * Math.cos(angle * Math.PI / 180), dy + radial * Math.sin(angle * Math.PI / 180) * vert); ctx.lineTo(dx + radial * Math.cos(angle * Math.PI / 180), dy - radial * Math.sin(angle * Math.PI / 180) * vert); ctx.stroke();
        ctx.fillStyle = '#F6D76F';
        ctx.fillText('the \u201CX\u201D of photo 51', dx, dy + R + 16);
      } else {
        ctx.fillStyle = 'rgba(237,228,214,0.4)';
        ctx.fillText('shoot X-rays to', dx, dy - 4);
        ctx.fillText('expose the film', dx, dy + 10);
      }
      simStatus(statusEl, exposed
        ? 'Exposed at pitch ' + pitch.toFixed(1) + '. The scattered X-rays form a crisp cross of spots on the film — the pattern Rosalind Franklin captured in photo 51, 1952. Its angle and spacing are fixed by the helix\u2019s pitch and base spacing. Crank the pitch and re-shoot: the cross opens or tightens. Watson and Crick read that geometry off the photo and the double helix fell into place.'
        : 'X-rays strike a DNA fibre and scatter off the regular array of atoms, like light off a ruled grating. The photograph that comes back is not a blur but an ordered cross of spots — every feature of it is a measurement. Expose the film and read the helix\u2019s pitch straight off the pattern.');
    }
    draw();
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
      case 'generation-drift': return generationDriftSim(shellEl, statusEl);
      case 'unit-circle': return unitCircleSim(shellEl, statusEl);
      case 'tangent-slope': return tangentSlopeSim(shellEl, statusEl);
      case 'limit-vision': return limitVisionSim(shellEl, statusEl);
      case 'rutherford-scatter': return rutherfordScatterSim(shellEl, statusEl);
      case 'cathode-ray': return cathodeRaySim(shellEl, statusEl);
      case 'blackbody': return blackbodySim(shellEl, statusEl);
      case 'radioactive-decay': return radioactiveDecaySim(shellEl, statusEl);
      case 'photoelectric': return photoelectricSim(shellEl, statusEl);
      case 'x-ray-tube': return xRayTubeSim(shellEl, statusEl);
      case 'double-slit': return doubleSlitSim(shellEl, statusEl);
      case 'fetch-execute': return fetchExecuteSim(shellEl, statusEl);
      case 'inclined-plane': return inclinedPlaneSim(shellEl, statusEl);
      case 'oersted': return oerstedSim(shellEl, statusEl);
      case 'michelson-morley': return michelsonMorleySim(shellEl, statusEl);
      case 'hubble-redshift': return hubbleRedshiftSim(shellEl, statusEl);
      case 'cloud-chamber': return cloudChamberSim(shellEl, statusEl);
      case 'peppered-moth': return pepperedMothSim(shellEl, statusEl);
      case 'galton-board': return galtonBoardSim(shellEl, statusEl);
      case 'x-ray-diffraction': return xRayDiffractionSim(shellEl, statusEl);
      default: return startSimulation(shellEl, statusEl);
    }
  }

  window.AlpacaSim = { start: startSimulation, run };
})();
