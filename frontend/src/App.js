import React, { useState } from 'react';
import './App.css';

const API_BASE_URL = 'http://127.0.0.1:8000'; 
function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadMessage, setUploadMessage] = useState('');
  const [documentId, setDocumentId] = useState(null);
  const [documentName, setDocumentName] = useState('upload your pdf here'); 
  const [question, setQuestion] = useState('');
  const [conversation, setConversation] = useState([]); 
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');


  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
      setDocumentName(file.name); 
      setUploadMessage('');
      setError('');
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setUploadMessage('Please select a file first!');
      return;
    }

    setLoading(true);
    setError('');
    setUploadMessage('');
    setConversation([]);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await fetch(`${API_BASE_URL}/upload-pdf/`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'File upload failed.');
      }

      const data = await response.json();
      setUploadMessage(`File uploaded! Document ID: ${data.id}`);
      setDocumentId(data.id);
      
    } catch (err) {
      setError(`Upload Error: ${err.message}`);
      setDocumentId(null);
      setDocumentName('demo.pdf');
    } finally {
      setLoading(false);
      
      document.getElementById('pdfFileInput').value = '';
    }
  };

  
  const handleQuestionChange = (event) => {
    setQuestion(event.target.value);
  };

  const handleAskQuestion = async () => {
    if (!documentId) {
      setError('Please upload a PDF first and get a Document ID.');
      return;
    }
    if (!question.trim()) {
      setError('Please enter a question.');
      return;
    }

    const userQuestion = question.trim();
    setConversation(prev => [...prev, { type: 'user', text: userQuestion }]); 
    setQuestion(''); 
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/ask-question/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ document_id: documentId, question: userQuestion }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to get answer.');
      }

      const data = await response.json();
      setConversation(prev => [...prev, { type: 'ai', text: data.answer }]); 
    } catch (err) {
      setError(`Question Error: ${err.message}`);
      setConversation(prev => [...prev, { type: 'ai', text: `Error: ${err.message}` }]); 
    } finally {
      setLoading(false);
    }
  };

  
  return (
    <div className="app-container">
      
      <header className="app-header">
        <div className="logo-section">
          
          <img src="/src/assets/ai_planet_logo.png" alt="AI Planet Logo" className="logo" /> 
        </div>
        <div className="document-section">
          
          <input
            type="file"
            id="pdfFileInput"
            accept=".pdf"
            onChange={handleFileChange}
            style={{ display: 'none' }} 
          />
          <label htmlFor="pdfFileInput" className="document-name-label">
            <span className="pdf-icon">📄</span> {documentName}
          </label>
          <button className="upload-btn" onClick={handleUpload} disabled={loading}>
            <span className="plus-icon">+</span> Upload PDF
          </button>
        </div>
      </header>

      {/* Main Chat Window */}
      <main className="chat-window">
        {conversation.length === 0 && !loading && !error && (
          <div className="welcome-message">
            <p>Upload a PDF and start asking questions!</p>
            {documentId && <p>Currently chatting about Document ID: {documentId}</p>}
          </div>
        )}

        {conversation.map((msg, index) => (
          <div key={index} className={`message-bubble ${msg.type}`}>
            <span className="avatar">{msg.type === 'user' ? 'S' : 'ai'}</span> 
            <div className="message-content">
              {msg.type === 'user' ? `${msg.text}` : msg.text} 
            </div>
          </div>
        ))}

        {loading && <div className="loading-indicator">Thinking...</div>}
        {error && <div className="error-message">{error}</div>}
      </main>

      {/* Message Input at the Bottom */}
      <footer className="message-input-container">
        <textarea
          placeholder="Send a message..."
          value={question}
          onChange={handleQuestionChange}
          onKeyPress={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { 
              e.preventDefault(); 
              handleAskQuestion();
            }
          }}
          rows="1" 
          disabled={loading || !documentId}
        ></textarea>
        <button onClick={handleAskQuestion} disabled={loading || !documentId || !question.trim()}>
          <span className="send-icon">➤</span>
        </button>
      </footer>
    </div>
  );
}

export default App;