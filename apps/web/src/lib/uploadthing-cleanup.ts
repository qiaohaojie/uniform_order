import { UTApi } from "uploadthing/server";

let cachedUtapi: UTApi | null = null;
function getUtapi() {
  if (!cachedUtapi) cachedUtapi = new UTApi();
  return cachedUtapi;
}

/**
 * Best-effort delete of an UploadThing file by its public URL.
 * Throws on failure; callers should catch + log + continue.
 */
export async function deleteUploadthingFileByUrl(url: string): Promise<void> {
  // UploadThing public URLs look like https://utfs.io/f/<fileKey>
  const match = /https?:\/\/[^/]+\/f\/([^/?#]+)/.exec(url);
  if (!match) throw new Error(`Unrecognized UploadThing URL: ${url}`);
  const fileKey = match[1];
  await getUtapi().deleteFiles(fileKey);
}
