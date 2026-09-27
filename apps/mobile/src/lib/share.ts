import { Linking, Share } from 'react-native';

/**
 * WhatsApp number in international format without "+", or null. Local South
 * African numbers (0XX XXX XXXX) become 27XXXXXXXXX.
 */
export function whatsappNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (/^0\d{9}$/.test(digits)) return `27${digits.slice(1)}`;
  if (/^\d{10,15}$/.test(digits)) return digits;
  return null;
}

/**
 * Open WhatsApp with the message, addressed to `phone` when we have a usable
 * number; otherwise fall back to the system share sheet (which lists WhatsApp).
 */
export async function shareMessage(message: string, phone?: string | null): Promise<void> {
  const number = whatsappNumber(phone);
  if (number) {
    const url = `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
    if (await Linking.canOpenURL(url)) {
      await Linking.openURL(url);
      return;
    }
  }
  await Share.share({ message });
}
