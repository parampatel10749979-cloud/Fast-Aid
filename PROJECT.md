# Smart Ambulance Traffic Routing

> **Instruction to the AI agent (Antigravity):** Read this whole file, then build the project exactly as described, in the order given in "Build Steps". Do not ask questions; use the defaults here. The project must run **offline** and be finished in 1-2 days.

---

## 1. What We Are Building

A Python simulation + dashboard that shows how an ambulance can reach a hospital faster using:

1. **Traffic-aware routing** (Dijkstra and A*)
2. **Dynamic rerouting** when traffic changes
3. **Traffic signal preemption** (green corridor)
4. **Best hospital selection**

It compares three modes on the same trip:

| Mode | Route cost | Rerouting | Signal preemption |
|---|---|---|---|
| Baseline | Distance only | No | No |
| Traffic-Aware | Live travel time | Yes | No |
| **Smart** | Live travel time + signal wait | Yes | **Yes** |

**Goal:** show that Smart is faster than Baseline, especially in heavy traffic.

---

## 2. Tech Stack

Python 3.10+, `networkx`, `numpy`, `pandas`, `matplotlib`, `plotly`, `streamlit`, `pytest`.

`requirements.txt`:
```
networkx
numpy
pandas
matplotlib
plotly
streamlit
pytest
```
No internet, API keys, or OSMnx required. Use a synthetic grid city.

---

## 3. Folder Structure

```
smart-ambulance-routing/
├── app.py                  # Streamlit dashboard
├── requirements.txt
├── README.md
├── src/
│   ├── city.py             # build grid city, hospitals, signals
│   ├── traffic.py          # congestion + incidents
│   ├── routing.py          # Dijkstra, A*, cost modes
│   ├── preemption.py       # green corridor
│   ├── hospitals.py        # choose hospital
│   ├── simulation.py       # run one ambulance trip
│   ├── metrics.py          # compare modes, benchmarks
│   └── visualize.py        # map + charts
├── experiments/run_benchmarks.py
├── tests/                  # pytest files
└── results/                # CSV + PNG outputs
```

---

## 4. Core Logic

### City (`city.py`)
- Grid of 12 x 12 intersections (nodes), blocks of 200 m, roads in both directions.
- Each road has: `length`, `speed_limit` (30/40/60 km/h), `congestion` (0 to 1).
- About 40% of intersections have traffic signals (cycle 30 s: 15 green, 15 red).
- 3 to 5 hospitals with `capacity` and `specialties` (cardiac, trauma, stroke).
- Use a fixed random seed (`numpy.random.default_rng(seed)`).

### Traffic (`traffic.py`)
- Start with random congestion around 0.2.
- Scenario presets: **Light, Moderate, Heavy, Gridlock**.
- Every few seconds, congestion drifts randomly (clipped to 0 to 1).
- Random incidents spike 1 to 3 roads up to 0.95, then fade.

### Travel time
```
speed = max(3, speed_limit * (1 - 0.85 * congestion))   # km/h
travel_time = length / speed                             # seconds
ambulance_time = travel_time / 1.25                      # siren speed boost
```

### Routing (`routing.py`)
- `dijkstra_route(graph, src, dst, mode)` (write own heap version).
- `astar_route(graph, src, dst, mode)`, heuristic = straight-line distance / max speed.
- Modes: `distance`, `traffic`, `smart` (travel time + expected signal wait).
- Return path, cost, nodes expanded, runtime.

### Preemption (`preemption.py`)
- For the next 3 signalized nodes on the route, set the signal to GREEN so the ambulance never waits.
- Must be switchable on/off.

### Hospital selection (`hospitals.py`)
- Keep hospitals with free capacity and a matching specialty (fallback: any with capacity).
- Pick the one with the lowest route cost.

### Simulation (`simulation.py`)
- `run_ambulance(graph, start, hospital, mode, preemption, reroute_interval=15, seed)`.
- Move edge by edge. At a red signal without preemption, add the remaining red time.
- In Traffic-Aware and Smart modes, recompute the route every 15 s; count reroutes.
- Return total time, distance, reroutes, signal stops, signal wait, path, and a trajectory log.

### Metrics (`metrics.py`)
- Compare runs: time saved (seconds and %), stops avoided, reroutes.
- Benchmark: 100 trials per scenario (random start and hospital, same conditions for all 3 modes). Save a DataFrame.

---

## 5. Dashboard (`app.py`, Streamlit)

**Sidebar:** city size, seed, traffic scenario, emergency type, algorithm (Dijkstra/A*), toggles (preemption, rerouting, incidents), buttons: Generate City, Dispatch Ambulance, Run Benchmark.

**Top cards:** Smart ETA, Time saved %, Signals preempted, Reroutes.

**Tabs:**
1. **Live Map:** congestion-colored roads (green to red), 3 route overlays, hospitals, signals.
2. **Simulation:** animated ambulance run with an event log.
3. **Comparison:** table + bar chart for the 3 modes.
4. **Benchmark:** charts + CSV download.
5. **About:** short description and assumptions.

---

## 6. Experiments (`experiments/run_benchmarks.py`)

Run 4 scenarios x 100 trials x 3 modes. Save to `results/`:
- `benchmark_results.csv`
- `avg_time_by_mode.png`
- `time_saved_boxplot.png`
- `time_saved_vs_congestion.png`
- `algorithm_comparison.png` (Dijkstra vs A*: nodes expanded and runtime)

Expected (do not hard-code): Smart < Traffic-Aware < Baseline; savings grow with congestion; A* expands fewer nodes than Dijkstra with the same cost.

---

## 7. Tests (`pytest -q`)

- Dijkstra and A* give the same cost.
- Known tiny graph returns the correct shortest path.
- Congestion always stays between 0 and 1.
- With preemption on, signal wait is 0 at preempted nodes.
- Same seed gives the same result.
- Smart is no slower than Baseline in at least 90% of trials.

---

## 8. Build Steps (do in order)

1. Create the folders and `requirements.txt`.
2. Write `city.py`, `traffic.py`, `routing.py`, plus their tests; make them pass.
3. Write `preemption.py`, `hospitals.py`, `simulation.py`, `metrics.py`, plus tests.
4. Write `experiments/run_benchmarks.py` and generate the results in `results/`.
5. Write `visualize.py` and `app.py` (all 5 tabs).
6. Write `README.md` (setup, how to run, architecture, screenshots, real results).
7. Final check in a fresh environment: `pip install -r requirements.txt`, `pytest -q`, `streamlit run app.py`.

---

## 9. Done When

- [ ] `streamlit run app.py` works offline with no errors.
- [ ] I can generate a city, dispatch an ambulance, and see all 3 routes.
- [ ] The animation shows reroutes and preempted signals.
- [ ] The comparison tab shows % time saved.
- [ ] `results/` has the CSV and 4 PNG charts.
- [ ] All tests pass.
- [ ] Code has type hints, short comments, and seeded randomness.

---

## 10. Rules

- Keep code simple and explainable in a viva.
- Keep each module under about 250 lines.
- No global mutable state; pass the graph and RNG explicitly.
- Report only real numbers from actual runs; never invent results.

## 11. Limitations (put in README)

Synthetic city; simple traffic model (not SUMO); preemption assumes vehicle-to-infrastructure communication; no real GPS or live traffic data.
