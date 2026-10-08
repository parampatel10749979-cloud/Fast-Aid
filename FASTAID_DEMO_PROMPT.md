# Fast-Aid Demo Build — 1-Day Showcase Version

> **Instruction to the AI agent (Antigravity):** Read this whole file, then build exactly as described, in the order given in "Build Steps". Do not ask questions; use the defaults here. **Goal: a working, impressive-looking demo ready in ONE DAY.** This is a rebuild of the attached existing project — REUSE and PORT the existing `routing.py`, `preemption.py`, `hospitals.py`, `metrics.py` logic almost unchanged; don't regenerate that from scratch. Everything in this prompt is deliberately scoped down from a "real production" version to avoid anything that can fail live during a demo (no live OSM downloads, no live WebSocket streaming, no live 100-trial benchmark runs during the demo). Favor "looks fully live, actually computed once and replayed" over genuinely real-time systems.

---

## 1. What We Are Building

Same concept as the existing project — an ambulance reaching a hospital faster via traffic-aware routing, dynamic rerouting, and signal preemption, compared against baseline — but now:
- Rendered on a **real street map** (real roads, real city) instead of a synthetic grid.
- Presented as a **React dashboard** instead of Streamlit, with smooth animations.
- The ambulance appears to move live on the map (Zomato/Uber-style animated marker), but it's actually replaying a pre-computed trajectory — not a real live backend stream. This looks identical in a demo and is far less likely to break.

---

## 2. Tech Stack

**Backend** — Python, FastAPI, NetworkX, NumPy, Pandas (reuse existing `routing.py`/`preemption.py`/`hospitals.py`/`metrics.py` as-is). No OSMnx live calls at runtime — the road graph is prepared ahead of time as a static file.

**Frontend** — React (Vite), MapLibre GL JS (free, no paid token required — use a free demo style or OSM raster tiles) or Mapbox if a token is already available, Tailwind CSS, Framer Motion.

No WebSocket needed. One REST call per dispatch returns the full trajectory; the frontend animates it client-side.

---

## 3. Folder Structure

```
fast-aid-demo/
├── backend/
│   ├── main.py                 # FastAPI, REST only
│   ├── requirements.txt
│   ├── data/
│   │   └── city_graph.graphml  # PRE-DOWNLOADED today, checked into repo, loaded at startup — never fetched live
│   ├── src/
│   │   ├── city.py             # loads the static graph file, places hospitals/signals (ported from existing + adapted to load from file)
│   │   ├── traffic.py          # reused as-is
│   │   ├── routing.py          # reused as-is
│   │   ├── preemption.py       # reused as-is
│   │   ├── hospitals.py        # reused as-is
│   │   ├── simulation.py       # reused as-is, just returns the FULL trajectory array in one response (no streaming)
│   │   └── metrics.py          # reused as-is
│   └── results/
│       ├── benchmark_results.csv      # PRE-GENERATED today, static
│       ├── avg_time_by_mode.png       # PRE-GENERATED today, static
│       ├── time_saved_boxplot.png     # PRE-GENERATED today, static
│       └── time_saved_vs_congestion.png
├── frontend/
│   ├── index.html
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── MapView.tsx         # map, route polylines, hospital/signal markers
│   │   │   ├── AmbulanceMarker.tsx # animates along the pre-fetched trajectory using setInterval/requestAnimationFrame + Framer Motion lerp
│   │   │   ├── TopCards.tsx        # ETA, time saved %, signals preempted, reroutes — animated count-up
│   │   │   ├── Sidebar.tsx         # scenario, algorithm, toggles, Dispatch button
│   │   │   ├── ComparisonPanel.tsx # 3-mode table + bar chart
│   │   │   ├── BenchmarkPanel.tsx  # loads the static pre-generated CSV/images
│   │   │   └── EventLog.tsx        # replays reroute/preemption events at the right animation timestamps
│   │   └── styles/
│   └── package.json
└── README.md
```

---

## 4. Core Logic — what to do TODAY, before touching code

