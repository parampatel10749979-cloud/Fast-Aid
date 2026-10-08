"""
simulation.py — Run one ambulance trip from start to hospital.

The simulation moves the ambulance edge-by-edge.
At each node:
  - If preemption is on, the next LOOKAHEAD signals are set green.
  - If a red signal is encountered (preemption off), the ambulance waits.
  - In traffic / smart modes, the route is recomputed every reroute_interval seconds.

Returns a rich result dict with metrics and a full trajectory log.
No global mutable state; graph and RNG are passed explicitly.
"""

from __future__ import annotations

import copy
from dataclasses import dataclass, field
from typing import Any, Literal

import networkx as nx
import numpy as np

from backend.city import signal_wait_time
from backend.preemption import preempt_signals, restore_signals, clear_all_preemptions
from backend.routing import dijkstra_route, astar_route, RoutingMode
from backend.traffic import travel_time_s

Algorithm = Literal["dijkstra", "astar"]


@dataclass
class TripEvent:
    """One event in the trajectory log."""
    time: float          # simulation time when event occurred
    node: Any            # current node
    event: str           # 'move', 'signal_wait', 'preemption', 'reroute', 'arrive'
    detail: str = ""     # human-readable description
    lat: float = 0.0     # latitude
    lon: float = 0.0     # longitude
    speed_kmh: float = 0.0 # ambulance travel speed


@dataclass
class TripResult:
    """Full result of one ambulance trip."""
    mode: RoutingMode
    algorithm: Algorithm
    preemption_on: bool
    total_time: float           # seconds
    total_distance: float       # metres
    reroutes: int
    signal_stops: int
    signal_wait: float          # total seconds spent waiting at red
    path: list[tuple]           # final path taken
    trajectory: list[TripEvent] = field(default_factory=list)


def get_node_coords(graph: nx.DiGraph, node: Any) -> tuple[float, float]:
    """Retrieve (lat, lon) for a node."""
    if graph.has_node(node):
        d = graph.nodes[node]
        if "lat" in d and "lon" in d:
            return float(d["lat"]), float(d["lon"])
    if isinstance(node, (tuple, list)) and len(node) == 2:
        return 37.7808 + node[0] * 0.0018, -122.4185 + node[1] * 0.0023
    return 37.7808, -122.4185


