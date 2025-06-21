# backend/schemas.py
from pydantic import BaseModel
from datetime import datetime

class DocumentBase(BaseModel):
    filename: str

class DocumentCreate(DocumentBase):
    pass

class Document(DocumentBase):
    id: int
    uploaded_at: datetime

    class Config:
        from_attributes = True # or orm_mode = True for older Pydantic