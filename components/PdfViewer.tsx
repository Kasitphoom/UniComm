'use client'
import React, { useEffect, useRef, useState } from 'react';
import { Viewer } from '@pdfme/ui';
import { Template, getInputFromTemplate } from '@pdfme/common';
import { plugins } from './Editor/plugins';
import type { PreviewProps } from '@pdfme/common';

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
    options?: PreviewProps['options'];
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
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const el = viewerRef.current;
        if (!el) return;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                // We need the card to be mostly visible (e.g., 70%) 
                // so pdfme can calculate the render area correctly.
                if (entry.isIntersecting && entry.intersectionRatio >= 0.7) {
                    setIsVisible(true);
                    observer.disconnect();
                }
            });
        }, { 
            threshold: [0.7], 
            // rootMargin helps trigger slightly before it hits the 70% mark
            rootMargin: '100px 0px' 
        });

        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        // CRITICAL: Ensure the ref exists, template is ready, and it's visible.
        // Also check if the clientHeight is > 0 to prevent pdfme 0-height errors.
        if (!viewerRef.current || !template || !isVisible || viewerRef.current.clientHeight === 0) return;

        const mockInputs = getInputFromTemplate(template).map((obj, pageIndex) => {
            const mockInput: Record<string, string> = {};
            const pageSchemas = template.schemas[pageIndex] || [];
            for (const key of Object.keys(obj)) {
                const schema = pageSchemas.find((s: any) => s.name === key);
                mockInput[key] = schema ? getContentFromSchema(schema) : '';
            }
            return mockInput;
        });

        const viewer = new Viewer({
            domContainer: viewerRef.current,
            template,
            inputs: mockInputs,
            plugins,
            options: {
                ...options,
                zoomLevel: options.zoomLevel ? options.zoomLevel : 1.8,
            }
        });

        viewerInstanceRef.current = viewer;

        return () => {
            if (viewerInstanceRef.current) {
                viewerInstanceRef.current.destroy();
                viewerInstanceRef.current = null;
            }
        };
    }, [template, isVisible]);

    return (
        <div 
            className={`
                ${className} 
                relative w-full h-full bg-white
                ${customViewerOptions.showToolbar ? "" : "[&_.pdfme-ui-control-bar]:hidden!"} 
                ${customViewerOptions.scroll ? "" : "[&_.pdfme-designer-background>div:nth-child(2)]:overflow-hidden!"}
            `}
        >
            {/* The inner div MUST have w-full h-full and the parent 
               (TemplateItemCard) MUST have a defined aspect ratio. 
            */}
            <div ref={viewerRef} className="w-full h-full" />
            
            {/* Show a skeleton while waiting for intersection */}
            {!isVisible && <div className="absolute inset-0 bg-default-50 animate-pulse rounded-md" />}
        </div>
    );
};

export default PdfViewer;