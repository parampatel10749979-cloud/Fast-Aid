"""Fast-Aid — Root Launcher.

Redirects to frontend/app.py so both:
    streamlit run frontend/app.py
and
    streamlit run app.py
work out of the box.
"""

import sys
from pathlib import Path

# Ensure root is in Python path
ROOT_DIR = Path(__file__).resolve().parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

# Launch the frontend Streamlit application
import frontend.app  # noqa: F401
