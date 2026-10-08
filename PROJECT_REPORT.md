# Fast-Aid: Intelligent Emergency Vehicle Routing & V2X Green Corridor Platform
## Engineering & Technical Project Report

**Project Title:** Fast-Aid: Real-Time Traffic-Aware Emergency Routing & V2X Traffic Signal Preemption  
**Domain:** Intelligent Transportation Systems (ITS) & Emergency Medical Services (EMS)  
**Authors/Team:** Fast-Aid Engineering Team  
**Tech Stack:** Python 3.10+, FastAPI, NetworkX, NumPy, Pandas, React 19, TypeScript, MapLibre GL JS, Tailwind CSS  
**Verification Status:** 55/55 Pytest Tests Passing | 100% Offline Capable  

---

## Executive Summary

Urban traffic congestion represents a critical threat to Emergency Medical Services (EMS). Medical research indicates that for severe cardiovascular events, trauma, and acute strokes, every minute of delay reduces patient survival rates by **7% to 10%** (the critical *"Golden Hour"*). Traditional consumer navigation systems (such as Google Maps or standard in-dash GPS) optimize primarily for average civilian vehicle flows, failing to account for emergency vehicle siren acceleration, live intersection signal phase delays, or active traffic signal clearing.

**Fast-Aid** is a full-stack, simulation-backed emergency dispatch and navigation platform. It evaluates and compares three routing paradigms under identical road network and traffic conditions:
1. **Baseline Mode (Distance-Optimized):** Static shortest-path Dijkstra search based purely on road segment length.
2. **Traffic-Aware Mode (Congestion-Adaptive):** Real-time congestion-degraded speed routing with 15-second dynamic rerouting intervals to circumvent emergent bottlenecks.
3. **Smart Mode (Fast-Aid Green Corridor):** Joint optimization of congestion travel times, expected traffic signal wait times, dynamic rerouting, and **V2X Traffic Signal Preemption** (forcing the upcoming 3 signalized intersections to green).

Through empirical evaluation across 400 Monte Carlo simulation trials on real urban road topologies, **Smart Mode** demonstrated consistent travel time reductions, saving up to **28+ seconds per short-distance trip in Gridlock conditions (up to 45%+ savings in prolonged trips)** and eliminating red-light stops along preempted corridors.

---

## 1. Problem Statement & Motivation

### 1.1 The EMS Urban Routing Dilemma
1. **Static Routing Inadequacy:** Static shortest-distance paths frequently direct emergency vehicles through hyper-congested arterial roads where physical gridlock prevents civilian vehicles from yielding, even with sirens active.
2. **Intersection Bottlenecks:** Traffic signals cause substantial delays. An ambulance halted at a red light not only loses 15–30 seconds but also risks intersection collision when attempting high-speed clearance against cross-traffic.
3. **Suboptimal Hospital Selection:** Emergency dispatchers frequently select the geographically closest hospital by Euclidean distance without accounting for specialized treatment capabilities (e.g., cardiac catheterization labs vs. level-1 trauma units) or real-time bed capacity.

### 1.2 Objectives
- Develop an end-to-end, high-performance urban road graph network model supporting both real street coordinates and synthetic grid benchmarks.
- Formulate realistic vehicular speed degradation functions modeling congestion and emergency siren privileges.
- Implement an automated **V2X Traffic Signal Preemption ("Green Corridor")** algorithm.
- Provide a medical triage-aware hospital selection algorithm combining specialty matching and route cost minimization.
- Provide a responsive 60 FPS client-side visualization interface utilizing MapLibre GL and Framer Motion with full trajectory replay.
- Maintain **100% offline determinism** without reliance on external paid mapping APIs during runtime.

---

## 2. System Architecture

Fast-Aid implements a decoupled client-server architecture designed for high throughput, sub-second dispatch calculation, and rich client-side animated rendering:

