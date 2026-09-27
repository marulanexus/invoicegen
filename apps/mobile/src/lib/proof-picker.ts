import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

/** The server's limit; checked here too so we don't upload a file it will refuse. */
const MAX_BYTES = 5 * 1024 * 1024;

export type ProofSource = 'camera' | 'photos' | 'pdf';

export type PickedProof = { uri: string; name: string; type: string };

export type PickResult =
  | { ok: true; file: PickedProof }
  | { ok: false; reason: 'cancelled' }
  | { ok: false; reason: 'permission' | 'too_big'; message: string };

const imageOptions: ImagePicker.ImagePickerOptions = {
  mediaTypes: 'images',
  // Compressed JPEG: small uploads, and viewable in any browser (iPhone HEIC isn't).
  quality: 0.7,
  preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
};

/** Take a photo, choose a screenshot, or choose a PDF as proof of payment. */
export async function pickProof(source: ProofSource): Promise<PickResult> {
  if (source === 'pdf') {
    const res = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
    if (res.canceled || !res.assets[0]) return { ok: false, reason: 'cancelled' };
    const a = res.assets[0];
    if ((a.size ?? 0) > MAX_BYTES) return { ok: false, reason: 'too_big', message: 'That PDF is bigger than 5 MB.' };
    return { ok: true, file: { uri: a.uri, name: a.name || 'proof-of-payment.pdf', type: 'application/pdf' } };
  }

  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      return { ok: false, reason: 'permission', message: 'Allow camera access in your phone settings to photograph the proof.' };
    }
  }
  const res =
    source === 'camera' ? await ImagePicker.launchCameraAsync(imageOptions) : await ImagePicker.launchImageLibraryAsync(imageOptions);
  if (res.canceled || !res.assets[0]) return { ok: false, reason: 'cancelled' };
  const a = res.assets[0];
  if ((a.fileSize ?? 0) > MAX_BYTES) return { ok: false, reason: 'too_big', message: 'That image is bigger than 5 MB.' };
  return {
    ok: true,
    file: { uri: a.uri, name: a.fileName || 'proof-of-payment.jpg', type: a.mimeType || 'image/jpeg' },
  };
}
