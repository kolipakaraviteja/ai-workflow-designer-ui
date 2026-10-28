import React, { useMemo } from 'react';
import type { WorkflowDefinition, WorkflowNode } from '../types/workflow';

interface Props {
  definition: WorkflowDefinition;
}

const actorOf = (node: WorkflowNode): string => {
  const a = node.properties?.assignee ?? node.properties?.actor ?? node.properties?.role;
  if (a) return String(a);
  const t = (node.type || '').toUpperCase();
  if (t.includes('SERVICE') || t.includes('SCRIPT') || t.includes('BUSINESS_RULE')) return 'System';
  if (t.includes('EVENT')) return 'Process';
  if (t.includes('GATEWAY')) return 'Decision';
  return 'Unassigned';
};

const friendlyType = (type: string): string => {
  const t = (type || '').toUpperCase();
  if (t === 'START_EVENT') return 'Start';
  if (t === 'END_EVENT') return 'End';
  if (t.includes('GATEWAY')) return 'Decision';
  if (t === 'USER_TASK') return 'Human task';
  if (t === 'SERVICE_TASK') return 'Automated task';
  if (t.includes('EVENT')) return 'Event';
  if (t.includes('TASK')) return 'Task';
  return 'Step';
};

/**
 * Plain-language, numbered walkthrough of the process, ordered by flow.
 * Designed for business readers who don't read BPMN notation.
 */
const ProcessStepsView: React.FC<Props> = ({ definition }) => {
  const { ordered, outgoing } = useMemo(() => {
    const out = new Map<string, { target: string; condition?: string }[]>();
    const hasIncoming = new Set<string>();
    for (const e of definition?.edges ?? []) {
      const list = out.get(e.source) ?? [];
      list.push({ target: e.target, condition: e.condition });
      out.set(e.source, list);
      hasIncoming.add(e.target);
    }

    const nodes = definition?.nodes ?? [];
    const byId = new Map(nodes.map(n => [n.id, n]));
    const seen = new Set<string>();
    const result: WorkflowNode[] = [];

    // BFS from start events / entry nodes to order steps along the flow
    const queue: string[] = nodes
      .filter(n => n.type === 'START_EVENT' || !hasIncoming.has(n.id))
      .map(n => n.id);
    while (queue.length) {
      const id = queue.shift()!;
      if (seen.has(id)) continue;
      seen.add(id);
      const node = byId.get(id);
      if (node) result.push(node);
      for (const e of out.get(id) ?? []) queue.push(e.target);
    }
    for (const n of nodes) if (!seen.has(n.id)) result.push(n);

    return { ordered: result, outgoing: out };
  }, [definition]);

  if (!ordered.length) {
    return <div className="steps-empty">No process steps yet.</div>;
  }

  let stepNo = 0;
  return (
    <ol className="process-steps">
      {ordered.map(node => {
        const isBoundary = node.type === 'START_EVENT' || node.type === 'END_EVENT';
        const isDecision = (node.type || '').includes('GATEWAY');
        if (!isBoundary) stepNo++;
        const branches = outgoing.get(node.id)?.filter(e => e.condition) ?? [];
        return (
          <li key={node.id} className={`step step-${isDecision ? 'decision' : isBoundary ? 'event' : 'task'}`}>
            <div className="step-header">
              {!isBoundary && <span className="step-num">{stepNo}</span>}
              <span className="step-actor">{actorOf(node)}</span>
              <span className="step-type">{friendlyType(node.type)}</span>
            </div>
            <div className="step-name">{node.name}</div>
            {node.description && <div className="step-desc">{node.description}</div>}
            {branches.length > 0 && (
              <ul className="step-branches">
                {branches.map((b, i) => {
                  const target = definition.nodes.find(n => n.id === b.target);
                  return <li key={i}><strong>{b.condition}</strong> → {target?.name ?? b.target}</li>;
                })}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
};

export default ProcessStepsView;
