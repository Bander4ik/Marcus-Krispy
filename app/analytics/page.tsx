// TAB 3 SEAM — My Analytics (YouTube Analytics API + Google OAuth). Coming soon.
export default function AnalyticsPage() {
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
      <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>My Analytics</h2>
      <p style={{ margin: 0, color: "var(--muted)", fontSize: 14 }}>
        Connect your channel — coming soon. Retention, traffic sources, and
        revenue via the YouTube Analytics API.
      </p>
      <p style={{ margin: "12px 0 0", color: "var(--muted)", fontSize: 12 }}>
        Seams: <code>lib/youtube/oauth.ts</code>,{" "}
        <code>lib/youtube/analytics-api.ts</code> · needs Marcus&apos;s Google
        OAuth client
      </p>
    </div>
  );
}
