"""
app.py — Fast-Aid Streamlit Dashboard

Tabs:
  1. Live Map      — city grid + congestion + 3 route overlays
  2. Simulation    — animated ambulance trip + event log
  3. Comparison    — table + bar chart for 3 modes
  4. Benchmark     — CSV download + charts from results/
  5. About         — architecture, assumptions, limitations

Run with: streamlit run app.py
"""

from __future__ import annotations

import sys
import time
from pathlib import Path

# Ensure repo root is on sys.path
_REPO_ROOT = Path(__file__).resolve().parent.parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

import networkx as nx
import numpy as np
import pandas as pd
import streamlit as st

# ── page config (must be first Streamlit call) ────────────────────────────────
st.set_page_config(
    page_title="Fast-Aid — Smart Ambulance Routing",
    page_icon="🚑",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── custom CSS ────────────────────────────────────────────────────────────────
st.markdown("""
<style>
    /* Dark gradient background */
    .stApp { background: linear-gradient(135deg, #0f0c29, #302b63, #24243e); }
    .stApp > header { background: transparent; }

    /* KPI cards */
    .kpi-card {
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.15);
        border-radius: 12px;
        padding: 18px 22px;
        text-align: center;
        backdrop-filter: blur(6px);
    }
    .kpi-value { font-size: 2rem; font-weight: 700; color: #00d4aa; }
    .kpi-label { font-size: 0.85rem; color: #aaa; margin-top: 4px; }

    /* Sidebar */
    section[data-testid="stSidebar"] > div {
        background: rgba(15,12,41,0.85);
        border-right: 1px solid rgba(255,255,255,0.08);
    }

    /* Tab text */
    button[data-baseweb="tab"] { color: #ccc; font-size: 0.95rem; }
    button[data-baseweb="tab"][aria-selected="true"] { color: #00d4aa !important; }

    /* Dataframe */
    .stDataFrame { border-radius: 8px; overflow: hidden; }
</style>
""", unsafe_allow_html=True)

# ── imports from backend and frontend (after page config) ────────────────────
from backend.city import build_city, Hospital
from backend.hospitals import select_hospital
from backend.metrics import compare_modes, RESULTS_DIR
from backend.routing import dijkstra_route, astar_route
from backend.simulation import run_ambulance, TripResult
from backend.traffic import TrafficEngine, ScenarioName
from frontend.visualize import (
    draw_city_map,
    draw_comparison_bar,
    draw_simulation_animation,
    draw_benchmark_avg_time,
    draw_benchmark_savings,
    ROUTE_NAMES,
)

SPECIALTIES = ["cardiac", "trauma", "stroke"]

# ─────────────────────────────────────────────────────────────────────────────
# SIDEBAR
# ─────────────────────────────────────────────────────────────────────────────

with st.sidebar:
    st.markdown("## 🚑 Fast-Aid Controls")
    st.markdown("---")

    seed = st.slider("City seed", 0, 200, 42, help="Change to generate a different city layout")
    scenario: ScenarioName = st.selectbox(
        "Traffic scenario", ["Light", "Moderate", "Heavy", "Gridlock"], index=1
    )
    emergency_type = st.selectbox("Emergency type", SPECIALTIES + ["any"], index=0)
    algorithm = st.radio("Routing algorithm", ["Dijkstra", "A*"], horizontal=True)

    st.markdown("---")
    st.markdown("**Toggles**")
    use_preemption = st.toggle("Signal preemption", value=True)
    use_rerouting  = st.toggle("Dynamic rerouting", value=True)
    use_incidents  = st.toggle("Random incidents",  value=False)

    st.markdown("---")
    gen_city_btn   = st.button("🏙️  Generate City",       use_container_width=True)
    dispatch_btn   = st.button("🚑  Dispatch Ambulance",   use_container_width=True)
    benchmark_btn  = st.button("📊  Run Quick Benchmark",  use_container_width=True)

# ─────────────────────────────────────────────────────────────────────────────
# SESSION STATE — initialise once
# ─────────────────────────────────────────────────────────────────────────────

def _init_state() -> None:
    if "graph" not in st.session_state:
        st.session_state.graph = None
    if "hospitals" not in st.session_state:
        st.session_state.hospitals = []
    if "traffic_eng" not in st.session_state:
        st.session_state.traffic_eng = None
    if "results" not in st.session_state:
        st.session_state.results = {}   # mode → TripResult
    if "metrics_df" not in st.session_state:
        st.session_state.metrics_df = None
    if "bench_df" not in st.session_state:
        st.session_state.bench_df = None

_init_state()

# ─────────────────────────────────────────────────────────────────────────────
# ACTIONS
# ─────────────────────────────────────────────────────────────────────────────

def _build_city() -> None:
    """Regenerate the city graph and traffic engine."""
    graph, hospitals = build_city(seed=seed)
    eng = TrafficEngine(graph, scenario=scenario, seed=seed)
    if use_incidents:
        eng.step(dt=30.0)   # warm up with some incidents
    st.session_state.graph      = graph
    st.session_state.hospitals  = hospitals
    st.session_state.traffic_eng = eng
    st.session_state.results    = {}
    st.session_state.metrics_df = None
    st.success(f"City generated: 12×12 grid, {len(hospitals)} hospitals, scenario={scenario}")


def _dispatch() -> None:
    """Run all 3 modes and store results."""
    graph = st.session_state.graph
    hospitals = st.session_state.hospitals
    if graph is None:
        st.warning("Generate a city first.")
        return

    specialty = None if emergency_type == "any" else emergency_type
    hospital = select_hospital(graph, (0, 0), hospitals, specialty=specialty)
    if hospital is None:
        st.error("No suitable hospital found. Try a different emergency type or regenerate.")
        return

    alg = "dijkstra" if algorithm == "Dijkstra" else "astar"
    results = {}
    with st.spinner("Running 3 mode simulations…"):
        for mode, preempt, reroute in [
            ("distance", False, False),
            ("traffic",  False, use_rerouting),
            ("smart",    use_preemption, use_rerouting),
        ]:
            results[mode] = run_ambulance(
                graph, (0, 0), hospital.node,
                mode=mode, algorithm=alg,
                preemption=preempt,
                reroute_interval=15.0 if reroute else 1e9,
            )

    st.session_state.results    = results
    st.session_state.metrics_df = compare_modes(
        results["distance"], results["traffic"], results["smart"]
    )
    st.success(f"Dispatch complete → hospital {hospital.node}")


def _quick_benchmark() -> None:
    """Run a 20-trial benchmark and store results."""
    from backend.metrics import run_benchmark
    with st.spinner("Running benchmark (20 trials × 4 scenarios)…"):
        df = run_benchmark(n_trials=20, seed=seed)
    st.session_state.bench_df = df
    st.success("Benchmark done.")


# ── trigger buttons ───────────────────────────────────────────────────────────
if gen_city_btn:
    _build_city()

if dispatch_btn:
    if st.session_state.graph is None:
        _build_city()
    _dispatch()

if benchmark_btn:
    if st.session_state.graph is None:
        _build_city()
    _quick_benchmark()

# ─────────────────────────────────────────────────────────────────────────────
# KPI CARDS
# ─────────────────────────────────────────────────────────────────────────────

results     = st.session_state.results
metrics_df  = st.session_state.metrics_df

smart_time   = results["smart"].total_time      if results else None
saved_pct    = None
signals_pre  = 0
reroutes_cnt = 0

if metrics_df is not None:
    smart_row  = metrics_df[metrics_df["mode"] == "smart"].iloc[0]
    saved_pct  = smart_row["time_saved_pct"]
    reroutes_cnt = results["smart"].reroutes

if results:
    # signals preempted = difference in signal_stops between no-preemption and preemption
    base_stops  = results["distance"].signal_stops
    smart_stops = results["smart"].signal_stops
    signals_pre = max(0, base_stops - smart_stops)

c1, c2, c3, c4 = st.columns(4)

def _kpi(col, value: str, label: str) -> None:
    col.markdown(
        f'<div class="kpi-card"><div class="kpi-value">{value}</div>'
        f'<div class="kpi-label">{label}</div></div>',
        unsafe_allow_html=True,
    )

_kpi(c1, f"{smart_time:.0f}s"  if smart_time  else "—", "🚑 Smart ETA")
_kpi(c2, f"{saved_pct:+.1f}%"  if saved_pct is not None else "—", "⏱ Time Saved")
_kpi(c3, str(signals_pre), "🚦 Signals Preempted")
_kpi(c4, str(reroutes_cnt), "🔀 Reroutes")

st.markdown("<br>", unsafe_allow_html=True)

# ─────────────────────────────────────────────────────────────────────────────
# TABS
# ─────────────────────────────────────────────────────────────────────────────

tab_map, tab_sim, tab_cmp, tab_bench, tab_about = st.tabs([
    "🗺️  Live Map",
    "🎬  Simulation",
    "📊  Comparison",
    "📈  Benchmark",
    "ℹ️  About",
])

# ─────────────────────────────── TAB 1: Live Map ─────────────────────────────
with tab_map:
    graph = st.session_state.graph
    if graph is None:
        st.info("👈 Click **Generate City** in the sidebar to start.")
    else:
        routes = {mode: r.path for mode, r in results.items()} if results else {}
        fig = draw_city_map(
            graph,
            routes=routes or None,
            hospitals=st.session_state.hospitals,
        )
        st.plotly_chart(fig, use_container_width=True)

        with st.expander("Legend", expanded=False):
            st.markdown("""
| Colour | Meaning |
|--------|---------|
| 🟢 Green road | Low congestion |
| 🟡 Yellow road | Medium congestion |
| 🔴 Red road | High congestion |
| 🟡 Small dot | Traffic signal |
| ✚ White cross | Hospital |
| 🔵 Blue line | Baseline route |
| 🟠 Amber line | Traffic-Aware route |
| 🟢 Green line | Fast-Aid (Smart) route |
""")

# ───────────────────────────── TAB 2: Simulation ─────────────────────────────
with tab_sim:
    if not results:
        st.info("👈 Dispatch an ambulance to see the simulation.")
    else:
        smart_result = results["smart"]
        traj_nodes = smart_result.path

        col_anim, col_log = st.columns([2, 1])
        with col_anim:
            st.subheader("Ambulance Movement (Fast-Aid mode)")
            fig_anim = draw_simulation_animation(
                st.session_state.graph,
                trajectory_nodes=traj_nodes,
                hospital_node=traj_nodes[-1],
                hospitals=st.session_state.hospitals,
                routes={m: r.path for m, r in results.items()},
            )
            st.plotly_chart(fig_anim, use_container_width=True)

        with col_log:
            st.subheader("Event Log")
            log_data = [
                {"Time (s)": f"{e.time:.1f}", "Node": str(e.node),
                 "Event": e.event, "Detail": e.detail}
                for e in smart_result.trajectory
            ]
            st.dataframe(pd.DataFrame(log_data), height=480, use_container_width=True)

# ─────────────────────────────── TAB 3: Comparison ───────────────────────────
with tab_cmp:
    if metrics_df is None:
        st.info("👈 Dispatch an ambulance to compare the three modes.")
    else:
        st.subheader("Mode Comparison")
        display_df = metrics_df[[
            "mode", "total_time_s", "distance_m",
            "signal_stops", "signal_wait_s", "reroutes",
            "time_saved_s", "time_saved_pct",
        ]].copy()
        display_df["mode"] = display_df["mode"].map(ROUTE_NAMES)
        display_df.columns = [
            "Mode", "Trip Time (s)", "Distance (m)",
            "Signal Stops", "Signal Wait (s)", "Reroutes",
            "Time Saved (s)", "Time Saved (%)",
        ]
        st.dataframe(display_df, use_container_width=True, hide_index=True)

        st.plotly_chart(draw_comparison_bar(metrics_df), use_container_width=True)

        # per-mode detail
        with st.expander("Trip details (all modes)"):
            for mode, result in results.items():
                st.markdown(f"**{ROUTE_NAMES[mode]}** — path length: {len(result.path)} nodes, "
                            f"total time: {result.total_time:.1f}s, "
                            f"reroutes: {result.reroutes}, "
                            f"signal wait: {result.signal_wait:.1f}s")

# ─────────────────────────────── TAB 4: Benchmark ────────────────────────────
with tab_bench:
    st.subheader("Benchmark Results")

    # try to load the full benchmark CSV first
    bench_df = st.session_state.bench_df
    full_csv = RESULTS_DIR / "benchmark_results.csv"
    if bench_df is None and full_csv.exists():
        bench_df = pd.read_csv(full_csv)

    if bench_df is None:
        st.info("Click **Run Quick Benchmark** in the sidebar, or run "
                "`python experiments/run_benchmarks.py` to generate results.")
    else:
        # summary table
        scenarios = ["Light", "Moderate", "Heavy", "Gridlock"]
        cols_map = {
            "distance_time_s": "Baseline (s)",
            "traffic_time_s":  "Traffic-Aware (s)",
            "smart_time_s":    "Fast-Aid (s)",
            "smart_saved_pct": "Smart Saved (%)",
        }
        avail_cols = [c for c in cols_map if c in bench_df.columns]
        summary = (
            bench_df.groupby("scenario")[avail_cols]
            .median()
            .round(1)
            .rename(columns=cols_map)
            .reindex([s for s in scenarios if s in bench_df["scenario"].unique()])
        )
        st.dataframe(summary, use_container_width=True)

        # charts
        c1, c2 = st.columns(2)
        with c1:
            st.plotly_chart(draw_benchmark_avg_time(bench_df), use_container_width=True)
        with c2:
            st.plotly_chart(draw_benchmark_savings(bench_df), use_container_width=True)

        # static PNG charts from experiments/
        png_dir = RESULTS_DIR
        pngs = [
            ("avg_time_by_mode.png",         "Avg Time by Mode"),
            ("time_saved_boxplot.png",        "Time Saved Boxplot"),
            ("time_saved_vs_congestion.png",  "Saved vs Congestion"),
            ("algorithm_comparison.png",      "Dijkstra vs A*"),
        ]
        available_pngs = [(f, l) for f, l in pngs if (png_dir / f).exists()]
        if available_pngs:
            st.markdown("### Static Charts (from full benchmark run)")
            cols = st.columns(len(available_pngs))
            for col, (fname, label) in zip(cols, available_pngs):
                col.image(str(png_dir / fname), caption=label, use_container_width=True)

        # CSV download
        csv_bytes = bench_df.to_csv(index=False).encode()
        st.download_button(
            "⬇️  Download benchmark_results.csv",
            data=csv_bytes,
            file_name="benchmark_results.csv",
            mime="text/csv",
        )

# ─────────────────────────────── TAB 5: About ────────────────────────────────
with tab_about:
    st.markdown("""
## 🚑 Fast-Aid — Smart Ambulance Routing

Fast-Aid is a Python simulation + Streamlit dashboard that demonstrates how intelligent
routing, dynamic rerouting, and signal preemption can significantly reduce ambulance
response times.

### Architecture

```
Emergency call
   │
   ▼
select_hospital()  ←─ hospitals.py  (capacity + specialty filter, ranked by route cost)
   │
   ▼
dijkstra_route() / astar_route()  ←─ routing.py  (distance / traffic / smart cost modes)
   │
   ▼
run_ambulance()  ←─ simulation.py  (edge-by-edge, signal waits, preemption, rerouting)
   │
   ├── preempt_signals()  ←─ preemption.py  (set next 3 signals green)
   └── TrafficEngine.step()  ←─ traffic.py  (congestion drift, incidents)
   │
   ▼
compare_modes()  ←─ metrics.py  (time saved %, stops avoided)
   │
   ▼
Streamlit Dashboard  ←─ app.py + visualize.py
```

### Three Modes Explained

| Mode | Cost function | Rerouting | Signal preemption |
|------|---------------|-----------|-------------------|
| **Baseline** | Edge length (metres) | ✗ | ✗ |
| **Traffic-Aware** | Travel time (live congestion) | ✓ every 15 s | ✗ |
| **Fast-Aid (Smart)** | Travel time + signal wait | ✓ every 15 s | ✓ next 3 signals |

### Travel-Time Formula

```
speed         = max(3, speed_limit × (1 − 0.85 × congestion))   # km/h
travel_time   = edge_length / speed                              # seconds
ambulance_time = travel_time / 1.25                              # siren boost
```

### Assumptions & Limitations

- **Synthetic city** — 12×12 grid, not a real map.
- **Simple traffic model** — random drift, not a full SUMO simulation.
- **Preemption** — assumes Vehicle-to-Infrastructure (V2X) communication.
- **No real GPS** or live traffic API data.
- Results are indicative and not clinical.

### Future Scope

- Live traffic APIs (Google Maps, TomTom, HERE)
- IoT sensors & 5G V2X for real signal control
- ML traffic prediction for forecast-based routing
- Multi-ambulance coordination & hospital load balancing
- Real OpenStreetMap networks & SUMO co-simulation

---
**Author:** Param Patel | Roll No: 117  
**Stack:** Python 3.10+, NetworkX, NumPy, Pandas, Matplotlib, Plotly, Streamlit  
**License:** MIT
""")
