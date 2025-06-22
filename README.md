# AskMyPdf Application

This is a full-stack application that allows users to upload PDF documents and ask questions regarding their content. The backend processes the documents using natural language processing (NLP) to provide answers, and the frontend provides an intuitive chat interface.

---

## 1. Objective

To develop a full-stack application where users can upload PDF documents and then ask questions about the content of those documents. The backend will process these documents and utilize natural language processing to provide answers to the questions posed by the users.

---

## 2. Features

* **PDF Upload**: Users can upload PDF documents to the application. The application stores the PDF and extracts its text content for further processing.
* **Intelligent Question Answering**: Users can ask questions related to the content of an uploaded PDF, and the system processes the question and the content of the PDF to provide an answer.
* **Conversation Interface**: Displays answers and allows for follow-up or new questions on the same document.
* **User Feedback**: Implements feedback mechanisms while uploading documents and processing questions. Displays error messages for unsupported file types or processing errors.

---

## 3. Tools and Technologies

* **Backend**: FastAPI
* **NLP Processing**: LangChain (for orchestrating the RAG pipeline), Google Gemini (`gemini-1.5-flash` for LLM, `embedding-001` for embeddings), and ChromaDB (for vector storage).
* **Text Extraction**: PyMuPDF (used internally by the backend).
* **Frontend**: React.js, Tailwind CSS.
* **Database**: SQLite (managed by SQLAlchemy) for storing document metadata.
* **File Storage**: Local filesystem for storing uploaded PDFs and extracted text content.

---

## 4. Application Architecture

The application employs a **client-server architecture** with a clear separation between the frontend and backend components.

### Frontend (`frontend/`)

This is a **React.js** single-page application responsible for the user interface. It handles:
* User interactions for uploading PDF files.
* Displaying the chat conversation history (user questions and AI answers).
* Sending API requests to the backend for PDF uploads and question answering.

### Backend (`backend/`)

This is a **FastAPI** application that serves as the API for the frontend. Its key responsibilities include:
* **File Handling**: Receiving PDF uploads, saving them locally, and extracting text content using PyMuPDF.
* **Data Management**: Storing metadata about uploaded documents (like filename and upload date) in an **SQLite database** using SQLAlchemy.
* **NLP Processing (RAG Pipeline)**:
    * **Text Chunking**: Splits extracted PDF text into smaller segments.
    * **Embedding Generation**: Converts text chunks into numerical vector representations (embeddings) using **Google Generative AI Embeddings**.
    * **Vector Storage**: Stores these embeddings in a persistent **ChromaDB vector store**. Each uploaded PDF gets its own dedicated collection.
    * **Retrieval-Augmented Generation (RAG)**: When a user asks a question, the system retrieves the most relevant text chunks from the corresponding PDF's vector store. These retrieved chunks, along with the user's question, are then provided as context to the **Google Gemini LLM** (`gemini-1.5-flash`) via LangChain's `RetrievalQA` chain to generate a precise answer.

### Data Flow Overview

1.  **PDF Upload**: User uploads a PDF via the Frontend. Frontend sends the PDF to the Backend's `/upload-pdf/` endpoint. Backend processes, saves, and creates embeddings in ChromaDB, then returns a `document_id`.
2.  **Question Answering**: User asks a question on the Frontend. Frontend sends the question and `document_id` to the Backend's `/ask-question/` endpoint. Backend retrieves context from ChromaDB, uses Gemini to generate an answer, and sends it back to the Frontend. Frontend displays the answer.

---

## 5. Setup Instructions

To get the application running on your local machine, follow these steps:

### Prerequisites

Ensure you have the following installed:

* **Python 3.9+**
* **Node.js (LTS recommended)** and **npm** (comes with Node.js)
* **Google API Key**: An API key from Google Cloud with access to the Gemini API and Embedding API. You'll need to set this as an environment variable.

### Backend Setup

1.  **Navigate to the `backend` directory:**
    ```bash
    cd backend
    ```
2.  **Create and activate a Python virtual environment:**
    ```bash
    python -m venv venv
    # On Windows: .\venv\Scripts\activate
    # On macOS/Linux: source venv/bin/activate
    ```
3.  **Install Python dependencies:**
    ```bash
    pip install fastapi uvicorn python-dotenv langchain-google-genai chromadb pymupdf sqlalchemy pydantic
    # Or if you have requirements.txt: pip install -r requirements.txt
    ```
4.  **Create a `.env` file**: In the `backend` directory, create a file named `.env` and add your Google API Key:
    ```
    GOOGLE_API_KEY="YOUR_GOOGLE_API_KEY_HERE"
    ```
    Replace `"YOUR_GOOGLE_API_KEY_HERE"` with your actual key.
5.  **Run the FastAPI application:**
    ```bash
    uvicorn main:app --reload
    ```
    The backend server will typically start at `http://127.0.0.1:8000`. Keep this terminal running.

### Frontend Setup

1.  **Open a new terminal and navigate to the `frontend` directory:**
    ```bash
    cd frontend
    ```
2.  **Install Node.js dependencies:**
    ```bash
    npm install
    ```
3.  **Start the React development server:**
    ```bash
    npm run dev
    ```
    The frontend application should automatically open in your web browser, usually at `http://localhost:5173` or `http://localhost:3000`.

---

## 6. API Documentation

The backend API, built with FastAPI, automatically generates interactive documentation.

* **Swagger UI**: Access interactive documentation at `http://127.0.0.1:8000/docs`.
* **ReDoc**: Access alternative documentation at `http://127.0.0.1:8000/redoc`.

### Key Endpoints:

* **`POST /upload-pdf/`**
    * **Description**: Uploads a PDF, processes its text, creates embeddings in ChromaDB, and stores document metadata.
    * **Request**: `multipart/form-data` (field: `file`).
    * **Response**: `200 OK` with document ID and details. Handles `400` (invalid file) and `409` (file exists).

* **`POST /ask-question/`**
    * **Description**: Receives a question and a `document_id`. Retrieves context from the PDF's vector store and generates an AI answer.
    * **Request**: `application/json` (fields: `document_id`, `question`).
    * **Response**: `200 OK` with the `answer`. Handles `404` (document not found) and `500` (processing error).

---

## 7. Usage

1.  **Start both the Backend and Frontend servers** as per the setup instructions.
2.  **Open the frontend URL** in your browser (e.g., `http://localhost:3000`).
3.  **Click "select pdf here"** to upload a PDF, then click **"Upload"**. A message will confirm the upload.
4.  **Enter your question** in the text input field and press Enter or click send.
5.  The AI's answer, based on your uploaded PDF, will appear in the chat.
