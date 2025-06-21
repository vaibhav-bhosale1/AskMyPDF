# backend/main.py (updated)
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from typing import Annotated
import shutil
import os
import fitz # PyMuPDF
from sqlalchemy.orm import Session

from .database import engine, Base, get_db
from . import models, schemas # Import models and create a schemas file soon

# Create tables (run this once to create your tables, then you can comment it out or remove for production)
# models.Base.metadata.create_all(bind=engine)

app = FastAPI()

UPLOAD_DIR = "pdfs"
TEXT_DIR = "extracted_texts" # Where we'll temporarily save extracted text

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(TEXT_DIR, exist_ok=True)

@app.get("/")
async def read_root():
    return {"message": "Welcome to the PDF Q&A Backend!"}

@app.post("/upload-pdf/")
async def upload_pdf(
    file: Annotated[UploadFile, File()],
    db: Session = Depends(get_db) # Inject database session
):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed.")

    # Ensure filename is safe (basic sanitation)
    safe_filename = os.path.basename(file.filename)
    file_path = os.path.join(UPLOAD_DIR, safe_filename)
    text_content = ""
    text_file_path = None # Initialize to None

    try:
        # 1. Save the PDF file
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # 2. Extract text content
        doc = fitz.open(file_path)
        for page in doc:
            text_content += page.get_text()
        doc.close()

        # 3. Store extracted text (for demonstration/future NLP use)
        # In a real NLP pipeline, this text might go directly into a vector store
        text_filename = os.path.splitext(safe_filename)[0] + ".txt"
        text_file_path = os.path.join(TEXT_DIR, text_filename)
        with open(text_file_path, "w", encoding="utf-8") as text_file:
            text_file.write(text_content)

        # 4. Store document metadata in the database 
        db_document = models.Document(filename=safe_filename)
        db.add(db_document)
        db.commit()
        db.refresh(db_document) # Refresh to get auto-generated ID and timestamp

        return {
            "message": f"Successfully uploaded and processed {safe_filename}",
            "document_id": db_document.id,
            "filename": db_document.filename,
            "uploaded_at": db_document.uploaded_at.isoformat(),
            "extracted_text_preview": text_content[:500] + "..." if len(text_content) > 500 else text_content
        }
    except Exception as e:
        # Clean up partially uploaded/processed files if error occurs
        if os.path.exists(file_path):
            os.remove(file_path)
        if text_file_path and os.path.exists(text_file_path):
            os.remove(text_file_path)
        raise HTTPException(status_code=500, detail=f"Could not process file: {e}")