import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Botch Build Platform",
  description:
    "Secure diaspora real estate investment platform for remote project funding and monitoring.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
