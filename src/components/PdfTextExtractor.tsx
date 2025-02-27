"use client";

import { useState, useEffect, useRef } from "react";
import axios from "axios";

interface PdfTextExtractorProps {
  pdfUrl: string;
  title?: string;
  filterNonEssentialText?: boolean;
}

export default function PdfTextExtractor({
  pdfUrl,
  title = "PDF Text",
  filterNonEssentialText = true,
}: PdfTextExtractorProps) {
  const [text, setText] = useState<string>("");
  const [filteredText, setFilteredText] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"text" | "pdf">("text");
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [showFiltered, setShowFiltered] = useState<boolean>(
    filterNonEssentialText
  );

  // Ref for the text container
  const textRef = useRef<HTMLPreElement>(null);

  // Filter out non-essential text (page numbers, rep info, etc.)
  const filterText = (text: string): string => {
    if (!text) return text;

    // Split the text into lines
    let lines = text.split("\n");
    let filteredLines: string[] = [];

    // Regular expressions to identify non-essential content
    const pageNumberRegex = /^\d+\s+of\s+\d+$/;
    const lcoNumberRegex = /^\d+\s+LCO\s+No\./i;
    const congresspersonRegex = /^(REP\.|SEN\.)\s+[A-Z]+/i;
    const districtReferenceRegex = /\d+(st|nd|rd|th)\s+Dist\.$/i;
    const dateLineRegex = /^[A-Z][a-z]+ \d{1,2}, \d{4}$/;
    const emptyLineWithNumberRegex = /^\s*\d+\s*$/;
    const headerFooterRegex = /^(File No\.|Calendar No\.|Substitute)/i;

    // Flag to indicate we've reached the main content
    let mainContentStarted = false;

    // Process each line
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Skip empty lines
      if (!line) {
        // Only keep empty lines within the main content
        if (mainContentStarted) {
          filteredLines.push("");
        }
        continue;
      }

      // Check if this line should be skipped
      const shouldSkip =
        pageNumberRegex.test(line) ||
        lcoNumberRegex.test(line) ||
        congresspersonRegex.test(line) ||
        districtReferenceRegex.test(line) ||
        dateLineRegex.test(line) ||
        emptyLineWithNumberRegex.test(line) ||
        headerFooterRegex.test(line);

      // If we find a line that starts with "Section" or contains "AN ACT", we've reached the main content
      if (
        line.startsWith("Section") ||
        line.includes("AN ACT") ||
        line.includes("AMENDMENT")
      ) {
        mainContentStarted = true;
      }

      // Add the line if it shouldn't be skipped and is part of the main content
      if (!shouldSkip && (mainContentStarted || line.startsWith("Section"))) {
        // Normalize whitespace: replace multiple spaces with a single space
        // But preserve leading spaces for indentation
        const leadingSpacesMatch = line.match(/^(\s*)/);
        const leadingSpaces = leadingSpacesMatch ? leadingSpacesMatch[0] : "";
        const normalizedLine = leadingSpaces + line.trim().replace(/\s+/g, " ");
        filteredLines.push(normalizedLine);
      }
    }

    // Additional processing to normalize whitespace in the entire text
    let result = filteredLines.join("\n");

    // Fix spacing around punctuation
    result = result.replace(/\s+([.,;:)])/g, "$1");
    result = result.replace(/([({])\s+/g, "$1");

    // Ensure proper spacing after commas in lists
    result = result.replace(/,(\w)/g, ", $1");

    // Ensure consistent spacing after periods in sentences
    result = result.replace(/\.(\w)/g, ". $1");

    // Fix spacing for inclusive ranges
    result = result.replace(/(\w+)\s*-\s*(\w+)/g, "$1-$2");

    return result;
  };

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
        setFilteredText(filterText(response.data.text));
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

  // Toggle between filtered and full text
  const toggleFiltered = () => {
    setShowFiltered(!showFiltered);
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
          <div className="flex space-x-2 mb-2">
            <button
              onClick={toggleFiltered}
              className={`px-3 py-1 text-xs rounded ${
                showFiltered
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-200 text-gray-700"
              }`}
            >
              {showFiltered ? "Show Body Only" : "Show Full Text"}
            </button>
            <button
              onClick={toggleDebugInfo}
              className="px-3 py-1 text-xs rounded bg-gray-200 text-gray-700"
            >
              {debugInfo ? "Hide Debug Info" : "Show Debug Info"}
            </button>
          </div>

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
            Extracted Text {showFiltered ? "(Body Only)" : "(Full Text)"}
          </h3>
          {error && (
            <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
          <div className="flex justify-between mb-2">
            <span className="text-xs text-gray-500">
              {showFiltered
                ? filteredText
                : text
                ? `${
                    (showFiltered ? filteredText : text).length
                  } characters extracted`
                : "No text extracted"}
            </span>
          </div>
          <pre
            ref={textRef}
            className="font-mono text-sm text-black dark:text-black whitespace-pre-wrap overflow-visible flex-1 border border-gray-200 p-2 rounded bg-white dark:bg-gray-100 tabular-nums"
          >
            {showFiltered
              ? filteredText || "No text could be extracted from this PDF."
              : text || "No text could be extracted from this PDF."}
          </pre>
        </div>
      </div>
    </div>
  );
}
