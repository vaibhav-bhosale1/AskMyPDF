# backend/schemas.py

from datetime import datetime
from pydantic import BaseModel
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

class QuestionResponse(BaseModel):
    answer: str
    sources: List[dict] # To provide snippet and page number

# --- NEW SCHEMA FOR DUPLICATE FILE HANDLING ---
class DuplicateFileResponse(BaseModel):
    message: str = "File with this name already exists."
    existing_document_id: int
    filename: str
    action_required: bool = True # Indicates frontend needs to prompt user