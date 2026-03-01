import { invoke } from "@tauri-apps/api/core";

export const readBinaryBase64 = async (path: string): Promise<string> => {
  return invoke<string>("read_binary_base64", { path });
};

export const writeBinaryBase64 = async (path: string, base64: string): Promise<void> => {
  await invoke("write_binary_base64", { path, base64 });
};

export const ensureDir = async (path: string): Promise<void> => {
  await invoke("ensure_dir", { path });
};
