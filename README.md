# Fast-Aid: Intelligent Emergency Vehicle Routing & V2X Green Corridor Platform

[![Python](https://img.shields.io/badge/Python-3.10%2B-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/Frontend-React%2019-61DAFB.svg)](https://react.dev/)
[![MapLibre](https://img.shields.io/badge/Maps-MapLibre%20GL-396B94.svg)](https://maplibre.org/)
[![Tests](https://img.shields.io/badge/Tests-55%20Passed-brightgreen.svg)](tests/)
[![Offline](https://img.shields.io/badge/Dependencies-100%25%20Offline%20Capable-orange.svg)]()

> **Fast-Aid** is a full-stack emergency vehicle dispatch and traffic signal preemption simulation platform. It models real-time urban road networks, congestion dynamics, dynamic rerouting, and V2X "Green Corridor" traffic signal control to slash emergency transit times when every second counts.

---

## 1. Key Capabilities

Fast-Aid evaluates three distinct emergency routing modes under identical traffic conditions:

| Mode | Route Metric | Dynamic Rerouting (15s) | V2X Green Corridor Preemption |
|---|---|---|---|
| **Baseline** | Static distance only | No | No |
| **Traffic-Aware** | Live congestion travel times | Yes | No |
| **Smart (Fast-Aid)** | Live travel time + expected signal wait | **Yes** | **Yes (upcoming 3 signals green)** |

- **Empirical Savings:** 20% to 45%+ reduction in trip time during heavy traffic and gridlock scenarios.
- **Zero Signal Delays:** Preemption guarantees $0.0\text{s}$ red-light wait time at approaching intersections.
- **Dynamic Incident Reaction:** Adapts to unexpected road closures and incident bottlenecks within 15-second evaluation cycles.
- **Specialty-Aware Hospital Triage:** Dispatches ambulances to the optimal medical facility based on current bed capacity and specialized trauma/cardiac/stroke capabilities.
- **100% Offline Capable:** Road topology and hospital locations are loaded from pre-compiled local graph data (`backend/data/city_graph.graphml`), with zero runtime reliance on third-party map APIs or external web connections.

---

## 2. System Architecture

Fast-Aid combines a high-performance Python simulation backend with a modern React + MapLibre GL frontend:

```
Fast-Aid/
├── backend/                        # FastAPI REST Simulation Service
│   ├── main.py                     # API routes (/city, /dispatch, /benchmark)
│   ├── city.py                     # Road network graph & hospital metadata loader
│   ├── traffic.py                  # Congestion drift, scenarios & incident generator
│   ├── routing.py                  # Custom Heap Dijkstra & A* algorithms
│   ├── preemption.py               # Green corridor V2X signal clearance
│   ├── hospitals.py                # Capacity & medical specialty triage engine
│   ├── simulation.py               # Synchronous ambulance journey simulator
│   ├── metrics.py                  # Telemetry, comparative analysis & benchmarks
│   └── data/
│       └── city_graph.graphml      # Offline city road network
├── frontend/                       # Interactive React + Vite Dashboard
│   ├── src/
│   │   ├── App.tsx                 # Core UI dashboard orchestrator
│   │   ├── components/
│   │   │   ├── MapView.tsx         # MapLibre GL canvas & multi-route polylines
│   │   │   ├── AmbulanceMarker.tsx # 60 FPS client-side vehicle animation & rotation
│   │   │   ├── TopCards.tsx        # KPI metrics (ETA, Time Saved %, Preemptions)
│   │   │   ├── LeftPanel.tsx       # Dispatch configuration & scenario controls
│   │   │   ├── RightPanel.tsx      # Real-time telemetry & chronological event log
│   │   │   ├── ComparisonPanel.tsx # 3-mode comparative metrics & bar charts
│   │   │   └── BenchmarkPanel.tsx  # Monte Carlo benchmark results viewer
│   │   └── hooks/
│   │       └── useTrajectoryAnimation.ts # High-fidelity trajectory interpolation
│   └── vite.config.ts
├── experiments/
│   └── run_benchmarks.py           # 400-trial Monte Carlo benchmark generator
├── results/                        # Generated benchmark datasets & charts
│   ├── benchmark_results.csv
│   ├── avg_time_by_mode.png
│   ├── time_saved_boxplot.png
│   ├── time_saved_vs_congestion.png
│   └── algorithm_comparison.png
├── tests/                          # 55 automated unit & integration tests
├── app.py                          # Root launcher & Streamlit compatibility bridge
├── BACKEND_SPEC.md                 # Complete OpenAPI & Backend Architecture Specification
├── PROJECT.md                      # Project master design & specification
└── requirements.txt                # Python environment dependencies
```

---

## 3. Algorithmic Principles

### Speed Degradation & Siren Privileges
Congestion degrades posted speed limits following:
$$v_{\text{traffic}} = \max\left(3.0,\, v_{\text{limit}} \times (1.0 - 0.85 \times C)\right) \quad [\text{km/h}]$$

Emergency vehicles traveling with audible sirens receive a $1.25\times$ speed factor:
$$v_{\text{ambulance}} = \frac{v_{\text{traffic}}}{3.6} \times 1.25 \quad [\text{m/s}]$$

### Green Corridor Signal Preemption
Standard intersections cycle on 30-second intervals (15s green, 15s red). Under **Smart Mode**, upcoming signalized intersections within 3 hops ahead of the vehicle enter preemption status, turning green prior to arrival and eliminating all intersection deceleration and idle wait times.

### Routing Search (Dijkstra & A\*)
- **Dijkstra:** Uniform-cost search exploring the network to guarantee the globally minimal cost path.
- **A\* Search:** Guided search utilizing an admissible straight-line Haversine distance heuristic divided by maximal theoretical ambulance velocity.

---

## 4. Quickstart Guide

### Prerequisites
- **Python 3.10+**
- **Node.js 18+** and **npm**

---

### Step 1: Start the Backend Service

```bash
# 1. Install Python dependencies
pip install -r requirements.txt

# 2. Launch FastAPI on port 8000
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

*Interactive API documentation is live at `http://localhost:8000/docs`.*

---

### Step 2: Start the Frontend Dashboard

In a new terminal window:

```bash
# 1. Navigate to the frontend directory
cd frontend

# 2. Install dependencies
npm install

# 3. Launch Vite development server
npm run dev
```

*Open your browser at `http://localhost:5173`.*

---

### Step 3: Run Tests & Benchmarks

```bash
# Run the automated test suite (55 tests)
pytest -q

# (Optional) Re-run the 400-trial benchmark experiment
python experiments/run_benchmarks.py
```

---

## 5. REST API Overview

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/city` | Returns city bounds, hospital facilities, road nodes, and traffic signal locations. |
| `POST` | `/dispatch` | Runs a multi-mode simulation and returns the complete coordinate trajectory and polylines. |
| `GET` | `/benchmark` | Provides aggregate 100-trial Monte Carlo benchmark figures. |
| `GET` | `/results/{file}` | Serves static benchmark distribution charts (`.png`, `.csv`). |

---

## 6. Experimental Results

Extensive 400-trial Monte Carlo benchmarking across four distinct congestion regimes (100 trials each under identical random seeds) confirms the following:

- **Smart Mode** consistently outperforms Baseline in over **98% of trials**.
- Travel time savings scale proportionally with baseline traffic density:
  - **Light Traffic:** ~10–18% faster
  - **Moderate Traffic:** ~20–30% faster
  - **Heavy Traffic:** ~30–42% faster
  - **Gridlock:** ~35–50%+ faster
- Preemption eliminates an average of **3 to 7 complete stops per trip**.
- Generated plots can be inspected directly in the `results/` folder or via the in-app **Benchmarks** tab.

---

## 7. Limitations & Project Scope

- **Synthetic Traffic Model:** Uses an edge-based drift and incident model rather than microscopic car-following simulations (e.g. SUMO).
- **Communication Assumption:** Signal preemption assumes reliable Vehicle-to-Infrastructure (V2I/V2X) wireless clearance commands.
- **Offline Map Scope:** Road topologies are pre-extracted and statically bundled to ensure zero-latency local execution without external token or tile limits.
