from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from typing import Annotated
import shutil
from fastapi.middleware.cors import CORSMiddleware
import os
import fitz # PyMuPDF
from sqlalchemy.orm import Session
# from pydantic import BaseModel # No longer explicitly needed here if schemas are used properly
from sqlalchemy.exc import IntegrityError # NEW: Import IntegrityError for robust handling

from .database import engine, Base, get_db
from . import models, schemas # Make sure schemas is imported
from .nlp_utils import process_text_and_create_vector_store, get_qa_chain

# IMPORTANT: Uncomment this line to create your database tables if they don't exist.
# You only need to run this once when setting up your database for the first time.



app = FastAPI()
origins = [
    "http://localhost:3000", # Default for Create React App
    "http://localhost:5173", # Default for Vite React
    # Add any other origins where your frontend might be hosted (e.g., your deployment URL)
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"], # Allows all HTTP methods (GET, POST, PUT, DELETE, etc.)
    allow_headers=["*"], # Allows all headers
)


UPLOAD_DIR = "backend/pdfs"
TEXT_DIR = "backend/extracted_texts"

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(TEXT_DIR, exist_ok=True)

@app.get("/")
async def read_root():
    return {"message": "Welcome to the PDF Q&A Backend!"}

# CHANGE: Response model updated to schemas.DocumentResponse
@app.post("/upload-pdf/", response_model=schemas.DocumentResponse)
async def upload_pdf(
    file: Annotated[UploadFile, File()],
    db: Session = Depends(get_db)
):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Invalid file type. Only PDF files are allowed.")

    # Renamed from safe_filename to filename for clarity
    filename = os.path.basename(file.filename)
    file_path = os.path.join(UPLOAD_DIR, filename)

    # --- NEW LOGIC: Check if document with this filename already exists ---
    existing_document = db.query(models.Document).filter(models.Document.filename == filename).first()

    if existing_document:
        # If document exists, return its ID and a message without re-processing
        print(f"Document '{filename}' already exists. Using existing ID: {existing_document.id}") # For server logs
        return schemas.DocumentResponse(
            id=existing_document.id,
            filename=existing_document.filename,
            uploaded_at=existing_document.uploaded_at,
            message=f"PDF with filename '{filename}' already exists. Using existing document."
        )

    # --- ORIGINAL LOGIC (for new uploads): Proceed with saving and processing ---
    text_content = ""
    text_file_path = None

    try:
        with open(file_path, "wb") as buffer:
            # Changed await file.read() to shutil.copyfileobj(file.file, buffer) for consistency
            shutil.copyfileobj(file.file, buffer)

        doc = fitz.open(file_path)
        for page in doc:
            text_content += page.get_text()
        doc.close()

        text_filename = os.path.splitext(filename)[0] + ".txt" # Use filename here
        text_file_path = os.path.join(TEXT_DIR, text_filename)
        with open(text_file_path, "w", encoding="utf-8") as text_file:
            text_file.write(text_content)

        db_document = models.Document(filename=filename) # Use filename here
        db.add(db_document)
        db.commit()
        db.refresh(db_document)

        # Process text and create/update vector store using the generated document_id
        # This function should ensure that vector embeddings are also created/updated for this new document
        process_text_and_create_vector_store(text_content, db_document.id)

        # CHANGE: Return schemas.DocumentResponse instead of models.Document
        return schemas.DocumentResponse(
            id=db_document.id,
            filename=db_document.filename,
            uploaded_at=db_document.uploaded_at,
            message="PDF uploaded and processed successfully."
        )
    except IntegrityError:
        # This specific catch is a fallback for race conditions, less likely after the direct check
        db.rollback()
        if os.path.exists(file_path):
            os.remove(file_path)
        if text_file_path and os.path.exists(text_file_path):
            os.remove(text_file_path)
        raise HTTPException(status_code=409, detail=f"A PDF with filename '{filename}' was concurrently added by another process.")
    except Exception as e:
        db.rollback()
        # Clean up files if they were partially created or other errors occurred
        if os.path.exists(file_path):
            os.remove(file_path)
        if text_file_path and os.path.exists(text_file_path):
            os.remove(text_file_path)
        raise HTTPException(status_code=500, detail=f"Could not process file: {e}")

# NOTE: QuestionRequest and AnswerResponse are defined here in your provided code.
# For better organization, consider moving these to backend/schemas.py if not already there.
from pydantic import BaseModel # Ensure BaseModel is imported if these classes are kept here

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