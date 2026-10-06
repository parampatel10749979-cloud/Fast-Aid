"""tests/test_routing.py — Unit tests for src/routing.py."""

import pytest
import networkx as nx

from backend.city import build_city
from backend.routing import dijkstra_route, astar_route, RouteResult


# ── tiny known graph fixture ──────────────────────────────────────────────────

@pytest.fixture
def tiny_graph():
    """
    A → B → C with distances 1, 2 and a longer A → C direct edge with distance 5.
    Shortest path A→C should go via B (cost 3).
    Nodes are tuples to match the city convention.
    """
    g = nx.DiGraph()
    a, b, c = (0, 0), (0, 1), (0, 2)
    g.add_node(a, has_signal=False, phase_offset=0.0, preempted=False)
    g.add_node(b, has_signal=False, phase_offset=0.0, preempted=False)
    g.add_node(c, has_signal=False, phase_offset=0.0, preempted=False)
    g.add_edge(a, b, length=100.0, speed_limit=60.0, congestion=0.0)
    g.add_edge(b, c, length=200.0, speed_limit=60.0, congestion=0.0)
    g.add_edge(a, c, length=500.0, speed_limit=60.0, congestion=0.0)
    return g, a, b, c


@pytest.fixture
def city_graph():
    """Standard 12×12 city."""
    graph, hospitals = build_city(seed=99)
    return graph, hospitals


# ── tiny graph tests ──────────────────────────────────────────────────────────

def test_dijkstra_tiny_graph_distance(tiny_graph):
    """Dijkstra finds the path via B (shorter distance) in distance mode."""
    g, a, b, c = tiny_graph
    result = dijkstra_route(g, a, c, mode="distance")
    assert result.path == [a, b, c], f"Expected [A,B,C], got {result.path}"
    assert abs(result.cost - 300.0) < 1e-6


def test_astar_tiny_graph_distance(tiny_graph):
    """A* finds the same path as Dijkstra on the tiny graph."""
    g, a, b, c = tiny_graph
    result = astar_route(g, a, c, mode="distance")
    assert result.path == [a, b, c]
    assert abs(result.cost - 300.0) < 1e-6


def test_dijkstra_astar_same_cost(city_graph):
    """Dijkstra and A* must return the same cost for the same src/dst."""
    graph, hospitals = city_graph
    src = (0, 0)
    dst = (11, 11)
    for mode in ("distance", "traffic", "smart"):
        d = dijkstra_route(graph, src, dst, mode=mode)
        a = astar_route(graph, src, dst, mode=mode)
        assert abs(d.cost - a.cost) < 1e-4, (
            f"Mode {mode}: Dijkstra cost {d.cost:.4f} ≠ A* cost {a.cost:.4f}"
        )


def test_path_endpoints(city_graph):
    """Path must start at src and end at dst."""
    graph, _ = city_graph
    src, dst = (1, 1), (10, 10)
    for fn in (dijkstra_route, astar_route):
        result = fn(graph, src, dst, mode="traffic")
        assert result.path[0] == src
        assert result.path[-1] == dst


def test_path_is_connected(city_graph):
    """Every consecutive pair of nodes in the path must be an edge in the graph."""
    graph, _ = city_graph
    result = dijkstra_route(graph, (0, 0), (11, 11), mode="smart")
    for u, v in zip(result.path[:-1], result.path[1:]):
        assert graph.has_edge(u, v), f"No edge {u}→{v} in path"


def test_nodes_expanded_astar_leq_dijkstra(city_graph):
    """A* should expand ≤ nodes than Dijkstra for the same query."""
    graph, _ = city_graph
    src, dst = (0, 0), (11, 11)
    d = dijkstra_route(graph, src, dst, mode="traffic")
    a = astar_route(graph, src, dst, mode="traffic")
    # A* should expand fewer or equal nodes (heuristic prunes the search)
    assert a.nodes_expanded <= d.nodes_expanded


def test_result_has_runtime(city_graph):
    """RouteResult must have a non-negative runtime_ms."""
    graph, _ = city_graph
    result = dijkstra_route(graph, (0, 0), (5, 5), mode="distance")
    assert result.runtime_ms >= 0.0


def test_same_src_dst_returns_trivial_path(city_graph):
    """Routing from a node to itself should return a single-node path."""
    graph, _ = city_graph
    result = dijkstra_route(graph, (3, 3), (3, 3), mode="distance")
    assert result.path == [(3, 3)]
    assert result.cost == 0.0


def test_deterministic_same_seed():
    """Same graph and seed → same route, same cost."""
    g1, _ = build_city(seed=11)
    g2, _ = build_city(seed=11)
    r1 = dijkstra_route(g1, (0, 0), (11, 11), mode="smart")
    r2 = dijkstra_route(g2, (0, 0), (11, 11), mode="smart")
    assert r1.path == r2.path
    assert abs(r1.cost - r2.cost) < 1e-9
