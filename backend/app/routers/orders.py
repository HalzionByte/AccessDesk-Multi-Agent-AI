"""Customer order routes."""

from typing import Annotated, Any

from fastapi import APIRouter, Depends

from app.auth import CustomerUser
from app.firebase import get_database
from app.schemas import Order
from app.services.orders import list_orders

router = APIRouter(prefix="/orders", tags=["orders"])
Database = Annotated[Any, Depends(get_database)]


@router.get("", response_model=list[Order])
def get_own_orders(user: CustomerUser, database: Database) -> list[Order]:
    return list_orders(database, user.uid)
