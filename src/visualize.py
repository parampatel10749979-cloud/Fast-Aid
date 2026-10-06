"""
visualize.py — Plotly figures for the Fast-Aid dashboard.

All functions are pure (no side effects) and return Plotly Figure objects.
The caller (app.py) is responsible for rendering them via st.plotly_chart.
"""

from __future__ import annotations

import math
from typing import Optional

import networkx as nx
import numpy as np
import pandas as pd
import plotly.graph_objects as go
import plotly.express as px

from src.city import BLOCK_LENGTH_M, Hospital

# ── colour helpers ────────────────────────────────────────────────────────────

def _congestion_color(c: float) -> str:
    """Map congestion [0,1] to a hex colour: green→yellow→red."""
    r = int(255 * c)
    g = int(255 * (1 - c))
    return f"rgb({r},{g},50)"


ROUTE_COLORS = {
    "distance": "#3498db",   # blue  — baseline
    "traffic":  "#f39c12",   # amber — traffic-aware
    "smart":    "#27ae60",   # green — fast-aid
}
ROUTE_NAMES = {
    "distance": "Baseline",
    "traffic":  "Traffic-Aware",
    "smart":    "Fast-Aid (Smart)",
}


def _node_xy(node: tuple[int, int]) -> tuple[float, float]:
    """Convert (row, col) grid node to (x, y) in metres."""
    return float(node[1]) * BLOCK_LENGTH_M, float(node[0]) * BLOCK_LENGTH_M


# ── city map ──────────────────────────────────────────────────────────────────

def draw_city_map(
    graph: nx.DiGraph,
    routes: dict[str, list[tuple[int, int]]] | None = None,
    hospitals: list[Hospital] | None = None,
    ambulance_node: tuple[int, int] | None = None,
) -> go.Figure:
    """
    Draw the city grid with congestion-coloured edges and optional route overlays.

    Args:
        graph:          City DiGraph.
        routes:         Dict mapping mode → path list.
        hospitals:      List of Hospital objects to mark.
        ambulance_node: Current ambulance position (highlighted).

    Returns:
        Plotly Figure.
    """
    fig = go.Figure()

    # ── draw road edges (skip reverse duplicates) ────────────────────────────
    seen: set[frozenset] = set()
    for u, v, data in graph.edges(data=True):
        key = frozenset([u, v])
        if key in seen:
            continue
        seen.add(key)
        x0, y0 = _node_xy(u)
        x1, y1 = _node_xy(v)
        cong = data.get("congestion", 0.0)
        color = _congestion_color(cong)
        fig.add_trace(go.Scatter(
            x=[x0, x1, None], y=[y0, y1, None],
            mode="lines",
            line=dict(color=color, width=2),
            hoverinfo="skip",
            showlegend=False,
        ))

    # ── draw signal nodes ────────────────────────────────────────────────────
    sig_x, sig_y = [], []
    for node, data in graph.nodes(data=True):
        if data.get("has_signal"):
            x, y = _node_xy(node)
            sig_x.append(x)
            sig_y.append(y)
    if sig_x:
        fig.add_trace(go.Scatter(
            x=sig_x, y=sig_y, mode="markers",
            marker=dict(symbol="circle", size=5, color="yellow",
                        line=dict(color="gray", width=0.5)),
            name="Signal",
        ))

    # ── draw route overlays ───────────────────────────────────────────────────
    if routes:
        for mode, path in routes.items():
            if not path:
                continue
            rx = [_node_xy(n)[0] for n in path]
            ry = [_node_xy(n)[1] for n in path]
            fig.add_trace(go.Scatter(
                x=rx, y=ry, mode="lines+markers",
                line=dict(color=ROUTE_COLORS.get(mode, "white"), width=3),
                marker=dict(size=4),
                name=ROUTE_NAMES.get(mode, mode),
            ))

    # ── draw hospitals ────────────────────────────────────────────────────────
    if hospitals:
        hx = [_node_xy(h.node)[0] for h in hospitals]
        hy = [_node_xy(h.node)[1] for h in hospitals]
        hl = [f"H {h.node}<br>Cap:{h.capacity}<br>{','.join(h.specialties)}"
              for h in hospitals]
        fig.add_trace(go.Scatter(
            x=hx, y=hy, mode="markers+text",
            marker=dict(symbol="cross", size=14, color="white",
                        line=dict(color="red", width=2)),
            text=["🏥"] * len(hospitals),
            textposition="top center",
            hovertext=hl, hoverinfo="text",
            name="Hospital",
        ))

    # ── ambulance marker ──────────────────────────────────────────────────────
    if ambulance_node:
        ax, ay = _node_xy(ambulance_node)
        fig.add_trace(go.Scatter(
            x=[ax], y=[ay], mode="markers+text",
            marker=dict(symbol="star", size=16, color="cyan"),
            text=["🚑"], textposition="top center",
            name="Ambulance",
        ))

    # ── colour scale legend ───────────────────────────────────────────────────
    for label, c in [("Low", 0.0), ("Medium", 0.5), ("High", 1.0)]:
        fig.add_trace(go.Scatter(
            x=[None], y=[None], mode="markers",
            marker=dict(size=10, color=_congestion_color(c)),
            name=f"Congestion: {label}",
            showlegend=True,
        ))

    fig.update_layout(
        title="City Road Network",
        xaxis=dict(showgrid=False, zeroline=False, showticklabels=False),
        yaxis=dict(showgrid=False, zeroline=False, showticklabels=False,
                   scaleanchor="x"),
        plot_bgcolor="#1a1a2e",
        paper_bgcolor="#16213e",
        font=dict(color="white"),
        legend=dict(bgcolor="rgba(0,0,0,0.4)", font=dict(size=11)),
        margin=dict(l=10, r=10, t=40, b=10),
        height=550,
    )
    return fig


