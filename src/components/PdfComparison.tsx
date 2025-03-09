"use client";

import { useState, useEffect, useRef } from "react";
import { Amendment } from "@/context/AmendmentsContext";
import axios from "axios";
import * as Diff from "diff";

interface PdfComparisonProps {
  leftPdfUrl?: string;
  rightPdfUrl?: string;
  leftLabel?: string;
  rightLabel?: string;
  leftAmendment?: Amendment | null;
  rightAmendment?: Amendment | null;
}

// Type for view mode
type ViewMode = "side-diff" | "combined-diff" | "pdf";

export default function PdfComparison({
  leftPdfUrl,
  rightPdfUrl,
  leftLabel,
  rightLabel,
  leftAmendment,
  rightAmendment,
}: PdfComparisonProps) {
  const [leftText, setLeftText] = useState<string>("");
  const [rightText, setRightText] = useState<string>("");
  const [diffResult, setDiffResult] = useState<Diff.Change[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [leftError, setLeftError] = useState<string | null>(null);
  const [rightError, setRightError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("side-diff");
  const [debugInfo, setDebugInfo] = useState<Record<string, unknown> | null>(
    null
  );

  // Refs for the text containers
  const leftTextRef = useRef<HTMLDivElement>(null);
  const rightTextRef = useRef<HTMLDivElement>(null);
  const diffTextRef = useRef<HTMLDivElement>(null);

  const leftIframeRef = useRef<HTMLIFrameElement>(null);
  const rightIframeRef = useRef<HTMLIFrameElement>(null);

  // Extract text from PDFs using server-side API
  useEffect(() => {
    const fetchPdfText = async () => {
      setLoading(true);
      setError(null);
      setLeftError(null);
      setRightError(null);

      try {
        const leftUrlToFetch = leftPdfUrl || leftAmendment?.lcoLink;
        const rightUrlToFetch = rightPdfUrl || rightAmendment?.lcoLink;

        if (!leftUrlToFetch && !rightUrlToFetch) {
          setLoading(false);
          return;
        }

        const requests = [];

        if (leftUrlToFetch) {
          const leftUrl = `/api/pdf-text?url=${encodeURIComponent(
            leftUrlToFetch
          )}`;
          requests.push(axios.get(leftUrl));
        } else {
          requests.push(Promise.resolve({ data: { text: "" } }));
        }

        if (rightUrlToFetch) {
          const rightUrl = `/api/pdf-text?url=${encodeURIComponent(
            rightUrlToFetch
          )}`;
          requests.push(axios.get(rightUrl));
        } else {
          requests.push(Promise.resolve({ data: { text: "" } }));
        }

        const [leftTextResult, rightTextResult] = await Promise.allSettled(
          requests
        );

        // Handle left PDF result
        if (leftTextResult.status === "fulfilled") {
          setLeftText(leftTextResult.value.data.text);
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
  }, [
    leftPdfUrl,
    rightPdfUrl,
    leftAmendment?.lcoLink,
    rightAmendment?.lcoLink,
  ]);

  // Calculate diff when texts change
  useEffect(() => {
    if (leftText && rightText) {
      const diff = Diff.diffLines(leftText, rightText, {
        ignoreWhitespace: false,
      });
      setDiffResult(diff);
    }
  }, [leftText, rightText]);

  // Toggle view mode
  const changeViewMode = (mode: ViewMode) => {
    setViewMode(mode);
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

  useEffect(() => {
    // Sync scroll between the two PDFs
    const leftIframe = leftIframeRef.current;
    const rightIframe = rightIframeRef.current;

    if (!leftIframe || !rightIframe) return;

    const handleScroll = (e: Event) => {
      const source = e.target as HTMLIFrameElement;
      const target = source === leftIframe ? rightIframe : leftIframe;

      if (!source.contentWindow || !target.contentWindow) return;

      const scrollRatio =
        source.contentWindow.scrollY /
        (source.contentWindow.document.documentElement.scrollHeight -
          source.contentWindow.innerHeight);

      target.contentWindow.scrollTo(
        0,
        scrollRatio *
          (target.contentWindow.document.documentElement.scrollHeight -
            target.contentWindow.innerHeight)
      );
    };

    leftIframe.addEventListener("scroll", handleScroll);
    rightIframe.addEventListener("scroll", handleScroll);

    return () => {
      leftIframe.removeEventListener("scroll", handleScroll);
      rightIframe.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const getDisplayUrl = (amendment: Amendment | null | undefined) => {
    return amendment?.lcoLink || "";
  };

  const getDisplayLabel = (
    label: string | undefined,
    amendment: Amendment | null | undefined
  ) => {
    if (label) return label;
    if (!amendment) return "No amendment selected";
    return `${amendment.chamber === "senate" ? "Senate" : "House"} - LCO ${
      amendment.lcoNumber
    }`;
  };

  const leftUrl = leftPdfUrl || getDisplayUrl(leftAmendment);
  const rightUrl = rightPdfUrl || getDisplayUrl(rightAmendment);
  const leftDisplayLabel = getDisplayLabel(leftLabel, leftAmendment);
  const rightDisplayLabel = getDisplayLabel(rightLabel, rightAmendment);

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
    <div>
      <div className="flex justify-between items-center p-4 bg-gray-100 border-b">
        <div className="text-center flex-1">
          <h3 className="font-medium text-gray-900">{leftDisplayLabel}</h3>
          <a
            href={leftUrl}
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
          <h3 className="font-medium text-gray-900">{rightDisplayLabel}</h3>
          <a
            href={rightUrl}
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
              {leftError && (
                <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
                  <p className="text-sm text-red-700">{leftError}</p>
                </div>
              )}
              <div className="flex justify-between mb-2">
                <span className="text-xs text-gray-500">
                  {leftText
                    ? `${leftText.length} characters`
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
              {rightError && (
                <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
                  <p className="text-sm text-red-700">{rightError}</p>
                </div>
              )}
              <div className="flex justify-between mb-2">
                <span className="text-xs text-gray-500">
                  {rightText
                    ? `${rightText.length} characters`
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

      {viewMode === "pdf" && (
        <div className="flex px-4 py-4">
          <div className="w-[49%]">
            <iframe
              ref={leftIframeRef}
              src={leftUrl}
              className="w-full h-[800px]"
            />
          </div>
          <div className="w-[2%]"></div>
          <div className="w-[49%]">
            <iframe
              ref={rightIframeRef}
              src={rightUrl}
              className="w-full h-[800px]"
            />
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
