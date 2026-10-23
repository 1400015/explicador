"use client";

import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES, MAX_IMAGES_PER_MESSAGE, type ChatImage } from "./shared";

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.85;

async function fileToImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function resizeToCanvas(img: HTMLImageElement): HTMLCanvasElement {
  let { width, height } = img;
  const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
  width = Math.round(width * scale);
  height = Math.round(height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível processar a imagem.");
  ctx.drawImage(img, 0, 0, width, height);
  return canvas;
}

function canvasToChatImage(canvas: HTMLCanvasElement): Promise<ChatImage> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Não foi possível processar a imagem."));
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
          resolve({ mimeType: blob.type, data: base64 });
        };
        reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
        reader.readAsDataURL(blob);
      },
      "image/jpeg",
      JPEG_QUALITY
    );
  });
}

export async function processImageFile(file: File): Promise<ChatImage> {
  const isAllowed = (ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type);
  if (!isAllowed) {
    throw new Error(`Tipo de imagem não suportado: ${file.type || "desconhecido"}. Use JPEG, PNG ou WebP.`);
  }
  if (file.size > MAX_IMAGE_BYTES * 2) {
    throw new Error("Imagem muito grande. O limite é 8 MB por foto.");
  }

  const img = await fileToImage(file);
  const canvas = resizeToCanvas(img);
  const processed = await canvasToChatImage(canvas);

  const bytes = Math.ceil((processed.data.length * 3) / 4);
  if (bytes > MAX_IMAGE_BYTES) {
    throw new Error("Imagem processada ficou acima de 4 MB. Tente uma foto menor.");
  }

  return processed;
}

export async function processImageFiles(files: File[]): Promise<ChatImage[]> {
  if (files.length > MAX_IMAGES_PER_MESSAGE) {
    throw new Error(`Máximo de ${MAX_IMAGES_PER_MESSAGE} fotos por mensagem.`);
  }
  const images: ChatImage[] = [];
  for (const file of files) {
    images.push(await processImageFile(file));
  }
  return images;
}
