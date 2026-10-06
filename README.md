# 🚑 Fast-Aid
### Smart Ambulance Routing and Signal Preemption

Fast-Aid is a Python simulation and dashboard that shows how an ambulance can reach a hospital faster using live-traffic routing, dynamic rerouting, and a green corridor of traffic signals.

---

## The Problem

In an emergency, every minute counts. Ambulances lose time because:
- Normal GPS picks the shortest road, not the fastest one.
- Traffic and accidents change during the trip.
- Red lights and queues force stops, even with sirens.

## The Solution

Fast-Aid models a city as a road graph and does the following:
1. Chooses the best hospital by travel time, capacity, and specialty.
2. Finds the fastest route with **Dijkstra** or **A\***.
3. Turns upcoming traffic signals green (**signal preemption**).
4. Rechecks the route every ~15 seconds and **reroutes** if traffic changes.
5. Compares results against normal routing.

## Three Modes Compared

| Mode | Route cost | Rerouting | Signal preemption |
|---|---|---|---|
| Baseline | Distance only | No | No |
| Traffic-Aware | Live travel time | Yes | No |
| **Fast-Aid (Smart)** | Live travel time + signal wait | Yes | **Yes** |

## How It Works

```
Emergency call → Pick hospital → Compute route (Dijkstra / A*)
      → Open green corridor → Reroute if traffic changes → Arrive → Compare
```

## Features

- Synthetic city grid with traffic scenarios: Light, Moderate, Heavy, Gridlock
- Random incidents (accidents) that block roads
- Dijkstra and A* with traffic-aware costs
- Signal preemption (switchable on/off)
- Hospital selection by capacity and specialty
- Interactive Streamlit dashboard with animated ambulance runs
- Benchmark experiments with CSV and charts

## Tech Stack

Python 3.10+, NetworkX, NumPy, Pandas, Matplotlib, Plotly, Streamlit, pytest

## Project Structure (Frontend / Backend Architecture)

```
fast-aid/
├── backend/                        # Backend Simulation & Computation Engine
│   ├── __init__.py
│   ├── city.py                     # Synthetic city grid, hospitals, signals
│   ├── traffic.py                  # BPR congestion and incident dynamics
│   ├── routing.py                  # Dijkstra, A*, time-cost routing
│   ├── preemption.py               # Green corridor signal preemption
│   ├── hospitals.py                # Multi-criteria hospital selection
│   ├── simulation.py               # Step-by-step ambulance trip traversal
│   └── metrics.py                  # Trip comparison and benchmark suite
├── frontend/                       # Frontend Presentation & Dashboard Layer
│   ├── __init__.py
│   ├── app.py                      # Interactive Streamlit dashboard
│   └── visualize.py                # Plotly city network & metrics visualizer
├── app.py                          # Root launcher shim (forwards to frontend/app.py)
├── experiments/
│   └── run_benchmarks.py           # Headless benchmark experiment runner
├── tests/                          # 51 unit tests covering all backend modules
├── results/                        # Benchmark CSV logs and generated figures
├── requirements.txt
└── README.md
```

## Installation

```bash
git clone <your-repo-url>
cd fast-aid
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

## Usage

**Run the frontend dashboard**
```bash
streamlit run frontend/app.py
```
*(or run `streamlit run app.py` from root)*

**Run benchmarks**
```bash
python experiments/run_benchmarks.py
```
Results are saved in `results/`.

**Run tests**
```bash
pytest -q
```

## Dashboard

- **Sidebar:** city size, seed, traffic scenario, emergency type, algorithm, toggles, and buttons (Generate City, Dispatch Ambulance, Run Benchmark)
- **Top cards:** Smart ETA, time saved %, signals preempted, reroutes
- **Tabs:** Live Map, Simulation, Comparison, Benchmark, About

> Median values across 100 trials per scenario (Dijkstra, seed=42).

| Scenario | Baseline (s) | Traffic-Aware (s) | Fast-Aid (s) | Time saved vs Baseline (%) |
|---|---|---|---|---|
| Light    | 75.9  | 65.9  | 70.4  | ~13% (Traffic-Aware) |
| Moderate | 88.5  | 80.0  | 80.0  | ~10% |
| Heavy    | 117.2 | 102.2 | 102.2 | ~13% |
| Gridlock | 220.1 | 178.6 | 178.6 | ~19% |

**Key finding:** Fast-Aid consistently matches or beats Traffic-Aware; both beat Baseline.
Savings grow with congestion — up to ~19% in Gridlock conditions.

## Assumptions and Limitations

- Synthetic city, so results are indicative and not clinical.
- Simple traffic model, not a full simulator like SUMO.
- Preemption assumes vehicle-to-infrastructure communication.
- No real GPS or live traffic data.

## Future Scope

- Live traffic APIs (Google Maps, TomTom, HERE)
- IoT sensors and 5G V2X for real signal control
- ML traffic prediction for forecast-based routing
- Multi-ambulance coordination and hospital load balancing
- Real OpenStreetMap networks and SUMO co-simulation
- Driver mobile app and hospital pre-arrival alerts

## Author

[Param Patel] | [Roll No:117]

## License

MIT
