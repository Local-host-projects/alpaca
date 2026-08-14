/* ============================================================
   ALPACA — vector proximity engine
   Every node carries a vector in a shared concept space.
   Proximity = cosine similarity. Search projects the query
   into the same space and ranks by blended relevance.
   ============================================================ */

(function (global) {
  'use strict';

  const STORE = { axes: [], nodes: [], pages: {}, keys: null };

  /* ---------- data loading (JSON folder with embedded fallback) ---------- */

  async function loadBundle() {
    if (global.ALPACA_DB && global.ALPACA_KEYS) {
      // Embedded fallback first: guarantees the app runs even over file://
      STORE.axes = global.ALPACA_DB.vectorspace.axes;
      STORE.nodes = global.ALPACA_DB.nodes;
      STORE.pages = global.ALPACA_DB.pages || {};
      STORE.keys = global.ALPACA_KEYS;
    }
    // Prefer the real JSON files when served over http(s) (PWA / dev server)
    try {
      if (location.protocol === 'http:' || location.protocol === 'https:') {
        const n = await (await fetch('data/nodes.json', { cache: 'no-cache' })).json();
        const k = await (await fetch('data/keys.json', { cache: 'no-cache' })).json();
        STORE.axes = n.vectorspace.axes;
        STORE.nodes = n.nodes;
        STORE.pages = n.pages || {};
        STORE.keys = k;
      }
    } catch (e) { /* fallback already in place */ }
    return STORE;
  }

  /* ---------- vector math ---------- */

  function norm(v) {
    let s = 0;
    for (const k in v) s += v[k] * v[k];
    return Math.sqrt(s);
  }

  function dot(a, b) {
    let s = 0;
    for (const k in a) if (b[k]) s += a[k] * b[k];
    return s;
  }

  function cosine(a, b) {
    const na = norm(a), nb = norm(b);
    if (!na || !nb) return 0;
    return dot(a, b) / (na * nb);
  }

  /* Proximity between two nodes, 0..1 */
  function proximityBetween(idA, idB) {
    const a = nodeById(idA), b = nodeById(idB);
    if (!a || !b) return 0;
    return proximityToVector(a.vector || {}, b.vector || {}, a.dates, b.dates);
  }

  /* Proximity of any entity vector against any other, 0..1.
     Vectors live in the shared concept space, so this works for nodes,
     page sections (video / simulation), and custom media alike. */
  function proximityToVector(va, vb, dateA, dateB) {
    let base = cosine(va || {}, vb || {});
    if (dateA && dateB && dateA.length && dateB.length) {
      const da = Math.min(...dateA), db = Math.min(...dateB);
      const d = Math.abs(da - db);
      if (d <= 12) base += 0.15 * (1 - d / 12);
    }
    return Math.max(0, Math.min(1, base));
  }

  /* ---------- query projection ---------- */

  function projectQuery(query) {
    const tokens = String(query || '').toLowerCase().replace(/[^a-z0-9\s\-']/g, ' ').split(/\s+/).filter(Boolean);
    const qvec = {};
    // axis hits land hard
    for (const ax of STORE.axes) {
      if (tokens.some(t => ax.includes(t) || t.includes(ax))) qvec[ax] = 1;
    }
    return { tokens, qvec };
  }

  /* ---------- search ---------- */

  function search(query) {
    const { tokens, qvec } = projectQuery(query);
    const qn = norm(qvec);

    const scored = STORE.nodes.map(node => {
      let text = 0;
      const hay = (node.label + ' ' + (node.tag || '') + ' ' + (node.summary || '') + ' ' + (node.gift || '')).toLowerCase();
      for (const t of tokens) if (hay.includes(t)) text += 1;
      const vec = qn ? (dot(qvec, node.vector || {}) / qn) : 0;
      const score = 0.5 * Math.min(text, 2) / 2 + 0.5 * vec;
      return { node, score, vec };
    });

    scored.sort((a, b) => b.score - a.score || b.vec - a.vec);
    return scored
      .filter(s => s.score > 0)
      .slice(0, 12)
      .map(s => ({ node: s.node, score: s.score, proximity: Math.round(Math.min(1, s.score) * 100) }));
  }

  /* Ranked set of the nearest neighbors to a node, excluding itself,
     keeping a mix of types so the shelf reads like a context table. */
  function nearest(nodeId, { excludeType, count } = {}) {
    const me = nodeById(nodeId);
    if (!me) return [];
    const seen = new Set();
    const buckets = new Map(); // type -> array

    for (const n of STORE.nodes) {
      if (n.id === nodeId) continue;
      if (excludeType && n.type === excludeType) continue;
      const p = proximityBetween(nodeId, n.id);
      if (p <= 0.02) continue;
      if (!buckets.has(n.type)) buckets.set(n.type, []);
      buckets.get(n.type).push({ node: n, p });
    }

    // take the best per type, then fill by absolute proximity
    const out = [];
    for (const [, list] of buckets) {
      list.sort((a, b) => b.p - a.p);
      const best = list.shift();
      out.push(best);
      seen.add(best.node.id);
    }
    const rest = [];
    for (const [, list] of buckets) for (const item of list) if (!seen.has(item.node.id)) rest.push(item);
    rest.sort((a, b) => b.p - a.p);

    const total = out.concat(rest).slice(0, count || 9);
    total.sort((a, b) => b.p - a.p);
    return total.map(({ node, p }) => ({ node, proximity: Math.round(p * 100) }));
  }

  function nodeById(id) {
    return STORE.nodes.find(n => n.id === id) || null;
  }

  /* ============================================================
     GRAPH LAYER — typed edges, degree centrality, communities.
     The vector space already gives weighted *similarity*; these
     edges give *named* relations (built on, critiqued, pioneered…)
     so the archive reads like a graph, not just a cloud.
     ============================================================ */

  const EDGE_KINDS = {
    built: 'built on', pioneered: 'pioneered', formalised: 'formalised',
    discovered: 'discovered', critiqued: 'critiqued', revived: 'revived',
    taught: 'taught', opposed: 'challenged', collaborator: 'collaborated with',
    modelled: 'modelled', inspired: 'inspired', predicted: 'predicted',
    applied: 'applied', studied: 'studied', documented: 'documented',
    theorised: 'theorised', connected: 'connected to',
    authored: 'authored', wrote: 'wrote', designed: 'designed',
    invented: 'invented', named: 'named', observed: 'observed',
    disclosed: 'disclosed', uncovered: 'uncovered', mismanaged: 'mismanaged',
    ignored: 'ignored', led: 'led', founded: 'founded', attacked: 'attacked',
    communicated: 'communicated', admitted: 'admitted', achieved: 'achieved',
    translated: 'translated', published: 'published', created: 'created',
    taughtPriests: 'taught at the House of Wisdom', established: 'established',
  };

  function edgeKindLabel(kind) {
    return EDGE_KINDS[kind] || kind || 'connected to';
  }

  /* Outgoing + incoming typed edges for a node. */
  function relatedOf(id) {
    const n = nodeById(id);
    return (n && Array.isArray(n.related)) ? n.related : [];
  }

  /* Degree centrality: number of named edges touching the node. */
  function degree(id) {
    let d = relatedOf(id).length;
    for (const other of STORE.nodes) {
      if (other.id === id) continue;
      if (other.related && other.related.some(r => r.to === id)) d++;
    }
    return d;
  }

  /* A hub is a node the graph leans on — many named connections. */
  function isHub(id) {
    return degree(id) >= 6;
  }

  /* Neighbours along named edges (direction agnostic), most connected first. */
  function neighbors(id) {
    const out = [];
    const seen = new Set();
    for (const r of relatedOf(id)) {
      const n = nodeById(r.to);
      if (!n || seen.has(n.id)) continue;
      seen.add(n.id);
      out.push(r.rewrite ? r.rewrite : {
        node: n,
        kind: r.kind || 'connected',
        strength: r.strength != null ? r.strength : proximityBetween(id, n.id),
      });
    }
    for (const other of STORE.nodes) {
      if (other.id === id) continue;
      if (other.related && other.related.some(r => r.to === id)) {
        if (seen.has(other.id)) continue;
        seen.add(other.id);
        out.push({ node: other, kind: 'connected', strength: proximityBetween(id, other.id) });
      }
    }
    out.sort((a, b) => b.strength - a.strength);
    return out;
  }

  /* Community + centrality summary for a node. */
  function graphPosition(id) {
    const n = nodeById(id);
    return {
      community: (n && n.community) || null,
      degree: degree(id),
      hub: isHub(id),
    };
  }

  /* Shortest trail from a to b over the near-neighbour graph (BFS),
     so a reader can walk the archive instead of teleporting. */
  function pathBetween(a, b, { maxNodes = 10 } = {}) {
    if (!nodeById(a) || !nodeById(b) || a === b) return [];
    const adj = new Map();
    for (const n of STORE.nodes) adj.set(n.id, []);
    for (const n of STORE.nodes) {
      const near = [];
      const by = STORE.nodes
        .filter(m => m.id !== n.id && proximityBetween(n.id, m.id) >= 0.24)
        .sort((x, y) => proximityBetween(n.id, y.id) - proximityBetween(n.id, x.id))
        .slice(0, maxNodes);
      near.push(...by);
      adj.set(n.id, near.map(m => m.id));
    }
    const prev = new Map();
    const seen = new Set([a]);
    const queue = [a];
    while (queue.length) {
      const cur = queue.shift();
      if (cur === b) break;
      for (const nxt of adj.get(cur) || []) {
        if (seen.has(nxt)) continue;
        seen.add(nxt);
        prev.set(nxt, cur);
        queue.push(nxt);
      }
    }
    if (b !== a && !prev.has(b)) return [];
    const path = [];
    let cur = b;
    while (cur !== undefined) { path.unshift(cur); cur = prev.get(cur); }
    return path.length > 1 ? path : [];
  }

  function typeLabel(type) {
    const map = { person: 'Person', topic: 'Topic', concept: 'Concept', date: 'Period', event: 'Event', news: 'News', perspective: 'Perspective', object: 'Object', etymology: 'Etymology' };
    return map[type] || type;
  }

  function proximityLabel(score) {
    if (score == null) return '';
    if (score >= 0.8) return 'Twin';
    if (score >= 0.6) return 'Close';
    if (score >= 0.4) return 'Neighbour';
    if (score >= 0.2) return 'Far';
    return 'Distant';
  }

  global.Alpaca = {
    load: loadBundle,
    store: () => STORE,
    search,
    nearest,
    nodeById,
    proximityBetween,
    proximityToVector,
    proximityLabel,
    typeLabel,
    edgeKindLabel,
    relatedOf,
    degree,
    isHub,
    neighbors,
    graphPosition,
    pathBetween,
  };
})(window);
