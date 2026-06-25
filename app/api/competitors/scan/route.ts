/**
 * /api/competitors/scan — the Competitors/Outliers scan endpoint.
 *
 *   GET  → the current state (no scan): { channels, lastScanAt, outliers }.
 *          Used on tab open to render the saved list + decide if a scan is due.
 *   POST → runs scanAll() over the saved channels, saves the ranked outliers +
 *          a fresh lastScanAt to the store, returns
 *          { channels, lastScanAt, outliers, errors }.
 *
 * Key handling: resolveYouTubeKey() is env-first (YOUTUBE_DATA_API_KEY, else the
 * key saved in Settings). When NO key is set, POST returns a graceful 400 JSON
 * (never throws / 500) so the UI can point the user at Settings. The key is
 * never logged or returned.
 *
 * runtime nodejs: the store writes to ~/.marcus-krispy and the fetch layer needs
 * Node. Local single-user use (gate behind APP_PASSWORD on any deploy).
 */
import { resolveYouTubeKey } from "@/lib/env";
import { readCompetitors, saveScan } from "@/lib/competitors/store";
import { scanAll } from "@/lib/youtube/data-api";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const { channels, lastScanAt, outliers } = await readCompetitors();
  return Response.json({ channels, lastScanAt, outliers });
}

export async function POST(): Promise<Response> {
  const key = await resolveYouTubeKey();
  if (!key) {
    return Response.json(
      {
        error:
          "A YouTube Data API key is required to scan competitors. Add it in Settings (it's a free key from Google Cloud).",
      },
      { status: 400 }
    );
  }

  const { channels } = await readCompetitors();
  if (channels.length === 0) {
    return Response.json(
      { error: "Add at least one competitor channel before scanning." },
      { status: 400 }
    );
  }

  try {
    const { outliers, errors } = await scanAll(channels, key);
    const saved = await saveScan(outliers);
    return Response.json({
      channels: saved.channels,
      lastScanAt: saved.lastScanAt,
      outliers: saved.outliers,
      errors,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to scan competitors.";
    return Response.json({ error: message }, { status: 500 });
  }
}
