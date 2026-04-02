from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from finance_svc.core.database import get_db
from finance_svc.models.user import User
from finance_svc.dependencies import get_current_user
from finance_svc.schemas.category import CategoryCreate, CategoryUpdate, CategoryResponse
from finance_svc.services import category_service

router = APIRouter(prefix="/api/categories", tags=["Categories"])


@router.get("", response_model=list[CategoryResponse])
def list_categories(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return category_service.get_categories(db, current_user.id)


@router.post("", response_model=CategoryResponse, status_code=201)
def create_category(data: CategoryCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return category_service.create_category(db, current_user.id, data)


@router.put("/{category_id}", response_model=CategoryResponse)
def update_category(category_id: str, data: CategoryUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return category_service.update_category(db, current_user.id, category_id, data)


@router.delete("/{category_id}", status_code=204)
def delete_category(category_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    category_service.delete_category(db, current_user.id, category_id)
