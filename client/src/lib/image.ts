import { api } from "./api";

/** Reduz a imagem no navegador (máx. 1600 px, JPEG) antes de enviar. */
export function resizeImage(file: File, maxSize = 1600, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type) && !/\.(jpe?g|png|webp)$/i.test(file.name)) {
      reject(new Error("Escolha um arquivo de imagem (JPG, PNG ou WEBP)."));
      return;
    }
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      const context = canvas.getContext("2d");
      if (!context) {
        URL.revokeObjectURL(url);
        reject(new Error("Não foi possível processar a imagem."));
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível abrir esta imagem."));
    };
    image.src = url;
  });
}

export async function uploadImage(file: File, maxSize?: number) {
  const dataUrl = await resizeImage(file, maxSize);
  const { url } = await api<{ url: string }>("/api/uploads", { method: "POST", body: { dataUrl } });
  return url;
}
