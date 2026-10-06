"""
hospitals.py — Select the best hospital for an incoming emergency.

Selection logic:
  1. Filter to hospitals with free capacity > 0.
  2. Among those, prefer hospitals with the requested specialty.
     Fallback: any hospital with capacity if none has the specialty.
  3. Rank survivors by lowest routing cost (traffic mode, Dijkstra).
  4. Return the best hospital.

No global mutable state; caller passes graph and hospital list.
"""

from __future__ import annotations

from backend.city import Hospital
from backend.routing import dijkstra_route, RoutingMode
import networkx as nx


def select_hospital(
    graph: nx.DiGraph,
    start: tuple[int, int],
    hospitals: list[Hospital],
    specialty: str | None = None,
    mode: RoutingMode = "traffic",
) -> Hospital | None:
    """
    Choose the best reachable hospital for the given emergency.

    Args:
        graph:     City graph with current congestion.
        start:     Ambulance's current node.
        hospitals: All hospitals in the city.
        specialty: Required specialty (e.g., 'cardiac'). None = any.
        mode:      Routing cost mode used for ranking.

    Returns:
        The best Hospital, or None if no hospital is reachable with capacity.
    """
    # ── step 1: capacity filter ───────────────────────────────────────────────
    candidates = [h for h in hospitals if h.capacity > 0]
    if not candidates:
        return None

    # ── step 2: specialty filter (with fallback) ──────────────────────────────
    if specialty:
        with_specialty = [h for h in candidates if specialty in h.specialties]
        if with_specialty:
            candidates = with_specialty
        # else: fallback to all candidates with capacity (already set)

    # ── step 3: rank by route cost ────────────────────────────────────────────
    best: Hospital | None = None
    best_cost: float = float("inf")

    for hospital in candidates:
        if hospital.node == start:
            # already here
            return hospital
        try:
            result = dijkstra_route(graph, start, hospital.node, mode=mode)
            if result.cost < best_cost:
                best_cost = result.cost
                best = hospital
        except ValueError:
            # hospital unreachable — skip
            continue

    return best


def admit_patient(hospital: Hospital) -> None:
    """
    Decrement hospital capacity by 1 to record a patient admission.

    Args:
        hospital: The hospital receiving the patient.

    Raises:
        ValueError: If the hospital is already at zero capacity.
    """
    if hospital.capacity <= 0:
        raise ValueError(f"Hospital at {hospital.node} has no free capacity.")
    hospital.capacity -= 1