# ── simulation animation ──────────────────────────────────────────────────────

def draw_simulation_animation(
    graph: nx.DiGraph,
    trajectory_nodes: list[tuple[int, int]],
    hospital_node: tuple[int, int],
    hospitals: list[Hospital],
    routes: dict[str, list[tuple[int, int]]] | None = None,
) -> go.Figure:
    """
    Build an animated figure showing the ambulance moving along its path.

    Args:
        graph:            City DiGraph.
        trajectory_nodes: Ordered list of nodes visited during the trip.
        hospital_node:    Destination hospital node.
        hospitals:        All hospitals for rendering.
        routes:           Optional route overlays.

    Returns:
        Plotly Figure with animation frames.
    """
    # base map
    fig = draw_city_map(graph, routes=routes, hospitals=hospitals)

    if not trajectory_nodes:
        return fig

    # build animation frames
    frames = []
    for i, node in enumerate(trajectory_nodes):
        ax, ay = _node_xy(node)
        frames.append(go.Frame(
            data=[go.Scatter(
                x=[ax], y=[ay], mode="markers+text",
                marker=dict(symbol="star", size=16, color="cyan"),
                text=["🚑"], textposition="top center",
                name="Ambulance",
            )],
            name=str(i),
        ))

    fig.frames = frames
    fig.update_layout(
        updatemenus=[dict(
            type="buttons", showactive=False,
            buttons=[
                dict(label="▶ Play", method="animate",
                     args=[None, dict(frame=dict(duration=300, redraw=True),
                                      fromcurrent=True)]),
                dict(label="⏹ Pause", method="animate",
                     args=[[None], dict(frame=dict(duration=0, redraw=False),
                                        mode="immediate")]),
            ],
            x=0.02, y=0.02, xanchor="left",
        )],
        sliders=[dict(
            steps=[dict(method="animate", args=[[str(i)],
                        dict(mode="immediate", frame=dict(duration=0, redraw=True))],
                        label=str(i))
                   for i in range(len(frames))],
            x=0.05, len=0.92, y=0.0,
        )],
    )
    return fig


