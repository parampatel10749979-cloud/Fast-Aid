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


from pathlib import Path

@dataclass
class Hospital:
    """Metadata for one hospital node."""
    node: Any
    capacity: int                       # number of free beds
    specialties: list[str] = field(default_factory=list)
    id: str = ""
    name: str = ""
    lat: float = 0.0
    lon: float = 0.0


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


# ── graphml loader & cache ───────────────────────────────────────────────────
_CACHED_GRAPH: nx.DiGraph | None = None
_CACHED_HOSPITALS: list[Hospital] | None = None


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Haversine distance between two lat/lon coordinates in metres."""
    R = 6371000.0  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = (math.sin(delta_phi / 2.0) ** 2 +
         math.cos(phi1) * math.cos(phi2) * (math.sin(delta_lambda / 2.0) ** 2))
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c


def load_city(
    path: str | Path = "backend/data/city_graph.graphml",
    reload: bool = False,
) -> tuple[nx.DiGraph, list[Hospital]]:
    """
    Load static city road network from GraphML file.
    Caches the loaded graph in memory for fast reuse.

    Args:
        path:   Path to city_graph.graphml file.
        reload: If True, bypass cache and reload from disk.

    Returns:
        graph:     DiGraph with typed edge/node attributes.
        hospitals: List of Hospital objects.
    """
    global _CACHED_GRAPH, _CACHED_HOSPITALS
    if _CACHED_GRAPH is not None and not reload:
        return _CACHED_GRAPH.copy(), list(_CACHED_HOSPITALS or [])

    file_path = Path(path)
    if not file_path.exists():
        graph, hospitals = build_city()
        _CACHED_GRAPH = graph
        _CACHED_HOSPITALS = hospitals
        return graph.copy(), list(hospitals)

    raw_graph = nx.read_graphml(file_path)
    graph = nx.DiGraph()
    hospitals: list[Hospital] = []

    for node_id, data in raw_graph.nodes(data=True):
        lat = float(data.get("lat", 37.78))
        lon = float(data.get("lon", -122.40))
        has_signal = data.get("has_signal", False)
        if isinstance(has_signal, str):
            has_signal = has_signal.lower() in ("true", "1")
        phase_offset = float(data.get("phase_offset", 0.0))
        preempted = data.get("preempted", False)
        if isinstance(preempted, str):
            preempted = preempted.lower() in ("true", "1")
        is_hospital = data.get("is_hospital", False)
        if isinstance(is_hospital, str):
            is_hospital = is_hospital.lower() in ("true", "1")

        hosp_cap = int(data.get("hospital_capacity", 0))
        hosp_id = str(data.get("hospital_id", ""))
        hosp_name = str(data.get("hospital_name", ""))
        specs_raw = str(data.get("hospital_specialties", ""))
        specialties = [s.strip() for s in specs_raw.split(",") if s.strip()]

        graph.add_node(
            node_id,
            lat=lat,
            lon=lon,
            row=int(data.get("row", 0)),
            col=int(data.get("col", 0)),
            has_signal=bool(has_signal),
            phase_offset=float(phase_offset),
            preempted=bool(preempted),
            is_hospital=bool(is_hospital),
            hospital_id=hosp_id,
            hospital_name=hosp_name,
            hospital_capacity=hosp_cap,
            hospital_specialties=specialties,
            intersection_label=str(data.get("intersection_label", node_id)),
        )

        if is_hospital:
            hospitals.append(Hospital(
                node=node_id,
                capacity=hosp_cap,
                specialties=specialties,
                id=hosp_id,
                name=hosp_name,
                lat=lat,
                lon=lon,
            ))

    for u, v, data in raw_graph.edges(data=True):
        graph.add_edge(
            u,
            v,
            length=float(data.get("length", BLOCK_LENGTH_M)),
            speed_limit=float(data.get("speed_limit", 40.0)),
            congestion=float(data.get("congestion", 0.0)),
            name=str(data.get("name", "City Street")),
        )

    _CACHED_GRAPH = graph
    _CACHED_HOSPITALS = hospitals
    return graph.copy(), list(hospitals)


# ── geometry helpers ──────────────────────────────────────────────────────────

def node_distance_m(
    u: tuple[int, int] | str,
    v: tuple[int, int] | str,
    graph: nx.DiGraph | None = None,
) -> float:
    """Straight-line distance between two nodes in metres (grid or lat/lon)."""
    # 1. Graph lookup if available
    g = graph or _CACHED_GRAPH
    if g is not None and g.has_node(u) and g.has_node(v):
        u_d = g.nodes[u]
        v_d = g.nodes[v]
        if "lat" in u_d and "lon" in u_d and "lat" in v_d and "lon" in v_d:
            return haversine_m(float(u_d["lat"]), float(u_d["lon"]), float(v_d["lat"]), float(v_d["lon"]))

    # 2. String node format "n_r_c" fallback
    if isinstance(u, str) and u.startswith("n_") and isinstance(v, str) and v.startswith("n_"):
        parts_u = u.split("_")
        parts_v = v.split("_")
        if len(parts_u) >= 3 and len(parts_v) >= 3:
            ru, cu = int(parts_u[1]), int(parts_u[2])
            rv, cv = int(parts_v[1]), int(parts_v[2])
            dr = (ru - rv) * BLOCK_LENGTH_M
            dc = (cu - cv) * BLOCK_LENGTH_M
            return math.hypot(dr, dc)

    # 3. Tuple (row, col) grid format
    if isinstance(u, (tuple, list)) and isinstance(v, (tuple, list)):
        dr = (u[0] - v[0]) * BLOCK_LENGTH_M
        dc = (u[1] - v[1]) * BLOCK_LENGTH_M
        return math.hypot(dr, dc)

    return 0.0


def signal_wait_time(graph: nx.DiGraph, node: tuple[int, int] | str, t: float) -> float:
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
    has_sig = data.get("has_signal", False)
    if isinstance(has_sig, str):
        has_sig = has_sig.lower() in ("true", "1")
    if not has_sig:
        return 0.0

    preempted = data.get("preempted", False)
    if isinstance(preempted, str):
        preempted = preempted.lower() in ("true", "1")
    if preempted:
        return 0.0

    phase_offset = float(data.get("phase_offset", 0.0))
    phase = (t + phase_offset) % SIGNAL_CYCLE_S
    if phase < SIGNAL_GREEN_S:
        return 0.0          # currently green
    return SIGNAL_CYCLE_S - phase   # remaining red time