def run_ambulance(
    graph: nx.DiGraph,
    start: tuple[int, int] | str,
    hospital_node: tuple[int, int] | str,
    mode: RoutingMode = "smart",
    algorithm: Algorithm = "dijkstra",
    preemption: bool = True,
    reroute_interval: float = 15.0,
    seed: int | None = None,
) -> TripResult:
    """
    Simulate one ambulance trip.

    Args:
        graph:            City DiGraph with current congestion.
        start:            Starting node.
        hospital_node:    Destination node.
        mode:             Routing cost mode.
        algorithm:        'dijkstra' or 'astar'.
        preemption:       Whether signal preemption is active.
        reroute_interval: Recompute route every this many seconds (traffic/smart).
        seed:             Unused here (congestion already set on graph). Kept for API.

    Returns:
        TripResult with all metrics and trajectory log.
    """
    # clear any preemptions from a previous run
    clear_all_preemptions(graph)

    _route_fn = dijkstra_route if algorithm == "dijkstra" else astar_route

    # ── initial route ─────────────────────────────────────────────────────────
    route_result = _route_fn(graph, start, hospital_node, mode=mode, sim_time=0.0)
    route = route_result.path

    sim_time: float = 0.0
    total_distance: float = 0.0
    reroutes: int = 0
    signal_stops: int = 0
    signal_wait_total: float = 0.0
    trajectory: list[TripEvent] = []
    last_reroute_time: float = 0.0
    preempted_nodes: list[Any] = []

    start_lat, start_lon = get_node_coords(graph, start)

    if start == hospital_node:
        return TripResult(
            mode=mode, algorithm=algorithm, preemption_on=preemption,
            total_time=0.0, total_distance=0.0, reroutes=0,
            signal_stops=0, signal_wait=0.0,
            path=[start],
            trajectory=[TripEvent(
                time=0.0, node=start, event="arrive", detail="Already at hospital",
                lat=start_lat, lon=start_lon, speed_kmh=0.0
            )],
        )

    # Initial dispatch event
    trajectory.append(TripEvent(
        time=0.0, node=start, event="dispatch", detail=f"Dispatched via {mode} mode",
        lat=start_lat, lon=start_lon, speed_kmh=0.0
    ))

    current_node = start
    path_taken: list[Any] = [start]

    # ── walk edge by edge ─────────────────────────────────────────────────────
    route_idx = 0   # index of current_node in route

    while current_node != hospital_node:
        # ── reroute check ─────────────────────────────────────────────────────
        should_reroute = (
            mode in ("traffic", "smart")
            and (sim_time - last_reroute_time) >= reroute_interval
            and reroutes < 50   # safety cap
        )
        if should_reroute:
            try:
                new_result = _route_fn(
                    graph, current_node, hospital_node, mode=mode, sim_time=sim_time
                )
                if new_result.path != route[route_idx:]:
                    reroutes += 1
                    cur_lat, cur_lon = get_node_coords(graph, current_node)
                    trajectory.append(TripEvent(
                        time=sim_time, node=current_node, event="reroute",
                        detail=f"Dynamic reroute #{reroutes} around congestion",
                        lat=cur_lat, lon=cur_lon, speed_kmh=0.0
                    ))
                route = new_result.path
                route_idx = 0
            except ValueError:
                pass   # keep old route if reroute fails
            last_reroute_time = sim_time

        # ── preempt upcoming signals ──────────────────────────────────────────
        if preemption:
            # restore signals we already passed
            passed = [n for n in preempted_nodes if n in path_taken]
            restore_signals(graph, passed)
            preempted_nodes = [n for n in preempted_nodes if n not in passed]
            # preempt ahead
            new_preempted = preempt_signals(graph, route, route_idx)
            preempted_nodes.extend(new_preempted)
            if new_preempted:
                cur_lat, cur_lon = get_node_coords(graph, current_node)
                trajectory.append(TripEvent(
                    time=sim_time, node=current_node, event="preemption",
                    detail=f"Green Wave activated for {len(new_preempted)} upcoming signals",
                    lat=cur_lat, lon=cur_lon, speed_kmh=0.0
                ))

        # ── get next node ─────────────────────────────────────────────────────
        if route_idx + 1 >= len(route):
            break   # reached destination

        next_node = route[route_idx + 1]

        # ── signal wait at current node (before moving) ───────────────────────
        wait = signal_wait_time(graph, current_node, sim_time)
        if wait > 0:
            signal_stops += 1
            signal_wait_total += wait
            sim_time += wait
            cur_lat, cur_lon = get_node_coords(graph, current_node)
            trajectory.append(TripEvent(
                time=sim_time, node=current_node, event="signal_wait",
                detail=f"Red light wait: {wait:.1f}s",
                lat=cur_lat, lon=cur_lon, speed_kmh=0.0
            ))

        # ── traverse edge ─────────────────────────────────────────────────────
        if not graph.has_edge(current_node, next_node):
            break

        edge_data = graph[current_node][next_node]
        t_edge = travel_time_s(
            edge_data["length"],
            edge_data["speed_limit"],
            edge_data["congestion"],
            ambulance=True,
        )
        sim_time += t_edge
        total_distance += edge_data["length"]

        nxt_lat, nxt_lon = get_node_coords(graph, next_node)
        speed_kmh = (edge_data["length"] / t_edge) * 3.6 if t_edge > 0 else 0.0

        trajectory.append(TripEvent(
            time=sim_time, node=next_node, event="move",
            detail=f"En route to {next_node} ({speed_kmh:.1f} km/h)",
            lat=nxt_lat, lon=nxt_lon, speed_kmh=speed_kmh
        ))

        current_node = next_node
        path_taken.append(current_node)
        route_idx += 1

    # ── restore all preemptions ───────────────────────────────────────────────
    restore_signals(graph, preempted_nodes)
    clear_all_preemptions(graph)

    end_lat, end_lon = get_node_coords(graph, current_node)
    trajectory.append(TripEvent(
        time=sim_time, node=current_node, event="arrive",
        detail="Arrived safely at destination hospital",
        lat=end_lat, lon=end_lon, speed_kmh=0.0
    ))

    return TripResult(
        mode=mode,
        algorithm=algorithm,
        preemption_on=preemption,
        total_time=sim_time,
        total_distance=total_distance,
        reroutes=reroutes,
        signal_stops=signal_stops,
        signal_wait=signal_wait_total,
        path=path_taken,
        trajectory=trajectory,
    )


