from fastapi import APIRouter, Depends, HTTPException

from app.auth import get_current_user
from app.database import get_db
from app.models.user import User
from app.services.task_manager import task_manager

router = APIRouter(prefix="/api/v1/tasks", tags=["tasks"])


@router.get("/{task_id}/progress")
async def get_progress(task_id: str, _user: User = Depends(get_current_user)):
    task = task_manager.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found or expired")
    return task
