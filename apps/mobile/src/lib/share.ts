import { whatsappNumber, whatsappUrl } from '@invoicegen/shared/whatsapp';
import { Linking, Share } from 'react-native';

export { whatsappNumber };

/**
 * Open WhatsApp with the message, addressed to `phone` when we have a usable
 * number; otherwise fall back to the system share sheet (which lists WhatsApp).
 */
export async function sendViaWhatsApp(message: string, phone?: string | null): Promise<void> {
  if (whatsappNumber(phone)) {
    const url = whatsappUrl(message, phone);
    if (await Linking.canOpenURL(url)) {
      await Linking.openURL(url);
      return;
    }
  }
  await Share.share({ message });
}
