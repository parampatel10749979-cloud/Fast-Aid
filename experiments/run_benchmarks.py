"""
experiments/run_benchmarks.py
Run 4 scenarios × 100 trials × 3 modes and save results + charts to results/.

Usage:
    python experiments/run_benchmarks.py
"""

from __future__ import annotations

import sys
from pathlib import Path

# allow running from repo root
sys.path.insert(0, str(Path(__file__).parent.parent))

import matplotlib
matplotlib.use("Agg")   # headless rendering
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

from src.metrics import run_benchmark, RESULTS_DIR

SCENARIOS = ["Light", "Moderate", "Heavy", "Gridlock"]
N_TRIALS  = 100
SEED      = 42


def main() -> None:
    RESULTS_DIR.mkdir(exist_ok=True)
    print(f"Running {N_TRIALS} trials × {len(SCENARIOS)} scenarios × 3 modes …")

    df = run_benchmark(n_trials=N_TRIALS, scenarios=SCENARIOS, seed=SEED)

    print(f"  Saved {RESULTS_DIR / 'benchmark_results.csv'}  ({len(df)} rows)")
    print()
    _print_summary(df)

    _plot_avg_time_by_mode(df)
    _plot_time_saved_boxplot(df)
    _plot_time_saved_vs_congestion(df)
    _plot_algorithm_comparison(df)

    print("\nAll charts saved to results/")


# ── summary table ─────────────────────────────────────────────────────────────

def _print_summary(df: pd.DataFrame) -> None:
    cols = ["distance_time_s", "traffic_time_s", "smart_time_s",
            "smart_saved_pct"]
    summary = (
        df.groupby("scenario")[cols]
        .median()
        .round(1)
        .rename(columns={
            "distance_time_s": "Baseline (s)",
            "traffic_time_s":  "Traffic-Aware (s)",
            "smart_time_s":    "Fast-Aid (s)",
            "smart_saved_pct": "Smart saved (%)",
        })
    )
    # preserve scenario order
    summary = summary.reindex(SCENARIOS)
    print(summary.to_string())
    print()


# ── chart 1: average time by mode ─────────────────────────────────────────────

def _plot_avg_time_by_mode(df: pd.DataFrame) -> None:
    modes   = ["Baseline", "Traffic-Aware", "Fast-Aid (Smart)"]
    cols    = ["distance_time_s", "traffic_time_s", "smart_time_s"]
    colours = ["#e74c3c", "#f39c12", "#27ae60"]

    avg = df.groupby("scenario")[cols].median().reindex(SCENARIOS)

    x   = np.arange(len(SCENARIOS))
    w   = 0.25
    fig, ax = plt.subplots(figsize=(9, 5))

    for i, (label, col, c) in enumerate(zip(modes, cols, colours)):
        ax.bar(x + i * w, avg[col], w, label=label, color=c, alpha=0.88)

    ax.set_xticks(x + w)
    ax.set_xticklabels(SCENARIOS)
    ax.set_xlabel("Traffic Scenario")
    ax.set_ylabel("Median Trip Time (s)")
    ax.set_title("Average Trip Time by Mode and Scenario")
    ax.legend()
    ax.grid(axis="y", linestyle="--", alpha=0.4)
    fig.tight_layout()
    fig.savefig(RESULTS_DIR / "avg_time_by_mode.png", dpi=120)
    plt.close(fig)
    print("  Saved avg_time_by_mode.png")


# ── chart 2: time-saved boxplot ───────────────────────────────────────────────

def _plot_time_saved_boxplot(df: pd.DataFrame) -> None:
    fig, axes = plt.subplots(1, 2, figsize=(11, 5), sharey=False)

    for ax, mode, col, title, c in zip(
        axes,
        ["traffic", "smart"],
        ["traffic_saved_pct", "smart_saved_pct"],
        ["Traffic-Aware vs Baseline", "Fast-Aid vs Baseline"],
        ["#f39c12", "#27ae60"],
    ):
        data = [df[df["scenario"] == s][col].dropna().values for s in SCENARIOS]
        bp   = ax.boxplot(data, patch_artist=True, tick_labels=SCENARIOS,
                          medianprops=dict(color="white", linewidth=2))
        for patch in bp["boxes"]:
            patch.set_facecolor(c)
            patch.set_alpha(0.75)
        ax.axhline(0, linestyle="--", color="gray", linewidth=0.8)
        ax.set_title(title)
        ax.set_xlabel("Scenario")
        ax.set_ylabel("Time Saved (%)")
        ax.grid(axis="y", linestyle="--", alpha=0.4)

    fig.suptitle("Time Saved vs Baseline — Distribution Across Trials")
    fig.tight_layout()
    fig.savefig(RESULTS_DIR / "time_saved_boxplot.png", dpi=120)
    plt.close(fig)
    print("  Saved time_saved_boxplot.png")


