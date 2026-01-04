'use client'
import React from 'react'
import { pdfjs, Document, Page } from 'react-pdf'
import type { ClassName, File } from 'react-pdf/dist/shared/types.js';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
).toString();

const options = {
    cMapUrl: '/cmaps/',
    wasmUrl: '/wasm/',
};

const PdfViewer = ({ file, className }: { file: File, className?: ClassName }) => {
    return (
        <Document file={file} options={options} className={className}>
            {/* Render only the first page for the preview */}
            <Page
                pageNumber={1}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                width={300} // You can set a fixed width or use a scale
            />
        </Document>
    )
}

export default PdfViewer