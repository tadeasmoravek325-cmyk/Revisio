"use client";

import { ReactNode } from "react";
import { StudyStoreProvider } from "@/hooks/useStudyStore";
import { ThemeProvider } from "./ThemeProvider";
import { ToastProvider } from "./ToastProvider";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <StudyStoreProvider>{children}</StudyStoreProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
