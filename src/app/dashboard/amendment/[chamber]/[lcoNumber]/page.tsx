"use client";

import { useParams, useRouter } from "next/navigation";
import { useAmendments } from "@/context/AmendmentsContext";
import PdfViewer from "@/components/PdfViewer";
import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { useBills } from "@/context/BillsContext";

// Define tab types for type safety
type TabType = "info" | "pdf";

export default function AmendmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const chamber = params.chamber as "senate" | "house";
  const lcoNumber = params.lcoNumber as string;
  const { senateAmendments, houseAmendments, loading, error } = useAmendments();
  const { getBillByNumber } = useBills();

  // State to track the active tab
  const [activeTab, setActiveTab] = useState<TabType>("info");

  // State for amendment text and summary
  const [amendmentText, setAmendmentText] = useState<string | null>(null);
  const [billText, setBillText] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [textLoading, setTextLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [textError, setTextError] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Find the amendment
  const amendments = chamber === "senate" ? senateAmendments : houseAmendments;
  const amendment = amendments.find((a) => a.lcoNumber === lcoNumber);
  const bill = amendment ? getBillByNumber(amendment.billNumber) : null;

  const generateSummary = useCallback(
    async (amendmentText: string, billText: string) => {
      const summaryResponse = await fetch("/api/summarize-amendment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ amendmentText, billText }),
      });

      if (!summaryResponse.ok) {
        throw new Error("Failed to generate summary");
      }

      const summaryData = await summaryResponse.json();

      // Store the summary in DynamoDB
      const storeResponse = await fetch(`/api/amendments/${chamber}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lcoNumber,
          summary: summaryData.summary,
        }),
      });

      if (!storeResponse.ok) {
        console.error("Failed to store summary in database");
      }

      return summaryData.summary;
    },
    [chamber, lcoNumber]
  );

  useEffect(() => {
    async function fetchTexts() {
      if (!amendment?.lcoLink || !bill?.pdfLinks?.[0]) return;

      setTextLoading(true);
      setTextError(null);
      setSummaryLoading(true);
      setSummaryError(null);

      try {
        // First try to fetch existing summary from DynamoDB
        const existingResponse = await fetch(`/api/amendments/${chamber}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (existingResponse.ok) {
          const amendments = await existingResponse.json();
          const currentAmendment = amendments.find(
            (a: { lcoNumber: string }) => a.lcoNumber === lcoNumber
          );
          if (currentAmendment?.summary) {
            setSummary(currentAmendment.summary);
            setSummaryLoading(false);
            // Only fetch texts if we still need them
            await fetchTextsOnly();
            return;
          }
        }

        // If no existing summary, fetch texts and generate new summary
        const amendmentResponse = await fetch(
          `/api/pdf-text?url=${encodeURIComponent(amendment.lcoLink)}`
        );
        if (!amendmentResponse.ok) {
          throw new Error("Failed to fetch amendment text");
        }
        const amendmentData = await amendmentResponse.json();
        setAmendmentText(amendmentData.text);

        const billResponse = await fetch(
          `/api/pdf-text?url=${encodeURIComponent(bill.pdfLinks[0])}`
        );
        if (!billResponse.ok) {
          throw new Error("Failed to fetch bill text");
        }
        const billData = await billResponse.json();
        setBillText(billData.text);

        const newSummary = await generateSummary(
          amendmentData.text,
          billData.text
        );
        setSummary(newSummary);
        setSummaryLoading(false);
      } catch (error) {
        setTextError(
          error instanceof Error ? error.message : "Failed to fetch texts"
        );
        setSummaryError(
          error instanceof Error ? error.message : "Failed to generate summary"
        );
      } finally {
        setTextLoading(false);
        setSummaryLoading(false);
      }
    }

    async function fetchTextsOnly() {
      if (!amendment?.lcoLink || !bill?.pdfLinks?.[0]) return;

      try {
        const amendmentResponse = await fetch(
          `/api/pdf-text?url=${encodeURIComponent(amendment.lcoLink)}`
        );
        if (!amendmentResponse.ok) {
          throw new Error("Failed to fetch amendment text");
        }
        const amendmentData = await amendmentResponse.json();
        setAmendmentText(amendmentData.text);

        const billResponse = await fetch(
          `/api/pdf-text?url=${encodeURIComponent(bill.pdfLinks[0])}`
        );
        if (!billResponse.ok) {
          throw new Error("Failed to fetch bill text");
        }
        const billData = await billResponse.json();
        setBillText(billData.text);
        setTextLoading(false);
      } catch (error) {
        setTextLoading(false);
        setTextError(
          error instanceof Error ? error.message : "Failed to fetch texts"
        );
      }
    }

    fetchTexts();
  }, [amendment?.lcoLink, bill?.pdfLinks, chamber, lcoNumber, generateSummary]);

  const handleRegenerateSummary = async () => {
    if (!amendmentText || !billText || !amendment) return;

    setIsRegenerating(true);
    setSummaryError(null);

    try {
      const newSummary = await generateSummary(amendmentText, billText);
      setSummary(newSummary);
    } catch (error) {
      setSummaryError(
        error instanceof Error ? error.message : "Failed to regenerate summary"
      );
    } finally {
      setIsRegenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading amendment details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg
              className="h-5 w-5 text-red-400"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!amendment) {
    return (
      <div className="bg-white shadow px-4 py-5 sm:rounded-lg sm:p-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">
            Amendment not found
          </h2>
          <p className="mt-2 text-gray-500">
            The amendment you are looking for does not exist or has been
            removed.
          </p>
          <button
            onClick={() => router.back()}
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Tab button component for consistent styling
  const TabButton = ({ tab, label }: { tab: TabType; label: string }) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`px-4 py-2 font-medium text-sm rounded-t-lg ${
        activeTab === tab
          ? "bg-white text-indigo-600 border-t border-l border-r border-gray-200"
          : "bg-gray-100 text-gray-600 hover:text-gray-800 hover:bg-gray-200"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="bg-white shadow px-4 py-5 sm:rounded-lg sm:p-6">
        <div className="md:flex md:items-center md:justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
              Amendment Details
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {chamber === "senate" ? "Senate" : "House"} Amendment {lcoNumber}
            </p>
          </div>
          <div className="mt-4 flex-shrink-0 flex md:mt-0 md:ml-4">
            <button
              onClick={() => router.back()}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 mr-2"
            >
              Go Back
            </button>
            <Link
              href={`/dashboard/bill/${amendment.billNumber}/compare-amendment-to-bill?lco=${amendment.lcoNumber}`}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 mr-2"
            >
              Compare to Bill
            </Link>
            <a
              href={amendment.lcoLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Download PDF
            </a>
          </div>
        </div>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        {/* Tab navigation */}
        <div className="flex border-b border-gray-200 bg-gray-50 px-4 pt-4">
          <TabButton tab="info" label="Amendment Information" />
          <TabButton tab="pdf" label="View PDF" />
        </div>

        {/* Tab content */}
        <div className="p-0">
          {/* Amendment Information Tab */}
          {activeTab === "info" && (
            <div className="border-t border-gray-200">
              <dl>
                <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Chamber</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {chamber === "senate" ? "Senate" : "House"}
                  </dd>
                </div>
                <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">
                    Bill Number
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    <Link
                      href={`/dashboard/bill/${amendment.billNumber}`}
                      className="text-indigo-600 hover:text-indigo-900"
                    >
                      {amendment.billNumber}
                    </Link>
                  </dd>
                </div>
                <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">
                    LCO Number
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {amendment.lcoNumber}
                  </dd>
                </div>
                <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">
                    Calendar Number
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {amendment.calNumber}
                  </dd>
                </div>
                <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Date</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {new Date(amendment.date).toLocaleDateString()}
                  </dd>
                </div>
                <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">
                    Bill Link
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    <a
                      href={amendment.billLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:text-indigo-900"
                    >
                      View Bill
                    </a>
                  </dd>
                </div>
                <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">
                    Amendment Link
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    <a
                      href={amendment.lcoLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:text-indigo-900"
                    >
                      View Amendment
                    </a>
                  </dd>
                </div>
              </dl>

              {/* Text & Analysis Section */}
              <div className="border-t border-gray-200 mt-6">
                <div className="px-4 py-3 bg-gray-50">
                  <h3 className="text-lg font-medium text-gray-900">
                    Amendment Text & Analysis
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    View the amendment text and its impact on the bill
                    {amendment.updatedAt && (
                      <span className="ml-2 text-gray-400">
                        · Last updated{" "}
                        {new Date(amendment.updatedAt).toLocaleString()}
                      </span>
                    )}
                  </p>
                </div>
                <div className="space-y-6 p-4">
                  <div className="bg-white shadow rounded-lg p-4">
                    <h4 className="text-base font-medium text-gray-900 mb-4">
                      Amendment Text
                    </h4>
                    {textLoading ? (
                      <div className="flex justify-center items-center h-32">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                      </div>
                    ) : textError ? (
                      <div className="text-red-600 text-sm">{textError}</div>
                    ) : amendmentText ? (
                      <pre className="whitespace-pre-wrap text-black overflow-x-auto text-sm">
                        {amendmentText}
                      </pre>
                    ) : (
                      <p className="text-gray-500">
                        No amendment text available
                      </p>
                    )}
                  </div>
                  <div className="bg-white shadow rounded-lg p-4">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="text-base font-medium text-gray-900">
                        Impact Analysis
                      </h4>
                      {summary && !summaryLoading && !isRegenerating && (
                        <button
                          onClick={handleRegenerateSummary}
                          className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                          Regenerate Analysis
                        </button>
                      )}
                    </div>
                    {summaryLoading || isRegenerating ? (
                      <div className="flex justify-center items-center h-32">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                      </div>
                    ) : summaryError ? (
                      <div className="text-red-600 text-sm">{summaryError}</div>
                    ) : summary ? (
                      <div className="prose max-w-none text-black">
                        <div className="whitespace-pre-wrap">{summary}</div>
                      </div>
                    ) : (
                      <p className="text-gray-500">No analysis available</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PDF Viewer Tab */}
          {activeTab === "pdf" && (
            <div>
              <div className="px-4 py-3 bg-gray-50 border-t border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">
                  Amendment PDF
                </h3>
              </div>
              <div className="h-screen max-h-[800px]">
                <PdfViewer url={amendment.lcoLink} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
