"""tests/test_simulation.py — Unit tests for src/simulation.py."""

import pytest
import numpy as np

from src.city import build_city
from src.hospitals import select_hospital
from src.simulation import run_ambulance, TripResult
from src.traffic import TrafficEngine


@pytest.fixture
def setup():
    """Build a city with Moderate traffic and return graph + a valid hospital."""
    graph, hospitals = build_city(seed=42)
    TrafficEngine(graph, scenario="Moderate", seed=42)  # init congestion
    hospital = select_hospital(graph, (0, 0), hospitals)
    return graph, hospitals, hospital


def test_trip_completes(setup):
    """run_ambulance must return a TripResult and arrive at the hospital."""
    graph, _, hospital = setup
    result = run_ambulance(graph, (0, 0), hospital.node, mode="smart", preemption=True)
    assert isinstance(result, TripResult)
    assert result.path[-1] == hospital.node


def test_total_time_positive(setup):
    """Total trip time must be > 0."""
    graph, _, hospital = setup
    result = run_ambulance(graph, (0, 0), hospital.node, mode="distance", preemption=False)
    assert result.total_time > 0


def test_preemption_reduces_signal_wait(setup):
    """Preemption ON total_time must be ≤ preemption OFF on the same smart mode."""
    graph, _, hospital = setup
    r_off = run_ambulance(graph, (0, 0), hospital.node, mode="smart", preemption=False)
    r_on  = run_ambulance(graph, (0, 0), hospital.node, mode="smart", preemption=True)
    # preemption eliminates red-light waits → total time must not increase
    assert r_on.total_time <= r_off.total_time + 1e-6


def test_same_seed_same_result(setup):
    """Same graph and same seed → identical total_time."""
    graph1, hospitals1 = build_city(seed=7)
    graph2, hospitals2 = build_city(seed=7)
    TrafficEngine(graph1, scenario="Heavy", seed=7)
    TrafficEngine(graph2, scenario="Heavy", seed=7)
    h1 = select_hospital(graph1, (0, 0), hospitals1)
    h2 = select_hospital(graph2, (0, 0), hospitals2)
    r1 = run_ambulance(graph1, (0, 0), h1.node, mode="smart", preemption=True)
    r2 = run_ambulance(graph2, (0, 0), h2.node, mode="smart", preemption=True)
    assert abs(r1.total_time - r2.total_time) < 1e-6


def test_smart_not_slower_than_baseline_90pct():
    """Smart mode must be ≤ baseline in at least 90% of trials."""
    rng = np.random.default_rng(0)
    graph, hospitals = build_city(seed=42)
    TrafficEngine(graph, scenario="Heavy", seed=0)
    nodes = list(graph.nodes())
    n_trials = 50
    smart_wins = 0

    for _ in range(n_trials):
        start = nodes[int(rng.integers(0, len(nodes)))]
        hospital = select_hospital(graph, start, hospitals)
        if hospital is None or hospital.node == start:
            continue
        base  = run_ambulance(graph, start, hospital.node, mode="distance", preemption=False)
        smart = run_ambulance(graph, start, hospital.node, mode="smart",    preemption=True)
        if smart.total_time <= base.total_time + 1e-6:
            smart_wins += 1

    valid_trials = n_trials
    assert smart_wins / valid_trials >= 0.90, (
        f"Smart won only {smart_wins}/{valid_trials} trials ({smart_wins/valid_trials:.0%})"
    )


def test_traffic_mode_reroutes(setup):
    """Traffic/smart modes should perform at least 0 reroutes (no crash)."""
    graph, _, hospital = setup
    result = run_ambulance(
        graph, (0, 0), hospital.node, mode="traffic",
        preemption=False, reroute_interval=15.0,
    )
    assert result.reroutes >= 0


def test_baseline_no_reroutes(setup):
    """Baseline (distance, no rerouting) should have 0 reroutes."""
    graph, _, hospital = setup
    result = run_ambulance(
        graph, (0, 0), hospital.node, mode="distance",
        preemption=False, reroute_interval=15.0,
    )
    assert result.reroutes == 0


def test_path_connected(setup):
    """Every consecutive pair of nodes in path_taken must be a graph edge."""
    graph, _, hospital = setup
    result = run_ambulance(graph, (0, 0), hospital.node, mode="smart", preemption=True)
    for u, v in zip(result.path[:-1], result.path[1:]):
        assert graph.has_edge(u, v), f"No edge {u}→{v} in trip path"


def test_trajectory_has_arrive_event(setup):
    """The trajectory log must end with an 'arrive' event."""
    graph, _, hospital = setup
    result = run_ambulance(graph, (0, 0), hospital.node, mode="smart", preemption=True)
    assert result.trajectory[-1].event == "arrive"
