# backend/schemas.py
from pydantic import BaseModel
from datetime import datetime
from typing import List, Dict, Any, Optional

class DocumentResponse(BaseModel):
    id: int
    filename: str
    uploaded_at: datetime
    message: str

class QuestionRequest(BaseModel):
    document_id: int
    question: str

# New Pydantic model for source documents
class SourceDocument(BaseModel):
    page_content: str
    metadata: Dict[str, Any] # This will contain 'page' number

class AnswerResponse(BaseModel):
    answer: str
    document_id: int
    question: str
    # Add source_documents to the response
    source_documents: Optional[List[SourceDocument]] = None # Use Optional as it might be empty or null

# New Pydantic model for feedback request
class FeedbackRequest(BaseModel):
    document_id: int
    question: str
    answer: str
    feedback_type: bool # True for positive, False for negative