# ── chart 3: time saved vs congestion ────────────────────────────────────────

def _plot_time_saved_vs_congestion(df: pd.DataFrame) -> None:
    congestion_map = {"Light": 0.10, "Moderate": 0.30, "Heavy": 0.60, "Gridlock": 0.85}
    df = df.copy()
    df["congestion"] = df["scenario"].map(congestion_map)

    medians = df.groupby("scenario").agg(
        congestion=("congestion", "first"),
        traffic_saved=("traffic_saved_pct", "median"),
        smart_saved=("smart_saved_pct", "median"),
    ).reset_index().sort_values("congestion")

    fig, ax = plt.subplots(figsize=(8, 5))
    ax.plot(medians["congestion"], medians["traffic_saved"],
            "o--", color="#f39c12", label="Traffic-Aware", linewidth=2)
    ax.plot(medians["congestion"], medians["smart_saved"],
            "s-",  color="#27ae60", label="Fast-Aid (Smart)", linewidth=2)

    for _, row in medians.iterrows():
        ax.annotate(row["scenario"], (row["congestion"], row["smart_saved"]),
                    textcoords="offset points", xytext=(5, 5), fontsize=8)

    ax.set_xlabel("Congestion Level (base)")
    ax.set_ylabel("Median Time Saved vs Baseline (%)")
    ax.set_title("Time Saved vs Congestion Level")
    ax.legend()
    ax.grid(linestyle="--", alpha=0.4)
    fig.tight_layout()
    fig.savefig(RESULTS_DIR / "time_saved_vs_congestion.png", dpi=120)
    plt.close(fig)
    print("  Saved time_saved_vs_congestion.png")


# ── chart 4: Dijkstra vs A* comparison ───────────────────────────────────────

def _plot_algorithm_comparison(df: pd.DataFrame) -> None:
    """
    Re-run a small set of trials with A* to compare nodes_expanded and runtime.
    We collect this data here rather than storing it in the main benchmark CSV
    to keep the main benchmark fast.
    """
    from src.city import build_city
    from src.hospitals import select_hospital
    from src.routing import dijkstra_route, astar_route
    from src.traffic import TrafficEngine

    rng   = np.random.default_rng(SEED + 1)
    graph, hospitals = build_city(seed=42)
    TrafficEngine(graph, scenario="Moderate", seed=SEED + 1)
    nodes = list(graph.nodes())

    dijkstra_exp, astar_exp = [], []
    dijkstra_rt,  astar_rt  = [], []

    n_samples = 80
    for _ in range(n_samples):
        src = nodes[int(rng.integers(0, len(nodes)))]
        dst = nodes[int(rng.integers(0, len(nodes)))]
        if src == dst:
            continue
        try:
            dr = dijkstra_route(graph, src, dst, mode="traffic")
            ar = astar_route(graph, src, dst, mode="traffic")
            dijkstra_exp.append(dr.nodes_expanded)
            astar_exp.append(ar.nodes_expanded)
            dijkstra_rt.append(dr.runtime_ms)
            astar_rt.append(ar.runtime_ms)
        except ValueError:
            continue

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(10, 5))

    # nodes expanded
    ax1.bar(["Dijkstra", "A*"],
            [np.median(dijkstra_exp), np.median(astar_exp)],
            color=["#3498db", "#9b59b6"], alpha=0.85)
    ax1.set_ylabel("Median Nodes Expanded")
    ax1.set_title("Nodes Expanded")
    ax1.grid(axis="y", linestyle="--", alpha=0.4)

    # runtime
    ax2.bar(["Dijkstra", "A*"],
            [np.median(dijkstra_rt), np.median(astar_rt)],
            color=["#3498db", "#9b59b6"], alpha=0.85)
    ax2.set_ylabel("Median Runtime (ms)")
    ax2.set_title("Routing Runtime")
    ax2.grid(axis="y", linestyle="--", alpha=0.4)

    fig.suptitle("Dijkstra vs A* — Nodes Expanded and Runtime")
    fig.tight_layout()
    fig.savefig(RESULTS_DIR / "algorithm_comparison.png", dpi=120)
    plt.close(fig)
    print("  Saved algorithm_comparison.png")


if __name__ == "__main__":
    main()
