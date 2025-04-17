# PDF Editor Microsite

A web-based PDF editor that allows users to add text, images, drawings, and patient information to PDF documents.

## Features

- 📄 PDF Upload and Viewing
- 📝 Text Annotation
- 🖼️ Image Insertion
- ✏️ Freehand Drawing
- 👤 Patient Information Integration
- 💾 PDF Save and Export


## Environment Setup
- Node.js v18.16.0

Environment Configuration
- Copy the example environment file:
```bash
cp .env.example .env
```
- Configure the environment variables in `.env`

## Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Deployment Environments

| Environment | URL |
|------------|-----|
| Production | https://pdf-ms.belle.ai |
| Staging | https://pdf-stag-ms.belle.ai |
| Testing | https://pdf-test-ms.belle.ai |

## Usage

1. **Upload PDF**
   - Click "Choose PDF" or drag & drop a PDF file

2. **Add Content**
   - Text: Click the text tool to add text fields
   - Images: Use the image tool to insert images
   - Drawing: Use the drawing tool for freehand annotations
   - Patient Info: Click the patient icon to add patient information

3. **Save Changes**
   - Click "Save" to export the modified PDF

## Tech Stack
- Svelte
- Tailwind CSS
- PDF.js
- JavaScript Canvas API



