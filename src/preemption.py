"""
preemption.py — Traffic signal green-corridor for ambulance routes.

The next LOOKAHEAD signalised nodes ahead of the ambulance on the route
are set to preempted=True so signal_wait_time() returns 0 for them.
After passing a node, it is restored to its original state.

No global mutable state; caller passes graph and route explicitly.
"""

from __future__ import annotations

LOOKAHEAD: int = 3   # number of upcoming signals to preempt


def preempt_signals(
    graph,
    route: list[tuple[int, int]],
    current_idx: int,
    lookahead: int = LOOKAHEAD,
) -> list[tuple[int, int]]:
    """
    Set the next `lookahead` signalised nodes on the route to preempted=True.

    Args:
        graph:       City DiGraph (nodes modified in place).
        route:       Ordered list of nodes from current position to destination.
        current_idx: Index of the ambulance's current node in route.
        lookahead:   How many upcoming signals to preempt.

    Returns:
        List of nodes that were just preempted (so caller can restore them later).
    """
    preempted_nodes: list[tuple[int, int]] = []
    signals_found = 0

    for idx in range(current_idx + 1, len(route)):
        if signals_found >= lookahead:
            break
        node = route[idx]
        if graph.nodes[node].get("has_signal", False):
            graph.nodes[node]["preempted"] = True
            preempted_nodes.append(node)
            signals_found += 1

    return preempted_nodes


def restore_signals(
    graph,
    nodes: list[tuple[int, int]],
) -> None:
    """
    Restore preempted signals to normal operation.

    Args:
        graph: City DiGraph.
        nodes: Nodes previously preempted; their preempted flag is cleared.
    """
    for node in nodes:
        if graph.has_node(node):
            graph.nodes[node]["preempted"] = False


def clear_all_preemptions(graph) -> None:
    """
    Reset every preempted flag in the graph (used between simulation runs).

    Args:
        graph: City DiGraph.
    """
    for node in graph.nodes():
        graph.nodes[node]["preempted"] = False
