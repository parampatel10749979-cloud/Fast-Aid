"""
main.py — FastAPI REST Backend for Fast-Aid Demo.

Endpoints:
  GET  /city       — City map bounds, hospitals, and traffic signals
  POST /dispatch   — Synchronous simulation returning trajectory & 3 routes
  GET  /benchmark  — Pre-generated 100-trial benchmark results and static plots
"""

import os
from pathlib import Path
from typing import Literal, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
import pandas as pd
import numpy as np

from backend.city import load_city, Hospital
from backend.traffic import TrafficEngine, ScenarioName
from backend.hospitals import select_hospital
from backend.simulation import run_all_modes_comparison, serialize_trip_result, run_ambulance

app = FastAPI(
    title="Fast-Aid Emergency Response API",
    description="Intelligent ambulance dispatch, dynamic rerouting, and green corridor preemption.",
    version="1.0.0",
)

# Allow CORS for local frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount results directory for static benchmark charts
RESULTS_DIR = Path("results").resolve()
if RESULTS_DIR.exists():
    app.mount("/results", StaticFiles(directory=str(RESULTS_DIR)), name="results")

# Preload static city graph into memory at module load
_GRAPH, _HOSPITALS = load_city()


class DispatchRequest(BaseModel):
    start_node: Optional[str] = Field(None, description="Starting node id, e.g. 'n_0_0'. If empty, picks a distant node.")
    hospital_id: Optional[str] = Field("auto", description="Target hospital id, or 'auto' to select best by capacity & specialty.")
    specialty: Optional[str] = Field(None, description="Requested specialty (cardiac, trauma, stroke, or None).")
    scenario: ScenarioName = Field("Moderate", description="Traffic congestion scenario: Light, Moderate, Heavy, Gridlock.")
    algorithm: Literal["dijkstra", "astar"] = Field("dijkstra", description="Routing algorithm.")
    preemption: bool = Field(True, description="Enable V2X green corridor signal preemption.")
    reroute_interval: float = Field(15.0, description="Dynamic rerouting period in seconds.")


@app.get("/city")
def get_city():
    """Return city bounds, center, hospitals, signals, and road metadata."""
    graph, hospitals = load_city()

    nodes_data = []
    lats = []
    lons = []
    signals = []

    for n, d in graph.nodes(data=True):
        lat = float(d.get("lat", 37.78))
        lon = float(d.get("lon", -122.40))
        lats.append(lat)
        lons.append(lon)

        has_sig = bool(d.get("has_signal", False))
        if has_sig:
            signals.append({
                "node": n,
                "lat": lat,
                "lon": lon,
                "phase_offset": round(float(d.get("phase_offset", 0.0)), 1),
            })

        nodes_data.append({
            "id": n,
            "lat": lat,
            "lon": lon,
            "has_signal": has_sig,
            "label": d.get("intersection_label", n),
        })

    hosp_list = [
        {
            "id": h.id or h.node,
            "name": h.name or f"Emergency Hospital {h.node}",
            "node": h.node,
            "lat": h.lat or graph.nodes[h.node].get("lat", 37.78),
            "lon": h.lon or graph.nodes[h.node].get("lon", -122.40),
            "capacity": h.capacity,
            "specialties": h.specialties,
        }
        for h in hospitals
    ]

    center_lat = float(np.mean(lats)) if lats else 37.7808
    center_lon = float(np.mean(lons)) if lons else -122.4075

    return {
        "center": [round(center_lat, 6), round(center_lon, 6)],
        "bounds": [
            [round(min(lats), 6), round(min(lons), 6)],
            [round(max(lats), 6), round(max(lons), 6)],
        ],
        "hospitals": hosp_list,
        "signals": signals,
        "nodes": nodes_data,
        "stats": {
            "node_count": graph.number_of_nodes(),
            "edge_count": graph.number_of_edges(),
            "signal_count": len(signals),
            "hospital_count": len(hosp_list),
        }
    }


@app.post("/dispatch")
def dispatch_ambulance(req: DispatchRequest):
    """
    Run emergency ambulance dispatch synchronously.
    Returns full trajectory, 3 comparison route polylines, and telemetry metrics.
    """
    # 1. Fresh copy of cached graph
    graph, hospitals = load_city()

    # 2. Apply scenario congestion
    rng = np.random.default_rng(int(np.random.randint(0, 10000)))
    _traffic = TrafficEngine(graph, scenario=req.scenario, rng=rng)

    # 3. Determine start node
    start = req.start_node
    if not start or not graph.has_node(start):
        # Default start: northwest corner, far from central hospitals
        start = "n_0_0"

    # 4. Determine destination hospital
    target_hospital = None
    if req.hospital_id and req.hospital_id != "auto":
        for h in hospitals:
            if h.id == req.hospital_id or h.node == req.hospital_id:
                target_hospital = h
                break

    if target_hospital is None:
        target_hospital = select_hospital(
            graph, start, hospitals, specialty=req.specialty, mode="traffic"
        )

    if target_hospital is None:
        # Fallback to first available hospital
        target_hospital = hospitals[0]

    dest_node = target_hospital.node

    # 5. Run simulation bundle across all 3 modes
    result = run_all_modes_comparison(
        graph,
        start=start,
        hospital_node=dest_node,
        algorithm=req.algorithm,
        reroute_interval=req.reroute_interval,
    )

    # Attach hospital metadata to response
    result["destination"] = {
        "id": target_hospital.id,
        "name": target_hospital.name,
        "node": target_hospital.node,
        "lat": target_hospital.lat,
        "lon": target_hospital.lon,
        "capacity": target_hospital.capacity,
        "specialties": target_hospital.specialties,
    }
    result["start_node"] = start
    result["scenario"] = req.scenario

    return result


@app.get("/benchmark")
def get_benchmark():
    """Return pre-generated 100-trial benchmark results and static charts."""
    csv_path = RESULTS_DIR / "benchmark_results.csv"
    if not csv_path.exists():
        raise HTTPException(status_code=404, detail="Benchmark CSV not found.")

    df = pd.read_csv(csv_path)

    # Aggregate key stats by scenario
    summary = (
        df.groupby("scenario")
        .agg(
            baseline_time_s=("distance_time_s", "mean"),
            traffic_time_s=("traffic_time_s", "mean"),
            smart_time_s=("smart_time_s", "mean"),
            time_saved_s=("smart_saved_s", "mean"),
            time_saved_pct=("smart_saved_pct", "mean"),
            smart_reroutes=("smart_reroutes", "mean"),
            smart_signal_stops=("smart_signal_stops", "mean"),
        )
        .round(2)
        .reset_index()
        .to_dict(orient="records")
    )

    # List chart image endpoints
    charts = {
        "avg_time_by_mode": "/results/avg_time_by_mode.png",
        "time_saved_boxplot": "/results/time_saved_boxplot.png",
        "time_saved_vs_congestion": "/results/time_saved_vs_congestion.png",
        "algorithm_comparison": "/results/algorithm_comparison.png",
    }

    return {
        "trials_per_scenario": 100,
        "summary": summary,
        "raw_preview": df.head(15).to_dict(orient="records"),
        "charts": charts,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
