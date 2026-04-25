from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from finance_svc.core.database import get_db
from finance_svc.models.user import User
from finance_svc.dependencies import get_current_user
from finance_svc.schemas.notification import (
    NotificationListResponse,
    NotificationResponse,
    UnreadCountResponse,
    NotificationActionRequest,
)
from finance_svc.services import notification_service

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])


@router.get("", response_model=NotificationListResponse)
def list_notifications(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    is_read: bool | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    items, total, total_pages = notification_service.list_notifications(
        db,
        current_user.id,
        page=page,
        page_size=page_size,
        is_read=is_read,
    )
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


@router.get("/unread-count", response_model=UnreadCountResponse)
def unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return {"unread_count": notification_service.get_unread_count(db, current_user.id)}


@router.patch("/{notification_id}/read", response_model=NotificationResponse)
def mark_notification_read(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = notification_service.mark_as_read(db, current_user.id, notification_id)
    if not item:
        raise HTTPException(status_code=404, detail="Notification not found")
    return item


@router.patch("/{notification_id}/unread", response_model=NotificationResponse)
def mark_notification_unread(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = notification_service.mark_as_unread(db, current_user.id, notification_id)
    if not item:
        raise HTTPException(status_code=404, detail="Notification not found")
    return item


@router.patch("/read-all", response_model=UnreadCountResponse)
def mark_all_notifications_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notification_service.mark_all_as_read(db, current_user.id)
    return {"unread_count": 0}


@router.post("/{notification_id}/action")
def handle_notification_action(
    notification_id: str,
    request: NotificationActionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return notification_service.handle_notification_action(
        db,
        current_user.id,
        notification_id,
        request.action,
    )