def serialize_trip_result(result: TripResult, graph: nx.DiGraph) -> dict:
    """Serialize TripResult to JSON-friendly dictionary."""
    path_coords = [list(get_node_coords(graph, n)) for n in result.path]
    traj_list = [
        {
            "t": round(e.time, 2),
            "lat": round(e.lat, 6),
            "lon": round(e.lon, 6),
            "event": e.event,
            "detail": e.detail,
            "speed_kmh": round(e.speed_kmh, 1),
            "node": str(e.node),
        }
        for e in result.trajectory
    ]
    return {
        "mode": result.mode,
        "algorithm": result.algorithm,
        "preemption_on": result.preemption_on,
        "total_time_s": round(result.total_time, 2),
        "total_distance_m": round(result.total_distance, 1),
        "reroutes": result.reroutes,
        "signal_stops": result.signal_stops,
        "signal_wait_s": round(result.signal_wait, 2),
        "path": [str(n) for n in result.path],
        "polyline": path_coords,
        "trajectory": traj_list,
    }


def run_all_modes_comparison(
    graph: nx.DiGraph,
    start: tuple[int, int] | str,
    hospital_node: tuple[int, int] | str,
    algorithm: Algorithm = "dijkstra",
    reroute_interval: float = 15.0,
) -> dict:
    """
    Run simulation for Baseline, Traffic-Aware, and Smart modes synchronously.
    Returns full bundle for frontend dispatch animation and comparison.
    """
    # 1. Baseline: distance mode, no preemption, no rerouting
    res_baseline = run_ambulance(
        graph, start, hospital_node,
        mode="distance", algorithm=algorithm, preemption=False,
        reroute_interval=999999.0
    )

    # 2. Traffic-Aware: live congestion, no preemption, 15s rerouting
    res_traffic = run_ambulance(
        graph, start, hospital_node,
        mode="traffic", algorithm=algorithm, preemption=False,
        reroute_interval=reroute_interval
    )

    # 3. Fast-Aid Smart: traffic + signal penalty + preemption + 15s rerouting
    res_smart = run_ambulance(
        graph, start, hospital_node,
        mode="smart", algorithm=algorithm, preemption=True,
        reroute_interval=reroute_interval
    )

    ser_baseline = serialize_trip_result(res_baseline, graph)
    ser_traffic = serialize_trip_result(res_traffic, graph)
    ser_smart = serialize_trip_result(res_smart, graph)

    saved_s = max(0.0, ser_baseline["total_time_s"] - ser_smart["total_time_s"])
    saved_pct = (saved_s / ser_baseline["total_time_s"] * 100) if ser_baseline["total_time_s"] > 0 else 0.0

    return {
        "active_trip": ser_smart,  # Primary trip to animate
        "routes": {
            "baseline": ser_baseline["polyline"],
            "traffic": ser_traffic["polyline"],
            "smart": ser_smart["polyline"],
        },
        "comparison": {
            "baseline": ser_baseline,
            "traffic": ser_traffic,
            "smart": ser_smart,
            "time_saved_s": round(saved_s, 2),
            "time_saved_pct": round(saved_pct, 1),
        }
    }

