from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.category import Category
from app.schemas.category import CategoryCreate, CategoryUpdate, CategoryResponse
import uuid

DEFAULT_CATEGORIES = [
    {"name": "Lương", "type": "income", "icon": "💼", "color": "#4CAF50"},
    {"name": "Thưởng", "type": "income", "icon": "🎁", "color": "#8BC34A"},
    {"name": "Thu nhập khác", "type": "income", "icon": "💰", "color": "#CDDC39"},
    {"name": "Ăn uống", "type": "expense", "icon": "🍜", "color": "#F44336"},
    {"name": "Di chuyển", "type": "expense", "icon": "🚌", "color": "#FF5722"},
    {"name": "Giải trí", "type": "expense", "icon": "🎮", "color": "#9C27B0"},
    {"name": "Mua sắm", "type": "expense", "icon": "🛒", "color": "#2196F3"},
    {"name": "Sức khỏe", "type": "expense", "icon": "🏥", "color": "#00BCD4"},
    {"name": "Giáo dục", "type": "expense", "icon": "📚", "color": "#009688"},
    {"name": "Tiết kiệm", "type": "expense", "icon": "🏦", "color": "#607D8B"},
    {"name": "Chi phí khác", "type": "expense", "icon": "📦", "color": "#795548"},
]


def seed_default_categories(db: Session, user_id: str):
    for cat in DEFAULT_CATEGORIES:
        category = Category(
            id=str(uuid.uuid4()),
            user_id=user_id,
            name=cat["name"],
            type=cat["type"],
            icon=cat.get("icon"),
            color=cat.get("color"),
            is_default=True,
        )
        db.add(category)


def get_categories(db: Session, user_id: str) -> list[CategoryResponse]:
    cats = db.query(Category).filter(
        Category.user_id == user_id,
        Category.parent_id == None,
        Category.is_active == True,
    ).all()
    return [_build_response(c) for c in cats]


def _get_user_categories_list(db: Session, user_id: str) -> list[str]:
    """Return list of active category names for the given user."""
    cats = db.query(Category).filter(Category.user_id == user_id, Category.is_active == True).all()
    return [c.name for c in cats]


def _build_response(cat: Category) -> CategoryResponse:
    return CategoryResponse(
        id=cat.id,
        name=cat.name,
        type=cat.type,
        parent_id=cat.parent_id,
        icon=cat.icon,
        color=cat.color,
        is_default=cat.is_default,
        is_active=cat.is_active,
        children=[_build_response(c) for c in cat.children if c.is_active],
    )


def create_category(db: Session, user_id: str, data: CategoryCreate) -> CategoryResponse:
    if data.type not in ("income", "expense"):
        raise HTTPException(status_code=400, detail="type must be 'income' or 'expense'")
    if data.parent_id:
        parent = db.query(Category).filter(Category.id == data.parent_id, Category.user_id == user_id).first()
        if not parent:
            raise HTTPException(status_code=404, detail="Parent category not found")
        if parent.parent_id is not None:
            raise HTTPException(status_code=400, detail="Max 2 levels of categories")
    cat = Category(
        id=str(uuid.uuid4()),
        user_id=user_id,
        parent_id=data.parent_id,
        name=data.name,
        type=data.type,
        icon=data.icon,
        color=data.color,
    )
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return _build_response(cat)


def update_category(db: Session, user_id: str, category_id: str, data: CategoryUpdate) -> CategoryResponse:
    cat = _get_or_404(db, user_id, category_id)
    if data.name is not None:
        cat.name = data.name
    if data.icon is not None:
        cat.icon = data.icon
    if data.color is not None:
        cat.color = data.color
    if data.is_active is not None:
        cat.is_active = data.is_active
    db.commit()
    db.refresh(cat)
    return _build_response(cat)


def delete_category(db: Session, user_id: str, category_id: str):
    from app.models.transaction import Transaction
    cat = _get_or_404(db, user_id, category_id)
    has_txn = db.query(Transaction).filter(Transaction.category_id == category_id).first()
    if has_txn:
        raise HTTPException(status_code=400, detail="Cannot delete category with existing transactions")
    db.delete(cat)
    db.commit()


def _get_or_404(db: Session, user_id: str, category_id: str) -> Category:
    cat = db.query(Category).filter(Category.id == category_id, Category.user_id == user_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    return cat
