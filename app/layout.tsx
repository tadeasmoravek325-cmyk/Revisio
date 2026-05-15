import type { Metadata } from "next";
import { AppProviders } from "@/components/ui/AppProviders";
import "./globals.css";

export const metadata: Metadata = {
  title: "Revisio",
  description: "Track study preparation for final exams."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('statnice-tracker-theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}"
          }}
        />
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
