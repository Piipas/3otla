import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#2f3fce",
      }}
    >
      <svg width="100" height="100" viewBox="0 0 32 32" aria-hidden="true">
        <rect x="6" y="6" width="20" height="20" rx="2" fill="#f4eee3" />
        <rect
          x="6"
          y="6"
          width="20"
          height="20"
          rx="2"
          fill="#f4eee3"
          transform="rotate(45 16 16)"
        />
        <circle cx="16" cy="16" r="4.2" fill="#2f3fce" />
      </svg>
    </div>,
    size,
  );
}
