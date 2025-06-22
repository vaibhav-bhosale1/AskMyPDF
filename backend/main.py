import logging
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from typing import Annotated
import shutil
from fastapi.middleware.cors import CORSMiddleware
import os
import fitz
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from .database import engine, Base, get_db
from . import models, schemas

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

models.Base.metadata.create_all(bind=engine)

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

UPLOAD_DIR = "backend/pdfs"
TEXT_DIR = "backend/extracted_texts"

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(TEXT_DIR, exist_ok=True)

@app.get("/")
async def read_root():
    logging.info("Root endpoint accessed.")
    return {"message": "Welcome to the PDF Q&A Backend!"}

@app.post("/upload-pdf/", response_model=schemas.DocumentResponse)
async def upload_pdf(
    file: Annotated[UploadFile, File()],
    db: Session = Depends(get_db)
):
    logging.info(f"Received file upload request for: {file.filename}")

    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename not provided.")

    if not file.filename.endswith(".pdf"):
        logging.warning(f"Invalid file type uploaded: {file.filename}")
        raise HTTPException(status_code=400, detail="Invalid file type. Only PDF files are allowed.")

    filename = os.path.basename(file.filename)
    file_path = os.path.join(UPLOAD_DIR, filename)

    existing_document = db.query(models.Document).filter(models.Document.filename == filename).first()

    if existing_document:
        logging.info(f"Document '{filename}' already exists. Using existing ID: {existing_document.id}")
        return schemas.DocumentResponse(
            id=existing_document.id,
            filename=existing_document.filename,
            uploaded_at=existing_document.uploaded_at,
            message=f"PDF with filename '{filename}' already exists. Using existing document."
        )

    text_content = ""
    text_file_path = None

    try:
        logging.info(f"Saving new file: {filename}")
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        doc = fitz.open(file_path)
        for page in doc:
            text_content += page.get_text()
        doc.close()

        text_filename = os.path.splitext(filename)[0] + ".txt"
        text_file_path = os.path.join(TEXT_DIR, text_filename)
        with open(text_file_path, "w", encoding="utf-8") as text_file:
            text_file.write(text_content)

        db_document = models.Document(filename=filename)
        db.add(db_document)
        db.commit()
        db.refresh(db_document)

        logging.info(f"File '{filename}' saved and document ID {db_document.id} created. Starting NLP processing.")
        nlp_utils.process_text_and_create_vector_store(text_content, db_document.id)
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
            os.remove(file_path)
        if text_file_path and os.path.exists(text_file_path):
            os.remove(text_file_path)
        logging.error(f"IntegrityError during upload for {filename}.")
        raise HTTPException(status_code=409, detail=f"A PDF with filename '{filename}' was concurrently added by another process.")
    except Exception as e:
        db.rollback()
        if os.path.exists(file_path):
            os.remove(file_path)
        if text_file_path and os.path.exists(text_file_path):
            os.remove(text_file_path)
        logging.error(f"Error processing file {filename}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Could not process file: {e}")

@app.post("/ask-question/", response_model=schemas.AnswerResponse)
async def ask_question(
    request: schemas.QuestionRequest,
    db: Session = Depends(get_db)
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
        logging.info(f"Answer generated for document ID {document_id}: '{answer[:50]}...'")

        return {
            "answer": answer,
            "document_id": document_id,
            "question": question
        }
    except Exception as e:
        logging.error(f"Error answering question for document ID {document_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error processing question: {e}. "
                                                     "Ensure the document was processed correctly and Ollama is running.")