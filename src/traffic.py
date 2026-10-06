"""
traffic.py — Congestion model for the grid city.

Provides:
  - Scenario presets (Light / Moderate / Heavy / Gridlock).
  - TrafficEngine class that holds congestion per edge and advances time.
  - Travel-time formula matching PROJECT.md spec.

No global mutable state; the caller owns the TrafficEngine instance.
"""

from __future__ import annotations

from typing import Literal

import networkx as nx
import numpy as np

# ── scenario presets ──────────────────────────────────────────────────────────
SCENARIOS: dict[str, dict] = {
    "Light":    {"base_congestion": 0.10, "drift": 0.02, "incident_prob": 0.005},
    "Moderate": {"base_congestion": 0.30, "drift": 0.04, "incident_prob": 0.015},
    "Heavy":    {"base_congestion": 0.60, "drift": 0.06, "incident_prob": 0.030},
    "Gridlock": {"base_congestion": 0.85, "drift": 0.03, "incident_prob": 0.050},
}

ScenarioName = Literal["Light", "Moderate", "Heavy", "Gridlock"]

# ── travel-time formula (from PROJECT.md) ─────────────────────────────────────
SIREN_BOOST: float = 1.25       # ambulance is this much faster than a car
MAX_SPEED_KMH: float = 60.0     # upper bound used by A* heuristic
KMH_TO_MS: float = 1000 / 3600  # convert km/h → m/s


def travel_time_s(
    length_m: float,
    speed_limit_kmh: float,
    congestion: float,
    ambulance: bool = True,
) -> float:
    """
    Compute edge travel time in seconds.

    Args:
        length_m:        Edge length in metres.
        speed_limit_kmh: Speed limit of the road in km/h.
        congestion:      Congestion factor in [0, 1].
        ambulance:       If True, apply 1.25× siren speed boost.

    Returns:
        Travel time in seconds.
    """
    speed_kmh = max(3.0, speed_limit_kmh * (1.0 - 0.85 * congestion))
    speed_ms = speed_kmh * KMH_TO_MS
    t = length_m / speed_ms
    if ambulance:
        t /= SIREN_BOOST
    return t


class TrafficEngine:
    """
    Manages per-edge congestion and advances it over time.

    Args:
        graph:    City graph (edges modified in place).
        scenario: One of the four scenario names.
        rng:      Seeded numpy Generator.
    """

    def __init__(
        self,
        graph: nx.DiGraph,
        scenario: ScenarioName = "Moderate",
        rng: np.random.Generator | None = None,
        seed: int | None = 42,
    ) -> None:
        if rng is None:
            rng = np.random.default_rng(seed)
        self._rng = rng
        self._graph = graph
        self._cfg = SCENARIOS[scenario]
        self._incidents: dict[tuple, float] = {}   # edge → fade-target time
        self._sim_time: float = 0.0

        # initialise congestion ~base + small noise
        base = self._cfg["base_congestion"]
        for u, v in graph.edges():
            noise = float(rng.uniform(-0.05, 0.05))
            graph[u][v]["congestion"] = float(np.clip(base + noise, 0.0, 1.0))

    # ── public API ────────────────────────────────────────────────────────────

    def step(self, dt: float = 1.0) -> None:
        """
        Advance simulation by dt seconds.

        Congestion drifts randomly and incidents are created / faded.

        Args:
            dt: Time step in seconds.
        """
        self._sim_time += dt
        drift = self._cfg["drift"]
        rng = self._rng
        graph = self._graph

        for u, v in graph.edges():
            c = graph[u][v]["congestion"]
            # random drift
            delta = float(rng.uniform(-drift, drift)) * dt / 10.0
            graph[u][v]["congestion"] = float(np.clip(c + delta, 0.0, 1.0))

        # possibly spawn a new incident
        if rng.random() < self._cfg["incident_prob"] * dt:
            self._spawn_incident()

        # fade existing incidents
        self._fade_incidents()

    def apply_scenario(self, scenario: ScenarioName) -> None:
        """
        Hot-swap the traffic scenario without rebuilding the engine.

        Args:
            scenario: New scenario name.
        """
        self._cfg = SCENARIOS[scenario]
        base = self._cfg["base_congestion"]
        for u, v in self._graph.edges():
            noise = float(self._rng.uniform(-0.05, 0.05))
            self._graph[u][v]["congestion"] = float(np.clip(base + noise, 0.0, 1.0))

    def get_congestion(self, u: tuple, v: tuple) -> float:
        """Return the current congestion on edge (u, v)."""
        return float(self._graph[u][v]["congestion"])

    @property
    def sim_time(self) -> float:
        """Current simulation time in seconds."""
        return self._sim_time

    # ── internal helpers ──────────────────────────────────────────────────────

    def _spawn_incident(self) -> None:
        """Spike 1–3 random edges to ~0.95 congestion and mark for fading."""
        edges = list(self._graph.edges())
        n = int(self._rng.integers(1, 4))
        chosen = [edges[i] for i in self._rng.choice(len(edges), size=n, replace=False)]
        fade_time = self._sim_time + float(self._rng.uniform(30, 120))
        for e in chosen:
            self._graph[e[0]][e[1]]["congestion"] = float(
                np.clip(self._rng.uniform(0.90, 1.0), 0.0, 1.0)
            )
            self._incidents[e] = fade_time

    def _fade_incidents(self) -> None:
        """Gradually reduce incident congestion back toward the base level."""
        base = self._cfg["base_congestion"]
        done = []
        for edge, fade_at in self._incidents.items():
            if self._sim_time >= fade_at:
                done.append(edge)
                continue
            u, v = edge
            if self._graph.has_edge(u, v):
                c = self._graph[u][v]["congestion"]
                # fade at 0.01 per second
                self._graph[u][v]["congestion"] = float(
                    np.clip(c - 0.01, base, 1.0)
                )
        for e in done:
            self._incidents.pop(e, None)
