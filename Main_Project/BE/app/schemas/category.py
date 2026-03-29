from pydantic import BaseModel, Field


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    type: str  # 'income' | 'expense'
    parent_id: str | None = None
    icon: str | None = None
    color: str | None = None


class CategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    icon: str | None = None
    color: str | None = None
    is_active: bool | None = None


class CategoryResponse(BaseModel):
    id: str
    name: str
    type: str
    parent_id: str | None
    icon: str | None
    color: str | None
    is_default: bool
    is_active: bool
    children: list["CategoryResponse"] = []

    model_config = {"from_attributes": True}
