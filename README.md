# Alpaca

A library that keeps the context. Every fact is a node; every node has neighbours — people, years, machines, and the way the world saw it. Search, then wander.

Alpaca is a standalone, offline-capable knowledge app (PWA) with a hand-rolled vector-proximity search engine over a shared concept space, sectioned fact pages, and a few small canvas simulations.

## Run it

Open `index.html` directly in a browser (works over `file://` via the embedded fallback bundle), or serve the folder:

```sh
npx serve .
```

## Structure

- `index.html` — home: search + curious intersections
- `facts.html` — topic page + proximity shelf
- `data/nodes.json` — the node database (concepts, people, events, etymology, perspectives)
- `data/keys.json` — reader-key / grant system for the gated archive
- `js/search.js` — vector proximity engine (cosine similarity)
- `js/app.js` — application controller, page renderer, auth
- `js/sim.js` — canvas simulations (Bohr atom, supply & demand, prisoner's dilemma)
- `js/_gen_data.js` — regenerates `js/data.js` (the embedded fallback) from `data/*.json`

## Data

The corpus is organised into communities (the atom, the stars, money & markets, computation, the ledger, counting, the software craft, …). Each node carries a `vector` in the shared concept space; proximity between nodes is cosine similarity.

## Build

After editing `data/nodes.json`, regenerate the embedded bundle:

```sh
node js/_gen_data.js
```

## License

All content and code in this repository are original works of this project unless otherwise attributed.
