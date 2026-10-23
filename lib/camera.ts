"use client";

import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { MAX_IMAGE_BYTES, type ChatImage } from "./shared";

const MAX_CAMERA_DIMENSION = 1600;

function isCapacitorNative(): boolean {
  return typeof window !== "undefined" &&
    // @ts-expect-error Capacitor injeta este objeto na app nativa
    !!window.Capacitor?.isNativePlatform?.();
}

function dataUrlToChatImage(dataUrl: string): ChatImage {
  const [header, base64] = dataUrl.split(",");
  const mimeType = header.match(/data:(.*?);/)?.[1] ?? "image/jpeg";
  return { mimeType, data: base64 };
}

function canvasToChatImage(canvas: HTMLCanvasElement): Promise<ChatImage> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Não foi possível processar a foto."));
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          resolve(dataUrlToChatImage(reader.result as string));
        };
        reader.onerror = () => reject(new Error("Não foi possível ler a foto."));
        reader.readAsDataURL(blob);
      },
      "image/jpeg",
      0.85
    );
  });
}

async function resizeImage(img: HTMLImageElement): Promise<ChatImage> {
  let { width, height } = img;
  const scale = Math.min(1, MAX_CAMERA_DIMENSION / Math.max(width, height));
  width = Math.round(width * scale);
  height = Math.round(height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível processar a foto.");
  ctx.drawImage(img, 0, 0, width, height);
  return canvasToChatImage(canvas);
}

async function loadImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  return img;
}

/**
 * Abre a câmara traseira do telemóvel (app nativa) ou o seletor de câmara
 * (browser/PWA). Devolve a foto já redimensionada e sem metadados EXIF.
 */
export async function takePhoto(): Promise<ChatImage> {
  if (isCapacitorNative()) {
    const photo = await Camera.getPhoto({
      source: CameraSource.Camera,
      resultType: CameraResultType.DataUrl,
      quality: 85,
      width: MAX_CAMERA_DIMENSION,
      saveToGallery: false,
      correctOrientation: true,
    });
    if (!photo.dataUrl) {
      throw new Error("Não consegui obter a foto. Tenta de novo.");
    }
    const img = await loadImageFromDataUrl(photo.dataUrl);
    const processed = await resizeImage(img);
    const bytes = Math.ceil((processed.data.length * 3) / 4);
    if (bytes > MAX_IMAGE_BYTES) {
      throw new Error("A foto ficou muito grande. Tenta com menos luz de fundo.");
    }
    return processed;
  }

  // Fallback browser/PWA: input com capture abre a câmara diretamente
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.capture = "environment";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        reject(new Error("Nenhuma foto tirada."));
        return;
      }
      try {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.src = url;
        await img.decode();
        URL.revokeObjectURL(url);
        resolve(await resizeImage(img));
      } catch (err) {
        reject(err instanceof Error ? err : new Error("Não consegui ler a foto."));
      }
    };
    input.oncancel = () => reject(new Error("Captura cancelada."));
    input.click();
  });
}
