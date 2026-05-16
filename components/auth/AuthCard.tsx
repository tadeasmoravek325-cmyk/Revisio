"use client";

import { ReactNode } from "react";
import { RevisioLogoImage } from "@/components/branding/RevisioLogoImage";

export function AuthCard({
  eyebrow,
  title,
  description,
  children
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-8">
      <section className="panel w-full max-w-md p-5 sm:p-6">
        <RevisioLogoImage
          lightSrc="/revisio-sign-cropped.svg"
          darkSrc="/revisio-sign-cropped-darkmode.svg"
          alt="Revisio"
          width={96}
          height={96}
          priority
          className="mx-auto h-auto w-40 sm:w-48"
        />
        <p className="mt-6 text-xs font-black uppercase tracking-[0.14em] text-blue-700 dark:text-blue-300">
          {eyebrow}
        </p>
        <h1 className="mt-2 text-3xl font-black leading-tight text-slate-950 dark:text-slate-50">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p>
        <div className="mt-6">{children}</div>
      </section>
    </main>
  );
}
