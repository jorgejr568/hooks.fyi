const CT_EXTENSION: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/bmp": "bmp",
  "image/avif": "avif",
  "application/pdf": "pdf",
  "application/json": "json",
  "application/xml": "xml",
  "application/zip": "zip",
  "application/x-www-form-urlencoded": "txt",
  "text/plain": "txt",
  "text/html": "html",
  "text/css": "css",
  "text/csv": "csv",
  "text/xml": "xml",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/ogg": "ogg",
  "audio/webm": "weba",
  "video/mp4": "mp4",
  "video/webm": "webm",
};

export function fileExtension(
  fileName: string | null | undefined,
  contentType: string | null | undefined,
): string {
  if (fileName) {
    const dot = fileName.lastIndexOf(".");
    if (dot > 0 && dot < fileName.length - 1) {
      const ext = fileName
        .slice(dot + 1)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
      if (ext.length > 0 && ext.length <= 8) return ext;
    }
  }
  const main = (contentType ?? "").toLowerCase().split(";")[0].trim();
  return CT_EXTENSION[main] ?? "bin";
}
