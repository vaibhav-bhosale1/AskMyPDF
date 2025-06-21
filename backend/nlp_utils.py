# backend/nlp_utils.py (updated for Local Models)
import os
from typing import List
from dotenv import load_dotenv

# LangChain imports for local models
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.llms import Ollama
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
from langchain.chains import RetrievalQA
from langchain.prompts import PromptTemplate
from langchain.schema import Document

load_dotenv() # Load environment variables (though not strictly needed for local models anymore unless for other config)

# Initialize Local Embeddings
# This will download the 'all-MiniLM-L6-v2' model the first time it's used.
# You can choose other models from Hugging Face if you prefer.
embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

# Initialize Ollama LLM
# Ensure Ollama is running (ollama serve) and 'llama2' model is pulled (ollama run llama2)
llm = Ollama(model="phi3", temperature=0.0) # Use the model you pulled

# Define a consistent directory for ChromaDB persistence
CHROMA_DB_DIR = "backend/chroma_db"
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
        embedding=embeddings,
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
        embedding_function=embeddings,
        collection_name=collection_name
    )

    if not vectorstore:
        raise ValueError(f"Vector store not found for document ID {document_id}")

    prompt_template = """Use the following pieces of context to answer the the question at the end. If you don't know the answer, just say that you don't know, don't try to make up an answer.
    Always answer as concisely as possible.

    {context}

    Question: {question}
    Helpful Answer:"""

    QA_CHAIN_PROMPT = PromptTemplate(
        input_variables=["context", "question"],
        template=prompt_template,
    )

    qa_chain = RetrievalQA.from_chain_type(
        llm,
        retriever=vectorstore.as_retriever(),
        chain_type_kwargs={"prompt": QA_CHAIN_PROMPT},
        return_source_documents=False
    )
    return qa_chain