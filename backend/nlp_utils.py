# backend/nlp_utils.py (updated for Google Gemini API)
import os
from langchain_community.vectorstores import Chroma
from langchain_google_genai import GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.chains import RetrievalQA
from langchain_core.documents import Document
from typing import List
from dotenv import load_dotenv
import logging

load_dotenv()

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
if not GOOGLE_API_KEY:
    logging.error("GOOGLE_API_KEY not found in environment variables. Please set it.")
    raise ValueError("GOOGLE_API_KEY not found. Please set it in your .env file.")

embeddings = GoogleGenerativeAIEmbeddings(model="models/embedding-001", google_api_key=GOOGLE_API_KEY)
llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash", google_api_key=GOOGLE_API_KEY)

CHROMA_DB_DIR = "backend/chroma_db"
os.makedirs(CHROMA_DB_DIR, exist_ok=True)

def process_documents_and_create_vector_store(documents: List[Document], document_id: int):
    logging.info(f"Processing {len(documents)} documents for document ID: {document_id}")
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
        length_function=len
    )
    chunked_documents = text_splitter.split_documents(documents)
    logging.info(f"Split into {len(chunked_documents)} chunks for document ID: {document_id}")

    collection_name = f"pdf_collection_{document_id}"
    persist_directory = os.path.join(CHROMA_DB_DIR, collection_name)
    logging.info(f"Function process_documents_and_create_vector_store called for document ID: {document_id}")
    logging.info(f"Received {len(documents)} documents for chunking.")

    vectorstore = Chroma.from_documents(
        documents=chunked_documents,
        embedding=embeddings,
        persist_directory=persist_directory,
        collection_name=collection_name
    )
    logging.info(f"ChromaDB initialized for document ID {document_id}. Attempting to persist...")
    vectorstore.persist()
    logging.info(f"Vector store created/updated for document ID: {document_id} at {persist_directory}")
    return vectorstore

def get_qa_chain(document_id: int):
    collection_name = f"pdf_collection_{document_id}"
    persist_directory = os.path.join(CHROMA_DB_DIR, collection_name)
    logging.info(f"Checking for vector store at: {persist_directory}")
    if not os.path.exists(persist_directory) or not os.listdir(persist_directory):
        logging.error(f"ChromaDB directory not found or is empty for document ID {document_id}: {persist_directory}")
        raise FileNotFoundError(f"Vector store not found for document ID {document_id}. Please ensure the PDF was processed correctly.")

   
    vectorstore = Chroma(
        persist_directory=persist_directory,
        embedding_function=embeddings,
        collection_name=collection_name
    )

    qa_chain = RetrievalQA.from_chain_type(
        llm=llm,
        chain_type="stuff",
        retriever=vectorstore.as_retriever(search_kwargs={"k": 4}),
        return_source_documents=True,
        input_key="query"
    )
    logging.info(f"QA chain created for document ID: {document_id}")
    return qa_chain