import type { ReactNode } from "react";

// Placeholder shell; the localized site ([locale]/) replaces this in the web phase.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
