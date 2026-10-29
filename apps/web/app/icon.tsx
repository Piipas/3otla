import { ImageResponse } from "next/og";

export const contentType = "image/png";

export function generateImageMetadata() {
  return [32, 192, 512].map((px) => ({
    id: String(px),
    size: { width: px, height: px },
    contentType: "image/png",
  }));
}

/** Eight-point star on Majorelle blue. Full-bleed so it also works as a maskable icon. */
export default async function Icon({ id }: { id: Promise<string> }) {
  const px = Number(await id);
  const star = Math.round(px * 0.56);
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#2f3fce",
        borderRadius: px <= 32 ? px * 0.22 : 0,
      }}
    >
      <svg width={star} height={star} viewBox="0 0 32 32" aria-hidden="true">
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
    { width: px, height: px },
  );
}
