"use client";

import { useState } from "react";
import PdfComparison from "@/components/PdfComparison";
import { useAmendments } from "@/context/AmendmentsContext";
import { useBills } from "@/context/BillsContext";

type PDFSource = "custom" | "bill" | "amendment";

interface PDFSelection {
  source: PDFSource;
  url: string;
  billNumber?: string;
  lcoNumber?: string;
}

export default function ComparePage() {
  const { bills, loading: billsLoading } = useBills();
  const {
    senateAmendments,
    houseAmendments,
    loading: amendmentsLoading,
  } = useAmendments();
  const allAmendments = [...senateAmendments, ...houseAmendments];

  const [leftSelection, setLeftSelection] = useState<PDFSelection>({
    source: "custom",
    url: "",
  });
  const [rightSelection, setRightSelection] = useState<PDFSelection>({
    source: "custom",
    url: "",
  });
  const [isComparing, setIsComparing] = useState(false);

  const handleCompare = () => {
    if (leftSelection.url && rightSelection.url) {
      setIsComparing(true);
    }
  };

  const handleSourceChange = (side: "left" | "right", source: PDFSource) => {
    if (side === "left") {
      setLeftSelection({ source, url: "" });
    } else {
      setRightSelection({ source, url: "" });
    }
  };

  const handleSelectionChange = (side: "left" | "right", selection: string) => {
    const updateSelection = (currentSelection: PDFSelection) => {
      if (currentSelection.source === "bill") {
        const bill = bills.find((b) => b.billNumber === selection);
        return {
          ...currentSelection,
          url: bill?.billLink || "",
          billNumber: selection,
        };
      } else if (currentSelection.source === "amendment") {
        const amendment = allAmendments.find((a) => a.lcoNumber === selection);
        return {
          ...currentSelection,
          url: amendment?.lcoLink || "",
          lcoNumber: selection,
        };
      } else {
        return {
          ...currentSelection,
          url: selection,
        };
      }
    };

    if (side === "left") {
      setLeftSelection(updateSelection(leftSelection));
    } else {
      setRightSelection(updateSelection(rightSelection));
    }
  };

  const renderSourceSelector = (side: "left" | "right") => {
    const selection = side === "left" ? leftSelection : rightSelection;

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleSourceChange(side, "custom")}
            className={`px-3 py-1 rounded-md text-sm ${
              selection.source === "custom"
                ? "bg-blue-600 text-white"
                : "bg-gray-200 hover:bg-gray-300"
            }`}
          >
            Custom URL
          </button>
          <button
            onClick={() => handleSourceChange(side, "bill")}
            className={`px-3 py-1 rounded-md text-sm ${
              selection.source === "bill"
                ? "bg-blue-600 text-white"
                : "bg-gray-200 hover:bg-gray-300"
            }`}
          >
            Bill
          </button>
          <button
            onClick={() => handleSourceChange(side, "amendment")}
            className={`px-3 py-1 rounded-md text-sm ${
              selection.source === "amendment"
                ? "bg-blue-600 text-white"
                : "bg-gray-200 hover:bg-gray-300"
            }`}
          >
            Amendment
          </button>
        </div>

        <div className="mt-2">
          {selection.source === "custom" && (
            <input
              type="text"
              value={selection.url}
              onChange={(e) => handleSelectionChange(side, e.target.value)}
              placeholder="Enter PDF URL"
              className="w-full p-2 border rounded-md text-sm"
            />
          )}

          {selection.source === "bill" && (
            <select
              value={selection.billNumber || ""}
              onChange={(e) => handleSelectionChange(side, e.target.value)}
              className="w-full p-2 border rounded-md text-sm"
            >
              <option value="">Select a Bill</option>
              {bills.map((bill) => (
                <option key={bill.billNumber} value={bill.billNumber}>
                  Bill {bill.billNumber}
                </option>
              ))}
            </select>
          )}

          {selection.source === "amendment" && (
            <select
              value={selection.lcoNumber || ""}
              onChange={(e) => handleSelectionChange(side, e.target.value)}
              className="w-full p-2 border rounded-md text-sm"
            >
              <option value="">Select an Amendment</option>
              {allAmendments.map((amendment) => (
                <option key={amendment.lcoNumber} value={amendment.lcoNumber}>
                  {amendment.chamber === "senate" ? "Senate" : "House"}{" "}
                  Amendment {amendment.lcoNumber} (Bill {amendment.billNumber})
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
    );
  };

  if (billsLoading || amendmentsLoading) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-6">PDF Comparison Tool</h1>

      {!isComparing ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium mb-2">
                First PDF
              </label>
              {renderSourceSelector("left")}
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium mb-2">
                Second PDF
              </label>
              {renderSourceSelector("right")}
            </div>
          </div>
          <div className="flex justify-center">
            <button
              onClick={handleCompare}
              disabled={!leftSelection.url || !rightSelection.url}
              className="px-6 py-2 bg-blue-600 text-white rounded-md disabled:bg-gray-400 disabled:cursor-not-allowed text-sm"
            >
              Compare PDFs
            </button>
          </div>
        </div>
      ) : (
        <div>
          <button
            onClick={() => setIsComparing(false)}
            className="mb-4 px-4 py-2 bg-gray-600 text-white rounded-md text-sm"
          >
            Back to Input
          </button>
          <PdfComparison
            leftPdfUrl={leftSelection.url}
            rightPdfUrl={rightSelection.url}
            leftLabel={
              leftSelection.source === "custom"
                ? "First PDF"
                : leftSelection.source === "bill"
                ? `Bill ${leftSelection.billNumber}`
                : `Amendment ${leftSelection.lcoNumber}`
            }
            rightLabel={
              rightSelection.source === "custom"
                ? "Second PDF"
                : rightSelection.source === "bill"
                ? `Bill ${rightSelection.billNumber}`
                : `Amendment ${rightSelection.lcoNumber}`
            }
          />
        </div>
      )}
    </div>
  );
}
