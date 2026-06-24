// TAB 2 SEAM — Competitors / Outliers (YouTube Data API v3). Coming soon.
export default function CompetitorsPage() {
  return (
    <div
      style={{
        border: "1px dashed var(--border)",
        background: "var(--panel)",
        borderRadius: 10,
        padding: 32,
        textAlign: "center",
      }}
    >
      <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>Competitors / Outliers</h2>
      <p style={{ margin: 0, color: "var(--muted)", fontSize: 14 }}>
        Coming soon. Niche outlier scraping via the public YouTube Data API v3.
      </p>
      <p style={{ margin: "12px 0 0", color: "var(--muted)", fontSize: 12 }}>
        Seam: <code>lib/youtube/data-api.ts</code> · needs{" "}
        <code>YOUTUBE_DATA_API_KEY</code>
      </p>
    </div>
  );
}
