"use client";

import Image, { ImageProps } from "next/image";
import { useTheme } from "@/components/ui/ThemeProvider";

type RevisioLogoImageProps = Omit<ImageProps, "src"> & {
  lightSrc: string;
  darkSrc?: string;
};

export function RevisioLogoImage({ lightSrc, darkSrc, ...props }: RevisioLogoImageProps) {
  const { theme } = useTheme();

  return <Image {...props} src={theme === "dark" ? darkSrc ?? lightSrc : lightSrc} />;
}
