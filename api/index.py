import os
import sys
from pathlib import Path

# Add backend directory to sys.path so all imports resolve seamlessly
BACKEND_DIR = Path(__file__).resolve().parent.parent / "finwise" / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app import create_app

app = create_app()

if __name__ == "__main__":
    app.run()

