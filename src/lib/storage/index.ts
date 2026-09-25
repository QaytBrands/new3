import { randomUUID } from "crypto";

export interface StorageProvider {
  put(path: string, data: Blob, contentType: string): Promise<{ url: string }>;
}

class LocalStorageProvider implements StorageProvider {
  async put(path: string, data: Blob): Promise<{ url: string }> {
    const { mkdir, writeFile } = await import("fs/promises");
    const { join, dirname } = await import("path");
    const full = join(process.cwd(), "public", "uploads", path);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, Buffer.from(await data.arrayBuffer()));
    return { url: `/uploads/${path}` };
  }
}

class VercelBlobStorageProvider implements StorageProvider {
  async put(path: string, data: Blob, contentType: string): Promise<{ url: string }> {
    const { put } = await import("@vercel/blob");
    const blob = await put(path, data, { access: "public", contentType, addRandomSuffix: true });
    return { url: blob.url };
  }
}

export function getStorage(): StorageProvider {
  return process.env.STORAGE_PROVIDER === "vercel-blob"
    ? new VercelBlobStorageProvider()
    : new LocalStorageProvider();
}

export function recordingPath(userId: string, ext: string) {
  return `recordings/${userId}/${Date.now()}-${randomUUID()}.${ext}`;
}
