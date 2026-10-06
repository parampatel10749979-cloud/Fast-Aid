"""
metrics.py — Compare routing modes and run benchmark experiments.

compare_modes():  produce a summary DataFrame for one trip set.
run_benchmark():  100 random trials per scenario, all 3 modes.
Saves results/benchmark_results.csv.
"""

from __future__ import annotations

import copy
import time
from pathlib import Path
from typing import Literal

import numpy as np
import pandas as pd
import networkx as nx

from src.city import build_city, Hospital
from src.hospitals import select_hospital
from src.routing import RoutingMode
from src.simulation import run_ambulance, TripResult
from src.traffic import TrafficEngine, ScenarioName

RESULTS_DIR = Path("results")


# ── single-trip comparison ────────────────────────────────────────────────────

def compare_modes(
    baseline: TripResult,
    traffic_aware: TripResult,
    smart: TripResult,
) -> pd.DataFrame:
    """
    Build a comparison DataFrame for one set of three trips.

    Args:
        baseline:       TripResult for 'distance' mode, no preemption.
        traffic_aware:  TripResult for 'traffic' mode with rerouting.
        smart:          TripResult for 'smart' mode with rerouting + preemption.

    Returns:
        DataFrame with one row per mode and columns for key metrics.
    """
    rows = []
    for result in (baseline, traffic_aware, smart):
        saved_s  = baseline.total_time - result.total_time
        saved_pct = (saved_s / baseline.total_time * 100) if baseline.total_time > 0 else 0.0
        rows.append({
            "mode":            result.mode,
            "algorithm":       result.algorithm,
            "preemption":      result.preemption_on,
            "total_time_s":    round(result.total_time, 2),
            "distance_m":      round(result.total_distance, 1),
            "reroutes":        result.reroutes,
            "signal_stops":    result.signal_stops,
            "signal_wait_s":   round(result.signal_wait, 2),
            "time_saved_s":    round(saved_s, 2),
            "time_saved_pct":  round(saved_pct, 2),
        })
    return pd.DataFrame(rows)


# ── benchmark ─────────────────────────────────────────────────────────────────

def run_benchmark(
    n_trials: int = 100,
    scenarios: list[ScenarioName] | None = None,
    seed: int = 0,
    algorithm: Literal["dijkstra", "astar"] = "dijkstra",
    grid_seed: int = 42,
) -> pd.DataFrame:
    """
    Run n_trials random trips per scenario for all 3 modes.

    Args:
        n_trials:   Number of random start/hospital pairs per scenario.
        scenarios:  List of scenario names; defaults to all four.
        seed:       Master RNG seed for trial sampling.
        algorithm:  Routing algorithm to use.
        grid_seed:  Seed used to build the city graph.

    Returns:
        DataFrame with one row per (scenario, trial, mode).
    """
    if scenarios is None:
        scenarios = ["Light", "Moderate", "Heavy", "Gridlock"]

    master_rng = np.random.default_rng(seed)
    all_rows: list[dict] = []

    for scenario in scenarios:
        # build a fresh city for each scenario
        graph, hospitals = build_city(seed=grid_seed)
        traffic_eng = TrafficEngine(graph, scenario=scenario, seed=int(master_rng.integers(0, 2**31)))

        nodes = list(graph.nodes())

        for trial in range(n_trials):
            # random start node
            start_idx = int(master_rng.integers(0, len(nodes)))
            start = nodes[start_idx]

            # pick a hospital (any specialty)
            hospital = select_hospital(graph, start, hospitals, specialty=None, mode="traffic")
            if hospital is None:
                continue
            hospital_node = hospital.node
            if hospital_node == start:
                continue

            # advance traffic a bit
            for _ in range(int(master_rng.integers(5, 30))):
                traffic_eng.step(dt=1.0)

            # snapshot congestion so all three modes see the same traffic
            congestion_snapshot: dict[tuple, float] = {
                (u, v): graph[u][v]["congestion"]
                for u, v in graph.edges()
            }

            # run all three modes with identical traffic
            row: dict = {
                "scenario": scenario,
                "trial": trial,
                "start": str(start),
                "hospital": str(hospital_node),
            }

            for mode, preemption, reroute in [
                ("distance", False, False),
                ("traffic",  False, True),
                ("smart",    True,  True),
            ]:
                # restore snapshot so each mode starts with identical congestion
                for (u, v), c in congestion_snapshot.items():
                    graph[u][v]["congestion"] = c

                result = run_ambulance(
                    graph,
                    start,
                    hospital_node,
                    mode=mode,
                    algorithm=algorithm,
                    preemption=preemption,
                    reroute_interval=15.0,
                )
                row[f"{mode}_time_s"]       = round(result.total_time, 2)
                row[f"{mode}_distance_m"]   = round(result.total_distance, 1)
                row[f"{mode}_reroutes"]     = result.reroutes
                row[f"{mode}_signal_stops"] = result.signal_stops
                row[f"{mode}_signal_wait_s"]= round(result.signal_wait, 2)

            # compute savings vs baseline (distance mode)
            for mode in ("traffic", "smart"):
                base = row["distance_time_s"]
                t    = row[f"{mode}_time_s"]
                row[f"{mode}_saved_s"]   = round(base - t, 2)
                row[f"{mode}_saved_pct"] = round((base - t) / base * 100 if base > 0 else 0, 2)

            all_rows.append(row)

    df = pd.DataFrame(all_rows)

    # ── save CSV ──────────────────────────────────────────────────────────────
    RESULTS_DIR.mkdir(exist_ok=True)
    out_path = RESULTS_DIR / "benchmark_results.csv"
    df.to_csv(out_path, index=False)
    return df
