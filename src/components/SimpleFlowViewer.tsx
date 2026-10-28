import React, { useEffect, useMemo, useRef } from 'react';
import mermaid from 'mermaid';
import type { WorkflowDefinition, WorkflowNode } from '../types/workflow';

mermaid.initialize({
  startOnLoad: false,
  theme: 'neutral',
  flowchart: { curve: 'basis', useMaxWidth: true },
  securityLevel: 'loose'
});

interface Props {
  definition: WorkflowDefinition;
}

const safeId = (id: string) => 'n_' + id.replace(/[^a-zA-Z0-9_]/g, '_');
const esc = (s?: string) => (s || '').replace(/["\[\]{}()<>]/g, ' ').replace(/\s+/g, ' ').trim() || 'Step';

const nodeShape = (node: WorkflowNode): string => {
  const id = safeId(node.id);
  const label = esc(node.name);
  const type = (node.type || '').toUpperCase();
  if (type === 'START_EVENT' || type === 'END_EVENT') return `${id}(["${label}"])`;
  if (type.includes('GATEWAY')) return `${id}{"${label}"}`;
  if (type.includes('EVENT')) return `${id}(("${label}"))`;
  return `${id}["${label}"]`;
};

const nodeClass = (type: string): string => {
  const t = (type || '').toUpperCase();
  if (t === 'START_EVENT' || t === 'END_EVENT') return 'event';
  if (t.includes('GATEWAY')) return 'gateway';
  if (t === 'SERVICE_TASK' || t === 'SCRIPT_TASK') return 'system';
  return 'task';
};

/**
 * Renders a business-friendly Mermaid flowchart from the workflow definition.
 * Same data source as the BPMN XML, without BPMN notation.
 */
const SimpleFlowViewer: React.FC<Props> = ({ definition }) => {
  const ref = useRef<HTMLDivElement>(null);
  const renderId = useRef(0);

  const chart = useMemo(() => {
    const lines: string[] = ['flowchart LR'];
    const assignments: string[] = [];
    for (const node of definition?.nodes ?? []) {
      lines.push('  ' + nodeShape(node));
      assignments.push(`  class ${safeId(node.id)} ${nodeClass(node.type)}`);
    }
    for (const edge of definition?.edges ?? []) {
      const label = edge.condition ? `|"${esc(edge.condition)}"|` : '';
      lines.push(`  ${safeId(edge.source)} -->${label} ${safeId(edge.target)}`);
    }
    lines.push('  classDef event fill:#d4f4dd,stroke:#2e7d32,color:#111');
    lines.push('  classDef task fill:#dbeafe,stroke:#1e40af,color:#111');
    lines.push('  classDef system fill:#ede9fe,stroke:#6d28d9,color:#111');
    lines.push('  classDef gateway fill:#fef3c7,stroke:#b45309,color:#111');
    return lines.join('\n') + '\n' + assignments.join('\n');
  }, [definition]);

  useEffect(() => {
    if (!ref.current || !chart) return;
    const id = `mmd-${++renderId.current}`;
    mermaid.render(id, chart).then(({ svg }) => {
      if (ref.current) ref.current.innerHTML = svg;
    }).catch(err => {
      console.error('Mermaid render failed:', err);
      if (ref.current) ref.current.innerHTML = '<p>Could not render diagram.</p>';
    });
    // Remove the error placeholder mermaid injects into the DOM on failure
    return () => { document.getElementById('d' + id)?.remove(); };
  }, [chart]);

  if (!definition?.nodes?.length) {
    return <div className="simple-flow-empty">No process steps yet.</div>;
  }

  return <div ref={ref} className="simple-flow" />;
};

export default SimpleFlowViewer;
