# backend/schemas.py

from datetime import datetime
from pydantic import BaseModel, Field # Import Field for validation/description
from typing import List, Optional

class DocumentResponse(BaseModel):
    id: int
    filename: str
    uploaded_at: datetime
    message: str

    class Config:
        from_attributes = True

# --- Modified QuestionRequest for better API design ---
class QuestionRequest(BaseModel):
    # document_id will be passed in the URL path, so only question is in the body
    question: str

# --- New Schema for Source Documents ---
class SourceDocument(BaseModel):
    page_content: str
    metadata: dict # Expecting {"page": X} but keep flexible

class QuestionResponse(BaseModel):
    answer: str
    # Changed 'sources: List[dict]' to use the new SourceDocument schema
    sources: List[SourceDocument] = Field(default_factory=list) # Default to empty list
    # Optionally, you might want to return the document_id and question for context on the frontend
    document_id: int
    question: str

    class Config:
        from_attributes = True # Allow ORM models to be used

# --- Duplicate File Handling Schema ---
class DuplicateFileResponse(BaseModel):
    message: str = "File with this name already exists."
    existing_document_id: int
    filename: str
    action_required: bool = True # Indicates frontend needs to prompt user

# --- NEW SCHEMAS FOR FEEDBACK ---
class FeedbackRequest(BaseModel):
    document_id: int # The ID of the document the feedback is for
    question: str    # The question that was asked
    answer: str      # The answer that was provided
    feedback_type: str = Field(..., description="e.g., 'helpful', 'not_helpful', 'accurate', 'inaccurate'") # Type of feedback

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