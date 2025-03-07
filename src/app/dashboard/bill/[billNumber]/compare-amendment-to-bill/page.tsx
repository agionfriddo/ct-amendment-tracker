"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useAmendments, Amendment } from "@/context/AmendmentsContext";
import { useBills } from "@/context/BillsContext";
import PdfComparison from "@/components/PdfComparison";
import Link from "next/link";

export default function ComparePdfPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const billNumber = params.billNumber as string;
  const selectedLco = searchParams.get("lco");

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
  const [selectedAmendment, setSelectedAmendment] = useState<Amendment | null>(
    null
  );

  const amendments = getAmendmentsByBill(billNumber);
  const bill = getBillByNumber(billNumber);

  useEffect(() => {
    if (amendments.length > 0 && selectedLco) {
      const amendment = amendments.find((a) => a.lcoNumber === selectedLco);
      if (amendment) setSelectedAmendment(amendment);
    }
  }, [amendments, selectedLco]);

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

  if (!bill || bill.pdfLinks.length === 0) {
    return (
      <div className="bg-white shadow px-4 py-5 sm:rounded-lg sm:p-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">
            Bill PDF not available
          </h2>
          <p className="mt-2 text-gray-500">
            The original bill PDF is not available for comparison
          </p>
        </div>
      </div>
    );
  }

  if (amendments.length === 0) {
    return (
      <div className="bg-white shadow px-4 py-5 sm:rounded-lg sm:p-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">
            No amendments available
          </h2>
          <p className="mt-2 text-gray-500">
            There are no amendments available to compare with the original bill
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="bg-white shadow px-4 py-3 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-gray-900">
            Compare Bill PDF with Amendment
          </h2>
          <p className="mt-1 text-sm text-gray-500">{billNumber}</p>
        </div>
        <div className="flex items-center space-x-4">
          <select
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
            value={selectedLco || ""}
            onChange={(e) => {
              const url = new URL(window.location.href);
              url.searchParams.set("lco", e.target.value);
              router.push(url.toString());
            }}
          >
            <option value="">Select an amendment</option>
            {amendments.map((amendment) => (
              <option key={amendment.lcoNumber} value={amendment.lcoNumber}>
                {amendment.chamber === "senate" ? "Senate" : "House"} - LCO{" "}
                {amendment.lcoNumber} (
                {new Date(amendment.date).toLocaleDateString()})
              </option>
            ))}
          </select>
          <Link
            href={`/dashboard/bill/${billNumber}`}
            className="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Back to Bill
          </Link>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <PdfComparison
          leftPdfUrl={bill.pdfLinks[0]}
          rightPdfUrl={selectedAmendment?.lcoLink}
          leftLabel="Original Bill"
          rightLabel={
            selectedAmendment
              ? `Amendment LCO ${selectedAmendment.lcoNumber}`
              : "Select an amendment"
          }
        />
      </div>
    </div>
  );
}
