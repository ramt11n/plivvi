"""Compatibility entry point for the original code-drawn brand export."""
from pathlib import Path
import runpy
runpy.run_path(str(Path(__file__).with_name("create-brand-assets.py")), run_name="__main__")
