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
from typing import Literal

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
    node: tuple          # current node
    event: str           # 'move', 'signal_wait', 'preemption', 'reroute', 'arrive'
    detail: str = ""     # human-readable description


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


def run_ambulance(
    graph: nx.DiGraph,
    start: tuple[int, int],
    hospital_node: tuple[int, int],
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
    preempted_nodes: list[tuple] = []

    if start == hospital_node:
        return TripResult(
            mode=mode, algorithm=algorithm, preemption_on=preemption,
            total_time=0.0, total_distance=0.0, reroutes=0,
            signal_stops=0, signal_wait=0.0,
            path=[start], trajectory=[],
        )

    current_node = start
    path_taken: list[tuple] = [start]

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
                    trajectory.append(TripEvent(
                        time=sim_time, node=current_node, event="reroute",
                        detail=f"Rerouted (reroute #{reroutes})",
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
                trajectory.append(TripEvent(
                    time=sim_time, node=current_node, event="preemption",
                    detail=f"Preempted signals: {new_preempted}",
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
            trajectory.append(TripEvent(
                time=sim_time, node=current_node, event="signal_wait",
                detail=f"Red signal: waited {wait:.1f}s",
            ))

        # ── traverse edge ─────────────────────────────────────────────────────
        if not graph.has_edge(current_node, next_node):
            # edge disappeared (shouldn't happen in a static grid); abort
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

        trajectory.append(TripEvent(
            time=sim_time, node=next_node, event="move",
            detail=f"Moved {current_node}→{next_node} in {t_edge:.1f}s",
        ))

        current_node = next_node
        path_taken.append(current_node)
        route_idx += 1

    # ── restore all preemptions ───────────────────────────────────────────────
    restore_signals(graph, preempted_nodes)
    clear_all_preemptions(graph)

    trajectory.append(TripEvent(
        time=sim_time, node=current_node, event="arrive",
        detail="Arrived at hospital",
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