# ── comparison bar chart ──────────────────────────────────────────────────────

def draw_comparison_bar(metrics_df: pd.DataFrame) -> go.Figure:
    """
    Grouped bar chart comparing total_time_s for the three modes.

    Args:
        metrics_df: DataFrame returned by metrics.compare_modes().

    Returns:
        Plotly Figure.
    """
    fig = go.Figure()
    colors = ["#e74c3c", "#f39c12", "#27ae60"]
    for row, color in zip(metrics_df.itertuples(), colors):
        label = ROUTE_NAMES.get(row.mode, row.mode)
        pct   = f"  ({row.time_saved_pct:+.1f}%)" if row.time_saved_s != 0 else ""
        fig.add_trace(go.Bar(
            x=[label + pct],
            y=[row.total_time_s],
            name=label,
            marker_color=color,
            text=[f"{row.total_time_s:.0f}s"],
            textposition="outside",
        ))
    fig.update_layout(
        title="Trip Time by Mode",
        yaxis_title="Total Time (s)",
        plot_bgcolor="#1a1a2e",
        paper_bgcolor="#16213e",
        font=dict(color="white"),
        showlegend=False,
        bargap=0.35,
        height=380,
        margin=dict(l=20, r=20, t=50, b=20),
    )
    return fig


# ── benchmark charts ──────────────────────────────────────────────────────────

def draw_benchmark_avg_time(df: pd.DataFrame) -> go.Figure:
    """Grouped bar chart of median trip times per scenario from the benchmark CSV."""
    scenarios = ["Light", "Moderate", "Heavy", "Gridlock"]
    modes = [
        ("Baseline",         "distance_time_s", "#e74c3c"),
        ("Traffic-Aware",    "traffic_time_s",  "#f39c12"),
        ("Fast-Aid (Smart)", "smart_time_s",    "#27ae60"),
    ]
    fig = go.Figure()
    grp = df.groupby("scenario")
    for label, col, color in modes:
        medians = [grp.get_group(s)[col].median() if s in grp.groups else 0
                   for s in scenarios]
        fig.add_trace(go.Bar(name=label, x=scenarios, y=medians,
                             marker_color=color, opacity=0.88))
    fig.update_layout(
        barmode="group", title="Median Trip Time by Mode & Scenario",
        xaxis_title="Scenario", yaxis_title="Median Time (s)",
        plot_bgcolor="#1a1a2e", paper_bgcolor="#16213e",
        font=dict(color="white"), height=400,
    )
    return fig


def draw_benchmark_savings(df: pd.DataFrame) -> go.Figure:
    """Line chart of median % time saved vs congestion level."""
    congestion_map = {"Light": 0.10, "Moderate": 0.30, "Heavy": 0.60, "Gridlock": 0.85}
    scenarios = ["Light", "Moderate", "Heavy", "Gridlock"]
    grp = df.groupby("scenario")

    fig = go.Figure()
    for label, col, color in [
        ("Traffic-Aware", "traffic_saved_pct", "#f39c12"),
        ("Fast-Aid",      "smart_saved_pct",   "#27ae60"),
    ]:
        y = [grp.get_group(s)[col].median() if s in grp.groups else 0
             for s in scenarios]
        x = [congestion_map[s] for s in scenarios]
        fig.add_trace(go.Scatter(x=x, y=y, mode="lines+markers",
                                 name=label, line=dict(color=color, width=2)))
    fig.update_layout(
        title="Time Saved vs Congestion Level",
        xaxis_title="Congestion Level", yaxis_title="Median Time Saved (%)",
        plot_bgcolor="#1a1a2e", paper_bgcolor="#16213e",
        font=dict(color="white"), height=380,
    )
    return fig
