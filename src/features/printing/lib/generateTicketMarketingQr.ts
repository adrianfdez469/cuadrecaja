import QRCode from "qrcode";
import { TICKET_MARKETING_URL } from "@/constants/ticket";

const QR_OPTIONS = {
  width: 120,
  margin: 1,
  errorCorrectionLevel: "M" as const,
};

let cachedMarketingQrDataUrl: string | null = null;
let marketingQrPromise: Promise<string> | null = null;

export async function generateTicketMarketingQrDataUrl(
  url: string = TICKET_MARKETING_URL,
): Promise<string> {
  if (url !== TICKET_MARKETING_URL) {
    return QRCode.toDataURL(url, QR_OPTIONS);
  }

  if (cachedMarketingQrDataUrl) {
    return cachedMarketingQrDataUrl;
  }

  if (!marketingQrPromise) {
    marketingQrPromise = QRCode.toDataURL(TICKET_MARKETING_URL, QR_OPTIONS).then(
      (dataUrl) => {
        cachedMarketingQrDataUrl = dataUrl;
        return dataUrl;
      },
    );
  }

  return marketingQrPromise;
}