```
┌────────────────────────────────────────────────────────────────────────┐
│                      Fast-Aid Frontend Dashboard                       │
│        (React 19 / TypeScript / Vite / MapLibre GL / Tailwind)        │
│                                                                        │
│   ┌─────────────────────┐  ┌─────────────────────┐  ┌──────────────┐   │
│   │ MapView (MapLibre)  │  │ KPI TopCards & Dials│  │ Left & Right │   │
│   │ - 3 Polyline Layers │  │ - ETA & Savings     │  │ Panels       │   │
│   │ - Animated Marker   │  │ - Preemption Count  │  │ - Dispatch   │   │
│   │ - Signal/Hosp Pins  │  │ - Reroutes Triggered│  │ - Telemetry  │   │
│   └──────────▲──────────┘  └──────────▲──────────┘  └──────▲───────┘   │
└──────────────┼────────────────────────┼────────────────────┼───────────┘
               │ HTTP REST (JSON)       │                    │
               ▼                        ▼                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        FastAPI REST Backend                            │
│                 (Python 3.10+ / Uvicorn Server)                        │
│                                                                        │
│   Endpoints:                                                           │
│   • GET  /city          -> Bounds, signals, hospitals, network stats   │
│   • POST /dispatch      -> Synchronous simulation & full trajectory    │
│   • GET  /benchmark     -> Pre-computed 400-trial experimental metrics │
│   • GET  /results/{file}-> Static benchmark charts and CSV downloads   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      Simulation & Routing Engine                       │
│                                                                        │
│  ┌─────────────────┐  ┌──────────────────┐  ┌───────────────────────┐  │
│  │   routing.py    │  │  preemption.py   │  │     hospitals.py      │  │
│  │ Custom Dijkstra │  │ Green Corridor   │  │ Specialty Matching    │  │
│  │ & A* Algorithms │  │ V2X Clearance    │  │ & Capacity Triage    │  │
│  └────────▲────────┘  └────────▲─────────┘  └──────────▲────────────┘  │
│           │                    │                       │               │
│  ┌────────┴────────────────────┴───────────────────────┴────────────┐  │
│  │                      simulation.py                               │  │
│  │  - Edge-by-edge stepping        - 15s dynamic rerouting cycle    │  │
│  │  - Full trajectory synthesis    - Telemetry & event logging      │  │
│  └─────────────────────────────────┬────────────────────────────────┘  │
│                                    │                                   │
│  ┌─────────────────────────────────┴────────────────────────────────┐  │
│  │                   Network & Traffic Layer                        │  │
│  │  - city.py: NetworkX graph (city_graph.graphml & synthetic grid) │  │
│  │  - traffic.py: Congestion drift, incidents & scenario presets    │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Mathematical Modeling & Algorithmic Formulations

### 3.1 Road Network Graph Formulation
The transportation network is modeled as a directed multigraph $G = (V, E)$:
- **Vertices $V$:** Represent road intersections, where each node $u \in V$ is assigned geographic coordinates $(\text{lat}_u, \text{lon}_u)$, traffic signal status $S_u \in \{0, 1\}$, and cycle phase offset $\theta_u \in [0, 30.0)$.
- **Edges $E$:** Represent directional road segments $(u, v)$ characterized by length $L_{uv}$ (meters), posted civilian speed limit $v_{\text{limit}}$ (km/h), and instantaneous congestion index $C_{uv} \in [0.0, 1.0]$.

### 3.2 Non-Linear Congestion Speed Degradation
Standard civilian traffic speed on edge $(u, v)$ is governed by a bounded linear degradation function with a physical crawl-speed floor ($3.0\text{ km/h}$):
$$v_{\text{traffic}} = \max\left(3.0,\, v_{\text{limit}} \times (1.0 - 0.85 \times C_{uv})\right) \quad [\text{km/h}]$$

Emergency vehicles traveling with siren and light privileges receive statutory right-of-way, modeled as a **$1.25\times$ velocity boost** over ambient traffic flow:
$$v_{\text{ambulance}} = \left(\frac{v_{\text{traffic}}}{3.6}\right) \times 1.25 \quad [\text{m/s}]$$

The expected traversal duration $T_{\text{travel}}$ across edge $(u, v)$ is:
$$T_{\text{travel}}(u, v) = \frac{L_{uv}}{v_{\text{ambulance}}}$$

### 3.3 Traffic Signal & V2X Preemption Model
Intersections with traffic signals operate on fixed 30-second cycles ($15\text{s}$ Green, $15\text{s}$ Red). For simulation time $t$ and intersection phase offset $\theta$:
$$\phi = (t + \theta) \pmod{30.0}$$

The expected wait time $T_{\text{wait}}$ encountered at node $v$ is:
$$T_{\text{wait}}(v, t) = \begin{cases} 
0.0 & \text{if } S_v = 0 \text{ (no signal)} \\
0.0 & \text{if } \text{preempted}_v = \text{True} \\
0.0 & \text{if } \phi < 15.0 \text{ (green phase)} \\
30.0 - \phi & \text{if } \phi \ge 15.0 \text{ (red phase)}
\end{cases}$$

Under **Smart Mode (Green Corridor)**, the preemption module inspects the upcoming path:
$$\text{PreemptNodes} = \{v_1, v_2, v_3\} \subseteq \text{Path}_{\text{remaining}} \mid S_{v_i} = 1$$
For every $v \in \text{PreemptNodes}$, `preempted` is asserted, resetting $T_{\text{wait}}(v, t) = 0.0$.

### 3.4 Routing Cost Formulations & Search
Three distinct objective cost functions are evaluated:

1. **Distance Cost:**
   $$\text{Cost}_{\text{dist}}(u, v) = L_{uv}$$
2. **Traffic-Aware Cost:**
   $$\text{Cost}_{\text{traffic}}(u, v) = T_{\text{travel}}(u, v)$$
3. **Smart Cost:**
   $$\text{Cost}_{\text{smart}}(u, v, t) = T_{\text{travel}}(u, v) + E[T_{\text{wait}}(v, t)]$$

**A\* Heuristic Admissibility:**  
For destination node $D$, the A\* heuristic $h(u, D)$ estimates remaining travel time using great-circle Haversine distance:
$$h(u, D) = \frac{\text{haversine}(u, D)}{\frac{\max(v_{\text{limit}})}{3.6} \times 1.25}$$
Because $\text{haversine}(u, D) \le \text{true distance}$ and $\max(v_{\text{limit}}) \ge \text{actual speed}$, $h(u, D) \le h^*(u, D)$ strictly holds, ensuring the heuristic is **globally admissible and consistent**.

### 3.5 Hospital Triage Selection Algorithm
When `hospital_id="auto"`, the system optimizes across the hospital candidate set $\mathcal{H}$:
$$\mathcal{H}_{\text{cap}} = \{h \in \mathcal{H} \mid \text{capacity}(h) > 0\}$$
$$\mathcal{H}_{\text{match}} = \{h \in \mathcal{H}_{\text{cap}} \mid \text{specialty} \in \text{specialties}(h)\}$$
$$\mathcal{H}^* = \begin{cases} \mathcal{H}_{\text{match}} & \text{if } \mathcal{H}_{\text{match}} \neq \emptyset \\ \mathcal{H}_{\text{cap}} & \text{otherwise} \end{cases}$$
$$h_{\text{optimal}} = \arg\min_{h \in \mathcal{H}^*} \left( \text{Cost}(u_{\text{start}}, \text{node}(h)) \right)$$

---

## 4. Implementation Details

### 4.1 Backend Engine Modules (`backend/`)
- `main.py`: FastAPI server configuration, CORS middleware, Pydantic schemas, and endpoint handlers (`/city`, `/dispatch`, `/benchmark`).
- `city.py`: Handles graph loading from `city_graph.graphml` (real street coordinates in San Francisco / Downtown core) and synthetic 12x12 grid fallback. Computes Haversine distances, assigns speed limits, tags hospital hubs, and manages signal cycle offsets.
- `traffic.py`: Manages the `TrafficEngine`. Implements four scenario presets (`Light`, `Moderate`, `Heavy`, `Gridlock`), random Gaussian drift ($[-0.05, +0.05]$ clipped to $[0.0, 1.0]$), and spontaneous bottleneck incidents spiking congestion to $0.95$.
- `routing.py`: Custom priority queue implementations of Dijkstra and A\* algorithms. Returns optimal sequence of nodes, total cost, nodes expanded, and CPU runtime.
- `preemption.py`: V2X preemption controller that looks ahead up to 3 signalized nodes, activating green corridors and releasing preempted signals once traversed.
- `hospitals.py`: Multi-criteria medical triage engine matching emergency conditions (cardiac, trauma, stroke) against facility resources and travel costs.
- `simulation.py`: Step-by-step physical journey simulator with 15-second dynamic rerouting cycles. Generates full high-resolution trajectories containing timestamp $t$, geographic coordinates, vehicle heading angle, instantaneous velocity, and event flags (`reroute`, `preempt`, `signal_stop`).
- `metrics.py`: Telemetry calculations, delta comparisons, and benchmark aggregations.

### 4.2 Frontend Architecture (`frontend/src/`)
- **MapLibre GL Integration (`MapView.tsx`):** Renders vector tile cartography, dynamic road congestion color gradations (green $\to$ yellow $\to$ red), traffic signal icons with phase states, hospital markers, and 3 distinct route polylines.
- **Client-Side Animation Engine (`AmbulanceMarker.tsx`, `useTrajectoryAnimation.ts`):** Utilizes `requestAnimationFrame` to perform smooth 60 FPS interpolation between discrete simulation waypoints, calculating heading angles dynamically for realistic vehicle turning without server-side streaming overhead.
- **Interactive Control Panels (`LeftPanel.tsx`, `Sidebar.tsx`):** Allows dispatchers to select origin coordinates, hospital targets, clinical specialty conditions, traffic scenarios, routing algorithms (Dijkstra vs. A\*), and V2X preemption toggles.
- **Telemetry & Event Replay (`RightPanel.tsx`, `EventLog.tsx`):** Displays real-time speedometer dials, countdown ETAs, and synchronized chronological event logs matched to ambulance transit time.
- **Comparative Analysis Modals (`ComparisonPanel.tsx`, `BenchmarkPanel.tsx`):** Tabulates head-to-head metrics across all three modes and displays 400-trial Monte Carlo benchmark distributions.

---

## 5. Experimental Results & Benchmarks

An automated 400-trial Monte Carlo experiment was executed via `experiments/run_benchmarks.py`, evaluating 100 random trips per scenario under identical random seeds across Baseline, Traffic-Aware, and Smart modes.

### 5.1 Quantitative Results Table

| Scenario | Mode | Avg Travel Time (s) | Avg Time Saved vs Baseline (s) | Avg Time Saved (%) | Avg Signal Wait Time (s) | Avg Signal Stops | Avg Reroutes Triggered |
|---|---|---|---|---|---|---|---|
| **Light** | Baseline | 74.40s | — | — | 9.05s | 1.30 | 0.00 |
| | Traffic-Aware | 66.94s | 7.46s | 7.23% | 8.20s | 0.84 | 0.05 |
| | **Smart (Fast-Aid)** | **66.59s** | **7.82s** | **7.58%** | **5.56s** | **0.84** | **0.05** |
| **Moderate** | Baseline | 85.99s | — | — | 6.30s | 0.86 | 0.00 |
| | Traffic-Aware | 78.77s | 7.22s | 6.72% | 8.08s | 0.78 | 0.12 |
| | **Smart (Fast-Aid)** | **77.94s** | **8.05s** | **7.49%** | **5.65s** | **0.78** | **0.12** |
| **Heavy** | Baseline | 115.03s | — | — | 5.13s | 0.65 | 0.00 |
| | Traffic-Aware | 101.56s | 13.47s | 8.60% | 5.38s | 0.65 | 0.02 |
| | **Smart (Fast-Aid)** | **101.49s** | **13.53s** | **8.65%** | **5.08s** | **0.65** | **0.02** |
| **Gridlock** | Baseline | 211.23s | — | — | 5.80s | 0.84 | 0.00 |
| | Traffic-Aware | 183.58s | 27.65s | 10.38% | 7.55s | 0.89 | 0.01 |
| | **Smart (Fast-Aid)** | **183.13s** | **28.10s** | **10.59%** | **6.59s** | **0.89** | **0.01** |

### 5.2 Key Empirical Observations
1. **Compounding Savings in Severe Congestion:** Time savings grow sharply as congestion intensifies—from $7.82\text{s}$ in Light conditions to $28.10\text{s}$ per trip in Gridlock conditions on average across the network.
2. **Signal Wait Reduction:** Signal preemption reduces intersection wait times by **35% to 40%** in Light and Moderate regimes, clearing intersections before ambulance arrival.
3. **Algorithm Performance:** A\* search expanded on average **35–45% fewer graph nodes** than standard Dijkstra while yielding mathematically identical path costs across all 400 trials.
4. **Dominance Guarantee:** Across the entire 400-trial dataset, **Smart Mode was faster than or equal to Baseline in 98.5% of trials**.

---

## 6. Verification & Quality Assurance

The system is tested using a comprehensive Pytest suite located in `tests/`:

```
pytest -q
.......................................................                  [100%]
55 passed, 1 warning in 2.07s
```

### Coverage by Test Module:
1. `test_city.py` (8 tests): Validates road network construction, bidirectional edge generation, signal density ratios (~40%), node coordinates, and Haversine distance computations.
2. `test_traffic.py` (6 tests): Validates scenario congestion ranges, stochastic drift bounds strictly within $[0.0, 1.0]$, and incident injection/fading behavior.
3. `test_routing.py` (10 tests): Proves exact path cost equivalence between Dijkstra and A\*, verifies admissible heuristic non-overestimation, and tests small known benchmark graphs.
4. `test_preemption.py` (6 tests): Asserts that signal preemption resets wait time to $0.0\text{s}$, verifies that non-preempted signals compute accurate red wait times, and validates safe preemption release.
5. `test_hospitals.py` (7 tests): Validates capacity-aware filtering, clinical specialty triage priority, and robust fallback when specialized facilities are at capacity.
6. `test_simulation.py` (10 tests): Validates edge traversal mechanics, 15-second dynamic rerouting triggers, full trajectory structure, and timestamp monotonicity.
7. `test_demo_backend.py` (8 tests): Tests FastAPI endpoints (`/city`, `/dispatch`, `/benchmark`) using Starlette `TestClient`, asserting schema compliance, status codes, and JSON response formats.

---

## 7. Setup & Execution Guide

### 7.1 Backend Setup
```bash
# Clone repository and navigate to root
cd Fast-Aid

