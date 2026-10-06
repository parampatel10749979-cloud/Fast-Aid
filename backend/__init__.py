"""Fast-Aid Backend Engine.

Core algorithmic modules for smart ambulance dispatch and routing:
- city: Manhattan grid network representation with traffic signals
- traffic: BPR volume-delay function and time-of-day traffic scenarios
- routing: Static Dijkstra and Dynamic Real-Time A* with preemption cost
- preemption: Emergency signal preemption and clearance
- hospitals: Specialty and bed-aware multi-criteria hospital selection
- simulation: Step-by-step physical route traversal simulation
- metrics: Evaluation, logging, and benchmarking
"""

__version__ = "1.0.0"
