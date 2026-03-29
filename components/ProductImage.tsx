"use client";
/* eslint-disable @next/next/no-img-element -- remote retailer thumbnails; Next/Image optional */

/** Plain img for HTTPS product art from sync (e.g. Google Shopping thumbnails). */
export function ProductImage({
  src,
  alt,
  className,
  priority,
}: {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      referrerPolicy="no-referrer"
    />
  );
}
