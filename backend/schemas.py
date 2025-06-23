# backend/schemas.py

from datetime import datetime
from pydantic import BaseModel, Field
from typing import List, Optional

class DocumentResponse(BaseModel):
    id: int
    filename: str
    uploaded_at: datetime
    message: str

    class Config:
        from_attributes = True

class QuestionRequest(BaseModel):
    question: str

class SourceDocument(BaseModel):
    page_content: str
    metadata: dict

class QuestionResponse(BaseModel):
    answer: str
    sources: List[SourceDocument] = Field(default_factory=list)
    document_id: int
    question: str

    class Config:
        from_attributes = True

class DuplicateFileResponse(BaseModel):
    message: str = "File with this name already exists."
    existing_document_id: int
    filename: str
    action_required: bool = True

class FeedbackRequest(BaseModel):
    document_id: int
    question: str
    answer: str
    feedback_type: str = Field(..., description="e.g., 'helpful', 'not_helpful', 'accurate', 'inaccurate'")

class FeedbackResponse(BaseModel):
    id: int
    document_id: int
    question: str
    answer: str
    feedback_type: str
    submitted_at: datetime
    message: str = "Feedback submitted successfully."

    class Config:
        from_attributes = True