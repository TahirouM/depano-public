import type { FilePurpose } from '@depano/schemas';
import * as ImagePicker from 'expo-image-picker';
import { api, ApiError } from './api';

export interface LocalFile {
  uri: string;
  contentType: string;
  sizeBytes?: number;
}

/**
 * Téléversement direct vers le stockage objet :
 * 1) files.uploadUrl (URL pré-signée) → 2) PUT du binaire → 3) files.complete.
 * L'API ne transporte jamais les fichiers.
 */
export async function uploadFile(file: LocalFile, purpose: FilePurpose): Promise<{ fileId: string; url: string }> {
  const blob = await (await fetch(file.uri)).blob();
  const target = await api.files.uploadUrl({ purpose, contentType: file.contentType, sizeBytes: file.sizeBytes ?? blob.size });
  let res: Response;
  try {
    res = await fetch(target.uploadUrl, { method: target.method, headers: target.headers, body: blob });
  } catch (e) {
    throw new ApiError(0, 'network_error', 'Connexion impossible. Vérifiez votre réseau.', e);
  }
  if (!res.ok) throw new ApiError(res.status, 'upload_failed', "L'envoi du fichier a échoué. Réessayez.");
  const done = await api.files.complete(target.fileId);
  return { fileId: done.id, url: done.url };
}

const ALLOWED_IMAGE = /^image\/(jpeg|png|webp|heic)$/;

/** Choisit (ou prend) une photo. Renvoie null si l'utilisateur annule ou refuse. */
export async function pickImage(source: 'library' | 'camera' = 'library'): Promise<LocalFile | null> {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return null;
  }
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.7, allowsEditing: false, exif: false };
  const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  const asset = res.canceled ? null : res.assets[0];
  if (!asset) return null;
  const type = asset.mimeType && ALLOWED_IMAGE.test(asset.mimeType) ? asset.mimeType : 'image/jpeg';
  return { uri: asset.uri, contentType: type, sizeBytes: asset.fileSize ?? undefined };
}
