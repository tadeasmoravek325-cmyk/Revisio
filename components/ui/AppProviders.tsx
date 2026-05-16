"use client";

import { ReactNode } from "react";
import { AuthGate } from "@/components/auth/AuthGate";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { StudyStoreProvider } from "@/hooks/useStudyStore";
import { ThemeProvider } from "./ThemeProvider";
import { ToastProvider } from "./ToastProvider";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <AuthGate>
            <StudyStoreProvider>{children}</StudyStoreProvider>
          </AuthGate>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
