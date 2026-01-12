'use client'
import React, { useEffect, useRef } from 'react';
import { Viewer } from '@pdfme/ui';
import { Template, getInputFromTemplate } from '@pdfme/common';
import { plugins } from './Editor/plugins';

// Extract actual content from a schema entry for mock input generation
const getContentFromSchema = (schema: any): string => {
    if (!schema) return ''
    if (schema.content !== undefined && schema.content !== null) {
        return String(schema.content)
    }
    return ''
}

interface CustomViewerOptions {
    showToolbar?: boolean;
    scroll?: boolean;
}

interface PdfViewerProps {
    template: Template;
    className?: string;
    options?: Pick<PdfViewerProps, "options">;
    customViewerOptions?: CustomViewerOptions;
}

const PdfViewer: React.FC<PdfViewerProps> = ({
    template,
    className = '',
    options = {},
    customViewerOptions = { showToolbar: true, scroll: true },
}) => {
    const viewerRef = useRef<HTMLDivElement>(null);
    const viewerInstanceRef = useRef<Viewer | null>(null);

    useEffect(() => {
        if (!viewerRef.current || !template) return;

        // Generate mockInputs using the same method as TemplateExportBar
        const mockInputs = getInputFromTemplate(template).map((obj, pageIndex) => {
            const mockInput: Record<string, string> = {}
            const pageSchemas = template.schemas[pageIndex] || []

            for (const key of Object.keys(obj)) {
                const schema = pageSchemas.find((s: any) => s.name === key)
                mockInput[key] = schema ? getContentFromSchema(schema) : ''
            }
            return mockInput
        })

        // Initialize pdfme viewer
        const viewer = new Viewer({
            domContainer: viewerRef.current,
            template,
            inputs: mockInputs,
            plugins,
            options: {
                ...options,
                zoomLevel: 1.5,
            }
        });

        viewerInstanceRef.current = viewer;

        // Cleanup on unmount
        return () => {
            if (viewerInstanceRef.current) {
                viewerInstanceRef.current.destroy();
                viewerInstanceRef.current = null;
            }
        };
    }, [template]);

    return (
        <div 
            className={`
                ${className} 
                ${customViewerOptions.showToolbar ? "" : "[&_.pdfme-ui-control-bar]:hidden!"} 
                ${customViewerOptions.scroll ? "" : "[&_.pdfme-designer-background>div:nth-child(2)]:overflow-hidden!"}
            `}
        >
            <div ref={viewerRef} className="w-full h-full" />
        </div>
    );
};

export default PdfViewer;