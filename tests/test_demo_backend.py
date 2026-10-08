"""
test_demo_backend.py — Test static city graph loading, simulation bundle, and REST API.
"""

import pytest
from fastapi.testclient import TestClient
from backend.city import load_city, node_distance_m, signal_wait_time
from backend.simulation import run_all_modes_comparison, run_ambulance
from backend.main import app


def test_load_city_structure():
    graph, hospitals = load_city()
    assert graph.number_of_nodes() > 100
    assert graph.number_of_edges() > 300
    assert len(hospitals) >= 3

    # Check node attributes
    sample_node = list(graph.nodes())[0]
    data = graph.nodes[sample_node]
    assert "lat" in data
    assert "lon" in data
    assert "has_signal" in data
    assert isinstance(data["has_signal"], bool)


def test_node_distance_haversine():
    graph, _ = load_city()
    nodes = list(graph.nodes())
    d = node_distance_m(nodes[0], nodes[1], graph=graph)
    assert d > 0.0
    assert d < 5000.0


def test_run_all_modes_comparison_returns_all_routes():
    graph, hospitals = load_city()
    start = "n_0_0"
    dst = hospitals[0].node
    res = run_all_modes_comparison(graph, start, dst)

    assert "active_trip" in res
    assert "routes" in res
    assert "comparison" in res

    routes = res["routes"]
    assert "baseline" in routes
    assert "traffic" in routes
    assert "smart" in routes

    # Coordinates in polylines
    for coord in routes["smart"]:
        assert len(coord) == 2
        assert 37.0 < coord[0] < 38.0
        assert -123.0 < coord[1] < -122.0


def test_api_endpoints():
    client = TestClient(app)

    # 1. GET /city
    r_city = client.get("/city")
    assert r_city.status_code == 200
    city_data = r_city.json()
    assert "bounds" in city_data
    assert "hospitals" in city_data
    assert len(city_data["hospitals"]) >= 3

    # 2. POST /dispatch
    r_disp = client.post("/dispatch", json={
        "start_node": "n_0_0",
        "hospital_id": "auto",
        "scenario": "Moderate",
        "algorithm": "dijkstra",
        "preemption": True
    })
    assert r_disp.status_code == 200
    disp_data = r_disp.json()
    assert "active_trip" in disp_data
    assert "comparison" in disp_data
    assert "routes" in disp_data

    # 3. GET /benchmark
    r_bench = client.get("/benchmark")
    assert r_bench.status_code == 200
    bench_data = r_bench.json()
    assert "summary" in bench_data
    assert len(bench_data["summary"]) == 4
