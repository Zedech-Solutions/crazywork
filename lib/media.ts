// Shared media helpers. CMS "image" fields now accept video too; we detect the
// kind from the file extension on the stored URL.
const VIDEO_EXT = [".mp4", ".webm", ".mov", ".m4v", ".ogv"];

export function isVideo(url: string | null | undefined): boolean {
  if (!url) return false;
  const clean = url.split("?")[0].toLowerCase();
  return VIDEO_EXT.some((ext) => clean.endsWith(ext));
}
