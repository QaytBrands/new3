import { randomUUID } from "crypto";

/**
 * Private object storage for student recordings. Stored objects are never public: they are
 * referenced by key and streamed through an authorised route (/api/recordings/[id]/audio).
 */
export interface StorageProvider {
  put(key: string, data: Blob, contentType: string): Promise<{ key: string }>;
  get(key: string): Promise<{ body: ReadableStream<Uint8Array>; contentType: string } | null>;
}

const SAFE_KEY = /^recordings\/[A-Za-z0-9_-]+\/[A-Za-z0-9._-]+$/;

class LocalStorageProvider implements StorageProvider {
  private dir() {
    // Outside /public so files are not directly downloadable.
    return process.env.LOCAL_UPLOAD_DIR ?? ".data/uploads";
  }

  async put(key: string, data: Blob): Promise<{ key: string }> {
    const { mkdir, writeFile } = await import("fs/promises");
    const { join, dirname, resolve } = await import("path");
    if (!SAFE_KEY.test(key)) throw new Error("Invalid storage key");
    const full = join(resolve(this.dir()), key);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, Buffer.from(await data.arrayBuffer()));
    return { key };
  }

  async get(key: string) {
    if (!SAFE_KEY.test(key)) return null;
    const { readFile } = await import("fs/promises");
    const { join, resolve } = await import("path");
    try {
      const buf = await readFile(join(resolve(this.dir()), key));
      const body = new Blob([new Uint8Array(buf)]).stream();
      return { body, contentType: contentTypeFor(key) };
    } catch {
      return null;
    }
  }
}

class VercelBlobStorageProvider implements StorageProvider {
  async put(key: string, data: Blob, contentType: string): Promise<{ key: string }> {
    const { put } = await import("@vercel/blob");
    const blob = await put(key, data, { access: "private", contentType, addRandomSuffix: true });
    return { key: blob.pathname };
  }

  async get(key: string) {
    const { get } = await import("@vercel/blob");
    const res = await get(key, { access: "private" });
    if (!res || res.statusCode !== 200 || !res.stream) return null;
    return { body: res.stream, contentType: res.blob.contentType ?? contentTypeFor(key) };
  }
}

function contentTypeFor(key: string) {
  return key.endsWith(".m4a") ? "audio/mp4" : key.endsWith(".ogg") ? "audio/ogg" : "audio/webm";
}

export type StorageMode = "none" | "local" | "vercel-blob";

/** Recording storage is off unless STORAGE_PROVIDER is set to "local" (dev) or "vercel-blob". */
export function storageMode(env: Record<string, string | undefined> = process.env): StorageMode {
  const v = env.STORAGE_PROVIDER?.trim();
  return v === "local" || v === "vercel-blob" ? v : "none";
}

/** Null when recording storage is turned off. */
export function getStorage(): StorageProvider | null {
  const mode = storageMode();
  if (mode === "vercel-blob") return new VercelBlobStorageProvider();
  if (mode === "local") return new LocalStorageProvider();
  return null;
}

export function recordingKey(userId: string, ext: string) {
  return `recordings/${userId}/${Date.now()}-${randomUUID()}.${ext}`;
}
