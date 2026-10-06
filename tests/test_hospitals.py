"""tests/test_hospitals.py — Unit tests for src/hospitals.py."""

import pytest

from src.city import build_city, Hospital
from src.hospitals import select_hospital, admit_patient


@pytest.fixture
def city():
    graph, hospitals = build_city(seed=42)
    return graph, hospitals


def test_returns_hospital_with_capacity(city):
    """select_hospital must only return a hospital with capacity > 0."""
    graph, hospitals = city
    start = (0, 0)
    result = select_hospital(graph, start, hospitals)
    assert result is not None
    assert result.capacity > 0


def test_prefers_matching_specialty(city):
    """If a specialty is requested and exists, the returned hospital must have it."""
    graph, hospitals = city
    start = (0, 0)
    for specialty in ("cardiac", "trauma", "stroke"):
        matching = [h for h in hospitals if specialty in h.specialties and h.capacity > 0]
        if not matching:
            continue   # this specialty not present in this city; skip
        result = select_hospital(graph, start, hospitals, specialty=specialty)
        if result is not None:
            assert specialty in result.specialties, (
                f"Returned hospital lacks specialty '{specialty}'"
            )


def test_fallback_when_no_specialty_match():
    """When no hospital has the specialty, any hospital with capacity is returned."""
    graph, hospitals = build_city(seed=10)
    start = (0, 0)
    # request a made-up specialty that no hospital will have
    result = select_hospital(graph, start, hospitals, specialty="neurology")
    # should still return something (fallback to any with capacity)
    assert result is not None


def test_returns_none_when_all_full():
    """Returns None when all hospitals have zero capacity."""
    graph, hospitals = build_city(seed=42)
    for h in hospitals:
        h.capacity = 0
    result = select_hospital(graph, (0, 0), hospitals)
    assert result is None


def test_admit_decrements_capacity(city):
    """admit_patient reduces the hospital's capacity by 1."""
    _, hospitals = city
    h = hospitals[0]
    original = h.capacity
    admit_patient(h)
    assert h.capacity == original - 1


def test_admit_raises_when_full():
    """admit_patient raises ValueError when capacity is 0."""
    h = Hospital(node=(0, 0), capacity=0, specialties=["cardiac"])
    with pytest.raises(ValueError):
        admit_patient(h)


def test_select_different_start_nodes(city):
    """select_hospital works correctly from various start positions."""
    graph, hospitals = city
    for start in [(0, 0), (5, 5), (11, 11)]:
        result = select_hospital(graph, start, hospitals)
        assert result is None or result.capacity > 0
