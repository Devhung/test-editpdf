const scripts = [
  {
    name: "pdfjsLib",
    src: "https://unpkg.com/pdfjs-dist@2.3.200/build/pdf.min.js",
  },
  {
    name: "PDFLib",
    src: "https://unpkg.com/pdf-lib@1.4.0/dist/pdf-lib.min.js",
  },
  {
    name: "download",
    src: "https://unpkg.com/downloadjs@1.4.7",
  },
  { name: "makeTextPDF", src: "/makeTextPDF.js" },
];

const assets = {};
export function getAsset(name) {
  if (assets[name]) return assets[name];
  const script = scripts.find((s) => s.name === name);
  if (!script) throw new Error(`Script ${name} not exists.`);
  return prepareAsset(script);
}

export function prepareAsset({ name, src }) {
  if (assets[name]) return assets[name];
  assets[name] = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => {
      resolve(window[name]);
      console.log(`${name} is loaded.`);
    };
    script.onerror = () => {
      reject(`The script ${name} didn't load correctly.`);
      alert(
        `Some scripts did not load correctly. Please reload and try again.`
      );
    };
    document.body.appendChild(script);
  });
  return assets[name];
}

export default function prepareAssets() {
  scripts.forEach(prepareAsset);
}

// out of the box fonts
const fonts = {
  "Times-Roman": {
    correction(size, lineHeight) {
      return (size * lineHeight - size) / 2 + size / 7;
    },
  },
  Courier: {
    correction(size, lineHeight) {
      return (size * lineHeight - size) / 2 + size / 6;
    },
  },
  Helvetica: {
    correction(size, lineHeight) {
      return (size * lineHeight - size) / 2 + size / 10;
    },
  },
};
// Available fonts
export const Fonts = {
  Calibri: {
    src: "/fonts/Calibri.ttf",
    correction(size, lineHeight) {
      return (size * lineHeight - size) / 2;
    },
    isDisplay: true,
  },
  "Calibri-Bold": {
    src: "/fonts/Calibri-Bold.ttf",
    correction(size, lineHeight) {
      return (size * lineHeight - size) / 2;
    },
    isDisplay: false,
  },
  "Calibri-Italic": {
    src: "/fonts/Calibri-Italic.ttf",
    correction(size, lineHeight) {
      return (size * lineHeight - size) / 2;
    },
    isDisplay: false,
  },
  "Calibri-BoldItalic": {
    src: "/fonts/Calibri-BoldItalic.ttf",
    correction(size, lineHeight) {
      return (size * lineHeight - size) / 2;
    },
    isDisplay: false,
  },
  Roboto: {
    src: "/fonts/Roboto.ttf",
    correction(size, lineHeight) {
      return (size * lineHeight - size) / 2;
    },
    isDisplay: true,
  },
  "Roboto-Bold": {
    src: "/fonts/Roboto-Bold.ttf",
    correction(size, lineHeight) {
      return (size * lineHeight - size) / 2;
    },
    isDisplay: false,
  },
  "Roboto-Italic": {
    src: "/fonts/Roboto-Italic.ttf",
    correction(size, lineHeight) {
      return (size * lineHeight - size) / 2;
    },
    isDisplay: false,
  },
  "Roboto-BoldItalic": {
    src: "/fonts/Roboto-BoldItalic.ttf",
    correction(size, lineHeight) {
      return (size * lineHeight - size) / 2;
    },
    isDisplay: false,
  },
};

export function fetchFont(name) {
  if (fonts[name]) return fonts[name];
  const font = Fonts[name];
  if (!font) throw new Error(`Font '${name}' not exists.`);
  fonts[name] = fetch(font.src)
    .then((r) => r.arrayBuffer())
    .then((fontBuffer) => {
      const fontFace = new FontFace(name, fontBuffer);
      fontFace.display = "swap";
      fontFace.load().then(() => document.fonts.add(fontFace));
      return {
        ...font,
        buffer: fontBuffer,
      };
    });
  return fonts[name];
}
