"""tests/test_traffic.py — Unit tests for src/traffic.py."""

import pytest
import numpy as np
import networkx as nx

from backend.city import build_city
from backend.traffic import TrafficEngine, SCENARIOS, travel_time_s


@pytest.fixture
def engine():
    graph, _ = build_city(seed=0)
    return graph, TrafficEngine(graph, scenario="Moderate", seed=0)


def test_congestion_in_bounds_after_init(engine):
    """All edge congestion values must be in [0, 1] after initialisation."""
    graph, _ = engine
    for u, v, data in graph.edges(data=True):
        assert 0.0 <= data["congestion"] <= 1.0, f"Edge {u}→{v} out of bounds"


def test_congestion_in_bounds_after_steps(engine):
    """Congestion stays in [0, 1] after 100 time steps."""
    graph, eng = engine
    for _ in range(100):
        eng.step(dt=1.0)
    for u, v, data in graph.edges(data=True):
        assert 0.0 <= data["congestion"] <= 1.0


def test_scenario_light_lower_than_gridlock():
    """Light scenario initialises lower average congestion than Gridlock."""
    g1, _ = build_city(seed=1)
    g2, _ = build_city(seed=1)
    TrafficEngine(g1, scenario="Light",    seed=1)
    TrafficEngine(g2, scenario="Gridlock", seed=1)
    avg_light    = np.mean([d["congestion"] for _, _, d in g1.edges(data=True)])
    avg_gridlock = np.mean([d["congestion"] for _, _, d in g2.edges(data=True)])
    assert avg_light < avg_gridlock


def test_apply_scenario_changes_congestion(engine):
    """apply_scenario should shift congestion toward the new base."""
    graph, eng = engine
    eng.apply_scenario("Gridlock")
    avg = np.mean([d["congestion"] for _, _, d in graph.edges(data=True)])
    # Gridlock base is 0.85; average should be above moderate (0.30)
    assert avg > 0.50


def test_travel_time_increases_with_congestion():
    """Higher congestion must yield a longer travel time."""
    t_low  = travel_time_s(200.0, 60.0, 0.1)
    t_high = travel_time_s(200.0, 60.0, 0.9)
    assert t_high > t_low


def test_travel_time_ambulance_faster():
    """Ambulance (siren) travel time must be shorter than a normal car."""
    t_car = travel_time_s(200.0, 60.0, 0.5, ambulance=False)
    t_amb = travel_time_s(200.0, 60.0, 0.5, ambulance=True)
    assert t_amb < t_car


def test_travel_time_minimum_speed():
    """Even at maximum congestion, travel time is finite (minimum speed = 3 km/h)."""
    t = travel_time_s(200.0, 60.0, 1.0)
    assert t < 1e6   # finite


def test_deterministic_step_same_seed():
    """Same seed produces the same congestion sequence."""
    g1, _ = build_city(seed=5)
    g2, _ = build_city(seed=5)
    e1 = TrafficEngine(g1, scenario="Moderate", seed=5)
    e2 = TrafficEngine(g2, scenario="Moderate", seed=5)
    for _ in range(10):
        e1.step()
        e2.step()
    for (u, v) in g1.edges():
        assert abs(g1[u][v]["congestion"] - g2[u][v]["congestion"]) < 1e-9


def test_sim_time_advances(engine):
    """sim_time property increases by dt each step."""
    _, eng = engine
    assert eng.sim_time == 0.0
    eng.step(dt=5.0)
    assert abs(eng.sim_time - 5.0) < 1e-9
