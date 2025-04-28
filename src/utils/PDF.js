import { readAsArrayBuffer } from './asyncReader.js';
import { fetchFont, getAsset } from './prepareAssets';
import { noop, sendMessageToApp, checkEnvironment } from './helper.js';
import { DEFAULT_SCALE } from '../config/constants.js';

export async function save(pdfFile, objects, name) {
  const PDFLib = await getAsset('PDFLib');
  const makeTextPDF = await getAsset('makeTextPDF');
  let pdfDoc;
  try {
    pdfDoc = await PDFLib.PDFDocument.load(await readAsArrayBuffer(pdfFile));
  } catch (e) {
    console.log('Failed to load PDF.');
    throw e;
  }
  const pagesProcesses = pdfDoc.getPages().map(async (page, pageIndex) => {
    const pageObjects = objects[pageIndex];
    // 'y' starts from bottom in PDFLib, use this to calculate y
    const pageHeight = page.getHeight();

    const embedProcesses = pageObjects.map(async (object) => {
      if (object.type === 'image') {
        let { file, x, y, width, height } = object;
        // Convert back from scaled dimensions
        const unscaledX = x / DEFAULT_SCALE;
        const unscaledY = y / DEFAULT_SCALE;
        const unscaledWidth = width / DEFAULT_SCALE;
        const unscaledHeight = height / DEFAULT_SCALE;

        let img;
        try {
          if (file.type === 'image/jpeg') {
            img = await pdfDoc.embedJpg(await readAsArrayBuffer(file));
          } else {
            img = await pdfDoc.embedPng(await readAsArrayBuffer(file));
          }
          return () =>
            page.drawImage(img, {
              x: unscaledX,
              y: pageHeight - unscaledY - unscaledHeight,
              width: unscaledWidth,
              height: unscaledHeight,
            });
        } catch (e) {
          console.log('Failed to embed image.', e);
          return noop;
        }
      } else if (object.type === 'text') {
        let { x, y, lines, lineHeight, size, fontFamily, width, isBold, isItalic } = object;
        // Convert back from scaled dimensions
        const unscaledX = x / DEFAULT_SCALE;
        const unscaledY = y / DEFAULT_SCALE;
        const unscaledSize = size / DEFAULT_SCALE;
        const unscaledWidth = width;

        const height = unscaledSize * lineHeight * lines.length;

        // Determine the correct font family based on text style
        let actualFontFamily = fontFamily;
        if (isBold && isItalic) {
          actualFontFamily = `${fontFamily}-BoldItalic`;
        } else if (isBold) {
          actualFontFamily = `${fontFamily}-Bold`;
        } else if (isItalic) {
          actualFontFamily = `${fontFamily}-Italic`;
        }

        const font = await fetchFont(actualFontFamily);
        const [textPage] = await pdfDoc.embedPdf(
          await makeTextPDF({
            lines,
            fontSize: unscaledSize,
            lineHeight,
            width: unscaledWidth,
            height,
            font: font.buffer || actualFontFamily, // built-in font family or custom font
            dy: font.correction(unscaledSize, lineHeight),
          }),
        );
        return () =>
          page.drawPage(textPage, {
            width: unscaledWidth,
            height,
            x: unscaledX,
            y: pageHeight - unscaledY - height,
          });
      } else if (object.type === 'drawing') {
        let { x, y, path, scale } = object;
        // Convert back from scaled dimensions
        const unscaledX = x / DEFAULT_SCALE;
        const unscaledY = y / DEFAULT_SCALE;
        const unscaledScale = scale / DEFAULT_SCALE;

        const {
          pushGraphicsState,
          setLineCap,
          popGraphicsState,
          setLineJoin,
          LineCapStyle,
          LineJoinStyle,
        } = PDFLib;
        return () => {
          page.pushOperators(
            pushGraphicsState(),
            setLineCap(LineCapStyle.Round),
            setLineJoin(LineJoinStyle.Round),
          );
          page.drawSvgPath(path, {
            borderWidth: 5 / DEFAULT_SCALE,
            scale: unscaledScale,
            x: unscaledX,
            y: pageHeight - unscaledY,
          });
          page.pushOperators(popGraphicsState());
        };
      }
    });
    // embed objects in order
    const drawProcesses = await Promise.all(embedProcesses);
    drawProcesses.forEach((p) => p());
  });
  await Promise.all(pagesProcesses);
  try {
    const pdfBytes = await pdfDoc.save();
    const base64Data = bytesToBase64(pdfBytes);
    const environment = checkEnvironment();
    if(environment === "react-native-webview"){
      sendMessageToApp({
        type: "PDF_SAVED",
        data: base64Data,
      });
    } else if (environment === "iframe"){
      const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
      sendMessageToApp({
        type: "PDF_SAVED",
        data: pdfBlob,
      });
    } else {
      const download = await getAsset('download');
      download(pdfBytes, name, 'application/pdf');
    }
  } catch (e) {
    console.log('Failed to save PDF.');
    throw e;
  }
}

export function bytesToBase64(bytes) {
  const binString = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
  return btoa(binString);
}
