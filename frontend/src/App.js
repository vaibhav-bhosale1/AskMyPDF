"use client"

import { useState, useEffect, useRef } from "react" // Import useEffect and useRef
import DuplicateFileModal from "./components/DuplicateFileModal";
import ChatArea from "./components/ChatArea";
import MessageInput from "./components/MessageInput";
const API_BASE_URL = "http://127.0.0.1:8000"

function App() {
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploadMessage, setUploadMessage] = useState("")
  const [documentId, setDocumentId] = useState(null)
  const [documentName, setDocumentName] = useState("upload your pdf here")
  const [question, setQuestion] = useState("")
  // Update conversation state to include source_documents for AI messages
  // Each message will now be: { type: "user" | "ai", text: string, id: number, sources?: Array<{ page_content: string, metadata: { page: number } }>, feedbackGiven?: boolean }
  const [conversation, setConversation] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // New state variables for handling duplicate files
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateFileData, setDuplicateFileData] = useState(null);

  // Ref for auto-scrolling chat
  const chatEndRef = useRef(null)

  // Auto-scroll to bottom of chat area when conversation updates
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [conversation])


  const handleFileChange = (event) => {
    const file = event.target.files[0]
    if (file) {
      setSelectedFile(file)
      setDocumentName(file.name)
      setUploadMessage("")
      setError("")
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) {
      setUploadMessage("Please select a file first!")
      return
    }

    setLoading(true)
    setError("")
    setUploadMessage("")
    setConversation([]) // Clear conversation on new upload

    const formData = new FormData()
    formData.append("file", selectedFile)

    try {
      const response = await fetch(`${API_BASE_URL}/upload-pdf/`, {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 409 && errorData.action_required) {
          setDuplicateFileData(errorData);
          setShowDuplicateModal(true);
          setError("A file with this name already exists. Please choose an action.");
          return;
        }
        throw new Error(errorData.detail || "File upload failed.");
      }

      const data = await response.json();
      alert(`File uploaded! Document ID: ${data.id}`);
      setDocumentId(data.id);
      setDocumentName(data.filename);
      setUploadMessage(data.message || "PDF uploaded and processed!");
      if (data.message) {
        setTimeout(() => setUploadMessage(""), 3000);
      }

    } catch (err) {
      setError(`Upload Error: ${err.message}`)
      setDocumentId(null)
    } finally {
      setLoading(false)
    }
  }

  const handleQuestionChange = (event) => {
    setQuestion(event.target.value)
  }

 const handleAskQuestion = async () => {
    if (!documentId) {
      setError("Please upload a PDF first and get a Document ID.")
      return
    }
    if (!question.trim()) {
      setError("Please enter a question.")
      return
    }

    const userQuestion = question.trim()
    const messageId = Date.now()
    setConversation((prev) => [...prev, { type: "user", text: userQuestion, id: messageId }])
    setQuestion("")
    setLoading(true)
    setError("")

    try {
      const response = await fetch(`${API_BASE_URL}/ask-question/${documentId}`, { // <-- MODIFIED LINE HERE
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question: userQuestion }), // <-- MODIFIED LINE HERE
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || "Failed to get answer.")
      }

      const data = await response.json()
      setConversation((prev) => [
        ...prev,
        {
          type: "ai",
          text: data.answer,
          id: messageId + 1,
          sources: data.source_documents || [],
          feedbackGiven: false
        },
      ])
    } catch (err) {
      setError(`Question Error: ${err.message}`)
      setConversation((prev) => [...prev, { type: "ai", text: `Error: ${err.message}`, id: Date.now() }])
    } finally {
      setLoading(false)
    }
  }

  // New function to handle feedback submission
  const handleFeedback = async (messageId, feedbackType) => {
    // Prevent submitting feedback multiple times for the same message
    const messageIndex = conversation.findIndex(msg => msg.id === messageId);
    if (messageIndex === -1 || conversation[messageIndex].feedbackGiven) {
        return;
    }

    const aiMessage = conversation[messageIndex];
    // Find the corresponding user question right before this AI message
    const userQuestionIndex = conversation.slice(0, messageIndex).reverse().findIndex(msg => msg.type === 'user');
    const userQuestion = userQuestionIndex !== -1 ? conversation[messageIndex - 1 - userQuestionIndex].text : "N/A";


    const feedbackPayload = {
      document_id: documentId,
      question: userQuestion,
      answer: aiMessage.text,
      feedback_type: feedbackType === 'positive' // Convert to boolean: true for positive, false for negative
    };

    try {
      const response = await fetch(`${API_BASE_URL}/submit-feedback/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(feedbackPayload),
      });

      if (response.ok) {
        console.log("Feedback submitted successfully.");
        // Update the conversation state to mark this message as having feedback given
        setConversation(prev =>
            prev.map(msg =>
                msg.id === messageId ? { ...msg, feedbackGiven: true } : msg
            )
        );
      } else {
        const errorData = await response.json();
        console.error("Failed to submit feedback:", errorData.detail || response.statusText);
        setError(`Failed to submit feedback: ${errorData.detail || response.statusText}`);
      }
    } catch (error) {
      console.error("Error submitting feedback:", error);
      setError(`Error submitting feedback: ${error.message}`);
    }
  };


  // Helper to extract unique page numbers for display
  const getUniquePageNumbers = (sources) => {
    if (!sources || sources.length === 0) return [];
    const pages = new Set();
    sources.forEach(source => {
      if (source.metadata && typeof source.metadata.page === 'number') {
        pages.add(source.metadata.page);
      }
    });
    return Array.from(pages).sort((a, b) => a - b);
  };

  const handleDuplicateAction = async (action) => {
    if (action === 'overwrite') {
      await handleUploadWithAction('overwrite', duplicateFileData.existing_document_id);
    } else if (action === 'new') {
      await handleUploadWithAction('new');
    } else {
      setShowDuplicateModal(false);
      setDuplicateFileData(null);
      setSelectedFile(null);
      setUploadMessage('Upload cancelled.');
    }
  };

  const handleUploadWithAction = async (action, existingDocId = null) => {
    setShowDuplicateModal(false);
    setDuplicateFileData(null);
    setLoading(true);
    setError("");
    setUploadMessage("");
    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("action", action);
    if (existingDocId) {
      formData.append("existing_document_id", existingDocId);
    }
    try {
      const response = await fetch(`${API_BASE_URL}/upload-pdf/`, {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      setDocumentId(data.id);
      setDocumentName(data.filename);
      setUploadMessage(data.message || "PDF uploaded and processed!");
      if (data.message) {
        setTimeout(() => setUploadMessage(""), 3000);
      }
    } catch (err) {
      setError(`Upload Error: ${err.message}`);
      setDocumentId(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md lg:max-w-4xl bg-white rounded-3xl shadow-xl overflow-hidden flex flex-col h-[700px] lg:h-[800px]">
        {/* Header */}
        <div className="bg-white px-6 lg:px-8 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 lg:w-10 lg:h-10 bg-green-500 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-sm lg:text-base">ai</span>
              </div>
              <div>
                <span className="font-bold text-black text-base lg:text-lg">planet</span>
                <div className="text-xs lg:text-sm text-gray-500">formerly DPhi</div>
              </div>
            </div>

            {/* File upload section */}
            <div className="flex items-center space-x-3">
              <input type="file" id="pdfFileInput" accept=".pdf" onChange={handleFileChange} className="hidden" />
              <label
                htmlFor="pdfFileInput"
                className="flex items-center space-x-2 px-3 py-2 lg:px-4 lg:py-3 bg-gray-50 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
              >
                <div className="w-4 h-4 lg:w-5 lg:h-5 text-green-500">

                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
                  </svg>
                </div>
                <span className="text-sm lg:text-base text-gray-700 max-w-[100px] lg:max-w-[150px] truncate">
                  {selectedFile ? documentName : "select pdf here"}
                </span>
              </label>

              <button
                onClick={handleUpload}
                disabled={loading}
                className="w-auto min-w-[60px] h-10 lg:h-12 px-3 lg:px-4 bg-black rounded-lg flex items-center justify-center space-x-2 hover:bg-gray-800 transition-colors disabled:bg-gray-300"
              >
                <span className="text-white text-sm lg:text-base font-medium">Upload</span>
                <span className="text-white text-lg lg:text-xl">+</span>
              </button>
            </div>
          </div>
        </div>

        {/* Chat Area */}
         <ChatArea
        conversation={conversation}
        loading={loading}
        error={error}
        uploadMessage={uploadMessage}
        getUniquePageNumbers={getUniquePageNumbers}
        handleFeedback={handleFeedback}
      />

        {/* Message Input */}
        <MessageInput
        question={question}
        onChange={handleQuestionChange}
        onSend={handleAskQuestion}
        loading={loading}
        documentId={documentId}
      />

        {/* Duplicate File Modal */}
       <DuplicateFileModal
        show={showDuplicateModal}
        data={duplicateFileData}
        loading={loading}
        onAction={handleDuplicateAction}
      />
      </div>
    </div>
  )
}

export default App