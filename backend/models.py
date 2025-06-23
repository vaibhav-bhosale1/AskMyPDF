# backend/models.py

from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func

Base = declarative_base()

class Document(Base):
    __tablename__ = "documents"
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, unique=True, index=True, nullable=False)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())

    feedbacks = relationship("Feedback", back_populates="document")


class Feedback(Base):
    __tablename__ = "feedback"
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    feedback_type = Column(String(50), nullable=False) 
    submitted_at = Column(DateTime(timezone=True), server_default=func.now())
    document = relationship("Document", back_populates="feedbacks")
