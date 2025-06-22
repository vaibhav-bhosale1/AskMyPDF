# backend/main.py

import logging
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Form
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
import fitz
from . import database
from dotenv import load_dotenv
from werkzeug.utils import secure_filename
import shutil
import os
from typing import List, Dict, Any 
from datetime import datetime
from typing import Optional

from langchain_core.documents import Document

from . import nlp_utils
from . import models
from . import schemas
from .database import engine, Base, get_db

load_dotenv()

PDF_DIR = "backend/pdfs"
TEXT_DIR = "backend/texts"
CHROMA_DB_DIR = "backend/chroma_db"

os.makedirs(PDF_DIR, exist_ok=True)
os.makedirs(TEXT_DIR, exist_ok=True)
os.makedirs(CHROMA_DB_DIR, exist_ok=True)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

Base.metadata.create_all(bind=engine)

app = FastAPI()

origins = [
    "http://localhost:3000",
    "http://localhost:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def generate_unique_filename(original_filename: str, db: Session) -> str:
    name, ext = os.path.splitext(original_filename)
    counter = 1
    new_filename = original_filename
    while db.query(models.Document).filter(models.Document.filename == new_filename).first():
        new_filename = f"{name} ({counter}){ext}"
        counter += 1
    return new_filename

@app.get("/")
async def read_root():
    logging.info("Root endpoint accessed.")
    return {"message": "Welcome to the PDF Q&A Backend!"}

@app.post("/upload-pdf/", response_model=schemas.DocumentResponse)
async def upload_pdf(
    file: UploadFile = File(...),
    action: Optional[str] = Form(None),
    existing_document_id: Optional[int] = Form(None),
    db: Session = Depends(get_db)
):
    original_filename = secure_filename(file.filename)
    filename_to_use = original_filename
    file_path = ""
    text_file_path = ""
    db_document = None

    try:
        if action == "overwrite" and existing_document_id is not None:
            db_document = db.query(models.Document).filter(models.Document.id == existing_document_id).first()
            if not db_document or db_document.filename != original_filename:
                raise HTTPException(status_code=400, detail="Mismatched document ID or filename for overwrite.")

            logging.info(f"Overwriting file '{original_filename}' (ID: {db_document.id}).")

            old_vector_store_dir = os.path.join(CHROMA_DB_DIR, f"pdf_collection_{db_document.id}")
            if os.path.exists(old_vector_store_dir):
                logging.info(f"Removing old vector store: {old_vector_store_dir}")
                shutil.rmtree(old_vector_store_dir)

            old_text_file_path = os.path.join(TEXT_DIR, os.path.splitext(original_filename)[0] + ".txt")
            if os.path.exists(old_text_file_path):
                logging.info(f"Removing old text file: {old_text_file_path}")
                os.remove(old_text_file_path)

            file_path = os.path.join(PDF_DIR, original_filename)
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            logging.info(f"Overwritten PDF file: {file_path}")

            extracted_documents_with_metadata = []
            with fitz.open(file_path) as doc:
                full_text_content = ""
                for i, page in enumerate(doc):
                    page_text = page.get_text()
                    full_text_content += f"\n--- Page {i+1} ---\n" + page_text
                    extracted_documents_with_metadata.append(
                        Document(page_content=page_text, metadata={"page": i + 1})
                    )

            text_filename = os.path.splitext(original_filename)[0] + ".txt"
            text_file_path = os.path.join(TEXT_DIR, text_filename)
            with open(text_file_path, "w", encoding="utf-8") as text_file:
                text_file.write(full_text_content)

            nlp_utils.process_documents_and_create_vector_store(extracted_documents_with_metadata, db_document.id)
            logging.info(f"Vector store re-processed for existing document ID: {db_document.id}")

            db_document.uploaded_at = datetime.now()
            db.add(db_document)
            db.commit()
            db.refresh(db_document)

            return schemas.DocumentResponse(
                id=db_document.id,
                filename=db_document.filename,
                uploaded_at=db_document.uploaded_at,
                message="PDF content updated and re-processed successfully."
            )

        elif action == "new":
            filename_to_use = generate_unique_filename(original_filename, db)
            logging.info(f"Uploading as new file: '{filename_to_use}'")

        else:
            existing_db_document = db.query(models.Document).filter(models.Document.filename == original_filename).first()
            if existing_db_document:
                logging.info(f"Duplicate filename '{original_filename}' detected for ID: {existing_db_document.id}. Awaiting user action.")
                return JSONResponse(
                    status_code=409,
                    content=schemas.DuplicateFileResponse(
                        message="File with this name already exists. What would you like to do?",
                        existing_document_id=existing_db_document.id,
                        filename=original_filename
                    ).model_dump()
                )
            logging.info(f"Proceeding with initial upload of '{filename_to_use}'")

        file_path = os.path.join(PDF_DIR, filename_to_use)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        extracted_documents_with_metadata = []
        with fitz.open(file_path) as doc:
            full_text_content = ""
            for i, page in enumerate(doc):
                page_text = page.get_text()
                full_text_content += f"\n--- Page {i+1} ---\n" + page_text
                extracted_documents_with_metadata.append(
                    Document(page_content=page_text, metadata={"page": i + 1})
                )

        text_filename = os.path.splitext(filename_to_use)[0] + ".txt"
        text_file_path = os.path.join(TEXT_DIR, text_filename)
        with open(text_file_path, "w", encoding="utf-8") as text_file:
            text_file.write(full_text_content)

        db_document = models.Document(filename=filename_to_use)
        db.add(db_document)
        db.commit()
        db.refresh(db_document)

        logging.info(f"File '{filename_to_use}' saved and document ID {db_document.id} created. Starting NLP processing.")

        nlp_utils.process_documents_and_create_vector_store(extracted_documents_with_metadata, db_document.id)
        logging.info(f"NLP processing complete for document ID: {db_document.id}")

        return schemas.DocumentResponse(
            id=db_document.id,
            filename=db_document.filename,
            uploaded_at=db_document.uploaded_at,
            message="PDF uploaded and processed successfully."
        )

    except IntegrityError:
        db.rollback()
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except OSError as e:
                logging.error(f"Failed to remove file {file_path} after IntegrityError: {e}")
        if text_file_path and os.path.exists(text_file_path):
            try:
                os.remove(text_file_path)
            except OSError as e:
                logging.error(f"Failed to remove text file {text_file_path} after IntegrityError: {e}")
        logging.error(f"IntegrityError during upload for {filename_to_use}.")
        raise HTTPException(status_code=409, detail=f"A PDF with filename '{filename_to_use}' was concurrently added.")
    except Exception as e:
        db.rollback()
        if file_path and os.path.exists(file_path):
            try:
                os.remove(file_path)
            except OSError as e_remove:
                logging.error(f"Failed to remove file {file_path} after processing error: {e_remove}")
        if text_file_path and os.path.exists(text_file_path):
            try:
                os.remove(text_file_path)
            except OSError as e_remove_text:
                logging.error(f"Failed to remove text file {text_file_path} after processing error: {e_remove_text}")
        logging.error(f"Error processing file {filename_to_use}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Could not process file: {e}")

@app.post("/ask-question/", response_model=schemas.QuestionResponse)
async def ask_question(
    document_id: int,
    request: schemas.QuestionRequest,
    db: Session = Depends(database.get_db)
):
    document_id = request.document_id
    question = request.question

    logging.info(f"Received question for document ID {document_id}: '{question}'")

    db_document = db.query(models.Document).filter(models.Document.id == document_id).first()
    if not db_document:
        logging.warning(f"Document with ID {document_id} not found for question: '{question}'")
        raise HTTPException(status_code=404, detail=f"Document with ID {document_id} not found.")

    try:
        qa_chain = get_qa_chain(document_id)
        result = qa_chain.invoke({"query": question})

        answer = result.get("result", "Could not find an answer.")
        source_documents_raw = result.get("source_documents", [])

        source_documents_formatted = []
        for doc in source_documents_raw:
            formatted_metadata = {k: v for k, v in doc.metadata.items() if k in ['page']}
            source_documents_formatted.append(
                schemas.SourceDocument(
                    page_content=doc.page_content,
                    metadata=formatted_metadata
                )
            )

        logging.info(f"Answer generated for document ID {document_id}: '{answer[:50]}...'")
        logging.info(f"Source documents found: {[doc.metadata.get('page') for doc in source_documents_raw if doc.metadata.get('page')]}")

        return {
            "answer": answer,
            "document_id": document_id,
            "question": question,
            "source_documents": source_documents_formatted
        }
    except Exception as e:
        logging.error(f"Error answering question for document ID {document_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error processing question: {e}.")

@app.post("/submit-feedback/")
async def submit_feedback(feedback_data: schemas.FeedbackRequest, db: Session = Depends(get_db)):
    logging.info(f"Received feedback for document ID {feedback_data.document_id}: Type={feedback_data.feedback_type}")

    doc_exists = db.query(models.Document).filter(models.Document.id == feedback_data.document_id).first()
    if not doc_exists:
        raise HTTPException(status_code=404, detail="Document not found for feedback submission.")

    new_feedback = models.Feedback(
        document_id=feedback_data.document_id,
        question=feedback_data.question,
        answer=feedback_data.answer,
        feedback_type=feedback_data.feedback_type,
    )
    db.add(new_feedback)
    db.commit()
    db.refresh(new_feedback)
    logging.info(f"Feedback ID {new_feedback.id} recorded for document ID {feedback_data.document_id}")

    return {"message": "Feedback submitted successfully.", "feedback_id": new_feedback.id}