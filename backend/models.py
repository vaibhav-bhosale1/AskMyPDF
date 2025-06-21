# backend/models.py
from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from .database import Base

class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, index=True, unique=True, nullable=False)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
    # You might add a path to the stored PDF file here later, if needed
    # file_path = Column(String)