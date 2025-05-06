import { getAsset } from './prepareAssets';

export function readAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export function readAsImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (error) => {
      if (src instanceof Blob) {
        window.URL.revokeObjectURL(img.src);
      }
      reject(error);
    };

    if (src instanceof Blob) {
      const url = window.URL.createObjectURL(src);
      img.src = url;
    } else {
      img.src = src;
    }
  });
}

export function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function base64toBlob(base64Data, contentType = '') {
  try {
    // Remove data URL prefix if present
    const base64WithoutPrefix = base64Data.includes('base64,')
      ? base64Data.split('base64,')[1]
      : base64Data;

    // Convert base64 to binary
    const binaryString = atob(base64WithoutPrefix);
    const length = binaryString.length;
    const bytes = new Uint8Array(length);

    // Convert binary to Uint8Array
    for (let i = 0; i < length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Create and return Blob
    return new Blob([bytes], { type: contentType || 'application/pdf' });
  } catch (error) {
    console.error('Error converting base64 to Blob:', error);
    throw new Error('Invalid base64 data');
  }
}

export async function readAsPDF(file) {
  const pdfjsLib = await getAsset('pdfjsLib');

  try {
    // Handle base64 string input
    if (typeof file === 'string') {
      // Convert base64 to Blob
      const pdfBlob = base64toBlob(file, 'application/pdf');
      const url = window.URL.createObjectURL(pdfBlob);
      return pdfjsLib.getDocument(url).promise;
    }

    // Handle Blob/File input
    if (file instanceof Blob) {
      const blob = new Blob([file], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      return pdfjsLib.getDocument(url).promise;
    }

    throw new Error('Invalid PDF input. Must be either a Blob/File or base64 string.');
  } catch (error) {
    console.error('Error reading PDF:', error);
    throw error;
  }
}

// Helper function to check if a string is base64
export function isBase64PDF(str) {
  if (typeof str !== 'string') return false;
  try {
    return str.startsWith('data:application/pdf;base64,');
  } catch (e) {
    return false;
  }
}

// Helper function to scale image
export function scaleImage(img, targetWidth, targetHeight) {
  return new Promise((resolve, reject) => {
    try {
      // Create canvas for scaling
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      // Set dimensions
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      // Draw scaled image
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

      // Convert to new image
      const scaledImg = new Image();
      scaledImg.onload = () => resolve(scaledImg);
      scaledImg.onerror = reject;
      scaledImg.src = canvas.toDataURL('image/jpeg', 0.95);
    } catch (error) {
      reject(error);
    }
  });
}
