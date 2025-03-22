from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime

class UserBase(BaseModel):
    username: str

class UserCreate(UserBase):
    password: str

class User(UserBase):
    id: int
    totp_enabled: bool
    totp_verified: bool

    class Config:
        from_attributes = True

class DocumentBase(BaseModel):
    name: str
    category: str
    tags: List[str]

class DocumentCreate(DocumentBase):
    pass

class Document(DocumentBase):
    id: int
    user_id: int
    file_url: str
    uploaded_at: datetime
    ocr_text: Optional[str] = None
    ocr_status: str
    ocr_error: Optional[str] = None
    summary: Optional[str] = None
    summary_status: str
    summary_error: Optional[str] = None

    class Config:
        from_attributes = True

class ShareLinkBase(BaseModel):
    max_accesses: Optional[int] = None
    expires_in_days: Optional[int] = None

class ShareLink(ShareLinkBase):
    id: int
    document_id: int
    token: str
    created_at: datetime
    expires_at: Optional[datetime] = None
    access_count: int

    class Config:
        from_attributes = True

class AppointmentBase(BaseModel):
    title: str
    date: datetime
    notes: Optional[str] = None

class AppointmentCreate(AppointmentBase):
    pass

class Appointment(AppointmentBase):
    id: int
    user_id: int

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None
