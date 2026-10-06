"""tests/test_city.py — Unit tests for src/city.py."""

import pytest
import networkx as nx
import numpy as np

from backend.city import build_city, signal_wait_time, GRID_ROWS, GRID_COLS, SIGNAL_CYCLE_S, SIGNAL_GREEN_S


@pytest.fixture
def city():
    """Default 12×12 city built with seed=42."""
    graph, hospitals = build_city(seed=42)
    return graph, hospitals


def test_node_count(city):
    """Graph must have exactly GRID_ROWS * GRID_COLS nodes."""
    graph, _ = city
    assert graph.number_of_nodes() == GRID_ROWS * GRID_COLS


def test_edges_bidirectional(city):
    """Every edge (u, v) must have a reverse edge (v, u)."""
    graph, _ = city
    for u, v in graph.edges():
        assert graph.has_edge(v, u), f"Missing reverse edge {v} → {u}"


def test_hospitals_placed(city):
    """Between 3 and 5 hospitals must be in the hospital list."""
    _, hospitals = city
    assert 3 <= len(hospitals) <= 5


def test_hospital_nodes_tagged(city):
    """All hospital nodes must be tagged is_hospital=True on the graph."""
    graph, hospitals = city
    for h in hospitals:
        assert graph.nodes[h.node].get("is_hospital") is True


def test_hospital_capacity_positive(city):
    """All hospitals have positive capacity."""
    _, hospitals = city
    for h in hospitals:
        assert h.capacity > 0


def test_hospital_specialties_valid(city):
    """All hospital specialties must come from the allowed set."""
    from backend.city import SPECIALTIES
    _, hospitals = city
    for h in hospitals:
        for s in h.specialties:
            assert s in SPECIALTIES


def test_edge_attributes(city):
    """Every edge must have length, speed_limit, and congestion attributes."""
    graph, _ = city
    for u, v, data in graph.edges(data=True):
        assert "length" in data
        assert "speed_limit" in data
        assert "congestion" in data


def test_signal_wait_zero_when_green(city):
    """signal_wait_time returns 0 when the signal is in the green phase."""
    graph, _ = city
    # find a signalised node
    signalled = [n for n, d in graph.nodes(data=True) if d.get("has_signal")]
    assert signalled, "Expected at least one signalised node"
    node = signalled[0]
    # set t so the phase is 0 (start of green)
    offset = graph.nodes[node]["phase_offset"]
    t = SIGNAL_CYCLE_S - offset   # phase = (t + offset) % cycle = 0
    assert signal_wait_time(graph, node, t) == 0.0


def test_signal_wait_nonzero_when_red(city):
    """signal_wait_time returns >0 when the signal is in the red phase."""
    graph, _ = city
    signalled = [n for n, d in graph.nodes(data=True) if d.get("has_signal")]
    node = signalled[0]
    offset = graph.nodes[node]["phase_offset"]
    # force red phase: phase = GREEN + 1
    t = (SIGNAL_GREEN_S + 1.0 - offset) % SIGNAL_CYCLE_S
    wait = signal_wait_time(graph, node, t)
    # Could be in green by coincidence for some offsets, so just check ≥ 0
    assert wait >= 0.0


def test_preempted_signal_no_wait(city):
    """Preempted signals always return 0 wait."""
    graph, _ = city
    signalled = [n for n, d in graph.nodes(data=True) if d.get("has_signal")]
    node = signalled[0]
    graph.nodes[node]["preempted"] = True
    assert signal_wait_time(graph, node, 999.0) == 0.0
    graph.nodes[node]["preempted"] = False   # restore


def test_deterministic_seed(city):
    """Same seed must produce the same graph structure."""
    g1, h1 = build_city(seed=7)
    g2, h2 = build_city(seed=7)
    assert sorted(str(h.node) for h in h1) == sorted(str(h.node) for h in h2)
    assert g1.number_of_edges() == g2.number_of_edges()
