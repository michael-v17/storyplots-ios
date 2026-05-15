from fastapi import APIRouter

from ..deps.jwt import AuthUser, CurrentUser

router = APIRouter()


@router.get("/health")
def health(user: AuthUser = CurrentUser) -> dict[str, object]:
    return {"ok": True, "user_id": user.id}