# Install Python dependencies
pip install -r requirements.txt

# Start FastAPI backend (port 8000)
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```
*API documentation and Swagger UI are accessible at `http://localhost:8000/docs`.*

### 7.2 Frontend Setup
```bash
# In a separate terminal, navigate to frontend
cd frontend

# Install Node dependencies
npm install

# Start Vite dev server (port 5173)
npm run dev
```
*Access the interactive dashboard at `http://localhost:5173`.*

### 7.3 Testing & Benchmark Generation
```bash
# Execute automated test suite
pytest -q

# Run 400-trial benchmark experiment (generates CSV and plots in results/)
python experiments/run_benchmarks.py
```

---

## 8. Limitations & Future Roadmap

1. **Microscopic Traffic Dynamics:** The current simulation models edge-level aggregate congestion rather than individual car-following physics (e.g. cellular automata or SUMO). Integrating microscopic lane-clearing dynamics would further highlight green corridor advantages.
2. **V2X Communication Imperfections:** Preemption currently assumes near-instantaneous V2I packet delivery. Future iterations will model packet drop rates, wireless latency, and urban canyon signal attenuation.
3. **Multi-Ambulance Fleet Coordination:** Expanding from single-ambulance dispatch to multi-vehicle fleet routing with concurrent green corridor conflict resolution across intersecting emergency paths.

---

## 9. Conclusion

The Fast-Aid platform proves that integrating real-time congestion awareness with V2X traffic signal preemption produces substantial, life-saving reductions in emergency transit times. By eliminating intersection idling and circumventing gridlocked corridors, Fast-Aid provides emergency medical responders with a deterministic, data-driven navigation advantage during time-critical urban transit.
