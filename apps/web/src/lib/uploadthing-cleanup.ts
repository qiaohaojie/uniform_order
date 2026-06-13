import { UTApi } from "uploadthing/server";

let cachedUtapi: UTApi | null = null;
function getUtapi() {
  if (!cachedUtapi) cachedUtapi = new UTApi();
  return cachedUtapi;
}

/**
 * Best-effort delete of an UploadThing file by its public URL.
 * A real UTApi failure still throws (callers catch + log + continue); but an
 * unrecognised URL shape is treated as a warn-and-skip rather than a throw, so
 * a future UploadThing URL-format drift degrades to a leaked orphan file
 * instead of breaking the catalog update that triggered the cleanup.
 */
export async function deleteUploadthingFileByUrl(url: string): Promise<void> {
  // UploadThing public URLs look like https://utfs.io/f/<fileKey> or the newer
  // https://<appId>.ufs.sh/f/<fileKey>; both expose the key under a /f/ segment.
  const match = /https?:\/\/[^/]+\/f\/([^/?#]+)/.exec(url);
  if (!match) {
    console.warn(`Skipping UploadThing cleanup for unrecognized URL: ${url}`);
    return;
  }
  const fileKey = match[1];
  await getUtapi().deleteFiles(fileKey);
}
