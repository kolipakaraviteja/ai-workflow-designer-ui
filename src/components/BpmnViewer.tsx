import React, { useEffect, useRef } from 'react';
// @ts-ignore
import BpmnViewer from 'bpmn-js/lib/NavigatedViewer';

interface BpmnViewerProps {
  bpmnXml: string;
  onElementClick?: (element: any) => void;
}

const BpmnViewerComponent: React.FC<BpmnViewerProps> = ({ bpmnXml, onElementClick }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize BPMN viewer
    const viewer = new BpmnViewer({
      container: containerRef.current
    });

    viewerRef.current = viewer;

    // Handle element clicks
    if (onElementClick) {
      viewer.on('element.click', (event: any) => {
        onElementClick(event.element);
      });
    }

    return () => {
      if (viewerRef.current) {
        viewerRef.current.destroy();
      }
    };
  }, [onElementClick]);

  useEffect(() => {
    if (!viewerRef.current || !bpmnXml) return;

    // Import BPMN XML
    viewerRef.current.importXML(bpmnXml)
      .then(() => {
        const canvas = viewerRef.current!.get('canvas');
        canvas.zoom('fit-viewport');
      })
      .catch((err: Error) => {
        console.error('Error importing BPMN:', err);
      });
  }, [bpmnXml]);

  return (
    <div
      ref={containerRef}
      style={{ height: '100%', width: '100%', border: '1px solid #ccc' }}
    />
  );
};

export default BpmnViewerComponent;
