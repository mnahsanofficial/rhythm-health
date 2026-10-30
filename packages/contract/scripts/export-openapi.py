"""Export FastAPI's public schema, without reading real env files or using services."""
import json
import os
from pathlib import Path
import sys
import tempfile

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "backend"))


def guard(event, args):
    if event == "socket.connect":
        raise RuntimeError("Contract generation must not contact external services")
    if event == "open" and isinstance(args[0], (str, bytes, os.PathLike)):
        name = os.fsdecode(args[0])
        if Path(name).name.startswith(".env"):
            raise RuntimeError("Contract generation must not read env files")


sys.addaudithook(guard)
# Settings resolves .env.local relative to cwd. This empty directory cannot contain it.
with tempfile.TemporaryDirectory(prefix="rhythm-openapi-") as directory:
    os.chdir(directory)
    from app.main import app

    print(json.dumps(app.openapi(), indent=2, ensure_ascii=False))
