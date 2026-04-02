from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session  # noqa: F401
from finance_svc.core.database import get_db
from finance_svc.schemas.auth import RegisterRequest, LoginRequest, TokenResponse, RefreshRequest, UserResponse, UpdateProfileRequest
from finance_svc.services import auth_service
from finance_svc.dependencies import get_current_user
from finance_svc.models.user import User

router = APIRouter(prefix="/api/auth", tags=["Auth"])


@router.post("/register", response_model=UserResponse, status_code=201)
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    return auth_service.register_user(db, data)


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    return auth_service.login_user(db, data)


@router.post("/refresh", response_model=TokenResponse)
def refresh(data: RefreshRequest, db: Session = Depends(get_db)):
    return auth_service.refresh_tokens(db, data.refresh_token)


@router.post("/logout")
def logout(current_user: User = Depends(get_current_user)):
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        default_currency=current_user.default_currency,
        created_at=current_user.created_at.isoformat(),
    )


@router.put("/me", response_model=UserResponse)
def update_profile(
    data: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if data.full_name is not None:
        current_user.full_name = data.full_name.strip()

    if data.new_password:
        from finance_svc.core.security import hash_password
        current_user.password_hash = hash_password(data.new_password)

    db.commit()
    db.refresh(current_user)

    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        default_currency=current_user.default_currency,
        created_at=current_user.created_at.isoformat(),
    )
