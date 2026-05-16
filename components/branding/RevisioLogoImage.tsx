"use client";

import Image, { ImageProps } from "next/image";

type RevisioLogoImageProps = Omit<ImageProps, "src"> & {
  lightSrc: string;
  darkSrc?: string;
};

function mergeClassNames(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function RevisioLogoImage({ lightSrc, darkSrc, className, ...props }: RevisioLogoImageProps) {
  if (!darkSrc) {
    return <Image {...props} src={lightSrc} className={className} />;
  }

  return (
    <>
      <Image {...props} src={lightSrc} className={mergeClassNames(className, "dark:hidden")} />
      <Image {...props} src={darkSrc} className={mergeClassNames(className, "hidden dark:block")} />
    </>
  );
}
