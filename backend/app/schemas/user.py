from pydantic import BaseModel, EmailStr


class UserProfileOut(BaseModel):
    id: int
    username: str
    email: str
    created_at: str | None = None
    tasks_count: int = 0
    total_time_tracked: int = 0

    model_config = {"from_attributes": True}


class UpdateProfileRequest(BaseModel):
    username: str | None = None
    email: EmailStr | None = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str
