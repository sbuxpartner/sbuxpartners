/**
 * Image preprocessing module - Disabled to remove sharp dependency
 * Sharp causes issues in some serverless environments and is not currently used in the Azure OCR path.
 */

export async function preprocessImage(imageBuffer: Buffer, options: any = {}): Promise<Buffer> {
  return imageBuffer;
}

export async function preprocessImageAggressive(imageBuffer: Buffer): Promise<Buffer> {
  return imageBuffer;
}

export async function preprocessForTable(imageBuffer: Buffer): Promise<Buffer> {
  return imageBuffer;
}
