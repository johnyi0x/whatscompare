"use client";
/* eslint-disable @next/next/no-img-element -- /api/amazon-img proxy; next/image not ideal for streamed JPEG */

/**
 * Plain img for /api/amazon-img — Next/Image is a poor fit for streamed proxy responses.
 */
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
