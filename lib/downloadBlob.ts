/**
 * Salva um Blob como arquivo.
 * — iOS Safari: usa Web Share API (abre o seletor nativo de salvar/biblioteca)
 * — Desktop / Android Chrome: usa <a download> clássico
 */
export async function downloadBlob(blob: Blob, filename: string): Promise<void> {
  const file = new File([blob], filename, { type: blob.type });

  // iOS 15+ / Android Chrome com Web Share suportando arquivos
  if (
    typeof navigator !== "undefined" &&
    navigator.share &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch {
      // Usuário cancelou ou API falhou → cai no fallback abaixo
    }
  }

  // Fallback: <a download> (desktop e Android Chrome sem share)
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Converte dataURL em Blob e chama downloadBlob */
export function downloadDataUrl(dataUrl: string, filename: string): Promise<void> {
  const [header, base64] = dataUrl.split(",");
  const mimeMatch = header.match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: mime });
  return downloadBlob(blob, filename);
}
