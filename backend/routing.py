"""
routing.py — Dijkstra and A* routing with three cost modes.

Modes:
  distance  — cost = edge length in metres
  traffic   — cost = ambulance travel time (seconds)
  smart     — cost = travel time + expected signal wait at destination node

Both algorithms use their own heap implementations (heapq).
No networkx shortest-path functions are used.
"""

from __future__ import annotations

import heapq
import math
import time
from dataclasses import dataclass, field
from typing import Literal

import networkx as nx

from backend.city import node_distance_m, signal_wait_time, MAX_SPEED_KMH_FOR_HEURISTIC
from backend.traffic import travel_time_s, KMH_TO_MS

RoutingMode = Literal["distance", "traffic", "smart"]

MAX_SPEED_MS: float = 60.0 * KMH_TO_MS   # used in A* heuristic


@dataclass
class RouteResult:
    """Result returned by dijkstra_route / astar_route."""
    path: list[tuple[int, int]]
    cost: float                 # total cost in the chosen mode's units
    nodes_expanded: int
    runtime_ms: float


# ── edge cost ─────────────────────────────────────────────────────────────────

def edge_cost(
    graph: nx.DiGraph,
    u: tuple[int, int],
    v: tuple[int, int],
    mode: RoutingMode,
    sim_time: float = 0.0,
) -> float:
    """
    Cost of traversing edge (u → v) under the given mode.

    Args:
        graph:    City graph with current congestion values.
        u, v:     Source and destination nodes.
        mode:     Routing cost mode.
        sim_time: Current simulation time (seconds), used for signal phase.

    Returns:
        Non-negative cost in mode-appropriate units.
    """
    data = graph[u][v]
    if mode == "distance":
        return float(data["length"])

    # traffic and smart: use ambulance travel time
    t = travel_time_s(
        data["length"],
        data["speed_limit"],
        data["congestion"],
        ambulance=True,
    )
    if mode == "smart":
        # add expected signal wait at the destination node
        t += signal_wait_time(graph, v, sim_time + t)
    return t


# ── Dijkstra ──────────────────────────────────────────────────────────────────

def dijkstra_route(
    graph: nx.DiGraph,
    src: tuple[int, int],
    dst: tuple[int, int],
    mode: RoutingMode = "smart",
    sim_time: float = 0.0,
) -> RouteResult:
    """
    Find the lowest-cost path from src to dst using Dijkstra's algorithm.

    Args:
        graph:    City graph.
        src:      Start node.
        dst:      Destination node.
        mode:     Cost mode ('distance', 'traffic', 'smart').
        sim_time: Current simulation time in seconds.

    Returns:
        RouteResult with path, cost, nodes_expanded, runtime_ms.

    Raises:
        ValueError: If dst is unreachable from src.
    """
    t0 = time.perf_counter()

    dist: dict[tuple, float] = {src: 0.0}
    prev: dict[tuple, tuple | None] = {src: None}
    # heap entries: (cost, node)
    heap: list[tuple[float, tuple]] = [(0.0, src)]
    visited: set[tuple] = set()
    nodes_expanded = 0

    while heap:
        cost_u, u = heapq.heappop(heap)
        if u in visited:
            continue
        visited.add(u)
        nodes_expanded += 1

        if u == dst:
            break

        for v in graph.successors(u):
            if v in visited:
                continue
            c = cost_u + edge_cost(graph, u, v, mode, sim_time + cost_u)
            if c < dist.get(v, math.inf):
                dist[v] = c
                prev[v] = u
                heapq.heappush(heap, (c, v))

    if dst not in dist:
        raise ValueError(f"No path from {src} to {dst}")

    path = _reconstruct(prev, dst)
    runtime_ms = (time.perf_counter() - t0) * 1000
    return RouteResult(path=path, cost=dist[dst], nodes_expanded=nodes_expanded, runtime_ms=runtime_ms)


# ── A* ────────────────────────────────────────────────────────────────────────

def astar_route(
    graph: nx.DiGraph,
    src: tuple[int, int],
    dst: tuple[int, int],
    mode: RoutingMode = "smart",
    sim_time: float = 0.0,
) -> RouteResult:
    """
    Find the lowest-cost path from src to dst using A*.

    Heuristic: straight-line distance / max_speed (admissible, consistent).

    Args:
        graph:    City graph.
        src:      Start node.
        dst:      Destination node.
        mode:     Cost mode ('distance', 'traffic', 'smart').
        sim_time: Current simulation time in seconds.

    Returns:
        RouteResult with path, cost, nodes_expanded, runtime_ms.

    Raises:
        ValueError: If dst is unreachable from src.
    """
    t0 = time.perf_counter()

    def heuristic(n: tuple[int, int]) -> float:
        d = node_distance_m(n, dst)
        if mode == "distance":
            return d
        return d / MAX_SPEED_MS   # lower-bound travel time in seconds

    g_score: dict[tuple, float] = {src: 0.0}
    prev: dict[tuple, tuple | None] = {src: None}
    heap: list[tuple[float, tuple]] = [(heuristic(src), src)]
    visited: set[tuple] = set()
    nodes_expanded = 0

    while heap:
        _, u = heapq.heappop(heap)
        if u in visited:
            continue
        visited.add(u)
        nodes_expanded += 1

        if u == dst:
            break

        g_u = g_score[u]
        for v in graph.successors(u):
            if v in visited:
                continue
            tentative = g_u + edge_cost(graph, u, v, mode, sim_time + g_u)
            if tentative < g_score.get(v, math.inf):
                g_score[v] = tentative
                prev[v] = u
                f = tentative + heuristic(v)
                heapq.heappush(heap, (f, v))

    if dst not in g_score:
        raise ValueError(f"No path from {src} to {dst}")

    path = _reconstruct(prev, dst)
    runtime_ms = (time.perf_counter() - t0) * 1000
    return RouteResult(path=path, cost=g_score[dst], nodes_expanded=nodes_expanded, runtime_ms=runtime_ms)


# ── path helper ───────────────────────────────────────────────────────────────

def _reconstruct(
    prev: dict[tuple, tuple | None],
    dst: tuple[int, int],
) -> list[tuple[int, int]]:
    """Walk the prev-pointer map to reconstruct the path."""
    path = []
    node: tuple | None = dst
    while node is not None:
        path.append(node)
        node = prev.get(node)
    path.reverse()
    return path
