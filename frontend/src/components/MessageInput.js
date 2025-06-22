import React from "react";

export default function MessageInput({ question, onChange, onSend, loading, documentId }) {
  return (
    <div className="px-6 lg:px-8 py-4 lg:py-6 border-t border-gray-100">
      <div className="flex items-center space-x-3 lg:space-x-4">
        <div className="flex-1 relative">
          <textarea
            value={question}
            onChange={onChange}
            onKeyPress={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend();
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
          onClick={onSend}
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
  );
}