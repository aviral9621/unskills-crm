import QRCode from 'qrcode'

export async function generateQRDataUrl(targetUrl: string): Promise<string> {
  return await QRCode.toDataURL(targetUrl, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 200,
    color: { dark: '#000000', light: '#FFFFFF' },
  })
}
