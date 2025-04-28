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
    img.onerror = reject;
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

export async function readAsPDF(file) {
  const pdfjsLib = await getAsset('pdfjsLib');

  // Handle base64 string input
  if (isBase64PDF(file)) {
    // Remove the data URL prefix and convert to binary
    const base64Data = file.replace('data:application/pdf;base64,', '');
    const binaryData = atob(base64Data);

    // Convert binary to Uint8Array
    const length = binaryData.length;
    const uint8Array = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
      uint8Array[i] = binaryData.charCodeAt(i);
    }

    return pdfjsLib.getDocument({ data: uint8Array }).promise;
  }

  // Handle Blob/File input
  if (file instanceof Blob) {
    // Safari possibly get webkitblobresource error 1 when using origin file blob
    const blob = new Blob([file]);
    const url = window.URL.createObjectURL(blob);
    return pdfjsLib.getDocument(url).promise;
  }

  throw new Error('Invalid PDF input. Must be either a Blob/File or base64 string.');
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
