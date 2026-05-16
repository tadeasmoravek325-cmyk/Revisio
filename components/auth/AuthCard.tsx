"use client";

import Image from "next/image";
import { ReactNode } from "react";

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
        <Image
          src="/revisio-logo-tight.svg"
          alt="Revisio - Final exam preparation"
          width={190}
          height={65}
          priority
          className="mx-auto h-auto w-[190px]"
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
