# backend/models.py
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship # Add this import for relationships
from .database import Base

class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, index=True, unique=True, nullable=False)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())

    # Optional: If you want to access related feedback from a Document object
    # feedback = relationship("Feedback", back_populates="document")

# New Feedback Model
class Feedback(Base):
    __tablename__ = "feedback"
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id")) # Links to the Document table
    question = Column(String) # Storing the question for context
    answer = Column(String)   # Storing the answer for context
    feedback_type = Column(Boolean) # True for 'positive' (thumbs up), False for 'negative' (thumbs down)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Optional: If you want to access the related Document from a Feedback object
    # document = relationship("Document", back_populates="feedback")