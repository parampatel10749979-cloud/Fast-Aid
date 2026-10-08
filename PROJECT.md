# Fast-Aid: Intelligent Emergency Vehicle Routing & V2X Green Corridor Platform

> **Project Status:** Production-Ready Demo & Simulation Suite  
> **Backend:** Python 3.10+ / FastAPI / NetworkX / NumPy / Pandas / Pytest  
> **Frontend:** React 19 / TypeScript / Vite / MapLibre GL JS / Tailwind CSS / Framer Motion  
> **Test Suite:** 55/55 Unit & Integration Tests Passing (100% Offline Capable)

---

## 1. Executive Summary

**Fast-Aid** is an intelligent emergency response simulation and dispatch platform designed to minimize ambulance transit times in urban environments. The system models, simulates, and proves the efficacy of three progressive routing strategies:

1. **Baseline Mode (Distance-Optimized):** Static shortest-path Dijkstra routing considering road lengths only, oblivious to traffic congestion or signal delays.
2. **Traffic-Aware Mode (Congestion-Adaptive):** Dynamic shortest-time routing that adapts to real-time traffic speeds and recalculates paths at regular intervals (15s) when bottlenecks occur.
3. **Smart Mode (Green Corridor + Signal Preemption):** Combines live traffic travel times with expected signal waiting delays, dynamic rerouting, and **V2X Traffic Signal Preemption** (turning upcoming signals green along the emergency vehicle's path).

### Core Impact Metrics
- **20% to 45%+ reduction in trip time** in Moderate to Gridlock traffic scenarios.
- **100% elimination of red-light intersection stops** along preempted corridors.
- Zero live external API dependencies at runtime; fast deterministic simulation execution.

---

## 2. System Architecture

Fast-Aid is structured as a decoupled full-stack architecture with a high-performance Python simulation backend and an interactive MapLibre GL React frontend.

```
Fast-Aid/
├── backend/                        # FastAPI Simulation Service
│   ├── main.py                     # REST API endpoints (/city, /dispatch, /benchmark)
│   ├── city.py                     # Real road graph loader & synthetic 12x12 grid generator
│   ├── traffic.py                  # TrafficEngine, scenarios (Light/Moderate/Heavy/Gridlock), incident injection
│   ├── routing.py                  # Custom Heap Dijkstra & A* routing (Distance, Traffic, Smart modes)
│   ├── preemption.py               # Green corridor V2X signal preemption logic
│   ├── hospitals.py                # Hospital selection engine (specialty matching + capacity filtering)
│   ├── simulation.py               # Multi-mode ambulance simulation & full trajectory generator
│   ├── metrics.py                  # Comparative telemetry & benchmark evaluation
│   ├── requirements.txt            # Python dependencies
│   └── data/
│       └── city_graph.graphml      # Pre-compiled static road graph with real coordinates
├── frontend/                       # Interactive React + Vite Client
│   ├── src/
│   │   ├── App.tsx                 # Main application dashboard controller
│   │   ├── api/
│   │   │   └── client.ts           # REST API client with fallback fixtures
│   │   ├── components/
│   │   │   ├── MapView.tsx         # MapLibre GL canvas, road styling, polyline overlays
│   │   │   ├── AmbulanceMarker.tsx # Smooth client-side vehicle animation & rotation
│   │   │   ├── TopCards.tsx        # KPI metrics & count-up animations
│   │   │   ├── Sidebar.tsx         # Scenario controls, algorithm selector, toggles
│   │   │   ├── LeftPanel.tsx       # Dispatch configuration & route controls
│   │   │   ├── RightPanel.tsx      # Telemetry, speed gauge, and live event log
│   │   │   ├── ComparisonPanel.tsx # 3-mode comparison metrics table & bar charts
│   │   │   └── BenchmarkPanel.tsx  # 100-trial Monte Carlo benchmark inspector
│   │   ├── hooks/
│   │   │   └── useTrajectoryAnimation.ts # High-fidelity client-side interpolation
│   │   └── types/                  # TypeScript interface contracts
│   ├── package.json
│   └── vite.config.ts
├── experiments/
│   └── run_benchmarks.py           # 400-run Monte Carlo benchmark batch generator
├── results/                        # Pre-generated benchmark CSVs & publication charts
│   ├── benchmark_results.csv
│   ├── avg_time_by_mode.png
│   ├── time_saved_boxplot.png
│   ├── time_saved_vs_congestion.png
│   └── algorithm_comparison.png
├── tests/                          # Automated Pytest Suite (55 tests)
│   ├── test_city.py
│   ├── test_demo_backend.py
│   ├── test_hospitals.py
│   ├── test_preemption.py
│   ├── test_routing.py
│   ├── test_simulation.py
│   └── test_traffic.py
├── app.py                          # Root launcher & Streamlit compatibility bridge
├── BACKEND_SPEC.md                 # Complete OpenAPI & Backend Architecture Specification
├── FASTAID_DEMO_PROMPT.md          # 1-Day Showcase Specification & Requirements
├── requirements.txt                # Unified Python requirements
└── PROJECT.md                      # This project master specification & status file
```

---

## 3. Core Logic & Mathematical Formulation

### 3.1 Road Network & Graph Representation
- **Graph Type:** Directed graph $G = (V, E)$ stored in NetworkX.
- **Nodes ($V$):** Intersections with geographic coordinates `(lat, lon)`, traffic signal status (`has_signal`), signal phase offset (`phase_offset`), and hospital attributes if applicable.
- **Edges ($E$):** Road segments with properties:
  - $L$: Length in metres (`length`).
  - $v_{\text{limit}}$: Posted speed limit in km/h ($30, 40, 60$).
  - $C$: Congestion factor $C \in [0.0, 1.0]$.
  - Name and orientation attributes.

### 3.2 Speed Degradation & Emergency Siren Travel Time
Traffic congestion degrades vehicular velocity non-linearly:
$$v_{\text{traffic}} = \max\left(3.0,\, v_{\text{limit}} \times (1.0 - 0.85 \times C)\right) \quad [\text{km/h}]$$

Converting to metres per second and applying the emergency vehicle siren privilege factor ($1.25\times$ speed boost):
$$v_{\text{ambulance}} = \frac{v_{\text{traffic}}}{3.6} \times 1.25 \quad [\text{m/s}]$$
$$T_{\text{travel}} = \frac{L}{v_{\text{ambulance}}} \quad [\text{seconds}]$$

### 3.3 Traffic Signal & Preemption Timing
- **Cycle:** 30-second fixed cycle (15s Green, 15s Red).
- **Signal Wait Calculation:**
  For simulation time $t$, given intersection phase offset $\theta$:
  $$\phi = (t + \theta) \pmod{30.0}$$
  $$T_{\text{wait}} = \begin{cases} 0.0 & \text{if } \phi < 15.0 \text{ or signal preempted} \\ 30.0 - \phi & \text{if } \phi \ge 15.0 \end{cases}$$
- **V2X Green Corridor Preemption:** At any moment during simulation, the upcoming 3 signalized intersections on the planned path are flagged with `preempted = True`, reducing $T_{\text{wait}}$ to $0.0$.

### 3.4 Routing Cost Modes & Algorithms
Custom min-heap priority queue implementations:
1. **Distance Mode:**
   $$\text{Cost}(u, v) = \text{length}_{u, v}$$
2. **Traffic Mode:**
   $$\text{Cost}(u, v) = T_{\text{travel}}(u, v)$$
3. **Smart Mode:**
   $$\text{Cost}(u, v, t) = T_{\text{travel}}(u, v) + E[T_{\text{wait}}(v)]$$

**Algorithms:**
- **Dijkstra:** Uniform-cost search exploring the state space greedily.
- **A\* Search:** Informed heuristic search using admissible straight-line Haversine travel time:
  $$h(u, \text{dst}) = \frac{\text{haversine}(u, \text{dst})}{\frac{\max(v_{\text{limit}})}{3.6} \times 1.25}$$

### 3.5 Hospital Selection Engine
Hospitals are selected using medical criteria and route efficiency:
1. Filter candidates where `capacity > 0`.
2. Filter candidates matching the emergency condition (`specialty`: cardiac, trauma, stroke).
3. If no matching specialty has capacity, fallback to any facility with open capacity.
4. Select the candidate hospital that minimizes total travel cost from the ambulance origin.

### 3.6 Dynamic Simulation & Trajectory Generation
Ambulance transit is simulated edge-by-edge with discrete step resolution:
- Dynamically checks traffic congestion drift and incident spikes.
- Periodically triggers dynamic rerouting (every 15s) in Traffic-Aware and Smart modes.
- Output includes complete trajectory steps `[{t, lat, lon, heading, speed_kmh, event}]` and full multi-route polylines for client-side animated playback.

---

## 4. Backend REST API Specification

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/city` | Returns city bounds, center coordinate, road nodes, signalized intersections, and hospital facilities. |
| `POST` | `/dispatch` | Synchronously dispatches an ambulance, executes 3-mode comparison, and returns full timestamped trajectory and polylines. |
| `GET` | `/benchmark` | Returns 100-trial aggregate benchmark statistics across Light, Moderate, Heavy, and Gridlock scenarios. |
| `GET` | `/results/{filename}` | Serves static visual chart outputs (`.png`, `.csv`). |
| `GET` | `/docs` | Auto-generated OpenAPI / Swagger UI interactive documentation. |

### Dispatch Request Payload Format
```json
{
  "start_node": "n_0_0",
  "hospital_id": "auto",
  "specialty": "cardiac",
  "scenario": "Moderate",
  "algorithm": "dijkstra",
  "preemption": true,
  "reroute_interval": 15.0
}
```

---

## 5. Frontend Dashboard Features

The React application delivers a responsive control center designed for live demonstrations:
- **MapLibre GL Map View:** Vector/raster cartography with real road topologies, traffic density coloring, signal indicators, and hospital pins.
- **Client-Side Trajectory Playback:** Smooth 60 FPS ambulance marker interpolation using requestAnimationFrame, dynamic heading rotation, and sirens.
- **Simultaneous Polyline Comparison:** Overlays Baseline (gray), Traffic-Aware (amber), and Smart Corridor (green) paths.
- **Live Event Log:** Chronological replay of dynamic rerouting decisions, signal preemption activations, and hospital arrival events.
- **KPI Stat Cards:** Animated count-up displays for ETA, Time Saved (%), Signals Preempted, and Reroute count.
- **Interactive Comparison & Benchmark Modals:** Tabular metrics, delta calculations, and pre-computed Monte Carlo distribution charts.

---

## 6. Verification & Test Suite

The test suite validates deterministic behavior, algorithmic correctness, and safety constraints:

| Test Module | Coverage Scope | Status |
|---|---|---|
| `test_city.py` | Graph generation, signal distribution, edge bidirectional symmetry, haversine metrics | Passed |
| `test_traffic.py` | Scenario presets, congestion bounds $[0.0, 1.0]$, incident spike fading | Passed |
| `test_routing.py` | Dijkstra vs. A\* equivalence, sub-graph shortest paths, heuristic admissibility | Passed |
| `test_preemption.py` | Preemption activation, wait-time reduction to 0.0s, safe de-allocation | Passed |
| `test_hospitals.py` | Capacity filtering, specialty triage matching, fallback handling | Passed |
| `test_simulation.py` | End-to-end trip execution, trajectory timestamps, dynamic reroute triggers | Passed |
| `test_demo_backend.py` | FastAPI endpoints (`/city`, `/dispatch`, `/benchmark`), response schemas | Passed |

**Overall Test Results:**
```
pytest -q
.......................................................                  [100%]
55 passed, 1 warning in 3.87s
```

---

## 7. How to Run

### Prerequisites
- Python 3.10 or higher
- Node.js 18+ and npm / bun

### 1. Launch Backend API
```bash
# Install Python dependencies
pip install -r requirements.txt

# Run FastAPI server on port 8000
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```
Interactive documentation is available at `http://localhost:8000/docs`.

### 2. Launch Frontend Application
```bash
# Navigate to frontend directory
cd frontend

# Install Node dependencies
npm install

# Start Vite dev server
npm run dev
```
Open `http://localhost:5173` in any modern web browser.

### 3. Run Benchmark Suite & Tests
```bash
# Run full automated test suite
pytest -q

# Regenerate Monte Carlo benchmark experiments (optional)
python experiments/run_benchmarks.py
```

### 4. Standalone / Streamlit Mode (Optional)
```bash
# Launch Streamlit dashboard bridge
streamlit run app.py
```

---

## 8. Definition of Done Checklist

- [x] **Real Map & Road Graph:** Static city road graph (`city_graph.graphml`) loaded without runtime external network calls.
- [x] **Algorithmic Correctness:** Custom Dijkstra and A\* yield identical optimal path costs; A\* expands fewer nodes.
- [x] **Signal Preemption:** V2X green corridor eliminates signal waiting time on preempted approaches.
- [x] **Full Trajectory Generation:** Single synchronous `/dispatch` request returns timestamped coordinates, headings, and event markers.
- [x] **Animated Ambulance UI:** Smooth client-side vehicle animation with heading rotation and playback controls.
- [x] **3-Mode Comparison:** Clear visual polyline overlays and tabular metric comparisons showing significant time savings.
- [x] **Pre-Computed Benchmarks:** 400-trial empirical dataset and generated visualizations served via `/benchmark`.
- [x] **Automated Tests:** 55/55 pytest unit and integration tests passing with zero failures.
- [x] **Complete Documentation:** Updated architecture specification and developer guides.
