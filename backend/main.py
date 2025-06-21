# backend/main.py
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from typing import Annotated
import shutil
import os
import fitz # PyMuPDF
from sqlalchemy.orm import Session
from pydantic import BaseModel

from .database import engine, Base, get_db
from . import models, schemas
from .nlp_utils import process_text_and_create_vector_store, get_qa_chain

#models.Base.metadata.create_all(bind=engine)


app = FastAPI()

UPLOAD_DIR = "backend/pdfs"
TEXT_DIR = "backend/extracted_texts"

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(TEXT_DIR, exist_ok=True)

@app.get("/")
async def read_root():
    return {"message": "Welcome to the PDF Q&A Backend!"}

@app.post("/upload-pdf/", response_model=schemas.Document)
async def upload_pdf(
    file: Annotated[UploadFile, File()],
    db: Session = Depends(get_db)
):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed.")

    safe_filename = os.path.basename(file.filename)
    file_path = os.path.join(UPLOAD_DIR, safe_filename)
    text_content = ""
    text_file_path = None

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        doc = fitz.open(file_path)
        for page in doc:
            text_content += page.get_text()
        doc.close()

        text_filename = os.path.splitext(safe_filename)[0] + ".txt"
        text_file_path = os.path.join(TEXT_DIR, text_filename)
        with open(text_file_path, "w", encoding="utf-8") as text_file:
            text_file.write(text_content)

        db_document = models.Document(filename=safe_filename)
        db.add(db_document)
        db.commit()
        db.refresh(db_document)

        # Process text and create/update vector store using the generated document_id
        process_text_and_create_vector_store(text_content, db_document.id)

        return db_document
    except Exception as e:
        if os.path.exists(file_path):
            os.remove(file_path)
        if text_file_path and os.path.exists(text_file_path):
            os.remove(text_file_path)
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Could not process file: {e}")

class QuestionRequest(BaseModel):
    document_id: int
    question: str

class AnswerResponse(BaseModel):
    answer: str
    document_id: int
    question: str

@app.post("/ask-question/", response_model=AnswerResponse)
async def ask_question(
    request: QuestionRequest,
    db: Session = Depends(get_db)
):
    document_id = request.document_id
    question = request.question

    db_document = db.query(models.Document).filter(models.Document.id == document_id).first()
    if not db_document:
        raise HTTPException(status_code=404, detail=f"Document with ID {document_id} not found.")

    try:
        qa_chain = get_qa_chain(document_id)
        result = qa_chain.invoke({"query": question})

        answer = result.get("result", "Could not find an answer.")

        return {
            "answer": answer,
            "document_id": document_id,
            "question": question
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing question: {e}. "
                                                    "Ensure the document was processed correctly and Ollama is running.")