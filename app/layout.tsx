import type { Metadata } from "next";
import { SITE_CONFIG } from "./lib/site-config";
import "./globals.css";

const title = "Private PDF Tools That Work Offline | SnackPDF";
const description = "Process PDFs on your device without uploading files or creating an account. SnackPDF works offline after the application is prepared.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_CONFIG.origin),
  title,
  description,
  applicationName: "SnackPDF",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "SnackPDF",
    title,
    description,
    url: "/",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "SnackPDF homepage and compact PDF tool directory" }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-GB">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48" type="image/x-icon" />
        <link rel="icon" href="/icons/favicon-16.png" sizes="16x16" type="image/png" />
        <link rel="icon" href="/icons/favicon-32.png" sizes="32x32" type="image/png" />
        <link rel="icon" href="/favicon.svg" sizes="any" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" />
        <link rel="mask-icon" href="/icons/safari-pinned-tab.svg" color="#c53b39" />
        <link rel="manifest" href="/manifest.webmanifest" />
      </head>
      <body>
        <a className="skip-link" href="#main-content">Skip to main content</a>
        {children}
      </body>
    </html>
  );
}
