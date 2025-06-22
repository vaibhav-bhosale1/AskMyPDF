from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class DocumentResponse(BaseModel):
    id: int
    filename: str
    uploaded_at: datetime
    message: Optional[str] = None

    class Config:
        from_attributes = True

class QuestionRequest(BaseModel):
    document_id: int
    question: str

class AnswerResponse(BaseModel):
    answer: str
    document_id: int