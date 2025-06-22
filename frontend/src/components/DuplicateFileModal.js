import React from "react";

export default function DuplicateFileModal({ show, data, loading, onAction }) {
  if (!show || !data) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md animate-fade-in">
        <h3 className="text-xl font-bold text-gray-800 mb-2 text-center">Duplicate File Detected!</h3>
        <p className="text-gray-600 text-center mb-6">
          A file named <span className="font-semibold text-black">"{data.filename}"</span> already exists.<br />
          What would you like to do?
        </p>
        <div className="flex flex-col space-y-3">
          <button
            onClick={() => onAction('overwrite')}
            disabled={loading}
            className="w-full py-2 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 transition disabled:bg-gray-300"
          >
            {loading ? 'Overwriting...' : 'Overwrite Existing'}
          </button>
          <button
            onClick={() => onAction('new')}
            disabled={loading}
            className="w-full py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition disabled:bg-gray-300"
          >
            {loading ? 'Uploading New...' : 'Upload as New File'}
          </button>
          <button
            onClick={() => onAction('cancel')}
            disabled={loading}
            className="w-full py-2 rounded-lg bg-gray-200 text-gray-700 font-semibold hover:bg-gray-300 transition disabled:bg-gray-100"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}