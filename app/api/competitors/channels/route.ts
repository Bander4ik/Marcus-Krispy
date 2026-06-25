/**
 * /api/competitors/channels — manage the editable competitor channel list.
 *
 *   GET    → { channels } — the current handles (seeded with the 12 defaults on
 *            first read).
 *   POST   → { handle } — add a channel by @handle (or a pasted channel URL,
 *            normalized to @name). Idempotent (duplicate ignored). 400 on empty.
 *   DELETE → ?handle=@name — remove a channel (case-insensitive). Returns the
 *            updated list.
 *
 * No key needed (this only edits local state). The scan itself lives at
 * /api/competitors/scan. runtime nodejs (writes to ~/.marcus-krispy).
 */
import { addChannel, getChannels, removeChannel } from "@/lib/competitors/store";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  return Response.json({ channels: await getChannels() });
}

interface PostBody {
  handle?: unknown;
}

export async function POST(request: Request): Promise<Response> {
  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const handle = typeof body.handle === "string" ? body.handle.trim() : "";
  if (!handle) {
    return Response.json(
      { error: "A channel handle is required." },
      { status: 400 }
    );
  }
  try {
    const channels = await addChannel(handle);
    return Response.json({ channels });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Couldn't add the channel.";
    return Response.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request): Promise<Response> {
  const handle = new URL(request.url).searchParams.get("handle")?.trim() ?? "";
  if (!handle) {
    return Response.json(
      { error: "A channel handle is required." },
      { status: 400 }
    );
  }
  const channels = await removeChannel(handle);
  return Response.json({ channels });
}