1. **Pick ONE real small area** (a few square km, a city center or district — not a whole metro) and run `osmnx.graph_from_place(...)` **once**, locally, right now. Save it as `backend/data/city_graph.graphml` and check it into the repo. The running app NEVER calls OSMnx live.
2. **Manually pin 3–5 hospital locations** as real lat/lon points within that area (don't rely on live Overpass hospital lookup — just hardcode coordinates you pick from the map).
3. Everything else (signals, congestion, routing, preemption, hospital selection) reuses the existing project's logic unchanged, just operating on this real graph instead of the synthetic grid.

### `simulation.py` — small change only
- Keep `run_ambulance(...)` exactly as-is.
- At the end, instead of (or in addition to) returning summary stats, return the **full trajectory log** as a JSON-serializable list: `[{t: 0, lat, lon, event: null}, {t: 1, lat, lon, event: "reroute"}, ...]`.
- The frontend receives this whole array in one response and animates through it — no streaming required.

### `city.py` — small change only
- Replace "generate synthetic grid" with "load `data/city_graph.graphml` from disk" at startup (cache in memory, load once).
- Attach the hardcoded hospital list and synthetic signal placement exactly as the existing logic already does.

---

## 5. Backend API (`main.py`) — REST ONLY, no WebSocket

- `GET /city` — returns city bounds, hospital locations, signal locations (for the frontend to draw the static map layer once on load).
- `POST /dispatch` — body: start location, hospital or "auto", mode, algorithm, toggles → runs the simulation **synchronously**, returns the full trajectory + summary stats + event log in ONE response. (This is the key simplification: no job IDs, no polling, no sockets — just a single request/response the frontend then animates client-side.)
- `GET /benchmark` — just reads and returns the pre-generated `results/benchmark_results.csv` contents as JSON for the chart, plus the static image URLs.

---

## 6. Frontend — demo-polish priorities, in order of visual impact

1. **Real map with real roads**, centered on the chosen area, loads instantly (MapLibre + free OSM-based style, no paid token dependency so it can't fail if a key is missing).
2. **Dispatch button → animated marker** that smoothly moves along the trajectory returned by `/dispatch`, rotating to face travel direction, with a pulsing dot — this is the single most important visual for "wow factor," spend the most time here.
3. **3 route polylines** (Baseline/Traffic-Aware/Smart) shown together, color-coded, with the Smart route highlighted/animated.
4. **Top cards** (ETA, time saved %, signals preempted, reroutes) animate in with Framer Motion count-up — cheap to build, high visual payoff.
5. **Event log** that reveals entries timed to match the marker's animation ("Rerouted at 0:14," "Signal preempted at 0:22") — reuse the trajectory's event timestamps, don't compute anything new.
6. **Comparison panel + Benchmark panel** — functional but lower priority; a clean table + one bar chart is enough, don't over-engineer.

Skip for now (not needed for a 1-day demo): dark/light theme toggle, mobile responsiveness polish, real GPS integration, multi-city support, auth, deployment hardening.

---

## 7. Tests

Given the 1-day constraint: port over only the fast, high-value existing tests (same-seed reproducibility, Dijkstra/A* cost match, preemption zeroes signal wait). Skip rewriting the full original test suite today — correctness of the ported algorithms was already proven in the existing project; focus remaining time on the frontend/demo polish instead.

---

## 8. Build Steps (do in order, time-boxed for one day)

1. **(Do first, by hand, before any agent coding)** Download and save the static road graph + pin hospital coordinates, per Section 4. This must exist before anything else can work.
2. Backend: adapt `city.py` to load the static graph; confirm existing `routing.py`/`preemption.py`/`hospitals.py` run against it unchanged (quick manual script check, not a full test rewrite).
3. Backend: adapt `simulation.py` to return the full trajectory array; write `main.py` with the three REST endpoints above. Test `/dispatch` with curl/Postman until it returns a sane trajectory.
4. **(Pre-generate now, not live)** Run the benchmark script once today, save CSV + PNGs into `backend/results/`.
5. Frontend: scaffold Vite + React + Tailwind + MapLibre; get the static map + hospital/signal markers rendering from `/city`.
6. Frontend: build `AmbulanceMarker.tsx` animation against a hardcoded sample trajectory first (don't wait on the backend being perfect) — this is the highest-risk, highest-payoff piece, start it early.
7. Frontend: wire the real `/dispatch` call in, connect `TopCards`, `EventLog`, `ComparisonPanel`.
8. Frontend: wire `BenchmarkPanel` to the static `/benchmark` data.
9. Polish pass: animations, transitions, color scheme — only after the above all works end-to-end once.
10. Dry-run the full demo flow 2–3 times before tomorrow: load app → dispatch → watch animation → check all panels. Fix whatever breaks first; don't start new features this late.

---

## 9. Done When

- [ ] App loads instantly with a real map, real roads, hospital/signal markers, no live external calls that can fail.
- [ ] Clicking Dispatch animates the ambulance smoothly along a real road route in real time-ish pacing.
- [ ] All 3 routes visible, Smart route highlighted.
- [ ] Top cards and event log animate and match the trajectory.
- [ ] Benchmark panel shows the pre-generated real results.
- [ ] Full demo flow has been dry-run at least twice with no errors.

## 10. Rules

- Nothing in the live demo path may depend on a live external API call (OSM, Overpass, Mapbox tiles with a possibly-missing token) — pre-fetch everything today.
- Reuse existing algorithm code unchanged wherever possible; today's work is data source + presentation, not algorithm rewrites.
- If something is taking too long, cut it from Section 6's "skip for now" list rather than slipping the deadline — the marker animation and real map are what sell the demo; everything else is secondary.
