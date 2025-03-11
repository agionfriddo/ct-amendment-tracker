"use client";

import { useParams } from "next/navigation";
import { useAmendments } from "@/context/AmendmentsContext";
import { useBills } from "@/context/BillsContext";
import AmendmentList from "@/components/AmendmentList";
import { useState, useEffect } from "react";

export default function BillDetailPage() {
  const params = useParams();
  const billNumber = params.billNumber as string;
  const {
    getAmendmentsByBill,
    loading: amendmentsLoading,
    error: amendmentsError,
  } = useAmendments();
  const {
    getBillByNumber,
    loading: billLoading,
    error: billError,
  } = useBills();

  const amendments = getAmendmentsByBill(billNumber);
  const bill = getBillByNumber(billNumber);

  const [billText, setBillText] = useState<string | null>(null);
  const [textLoading, setTextLoading] = useState(false);
  const [textError, setTextError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const generateSummary = async (text: string) => {
    const summaryResponse = await fetch("/api/summarize-bill", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    });

    if (!summaryResponse.ok) {
      throw new Error("Failed to generate summary");
    }

    const summaryData = await summaryResponse.json();

    return summaryData.summary;
  };

  useEffect(() => {
    async function fetchBillText() {
      if (!bill?.pdfLinks?.[0]) return;

      setTextLoading(true);
      setTextError(null);
      setSummaryLoading(true);
      setSummaryError(null);

      try {
        // Fetch bill text
        const response = await fetch(
          `/api/pdf-text?url=${encodeURIComponent(bill.pdfLinks[0])}`
        );
        if (!response.ok) {
          throw new Error("Failed to fetch bill text");
        }
        const data = await response.json();
        setBillText(data.text);
        setTextLoading(false);

        const newSummary = await generateSummary(data.text);
        setSummary(newSummary);
        setSummaryLoading(false);
      } catch (error) {
        setTextLoading(false);
        setSummaryLoading(false);
        setTextError(
          error instanceof Error ? error.message : "Failed to fetch bill text"
        );
        setSummaryError(
          error instanceof Error ? error.message : "Failed to generate summary"
        );
      }
    }

    fetchBillText();
  }, [bill?.pdfLinks, billNumber]);

  const handleRegenerateSummary = async () => {
    if (!billText) return;

    setIsRegenerating(true);
    setSummaryError(null);

    try {
      const newSummary = await generateSummary(billText);
      setSummary(newSummary);
    } catch (error) {
      setSummaryError(
        error instanceof Error ? error.message : "Failed to regenerate summary"
      );
    } finally {
      setIsRegenerating(false);
    }
  };

  if (billLoading || amendmentsLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading bill and amendments...</p>
        </div>
      </div>
    );
  }

  if (billError || amendmentsError) {
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
            <p className="text-sm text-red-700">
              {billError || amendmentsError}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!bill) {
    return (
      <div className="bg-white shadow px-4 py-5 sm:rounded-lg sm:p-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Bill not found</h2>
          <p className="mt-2 text-gray-500">Could not find bill {billNumber}</p>
        </div>
      </div>
    );
  }

  const hasBillPdf = bill.pdfLinks.length > 0;

  return (
    <div className="space-y-6 max-w-[2000px] mx-auto px-4">
      <div className="bg-white shadow px-4 py-5 sm:rounded-lg sm:p-6">
        <div className="md:flex md:items-center md:justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
              {billNumber}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {amendments.length} amendments for this bill
            </p>
          </div>
          <div className="mt-4 flex-shrink-0 flex md:mt-0 md:ml-4 space-x-3">
            <a
              href={bill.billLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              View Bill
            </a>
            {hasBillPdf && (
              <div className="relative inline-block text-left">
                <a
                  href={bill.pdfLinks[0]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  View PDF
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-8">
          <div className="bg-white shadow px-4 py-5 sm:rounded-lg sm:p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium leading-6 text-gray-900">
                Bill Text
              </h3>
            </div>
            {textLoading ? (
              <div className="flex justify-center items-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
              </div>
            ) : textError ? (
              <div className="text-red-600 text-sm">{textError}</div>
            ) : billText ? (
              <pre className="whitespace-pre-wrap text-black overflow-x-auto text-sm">
                {billText}
              </pre>
            ) : (
              <p className="text-gray-500">No bill text available</p>
            )}
          </div>
        </div>

        <div className="col-span-4">
          <div className="bg-white shadow px-4 py-5 sm:rounded-lg sm:p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium leading-6 text-gray-900">
                Bill Summary
              </h3>
              {summary && !summaryLoading && !isRegenerating && (
                <button
                  onClick={handleRegenerateSummary}
                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Regenerate Summary
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
              <p className="text-gray-500">No summary available</p>
            )}
          </div>
        </div>
      </div>

      <AmendmentList
        amendments={amendments}
        title={`Amendments for ${billNumber}`}
      />
    </div>
  );
}
