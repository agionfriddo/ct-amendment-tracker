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
  const [viewMode, setViewMode] = useState<"text" | "pdf">("text");
  const [debugInfo, setDebugInfo] = useState<any>(null);

  // Ref for the text container
  const textRef = useRef<HTMLPreElement>(null);

  // Extract text from PDF using server-side API
  useEffect(() => {
    const fetchPdfText = async () => {
      setLoading(true);
      setError(null);

      try {
        // Extract text from PDF using our server-side API
        const url = `/api/pdf-text?url=${encodeURIComponent(pdfUrl)}`;
        const response = await axios.get(url);

        setText(response.data.text);
        console.log("PDF text extracted successfully", {
          characters: response.data.text.length,
          pages: response.data.numpages,
        });
      } catch (err) {
        console.error("Error extracting text from PDF:", err);

        let errorMsg =
          "Failed to extract text from PDF. View the original PDF instead.";
        if (axios.isAxiosError(err)) {
          errorMsg += ` (Status: ${
            err.response?.status || "unknown"
          }, Message: ${err.message})`;
          setDebugInfo({
            error: {
              message: err.message,
              code: err.code,
              status: err.response?.status,
              data: err.response?.data,
            },
          });
        }

        setError(errorMsg);
      } finally {
        setLoading(false);
      }
    };

    fetchPdfText();
  }, [pdfUrl]);

  // Toggle debug information
  const toggleDebugInfo = () => {
    setDebugInfo(debugInfo ? null : { error });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
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
    <div className="flex flex-col">
      <div className="flex justify-between items-center p-4 bg-gray-100 border-b">
        <div className="text-center flex-1">
          <h3 className="font-medium text-gray-900">{title}</h3>
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-indigo-600 hover:text-indigo-800"
          >
            View Original PDF
          </a>
        </div>

        <div className="flex flex-col items-center">
          <button
            onClick={toggleDebugInfo}
            className="px-3 py-1 text-xs rounded mb-2 bg-gray-200 text-gray-700"
          >
            {debugInfo ? "Hide Debug Info" : "Show Debug Info"}
          </button>

          {error && (
            <div className="text-xs text-red-500 mt-1 max-w-xs text-center">
              {error}
            </div>
          )}
        </div>
      </div>

      {debugInfo && (
        <div className="p-4 bg-gray-100 border-b overflow-auto max-h-60">
          <h3 className="font-medium text-gray-900 mb-2">Debug Information</h3>
          <pre className="text-xs text-black dark:text-black bg-white dark:bg-gray-100 p-2 rounded border">
            {JSON.stringify(debugInfo, null, 2)}
          </pre>
        </div>
      )}

      <div className="w-full overflow-hidden">
        <div className="bg-white shadow-sm rounded-lg p-4 flex flex-col">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Extracted Text
          </h3>
          {error && (
            <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
          <div className="flex justify-between mb-2">
            <span className="text-xs text-gray-500">
              {text
                ? `${text.length} characters extracted`
                : "No text extracted"}
            </span>
          </div>
          <pre
            ref={textRef}
            className="font-mono text-sm text-black dark:text-black whitespace-pre-wrap overflow-visible flex-1 border border-gray-200 p-2 rounded bg-white dark:bg-gray-100 tabular-nums"
          >
            {text || "No text could be extracted from this PDF."}
          </pre>
        </div>
      </div>
    </div>
  );
}
