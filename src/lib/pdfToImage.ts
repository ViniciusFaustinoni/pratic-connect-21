import * as pdfjsLib from 'pdfjs-dist';

// Configure worker from CDN (avoids need to copy worker file)
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

/**
 * Converts a PDF file to a JPEG image (first page only)
 * @param file - The PDF file to convert
 * @returns A Blob containing the JPEG image
 */
export async function convertPdfToImage(file: File): Promise<Blob> {
  // Read file as ArrayBuffer
  const arrayBuffer = await file.arrayBuffer();
  
  // Load PDF document
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  // Get first page (documents like CNH, CRLV are usually 1 page)
  const page = await pdf.getPage(1);
  
  // Set scale for good OCR quality (2.5x resolution for better CPF extraction)
  const scale = 2.5;
  const viewport = page.getViewport({ scale });
  
  // Create canvas element
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  
  if (!context) {
    throw new Error('Failed to get canvas 2D context');
  }
  
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  
  // Render page to canvas
  await page.render({
    canvasContext: context,
    viewport: viewport
  }).promise;
  
  // Convert canvas to JPEG Blob (good quality, smaller size than PNG)
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to convert canvas to blob'));
        }
      },
      'image/jpeg',
      0.92 // 92% quality - good balance between size and clarity for OCR
    );
  });
}

/**
 * Checks if a file is a PDF
 * @param file - The file to check
 * @returns True if the file is a PDF
 */
export function isPdf(file: File): boolean {
  return file.type === 'application/pdf' || 
         file.name.toLowerCase().endsWith('.pdf');
}

/**
 * Gets the converted filename (PDF to JPG)
 * @param originalName - Original filename
 * @returns New filename with .jpg extension
 */
export function getPdfConvertedName(originalName: string): string {
  return originalName.replace(/\.pdf$/i, '.jpg');
}
