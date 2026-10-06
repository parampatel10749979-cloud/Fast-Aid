"""tests/test_preemption.py — Unit tests for src/preemption.py."""

import pytest
import networkx as nx

from backend.city import build_city, signal_wait_time
from backend.preemption import preempt_signals, restore_signals, clear_all_preemptions


@pytest.fixture
def city():
    graph, hospitals = build_city(seed=42)
    return graph, hospitals


def test_preempted_signals_return_zero_wait(city):
    """With preemption on, signal_wait_time must be 0 at preempted nodes."""
    graph, _ = city
    # build a simple route across the whole grid
    route = [(r, 0) for r in range(12)]
    preempted = preempt_signals(graph, route, current_idx=0, lookahead=3)
    for node in preempted:
        # regardless of time, preempted node must return 0
        assert signal_wait_time(graph, node, t=999.0) == 0.0


def test_preempt_respects_lookahead(city):
    """preempt_signals must preempt at most `lookahead` signals."""
    graph, _ = city
    route = [(r, 0) for r in range(12)]
    for lookahead in (1, 2, 3):
        clear_all_preemptions(graph)
        preempted = preempt_signals(graph, route, current_idx=0, lookahead=lookahead)
        assert len(preempted) <= lookahead


def test_restore_signals(city):
    """restore_signals must clear the preempted flag."""
    graph, _ = city
    route = [(r, 0) for r in range(12)]
    preempted = preempt_signals(graph, route, current_idx=0)
    restore_signals(graph, preempted)
    for node in preempted:
        assert graph.nodes[node]["preempted"] is False


def test_clear_all_preemptions(city):
    """clear_all_preemptions resets every node in the graph."""
    graph, _ = city
    # manually preempt some nodes
    for node in list(graph.nodes())[:10]:
        graph.nodes[node]["preempted"] = True
    clear_all_preemptions(graph)
    for node in graph.nodes():
        assert graph.nodes[node]["preempted"] is False


def test_preempt_only_signalised_nodes(city):
    """preempt_signals must only preempt nodes that have has_signal=True."""
    graph, _ = city
    route = [(r, 0) for r in range(12)]
    preempted = preempt_signals(graph, route, current_idx=0)
    for node in preempted:
        assert graph.nodes[node].get("has_signal") is True


def test_no_preemption_beyond_route_end(city):
    """preempt_signals must not go past the end of the route."""
    graph, _ = city
    short_route = [(0, 0), (0, 1), (0, 2)]
    preempted = preempt_signals(graph, short_route, current_idx=1, lookahead=10)
    # only one node ahead: (0, 2)
    assert all(n in short_route for n in preempted)
