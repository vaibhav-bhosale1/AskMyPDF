# backend/nlp_utils.py (updated for Google Gemini API)
import os
from typing import List
from dotenv import load_dotenv

# LangChain imports for Google Gemini
from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
from langchain.chains import RetrievalQA
from langchain.prompts import PromptTemplate
from langchain.schema import Document

load_dotenv() # Load environment variables

# Initialize Google Gemini components
if not os.getenv("GOOGLE_API_KEY"):
    raise ValueError("GOOGLE_API_KEY environment variable not set.")

# Using a suitable Gemini model for chat and embeddings
# gemini-pro is good for general text, gemini-pro-vision for multimodal
llm = ChatGoogleGenerativeAI(model="models/gemini-1.5-flash", temperature=0.0)
embeddings = GoogleGenerativeAIEmbeddings(model="models/embedding-001") # Recommended embedding model for Gemini

# Define a consistent directory for ChromaDB persistence
CHROMA_DB_DIR = "chroma_db"
os.makedirs(CHROMA_DB_DIR, exist_ok=True)


def process_text_and_create_vector_store(text_content: str, document_id: int):
    """
    Splits text, creates embeddings, and stores them in a ChromaDB vector store.
    Each document will have its own collection within ChromaDB, identified by document_id.
    """
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
        length_function=len,
    )
    texts = text_splitter.split_text(text_content)

    documents = [Document(page_content=t, metadata={"document_id": document_id}) for t in texts]

    collection_name = f"document_{document_id}_collection"

    vectorstore = Chroma.from_documents(
        documents=documents,
        embedding=embeddings, # Use Google Generative AI Embeddings
        persist_directory=CHROMA_DB_DIR,
        collection_name=collection_name
    )

    vectorstore.persist()
    print(f"Vector store created and persisted for document ID {document_id} in collection '{collection_name}'.")
    return vectorstore


def get_qa_chain(document_id: int):
    """
    Loads the vector store for a specific document and creates a QA chain.
    """
    collection_name = f"document_{document_id}_collection"

    vectorstore = Chroma(
        persist_directory=CHROMA_DB_DIR,
        embedding_function=embeddings, # Use Google Generative AI Embeddings
        collection_name=collection_name
    )

    if not vectorstore:
        raise ValueError(f"Vector store not found for document ID {document_id}")

    prompt_template = """Use the following pieces of context to answer the user's question.
    If you don't know the answer, just say that you don't know, don't try to make up an answer.
    Always answer as concisely as possible.

    {context}

    Question: {question}
    Helpful Answer:"""

    QA_CHAIN_PROMPT = PromptTemplate(
        input_variables=["context", "question"],
        template=prompt_template,
    )

    qa_chain = RetrievalQA.from_chain_type(
        llm, # Use Google Gemini LLM
        retriever=vectorstore.as_retriever(search_kwargs={"k": 2}), # Keep k=2 for faster responses
        chain_type_kwargs={"prompt": QA_CHAIN_PROMPT},
        return_source_documents=False
    )
    return qa_chain