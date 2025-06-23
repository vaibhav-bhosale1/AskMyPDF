import React, { useRef, useEffect, useState } from "react";
import ThinkingLoader from "./Loader";

export default function ChatArea({ conversation, loading, error, uploadMessage, getUniquePageNumbers, handleFeedback }) {
  const chatEndRef = useRef(null);
  const [copiedMessageId, setCopiedMessageId] = useState(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation]);

  const handleCopy = async (text, messageId) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-6 lg:px-8 py-4 lg:py-6 space-y-4 lg:space-y-6">
      {conversation.map((msg, index) => (
        <div key={msg.id} className="flex items-start space-x-3 lg:space-x-4">
          <div className={`w-10 h-10 lg:w-12 lg:h-12 rounded-full flex items-center justify-center text-white font-semibold text-sm lg:text-base flex-shrink-0 ${
            msg.type === "user" ? "bg-purple-500" : "bg-green-500"
          }`}>
            {msg.type === "user" ? "S" : "ai"}
          </div>
          <div className="flex-1 lg:max-w-3xl bg-gray-50 rounded-2xl rounded-tl-sm px-4 lg:px-6 py-3 lg:py-4">
            <p className="text-gray-800 text-sm lg:text-base leading-relaxed">{msg.text}</p>
            {msg.type === "ai" && msg.sources && msg.sources.length > 0 && (
              <div className="mt-2 text-xs text-gray-600 border-t border-gray-200 pt-2">
                Source(s): Page(s) {getUniquePageNumbers(msg.sources).join(', ')}
              </div>
            )}
            {msg.type === "ai" && (
              <div className="mt-3 flex space-x-2 justify-end">
                <button
                  onClick={() => handleCopy(msg.text, msg.id)}
                  className="p-1 rounded-full text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors"
                  title={copiedMessageId === msg.id ? "Copied!" : "Copy response"}
                >
                  {copiedMessageId === msg.id ? "✓" : "📋"}
                </button>
                <button
                  onClick={() => handleFeedback(msg.id, 'positive')}
                  disabled={msg.feedbackGiven}
                  className={`p-1 rounded-full ${msg.feedbackGiven ? 'text-gray-400 cursor-not-allowed' : 'text-green-600 hover:bg-green-100'}`}
                  title="Helpful"
                >👍</button>
                <button
                  onClick={() => handleFeedback(msg.id, 'negative')}
                  disabled={msg.feedbackGiven}
                  className={`p-1 rounded-full ${msg.feedbackGiven ? 'text-gray-400 cursor-not-allowed' : 'text-red-600 hover:bg-red-100'}`}
                  title="Not Helpful"
                >👎</button>
              </div>
            )}
          </div>
        </div>
      ))}
      {loading && (
        <div className="flex items-center justify-center py-4">
         <ThinkingLoader/>
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
      <div ref={chatEndRef} />
    </div>
  );
}