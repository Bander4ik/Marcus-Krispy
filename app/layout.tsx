import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Marcus Krispy — TennisTimez Studio",
  description: "Script automation, competitor scouting, and analytics for @TennisTimez.",
};

const TABS = [
  { href: "/script", label: "Script", soon: false },
  { href: "/competitors", label: "Competitors", soon: false },
  { href: "/analytics", label: "Analytics", soon: true },
  { href: "/settings", label: "⚙ Settings", soon: false },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div style={{ maxWidth: 920, margin: "0 auto", padding: "24px 20px" }}>
          <header style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
              TennisTimez Studio{" "}
              <span style={{ color: "var(--muted)", fontWeight: 400, fontSize: 14 }}>
                — Marcus Krispy
              </span>
            </h1>
            <nav style={{ display: "flex", gap: 8, marginTop: 16 }}>
              {TABS.map((t) => (
                <Link
                  key={t.href}
                  href={t.href}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 14px",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--panel)",
                    color: "var(--foreground)",
                    textDecoration: "none",
                    fontSize: 14,
                  }}
                >
                  {t.label}
                  {t.soon && (
                    <span
                      style={{
                        fontSize: 10,
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                        color: "var(--accent)",
                        border: "1px solid var(--accent)",
                        borderRadius: 4,
                        padding: "1px 4px",
                      }}
                    >
                      soon
                    </span>
                  )}
                </Link>
              ))}
            </nav>
          </header>
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
