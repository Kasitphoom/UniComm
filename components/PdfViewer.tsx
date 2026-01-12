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

    // Delay initialization until the container is in (nearly) full view.
    // If the container is taller than the viewport, allow partial visibility to trigger.
    useEffect(() => {
        const el = viewerRef.current;
        if (!el) return;

        const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
        const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
        const { height, width } = el.getBoundingClientRect();

        const requiresFullView = height <= viewportHeight && width <= viewportWidth;
        const threshold = requiresFullView ? 1.0 : 0.25;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                const ratio = entry.intersectionRatio;
                const visibleEnough = requiresFullView ? ratio >= 0.99 : ratio >= threshold;
                if (entry.isIntersecting && visibleEnough) {
                    setIsVisible(true);
                    observer.disconnect();
                }
            });
        }, { threshold: [threshold, 1.0] });

        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (!viewerRef.current || !template || !isVisible) return;

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
                zoomLevel: options.zoomLevel ? options.zoomLevel : 1.5,
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
    }, [template, isVisible]);

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