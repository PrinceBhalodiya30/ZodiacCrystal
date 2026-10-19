import { HttpErrorResponse } from '@angular/common/http';

// Triggers a browser download for an in-memory blob (e.g. a PDF fetched via HttpClient
// with responseType: 'blob'), without needing the file to have a real server URL.
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  // Safari and older Firefox only follow a link that is in the document, and
  // cancel the download if the URL is revoked in the same tick.
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => window.URL.revokeObjectURL(url), 1000);
}

// With responseType: 'blob' the server's JSON error ({ message }) arrives as a
// Blob too, so read it before falling back to the generic message.
export async function blobErrorMessage(error: unknown, fallback: string): Promise<string> {
  if (error instanceof HttpErrorResponse && error.error instanceof Blob) {
    try {
      const body = JSON.parse(await error.error.text());
      if (typeof body?.message === 'string' && body.message.trim()) {
        return body.message;
      }
    } catch {
      // Not JSON - use the fallback.
    }
  }
  return fallback;
}
