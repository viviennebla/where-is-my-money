import uuid
import threading
from datetime import datetime
from typing import Any


class TaskManager:
    """In-memory async task tracker. Tasks auto-expire 10 min after completion."""

    TTL_SECONDS = 600

    def __init__(self):
        self._tasks: dict[str, dict] = {}
        self._lock = threading.Lock()

    def create(self, type_: str, total: int) -> str:
        task_id = str(uuid.uuid4())
        with self._lock:
            self._tasks[task_id] = {
                "type": type_,
                "current": 0,
                "total": total,
                "status": "processing",
                "message": "",
                "result": None,
                "error": None,
                "finished_at": None,
            }
        return task_id

    def set_message(self, task_id: str, message: str):
        with self._lock:
            t = self._tasks.get(task_id)
            if t:
                t["message"] = message

    def update(self, task_id: str, current: int):
        with self._lock:
            t = self._tasks.get(task_id)
            if t:
                t["current"] = current

    def complete(self, task_id: str, result: dict[str, Any] | None = None):
        with self._lock:
            t = self._tasks.get(task_id)
            if t:
                t["status"] = "done"
                t["result"] = result
                t["finished_at"] = datetime.utcnow()

    def fail(self, task_id: str, error: str):
        with self._lock:
            t = self._tasks.get(task_id)
            if t:
                t["status"] = "error"
                t["error"] = error
                t["finished_at"] = datetime.utcnow()

    def get(self, task_id: str) -> dict | None:
        self._expire()
        with self._lock:
            return self._tasks.get(task_id)

    def _expire(self):
        cutoff = datetime.utcnow()
        with self._lock:
            stale = [
                tid
                for tid, t in self._tasks.items()
                if t.get("finished_at")
                and (cutoff - t["finished_at"]).total_seconds() > self.TTL_SECONDS
            ]
            for tid in stale:
                del self._tasks[tid]


task_manager = TaskManager()
