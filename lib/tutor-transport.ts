"use client";

import { CapacitorHttp } from "@capacitor/core";
import { askTutorDirect } from "./gemini-client";
import { isNativeApp } from "./settings";
import { createTutorTransport } from "./transport-core";
import { normalizeNativeError } from "./gemini-http";
import {
  friendlyApiError,
  classifyApiError,
  apiErrorDiagnostic,
} from "./api-error";
import { TutorError, ensureNotAborted } from "./tutor-error";

export const askTutor = createTutorTransport({
  native: isNativeApp,
  direct: askTutorDirect,
  server: async (url, body, signal, native) => {
    try {
      if (native) {
        const response = await CapacitorHttp.request({
          url,
          method: "POST",
          headers: { "Content-Type": "application/json" },
          data: body,
          connectTimeout: 15_000,
          readTimeout: 55_000,
          responseType: "json",
          disableRedirects: true,
        });
        ensureNotAborted(signal);
        return { status: response.status, data: response.data };
      }
      const response = await fetch(url, {
        method: "POST",
        redirect: "error",
        signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return { status: response.status, data: await response.json() };
    } catch (error) {
      if (error instanceof TutorError) throw error;
      const normalized = native ? normalizeNativeError(error) : error;
      throw new TutorError(
        friendlyApiError(normalized),
        classifyApiError(normalized),
        apiErrorDiagnostic(normalized),
      );
    }
  },
});
