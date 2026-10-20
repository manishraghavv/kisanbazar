import apiClient from "@/lib/api-client";

/** Downloads an authenticated PDF (the API needs the bearer token, so a plain link cannot be used). */
export async function downloadPdf(path: string, filename: string): Promise<void> {
  const res = await apiClient.get(path, { responseType: "blob" });
  const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
