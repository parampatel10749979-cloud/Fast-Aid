"""
city.py — Build a synthetic 12×12 grid city.

Nodes:  (row, col) tuples, 0-indexed.
Edges:  bidirectional roads with length, speed_limit, congestion, has_signal.
Hospitals: 3–5 nodes tagged with capacity and specialties.
Signals:   ~40% of nodes carry a traffic signal (cycle 30 s: 15 green / 15 red).
All randomness uses a seeded numpy Generator passed in by the caller.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any

import networkx as nx
import numpy as np

# ── constants ────────────────────────────────────────────────────────────────
GRID_ROWS: int = 12
GRID_COLS: int = 12
BLOCK_LENGTH_M: float = 200.0          # metres per block
SPEED_OPTIONS_KMH: list[int] = [30, 40, 60]
SIGNAL_FRACTION: float = 0.40          # ~40 % of nodes have signals
SIGNAL_CYCLE_S: float = 30.0           # total cycle length
SIGNAL_GREEN_S: float = 15.0          # green phase duration
SIGNAL_RED_S: float = 15.0            # red phase duration
MAX_SPEED_KMH_FOR_HEURISTIC: float = 60.0  # used by A* heuristic
SPECIALTIES: list[str] = ["cardiac", "trauma", "stroke"]
NUM_HOSPITALS_MIN: int = 3
NUM_HOSPITALS_MAX: int = 5


@dataclass
class Hospital:
    """Metadata for one hospital node."""
    node: tuple[int, int]
    capacity: int                       # number of free beds
    specialties: list[str] = field(default_factory=list)


def build_city(
    rows: int = GRID_ROWS,
    cols: int = GRID_COLS,
    rng: np.random.Generator | None = None,
    seed: int | None = 42,
) -> tuple[nx.DiGraph, list[Hospital]]:
    """
    Build a directed grid-city graph and place hospitals.

    Args:
        rows:  Number of rows in the grid.
        cols:  Number of columns in the grid.
        rng:   Pre-created numpy Generator (takes priority over seed).
        seed:  Integer seed used if rng is None.

    Returns:
        graph:     Directed graph with edge and node attributes.
        hospitals: List of Hospital objects.
    """
    if rng is None:
        rng = np.random.default_rng(seed)

    graph = nx.DiGraph()

    # ── add nodes ────────────────────────────────────────────────────────────
    for r in range(rows):
        for c in range(cols):
            has_signal = rng.random() < SIGNAL_FRACTION
            # phase_offset randomises which part of the cycle each signal is in
            phase_offset = float(rng.uniform(0, SIGNAL_CYCLE_S)) if has_signal else 0.0
            graph.add_node(
                (r, c),
                has_signal=has_signal,
                phase_offset=phase_offset,   # seconds into cycle at t=0
                preempted=False,             # set True by preemption module
            )

    # ── add edges (bidirectional) ─────────────────────────────────────────────
    for r in range(rows):
        for c in range(cols):
            # horizontal neighbours
            if c + 1 < cols:
                _add_edge_pair(graph, (r, c), (r, c + 1), rng)
            # vertical neighbours
            if r + 1 < rows:
                _add_edge_pair(graph, (r, c), (r + 1, c), rng)

    # ── place hospitals ───────────────────────────────────────────────────────
    n_hospitals = int(rng.integers(NUM_HOSPITALS_MIN, NUM_HOSPITALS_MAX + 1))
    all_nodes = list(graph.nodes())
    chosen = [
        all_nodes[i]
        for i in rng.choice(len(all_nodes), size=n_hospitals, replace=False)
    ]

    hospitals: list[Hospital] = []
    for node in chosen:
        capacity = int(rng.integers(5, 25))
        n_specs = int(rng.integers(1, len(SPECIALTIES) + 1))
        specs = list(rng.choice(SPECIALTIES, size=n_specs, replace=False))
        hospitals.append(Hospital(node=node, capacity=capacity, specialties=specs))
        graph.nodes[node]["is_hospital"] = True
        graph.nodes[node]["hospital_capacity"] = capacity
        graph.nodes[node]["hospital_specialties"] = specs

    return graph, hospitals


def _add_edge_pair(
    graph: nx.DiGraph,
    u: tuple[int, int],
    v: tuple[int, int],
    rng: np.random.Generator,
) -> None:
    """Add a bidirectional road between u and v with random attributes."""
    speed_limit = int(rng.choice(SPEED_OPTIONS_KMH))
    attrs: dict[str, Any] = {
        "length": BLOCK_LENGTH_M,
        "speed_limit": float(speed_limit),
        "congestion": 0.0,    # set by traffic module
    }
    graph.add_edge(u, v, **attrs)
    graph.add_edge(v, u, **attrs)


# ── geometry helpers ──────────────────────────────────────────────────────────

def node_distance_m(u: tuple[int, int], v: tuple[int, int]) -> float:
    """Straight-line distance between two grid nodes in metres."""
    dr = (u[0] - v[0]) * BLOCK_LENGTH_M
    dc = (u[1] - v[1]) * BLOCK_LENGTH_M
    return math.hypot(dr, dc)


def signal_wait_time(graph: nx.DiGraph, node: tuple[int, int], t: float) -> float:
    """
    Expected red-phase wait at a signalised node at simulation time t.

    Args:
        graph: City graph.
        node:  Intersection to check.
        t:     Current simulation time in seconds.

    Returns:
        Seconds of wait (0 if green or no signal or preempted).
    """
    data = graph.nodes[node]
    if not data.get("has_signal", False):
        return 0.0
    if data.get("preempted", False):
        return 0.0
    phase = (t + data["phase_offset"]) % SIGNAL_CYCLE_S
    if phase < SIGNAL_GREEN_S:
        return 0.0          # currently green
    return SIGNAL_CYCLE_S - phase   # remaining red time
