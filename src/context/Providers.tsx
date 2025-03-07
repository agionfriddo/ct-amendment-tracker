"use client";

import { ReactNode } from "react";
import { AuthProvider } from "./AuthContext";
import { AmendmentsProvider } from "./AmendmentsContext";
import { BillsProvider } from "./BillsContext";

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <AuthProvider>
      <BillsProvider>
        <AmendmentsProvider>{children}</AmendmentsProvider>
      </BillsProvider>
    </AuthProvider>
  );
}
