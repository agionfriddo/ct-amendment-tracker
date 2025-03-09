"use client";

import { useState, useEffect, useRef } from "react";
import axios from "axios";

interface PdfTextExtractorProps {
  pdfUrl: string;
  title?: string;
}

export default function PdfTextExtractor({
  pdfUrl,
  title = "PDF Text",
}: PdfTextExtractorProps) {
  const [text, setText] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<Record<string, unknown> | null>(
    null
  );

  // Ref for the text container
  const textRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const fetchPdfText = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await axios.get(
          `/api/pdf-text?url=${encodeURIComponent(pdfUrl)}`
        );
        setText(response.data.text);
      } catch (err) {
        console.error("Error extracting PDF text:", err);
        let errorMsg =
          "Failed to extract text from PDF. View the original PDF instead.";
        if (axios.isAxiosError(err)) {
          errorMsg += ` (Status: ${
            err.response?.status || "unknown"
          }, Message: ${err.message})`;
          setDebugInfo({
            message: err.message,
            code: err.code,
            status: err.response?.status,
            data: err.response?.data,
          });
        }
        setError(errorMsg);
      } finally {
        setLoading(false);
      }
    };

    if (pdfUrl) {
      fetchPdfText();
    }
  }, [pdfUrl]);

  // Toggle debug information
  const toggleDebugInfo = () => {
    setDebugInfo(debugInfo ? null : { error });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Extracting text from PDF...</p>
          <p className="text-sm text-gray-500">
            This may take a moment for large documents
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow-sm rounded-lg p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-gray-900">{title}</h3>
        <div className="flex items-center space-x-2">
          <button
            onClick={toggleDebugInfo}
            className="px-3 py-1 text-xs rounded bg-gray-200 text-gray-700 hover:bg-gray-300"
          >
            {debugInfo ? "Hide Debug Info" : "Show Debug Info"}
          </button>
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-indigo-600 hover:text-indigo-800"
          >
            View Original PDF
          </a>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {debugInfo && (
        <div className="mb-4 overflow-auto max-h-60">
          <pre className="text-xs text-black dark:text-black bg-gray-100 p-2 rounded border">
            {JSON.stringify(debugInfo, null, 2)}
          </pre>
        </div>
      )}

      <div className="flex justify-between mb-2">
        <span className="text-xs text-gray-500">
          {text ? `${text.length} characters` : "No text extracted"}
        </span>
      </div>

      <pre
        ref={textRef}
        className="font-mono text-sm text-black dark:text-black whitespace-pre-wrap overflow-auto border border-gray-200 p-2 rounded bg-white dark:bg-gray-100 tabular-nums"
      >
        {text || "No text extracted from PDF"}
      </pre>
    </div>
  );
}
