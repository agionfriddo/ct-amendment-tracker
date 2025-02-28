"use client";

import { useState, useEffect, useRef } from "react";
import { Amendment } from "@/context/AmendmentsContext";
import axios from "axios";
import PdfViewer from "./PdfViewer";
import * as Diff from "diff";

interface PdfComparisonProps {
  leftAmendment: Amendment | null;
  rightAmendment: Amendment | null;
  filterNonEssentialText?: boolean;
}

// Type for view mode
type ViewMode = "side-diff" | "combined-diff" | "pdf";

export default function PdfComparison({
  leftAmendment,
  rightAmendment,
  filterNonEssentialText = true,
}: PdfComparisonProps) {
  const [leftText, setLeftText] = useState<string>("");
  const [rightText, setRightText] = useState<string>("");
  const [filteredLeftText, setFilteredLeftText] = useState<string>("");
  const [filteredRightText, setFilteredRightText] = useState<string>("");
  const [diffResult, setDiffResult] = useState<Diff.Change[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [leftError, setLeftError] = useState<string | null>(null);
  const [rightError, setRightError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("side-diff");
  const [debugInfo, setDebugInfo] = useState<Record<string, unknown> | null>(
    null
  );
  const [showFiltered, setShowFiltered] = useState<boolean>(
    filterNonEssentialText
  );

  // Refs for the text containers
  const leftTextRef = useRef<HTMLDivElement>(null);
  const rightTextRef = useRef<HTMLDivElement>(null);
  const diffTextRef = useRef<HTMLDivElement>(null);

  // Filter out non-essential text (page numbers, rep info, etc.)
  const filterText = (text: string): string => {
    if (!text) return text;

    // Split the text into lines
    const lines = text.split("\n");
    const filteredLines: string[] = [];

    // Regular expressions to identify non-essential content
    const pageNumberRegex = /^\d+\s+of\s+\d+$/;
    const lcoNumberRegex = /^\d+\s+LCO\s+No\./i;
    const congresspersonRegex = /^(REP\.|SEN\.)\s+[A-Z]+/i;
    const districtReferenceRegex = /\d+(st|nd|rd|th)\s+Dist\.$/i;
    const dateLineRegex = /^[A-Z][a-z]+ \d{1,2}, \d{4}$/;
    const headerFooterRegex = /^(File No\.|Calendar No\.|Substitute)/i;
    const lineNumberStartRegex = /^\s*\d+\s+\S/; // Matches lines that start with a number followed by content

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
        headerFooterRegex.test(line);

      // Check if this line starts with a line number
      const isLineNumberStart = lineNumberStartRegex.test(line);

      // If we find a line that starts with "1" and contains content, we've reached the main content
      // Or if we're already in main content
      if (
        !mainContentStarted &&
        isLineNumberStart &&
        line.trim().startsWith("1")
      ) {
        mainContentStarted = true;
      }

      // Add the line if it shouldn't be skipped and is part of the main content
      if (!shouldSkip && mainContentStarted) {
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

  // Extract text from PDFs using server-side API
  useEffect(() => {
    const fetchPdfText = async () => {
      setLoading(true);
      setError(null);
      setLeftError(null);
      setRightError(null);

      try {
        const leftUrl = `/api/pdf-text?url=${encodeURIComponent(
          leftAmendment?.lcoLink || ""
        )}`;
        const rightUrl = `/api/pdf-text?url=${encodeURIComponent(
          rightAmendment?.lcoLink || ""
        )}`;

        const [leftTextResult, rightTextResult] = await Promise.allSettled([
          axios.get(leftUrl),
          axios.get(rightUrl),
        ]);

        // Handle left PDF result
        if (leftTextResult.status === "fulfilled") {
          setLeftText(leftTextResult.value.data.text);
          setFilteredLeftText(filterText(leftTextResult.value.data.text));
        } else {
          const reason = leftTextResult.reason;
          console.error("Error extracting text from left PDF:", reason);

          let errorMsg =
            "Failed to extract text from left PDF. View the original PDF instead.";
          if (axios.isAxiosError(reason)) {
            errorMsg += ` (Status: ${
              reason.response?.status || "unknown"
            }, Message: ${reason.message})`;
            setDebugInfo((prev) => ({
              ...prev,
              leftError: {
                message: reason.message,
                code: reason.code,
                status: reason.response?.status,
                data: reason.response?.data,
              },
            }));
          }

          setLeftError(errorMsg);
        }

        // Handle right PDF result
        if (rightTextResult.status === "fulfilled") {
          setRightText(rightTextResult.value.data.text);
          setFilteredRightText(filterText(rightTextResult.value.data.text));
        } else {
          const reason = rightTextResult.reason;
          console.error("Error extracting text from right PDF:", reason);

          let errorMsg =
            "Failed to extract text from right PDF. View the original PDF instead.";
          if (axios.isAxiosError(reason)) {
            errorMsg += ` (Status: ${
              reason.response?.status || "unknown"
            }, Message: ${reason.message})`;
            setDebugInfo((prev) => ({
              ...prev,
              rightError: {
                message: reason.message,
                code: reason.code,
                status: reason.response?.status,
                data: reason.response?.data,
              },
            }));
          }

          setRightError(errorMsg);
        }

        // If both failed, show a general error
        if (
          leftTextResult.status === "rejected" &&
          rightTextResult.status === "rejected"
        ) {
          setError(
            "Failed to extract text from both PDFs. View the original documents instead."
          );
        }
      } catch (err) {
        console.error("Error in PDF text extraction process:", err);
        setError(
          "An error occurred during the text extraction process. View the original documents instead."
        );
        if (axios.isAxiosError(err)) {
          setDebugInfo((prev) => ({
            ...prev,
            generalError: {
              message: err.message,
              code: err.code,
              status: err.response?.status,
              data: err.response?.data,
            },
          }));
        }
      } finally {
        setLoading(false);
      }
    };

    fetchPdfText();
  }, [leftAmendment?.lcoLink, rightAmendment?.lcoLink]);

  // Calculate diff when texts change
  useEffect(() => {
    if (
      (showFiltered ? filteredLeftText : leftText) &&
      (showFiltered ? filteredRightText : rightText)
    ) {
      // Compute the diff based on filtered or unfiltered text
      const diff = Diff.diffLines(
        showFiltered ? filteredLeftText : leftText,
        showFiltered ? filteredRightText : rightText,
        {
          ignoreWhitespace: false,
        }
      );
      setDiffResult(diff);
    }
  }, [leftText, rightText, filteredLeftText, filteredRightText, showFiltered]);

  // Toggle view mode
  const changeViewMode = (mode: ViewMode) => {
    setViewMode(mode);
  };

  // Toggle filtered text
  const toggleFiltered = () => {
    setShowFiltered(!showFiltered);
  };

  // Toggle debug information
  const toggleDebugInfo = () => {
    setDebugInfo(debugInfo ? null : { error, leftError, rightError });
  };

  // Render diff with highlighted changes
  const renderDiff = () => {
    if (!diffResult.length) return "No differences found.";

    return (
      <div className="diff-container">
        {diffResult.map((part, index) => {
          // Skip parts with no content
          if (!part.value.trim()) return null;

          const lines = part.value.split("\n");

          return (
            <div
              key={index}
              className={`diff-part ${
                part.added
                  ? "diff-added"
                  : part.removed
                  ? "diff-removed"
                  : "diff-unchanged"
              }`}
            >
              {lines.map((line, lineIndex) => {
                if (!line && lineIndex === lines.length - 1) return null;

                return (
                  <div
                    key={`${index}-${lineIndex}`}
                    className={`diff-line ${
                      part.added
                        ? "bg-blue-100"
                        : part.removed
                        ? "bg-amber-100"
                        : ""
                    }`}
                  >
                    <span className="line-prefix">
                      {part.added ? "R " : part.removed ? "L " : "  "}
                    </span>
                    <span>{line}</span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  };

  // Synchronize scrolling between left and right panels
  useEffect(() => {
    if (viewMode !== "side-diff") return;

    const leftContainer = leftTextRef.current;
    const rightContainer = rightTextRef.current;
    if (!leftContainer || !rightContainer) return;

    let isScrolling = false;

    const syncScroll = (source: HTMLDivElement, target: HTMLDivElement) => {
      if (!isScrolling) {
        isScrolling = true;
        target.scrollTop = source.scrollTop;
        setTimeout(() => {
          isScrolling = false;
        }, 50);
      }
    };

    const handleLeftScroll = () =>
      leftContainer &&
      rightContainer &&
      syncScroll(leftContainer, rightContainer);
    const handleRightScroll = () =>
      rightContainer &&
      leftContainer &&
      syncScroll(rightContainer, leftContainer);

    leftContainer.addEventListener("scroll", handleLeftScroll);
    rightContainer.addEventListener("scroll", handleRightScroll);

    return () => {
      leftContainer.removeEventListener("scroll", handleLeftScroll);
      rightContainer.removeEventListener("scroll", handleRightScroll);
    };
  }, [viewMode]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Extracting text from PDFs...</p>
          <p className="text-sm text-gray-500">
            This may take a moment for large documents
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <div className="flex justify-between items-center p-4 bg-gray-100 border-b">
        <div className="text-center flex-1">
          <h3 className="font-medium text-gray-900">
            {leftAmendment?.chamber === "senate" ? "Senate" : "House"} Amendment
          </h3>
          <p className="text-sm text-gray-500">
            LCO {leftAmendment?.lcoNumber}
          </p>
          <p className="text-sm text-gray-500">
            {new Date(leftAmendment?.date || "").toLocaleDateString()}
          </p>
          <a
            href={leftAmendment?.lcoLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-indigo-600 hover:text-indigo-800"
          >
            View Original PDF
          </a>
        </div>

        <div className="flex flex-col items-center">
          {viewMode !== "pdf" && (
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
            </div>
          )}

          <div className="flex space-x-2 mb-2">
            <button
              onClick={() => changeViewMode("side-diff")}
              className={`px-3 py-1 text-xs rounded ${
                viewMode === "side-diff"
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-200 text-gray-700"
              }`}
            >
              Side-by-side Diff
            </button>
            <button
              onClick={() => changeViewMode("combined-diff")}
              className={`px-3 py-1 text-xs rounded ${
                viewMode === "combined-diff"
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-200 text-gray-700"
              }`}
            >
              Combined Diff
            </button>
            <button
              onClick={() => changeViewMode("pdf")}
              className={`px-3 py-1 text-xs rounded ${
                viewMode === "pdf"
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-200 text-gray-700"
              }`}
            >
              PDF View
            </button>
          </div>

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

        <div className="text-center flex-1">
          <h3 className="font-medium text-gray-900">
            {rightAmendment?.chamber === "senate" ? "Senate" : "House"}{" "}
            Amendment
          </h3>
          <p className="text-sm text-gray-500">
            LCO {rightAmendment?.lcoNumber}
          </p>
          <p className="text-sm text-gray-500">
            {new Date(rightAmendment?.date || "").toLocaleDateString()}
          </p>
          <a
            href={rightAmendment?.lcoLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-indigo-600 hover:text-indigo-800"
          >
            View Original PDF
          </a>
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

      {viewMode === "side-diff" && (
        <div className="flex flex-1 px-4 py-4 overflow-auto">
          <div className="w-[49%]">
            <div className="bg-white shadow-sm rounded-lg p-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {leftAmendment?.chamber === "senate" ? "Senate" : "House"}{" "}
                Amendment {showFiltered ? "(Body Only)" : "(Full Text)"}
              </h3>
              {leftError && (
                <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
                  <p className="text-sm text-red-700">{leftError}</p>
                </div>
              )}
              <div className="flex justify-between mb-2">
                <span className="text-xs text-gray-500">
                  {(showFiltered ? filteredLeftText : leftText)
                    ? `${
                        (showFiltered ? filteredLeftText : leftText).length
                      } characters`
                    : "No text extracted"}
                </span>
              </div>
              <div className="font-mono text-sm text-black dark:text-black whitespace-pre-wrap border border-gray-200 p-2 rounded bg-white dark:bg-gray-100 tabular-nums">
                {diffResult.map((part, index) => {
                  if (part.added) return null;
                  const lines = part.value.split("\n");
                  return (
                    <div
                      key={index}
                      className={part.removed ? "bg-amber-100" : ""}
                    >
                      {lines.map((line, lineIndex) => (
                        <div key={`${index}-${lineIndex}`}>{line || "\n"}</div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="w-[2%]"></div>
          <div className="w-[49%]">
            <div className="bg-white shadow-sm rounded-lg p-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {rightAmendment?.chamber === "senate" ? "Senate" : "House"}{" "}
                Amendment {showFiltered ? "(Body Only)" : "(Full Text)"}
              </h3>
              {rightError && (
                <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
                  <p className="text-sm text-red-700">{rightError}</p>
                </div>
              )}
              <div className="flex justify-between mb-2">
                <span className="text-xs text-gray-500">
                  {(showFiltered ? filteredRightText : rightText)
                    ? `${
                        (showFiltered ? filteredRightText : rightText).length
                      } characters`
                    : "No text extracted"}
                </span>
              </div>
              <div className="font-mono text-sm text-black dark:text-black whitespace-pre-wrap border border-gray-200 p-2 rounded bg-white dark:bg-gray-100 tabular-nums">
                {diffResult.map((part, index) => {
                  if (part.removed) return null;
                  const lines = part.value.split("\n");
                  return (
                    <div
                      key={index}
                      className={part.added ? "bg-blue-100" : ""}
                    >
                      {lines.map((line, lineIndex) => (
                        <div key={`${index}-${lineIndex}`}>{line || "\n"}</div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {viewMode === "combined-diff" && (
        <div className="flex-1 overflow-hidden px-4">
          <div className="bg-white shadow-sm rounded-lg p-4 h-full flex flex-col">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Combined Diff View {showFiltered ? "(Body Only)" : "(Full Text)"}
            </h3>
            <div className="flex justify-between mb-2">
              <span className="text-xs text-gray-500">
                <span className="inline-block px-2 py-1 bg-amber-100 mr-2">
                  Left Amendment Only
                </span>
                <span className="inline-block px-2 py-1 bg-blue-100">
                  Right Amendment Only
                </span>
              </span>
            </div>
            <div
              ref={diffTextRef}
              className="font-mono text-sm text-black dark:text-black whitespace-pre-wrap overflow-auto flex-1 border border-gray-200 p-2 rounded bg-white dark:bg-gray-100 tabular-nums"
            >
              {renderDiff()}
            </div>
          </div>
        </div>
      )}

      {viewMode === "pdf" && leftAmendment && rightAmendment && (
        <div className="flex flex-1 overflow-hidden px-4">
          <div className="w-[49%] h-full overflow-hidden">
            <PdfViewer url={leftAmendment.lcoLink} />
          </div>
          <div className="w-[2%]"></div>
          <div className="w-[49%] h-full overflow-hidden">
            <PdfViewer url={rightAmendment.lcoLink} />
          </div>
        </div>
      )}

      <style jsx>{`
        .diff-line {
          display: flex;
          padding: 2px 0;
          line-height: 1.5;
        }
        .line-prefix {
          width: 20px;
          display: inline-block;
          color: #586069;
          user-select: none;
        }
        .diff-added {
          background-color: #e6f3ff;
        }
        .diff-removed {
          background-color: #fff8e6;
        }
        .diff-unchanged {
          background-color: transparent;
        }
      `}</style>
    </div>
  );
}
