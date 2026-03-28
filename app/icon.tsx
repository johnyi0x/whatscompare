import { ImageResponse } from "next/og";

/** Mint “c” on same dark page bg as `.dark` theme (`--color-bg-page`). */
export const runtime = "edge";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0c1220",
          color: "#86d4ae",
          fontSize: 20,
          fontWeight: 600,
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        }}
      >
        c
      </div>
    ),
    { ...size }
  );
}
