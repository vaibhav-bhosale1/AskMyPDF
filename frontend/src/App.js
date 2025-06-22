"use client"

import { useState, useEffect, useRef } from "react" // Import useEffect and useRef

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
        const errorData = await response.json()
        if (response.status === 409 && errorData.id) {
          alert(errorData.message);
          setDocumentId(errorData.id);
          setDocumentName(errorData.filename);
          setUploadMessage(errorData.message);
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
    // Assign a unique ID to each message for feedback tracking
    const messageId = Date.now()
    setConversation((prev) => [...prev, { type: "user", text: userQuestion, id: messageId }])
    setQuestion("")
    setLoading(true)
    setError("")

    try {
      const response = await fetch(`${API_BASE_URL}/ask-question/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ document_id: documentId, question: userQuestion }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || "Failed to get answer.")
      }

      const data = await response.json()
      // Store the AI message along with its sources
      setConversation((prev) => [
        ...prev,
        {
          type: "ai",
          text: data.answer,
          id: messageId + 1, // Another unique ID for AI response
          sources: data.source_documents || [], // Store source documents
          feedbackGiven: false // Initial state for feedback
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
        <div className="flex-1 overflow-y-auto px-6 lg:px-8 py-4 lg:py-6 space-y-4 lg:space-y-6">
          {/* Show when no PDF uploaded */}
          {!documentId && conversation.length === 0 && !loading && !error && (
            <div className="text-center text-gray-500 mt-8">
              <p className="text-sm lg:text-base">
                Upload a PDF and start asking questions!
              </p>
            </div>
          )}

          {/* Show when PDF uploaded, but no questions yet */}
          {documentId && conversation.length === 0 && !loading && !error && (
            <div className="text-center text-green-600 mt-8">
              <p className="text-sm lg:text-base">
                Now you can ask questions about your PDF!
              </p>
            </div>
          )}

          {conversation.map((msg, index) => (
            <div key={msg.id} className="flex items-start space-x-3 lg:space-x-4"> {/* Use msg.id as key */}
              {/* Avatar */}
              <div
                className={`w-10 h-10 lg:w-12 lg:h-12 rounded-full flex items-center justify-center text-white font-semibold text-sm lg:text-base flex-shrink-0 ${
                  msg.type === "user" ? "bg-purple-500" : "bg-green-500"
                }`}
              >
                {msg.type === "user" ? "S" : "ai"}
              </div>

              {/* Message Content */}
              <div className="flex-1 lg:max-w-3xl bg-gray-50 rounded-2xl rounded-tl-sm px-4 lg:px-6 py-3 lg:py-4">
                <p className="text-gray-800 text-sm lg:text-base leading-relaxed">{msg.text}</p>

                {/* Source Documents Display (Innovation 1) */}
                {msg.type === "ai" && msg.sources && msg.sources.length > 0 && (
                  <div className="mt-2 text-xs text-gray-600 border-t border-gray-200 pt-2">
                    Source(s): Page(s) {getUniquePageNumbers(msg.sources).join(', ')}
                  </div>
                )}

                {/* User Feedback Controls (Innovation 2) */}
                {msg.type === "ai" && (
                    <div className="mt-3 flex space-x-2 justify-end"> {/* Align feedback to the right */}
                        <button
                            onClick={() => handleFeedback(msg.id, 'positive')}
                            disabled={msg.feedbackGiven} // Disable after feedback
                            className={`p-1 rounded-full ${msg.feedbackGiven ? 'text-gray-400 cursor-not-allowed' : 'text-green-600 hover:bg-green-100'}`}
                            title="Helpful"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6.382 11.023A1.35 1.35 0 017 11c.884 0 1.57-.44 1.948-1.045l.003-.004L9.9 8.2A1 1 0 0110 8c.417 0 .806.285.992.676.664 1.408 2.054 1.957 3.522 1.957h1.082c.086 0 .17-.01.25-.024a1.688 1.688 0 001.26-1.743l-.707-10.597A1.5 1.5 0 0015.177 3H15V2.25A2.25 2.25 0 0012.75 0h-2.25a.75.75 0 00-.75.75v3.5a.75.75 0 00.75.75H12a.75.75 0 01.75.75v1.5a.75.75 0 01-.75.75h-.75V7.5a.75.75 0 00-.75-.75h-.75a.75.75 0 00-.75.75v.75H6.382zM4.5 18h11a1.5 1.5 0 001.5-1.5v-9a1.5 1.5 0 00-1.5-1.5h-11A1.5 1.5 0 003 7.5v9A1.5 1.5 0 004.5 18z" clipRule="evenodd" />
                            </svg>
                        </button>
                        <button
                            onClick={() => handleFeedback(msg.id, 'negative')}
                            disabled={msg.feedbackGiven} // Disable after feedback
                            className={`p-1 rounded-full ${msg.feedbackGiven ? 'text-gray-400 cursor-not-allowed' : 'text-red-600 hover:bg-red-100'}`}
                            title="Not Helpful"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 rotate-180" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6.382 11.023A1.35 1.35 0 017 11c.884 0 1.57-.44 1.948-1.045l.003-.004L9.9 8.2A1 1 0 0110 8c.417 0 .806.285.992.676.664 1.408 2.054 1.957 3.522 1.957h1.082c.086 0 .17-.01.25-.024a1.688 1.688 0 001.26-1.743l-.707-10.597A1.5 1.5 0 0015.177 3H15V2.25A2.25 2.25 0 0012.75 0h-2.25a.75.75 0 00-.75.75v3.5a.75.75 0 00.75.75H12a.75.75 0 01.75.75v1.5a.75.75 0 01-.75.75h-.75V7.5a.75.75 0 00-.75-.75h-.75a.75.75 0 00-.75.75v.75H6.382zM4.5 18h11a1.5 1.5 0 001.5-1.5v-9a1.5 1.5 0 00-1.5-1.5h-11A1.5 1.5 0 003 7.5v9A1.5 1.5 0 004.5 18z" clipRule="evenodd" />
                            </svg>
                        </button>
                    </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-center justify-center py-4">
              <div className="text-gray-500 text-sm lg:text-base">Thinking...</div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 lg:p-4 text-red-700 text-sm lg:text-base">
              {error}
            </div>
          )}

          {uploadMessage && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 lg:p-4 text-green-700 text-sm lg:text-base">
              {uploadMessage}
            </div>
          )}
          <div ref={chatEndRef} /> {/* For auto-scrolling */}
        </div>

        {/* Message Input */}
        <div className="px-6 lg:px-8 py-4 lg:py-6 border-t border-gray-100">
          <div className="flex items-center space-x-3 lg:space-x-4">
            <div className="flex-1 relative">
              <textarea
                value={question}
                onChange={handleQuestionChange}
                onKeyPress={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleAskQuestion()
                  }
                }}
                placeholder="Send a message..."
                disabled={loading || !documentId}
                className="w-full px-4 lg:px-6 py-3 lg:py-4 pr-12 bg-gray-50 border border-gray-200 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm lg:text-base placeholder-gray-500 disabled:bg-gray-100"
                rows="1"
                style={{ minHeight: "48px", maxHeight: "120px" }}
              />
            </div>

            <button
              onClick={handleAskQuestion}
              disabled={loading || !documentId || !question.trim()}
              className="w-12 h-12 lg:w-14 lg:h-14 bg-black rounded-xl flex items-center justify-center hover:bg-gray-800 transition-colors disabled:bg-gray-300"
            >
              <svg className="w-5 h-5 lg:w-6 lg:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App