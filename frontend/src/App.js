"use client"

import { useState } from "react"

const API_BASE_URL = "http://127.0.0.1:8000"

function App() {
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploadMessage, setUploadMessage] = useState("")
  const [documentId, setDocumentId] = useState(null)
  const [documentName, setDocumentName] = useState("upload your pdf here")
  const [question, setQuestion] = useState("")
  const [conversation, setConversation] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

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
    setConversation([])

    const formData = new FormData()
    formData.append("file", selectedFile)

    try {
      const response = await fetch(`${API_BASE_URL}/upload-pdf/`, {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        // If the backend returns a 409 Conflict for duplicate file, extract the ID
        if (response.status === 409 && errorData.id) {
          alert(errorData.message); // Show the duplicate message
          setDocumentId(errorData.id); // Set document ID from the existing one
          setDocumentName(errorData.filename); // Set document name from the existing one
          setUploadMessage(errorData.message); // Display message in UI
          return; // Exit here as it's a "successful" handling of a duplicate
        }
        throw new Error(errorData.detail || "File upload failed.");
      }

      const data = await response.json();
      alert(`File uploaded! Document ID: ${data.id}`);
      // FIX IS HERE: Set the documentId from the response data
      setDocumentId(data.id);
      setDocumentName(data.filename); // Update document name with the actual uploaded/existing filename
      setUploadMessage(data.message || "PDF uploaded and processed!"); // Display success message
       if (data.message) {
      setTimeout(() => setUploadMessage(""), 3000);
    }
      
    } catch (err) {
      setError(`Upload Error: ${err.message}`)
      setDocumentId(null) // Ensure it's null on actual upload failure
      // Keep selectedFile.name if you want to retry the same file,
      // or set to default if you want to clear it completely.
      // For now, let's keep it to allow re-selection or showing the problem.
      // setDocumentName("upload your pdf here"); // Removed: Better to keep the selected file name on error
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
    setConversation((prev) => [...prev, { type: "user", text: userQuestion }])
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
      setConversation((prev) => [...prev, { type: "ai", text: data.answer }])
    } catch (err) {
      setError(`Question Error: ${err.message}`)
      setConversation((prev) => [...prev, { type: "ai", text: `Error: ${err.message}` }])
    } finally {
      setLoading(false)
    }
  }

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
            <div key={index} className="flex items-start space-x-3 lg:space-x-4">
              {/* Avatar */}
              <div
                className={`w-10 h-10 lg:w-12 lg:h-12 rounded-full flex items-center justify-center text-white font-semibold text-sm lg:text-base flex-shrink-0 ${
                  msg.type === "user" ? "bg-purple-500" : "bg-green-500"
                }`}
              >
                {msg.type === "user" ? "S" : "ai"}
              </div>

              {/* Message */}
              <div className="flex-1 lg:max-w-3xl bg-gray-50 rounded-2xl rounded-tl-sm px-4 lg:px-6 py-3 lg:py-4">
                <p className="text-gray-800 text-sm lg:text-base leading-relaxed">{msg.text}</p>
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
