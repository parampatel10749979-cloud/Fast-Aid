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

## Project Structure

```
fast-aid/
├── app.py                  # Streamlit dashboard
├── requirements.txt
├── README.md
├── src/
│   ├── city.py             # grid city, hospitals, signals
│   ├── traffic.py          # congestion and incidents
│   ├── routing.py          # Dijkstra, A*, cost modes
│   ├── preemption.py       # green corridor
│   ├── hospitals.py        # hospital selection
│   ├── simulation.py       # one ambulance trip
│   ├── metrics.py          # comparison and benchmarks
│   └── visualize.py        # maps and charts
├── experiments/run_benchmarks.py
├── tests/
└── results/
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

**Run the dashboard**
```bash
streamlit run app.py
```

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

## Results

> Fill this table with your real numbers after running the benchmarks.

| Scenario | Baseline (s) | Traffic-Aware (s) | Fast-Aid (s) | Time saved (%) |
|---|---|---|---|---|
| Light | | | | |
| Moderate | | | | |
| Heavy | | | | |
| Gridlock | | | | |

Add your screenshots here (map, simulation, comparison chart).

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
