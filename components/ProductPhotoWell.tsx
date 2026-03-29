import type { ReactNode } from "react";

/**
 * Square product media area: when an image is shown, the canvas behind it is always white
 * (catalog + PDP) so light-background product shots don’t float on dark gray in dark mode.
 */
export function ProductPhotoWell({
  children,
  className = "",
  hasImage,
}: {
  children: ReactNode;
  className?: string;
  hasImage: boolean;
}) {
  return (
    <div className={`relative aspect-square w-full overflow-hidden ${className}`.trim()}>
      <div
        className={`absolute inset-0 flex items-center justify-center p-3 sm:p-4 ${
          hasImage ? "bg-white" : "bg-surface-subtle"
        }`}
      >
        <div className="relative h-full w-full">{children}</div>
      </div>
    </div>
  );
}
