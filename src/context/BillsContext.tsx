"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import axios from "axios";
import { useSession } from "next-auth/react";

export interface Bill {
  billNumber: string;
  billLink: string;
  pdfLinks: string[];
  summary?: string | null;
  updatedAt?: string | null;
}

interface BillsContextType {
  bills: Bill[];
  loading: boolean;
  error: string | null;
  refreshBills: () => Promise<void>;
  getBillByNumber: (billNumber: string) => Bill | undefined;
}

const BillsContext = createContext<BillsContextType | undefined>(undefined);

export function useBills() {
  const context = useContext(BillsContext);
  if (context === undefined) {
    throw new Error("useBills must be used within a BillsProvider");
  }
  return context;
}

interface BillsProviderProps {
  children: ReactNode;
}

export function BillsProvider({ children }: BillsProviderProps) {
  const { status } = useSession();
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBills = useCallback(async () => {
    if (status !== "authenticated") return;

    setLoading(true);
    setError(null);

    try {
      const response = await axios.get("/api/bills");
      setBills(response.data);
    } catch (err) {
      console.error("Error fetching bills:", err);
      setError("Failed to fetch bills");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    if (status === "authenticated") {
      fetchBills();
    } else if (status === "unauthenticated") {
      setBills([]);
      setLoading(false);
    }
  }, [status, fetchBills]);

  const refreshBills = async () => {
    await fetchBills();
  };

  const getBillByNumber = (billNumber: string): Bill | undefined => {
    return bills.find((b) => b.billNumber === billNumber);
  };

  const value = {
    bills,
    loading,
    error,
    refreshBills,
    getBillByNumber,
  };

  return (
    <BillsContext.Provider value={value}>{children}</BillsContext.Provider>
  );
}
