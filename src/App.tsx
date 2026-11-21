import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { workflowApi, agentApi, simulationApi, deploymentApi, conversationApi, authApi, authStore, usageApi } from './services/api';
import type { Workflow, ConversationMessage, DocumentUploadResult, UsageSummary } from './types/workflow';
import BpmnViewer from './components/BpmnViewer';
import SimpleFlowViewer from './components/SimpleFlowViewer';
import ProcessStepsView from './components/ProcessStepsView';
import LoginPage from './components/LoginPage';
import KnowledgeBase from './components/KnowledgeBase';
import FileUpload from './components/FileUpload';
import './App.css';

const errorMessage = (error: any, fallback: string) =>
  error?.response?.data?.error || error?.response?.data?.message || fallback;

const formatTokens = (value: number | undefined) => {
  if (value == null) return '—';
  return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(value);
};

function DesignerHome() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [chatMessages, setChatMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [viewMode, setViewMode] = useState<'simple' | 'steps' | 'advanced'>('simple');
  const [loading, setLoading] = useState(false);
  const [workflowsLoading, setWorkflowsLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [creatingWorkflow, setCreatingWorkflow] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [operationError, setOperationError] = useState('');
  const [workflowQuery, setWorkflowQuery] = useState('');
  const [userUsage, setUserUsage] = useState<UsageSummary | null>(null);
  const [workflowUsage, setWorkflowUsage] = useState<UsageSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Workflow | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const selectionRequest = useRef(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const user = authStore.getUser();

  useEffect(() => {
    loadWorkflows(true);
    void loadUserUsage();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [chatMessages, loading]);

  useEffect(() => {
    if (!deleteTarget) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && activeAction !== 'delete') setDeleteTarget(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleteTarget, activeAction]);

  const loadWorkflows = async (showLoading = false) => {
    if (showLoading) setWorkflowsLoading(true);
    try {
      const data = await workflowApi.getAllWorkflows();
      setWorkflows(data);
    } catch (error) {
      console.error('Failed to load workflows:', error);
      setOperationError(errorMessage(error, 'Could not load workflows. Please try again.'));
    } finally {
      if (showLoading) setWorkflowsLoading(false);
    }
  };

  const loadUserUsage = async () => {
    try {
      setUserUsage(await usageApi.getMyUsage());
    } catch (error) {
      console.error('Failed to load token usage:', error);
      setUserUsage(null);
    }
  };

  const loadWorkflowUsage = async (workflowId: string, requestId = selectionRequest.current) => {
    try {
      const usage = await usageApi.getWorkflowUsage(workflowId);
      if (requestId === selectionRequest.current) setWorkflowUsage(usage);
    } catch (error) {
      console.error('Failed to load workflow token usage:', error);
      if (requestId === selectionRequest.current) setWorkflowUsage(null);
    }
  };

  const selectWorkflow = async (workflow: Workflow) => {
    const requestId = ++selectionRequest.current;
    setSelectedWorkflow(workflow);
    setConversationId(undefined);
    setChatMessages([]);
    setHistoryLoading(true);
    setOperationError('');
    setWorkflowUsage(null);
    void loadWorkflowUsage(workflow.id, requestId);
    // Restore the user's latest conversation for this workflow so the agent
    // continues where it left off (spec state, memory).
    try {
      const latest = await conversationApi.getLatestForWorkflow(workflow.id);
      if (latest?.conversationId) {
        const history = await conversationApi.getMessages(latest.conversationId);
        if (requestId !== selectionRequest.current) return;
        setConversationId(latest.conversationId);
        setChatMessages(history.map((m: ConversationMessage) => ({
          role: m.role.toLowerCase(),
          content: m.content
        })));
        return;
      }
      const history = await conversationApi.getWorkflowMessages(workflow.id);
      if (requestId !== selectionRequest.current) return;
      setChatMessages(history.map((m: ConversationMessage) => ({
        role: m.role.toLowerCase(),
        content: m.content
      })));
    } catch (error) {
      console.error('Failed to load conversation history:', error);
      if (requestId === selectionRequest.current) {
        setOperationError(errorMessage(error, 'Conversation history could not be loaded.'));
      }
    } finally {
      if (requestId === selectionRequest.current) setHistoryLoading(false);
    }
  };

  const createNewWorkflow = async () => {
    setCreatingWorkflow(true);
    setOperationError('');
    try {
      const newWorkflow = await workflowApi.createWorkflow({
        name: 'New Workflow',
        description: 'Created by AI Workflow Designer'
      });
      selectionRequest.current += 1;
      setWorkflows(current => [newWorkflow, ...current]);
      setSelectedWorkflow(newWorkflow);
      setChatMessages([]);
      setConversationId(undefined);
      setHistoryLoading(false);
      setWorkflowUsage(null);
    } catch (error) {
      console.error('Failed to create workflow:', error);
      setOperationError(errorMessage(error, 'Could not create a workflow. Please try again.'));
    } finally {
      setCreatingWorkflow(false);
    }
  };

  const handleSendMessage = async () => {
    if (!currentMessage.trim() || loading) return;

    const userMessage = currentMessage;
    const workflowId = selectedWorkflow?.id;
    const requestId = selectionRequest.current;
    setCurrentMessage('');
    setChatMessages(messages => [...messages, { role: 'user', content: userMessage }]);
    setLoading(true);
    setOperationError('');

    try {
      const response = await agentApi.chat(userMessage, workflowId, conversationId);
      if (requestId === selectionRequest.current) {
        setChatMessages(prev => [...prev, { role: 'assistant', content: response.message }]);
        if (response.conversationId) setConversationId(response.conversationId);
      }

      void loadUserUsage();
      const usageWorkflowId = response.workflowId ?? workflowId;
      if (requestId === selectionRequest.current) {
        if (usageWorkflowId) {
          void loadWorkflowUsage(usageWorkflowId, requestId);
        } else {
          setWorkflowUsage(null);
        }
      }

      if (response.modifiedWorkflow) {
        await loadWorkflows();
        const targetWorkflowId = response.workflowId ?? workflowId;
        if (targetWorkflowId) {
          const updatedWorkflow = await workflowApi.getWorkflow(targetWorkflowId);
          if (requestId === selectionRequest.current) setSelectedWorkflow(updatedWorkflow);
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      if (requestId === selectionRequest.current) {
        setChatMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong.' }]);
        setOperationError(errorMessage(error, 'Your message could not be sent. Please try again.'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDocumentUpload = (result: DocumentUploadResult) => {
    const usageText = result.tokenUsage
      ? ` · ${formatTokens(result.tokenUsage.totalTokens)} tokens used`
      : '';
    setChatMessages(prev => [...prev, {
      role: 'assistant',
      content: `Document "${result.filename}" processed (${result.extractedCharacters} chars extracted). ${result.message ?? ''}${usageText}`
    }]);
    if (result.workflow) {
      loadWorkflows();
      void loadUserUsage();
      setOperationError('');
    }
  };

  const handleValidate = async () => {
    if (!selectedWorkflow) return;

    setActiveAction('validate');
    setOperationError('');
    try {
      const validationResult = await workflowApi.validateWorkflow(selectedWorkflow.id);
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: `Validation Result:\nStatus: ${validationResult.status}\nErrors: ${validationResult.errors?.join(', ') || 'None'}\nWarnings: ${validationResult.warnings?.join(', ') || 'None'}`
      }]);
    } catch (error) {
      console.error('Failed to validate workflow:', error);
      setOperationError(errorMessage(error, 'Validation failed. Please try again.'));
    } finally {
      setActiveAction(null);
    }
  };

  const handleGenerateBpmn = async () => {
    if (!selectedWorkflow) return;

    setActiveAction('generate');
    setOperationError('');
    try {
      const bpmnXml = await workflowApi.generateBpmn(selectedWorkflow.id);
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: `BPMN XML generated successfully. Length: ${bpmnXml.length} characters.`
      }]);
      
      // Refresh workflow to get updated BPMN
      const updatedWorkflow = await workflowApi.getWorkflow(selectedWorkflow.id);
      setSelectedWorkflow(updatedWorkflow);
    } catch (error) {
      console.error('Failed to generate BPMN:', error);
      setOperationError(errorMessage(error, 'BPMN could not be generated.'));
    } finally {
      setActiveAction(null);
    }
  };

  const handleSimulate = async () => {
    if (!selectedWorkflow) return;

    setActiveAction('simulate');
    setOperationError('');
    try {
      const simulationResult = await simulationApi.simulate({
        workflowId: selectedWorkflow.id,
        inputVariables: {}
      });
      
      const pathDescription = simulationResult.executionPath.join(' → ');
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: `Simulation Result:\nStatus: ${simulationResult.success ? 'Success' : 'Failed'}\nExecution Path: ${pathDescription}\nDuration: ${simulationResult.duration}ms\n${simulationResult.errorMessage ? `Error: ${simulationResult.errorMessage}` : ''}`
      }]);
    } catch (error) {
      console.error('Failed to simulate workflow:', error);
      setOperationError(errorMessage(error, 'Simulation failed. Please try again.'));
    } finally {
      setActiveAction(null);
    }
  };

  const handleDeploy = async () => {
    if (!selectedWorkflow) return;

    setActiveAction('deploy');
    setOperationError('');
    try {
      const deploymentResult = await deploymentApi.deployWorkflow(selectedWorkflow.id, user?.username);
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: `Deployment Result:\nStatus: ${deploymentResult.success ? 'Success' : 'Failed'}\nDeployment ID: ${deploymentResult.deploymentId}\nWorkflow: ${deploymentResult.workflowName}`
      }]);
    } catch (error) {
      console.error('Failed to deploy workflow:', error);
      setOperationError(errorMessage(error, 'Deployment failed. Please try again.'));
    } finally {
      setActiveAction(null);
    }
  };

  const handleExport = async () => {
    if (!selectedWorkflow) return;

    setActiveAction('export');
    setOperationError('');
    try {
      const bpmnXml = await workflowApi.getBpmnXml(selectedWorkflow.id);
      
      // Create download link
      const blob = new Blob([bpmnXml], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedWorkflow.name.replace(/\s+/g, '_')}.bpmn`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: `Workflow exported as BPMN file: ${selectedWorkflow.name}.bpmn`
      }]);
    } catch (error) {
      console.error('Failed to export workflow:', error);
      setOperationError(errorMessage(error, 'Workflow could not be exported.'));
    } finally {
      setActiveAction(null);
    }
  };

  const requestDeleteWorkflow = () => {
    if (!selectedWorkflow) return;
    setDeleteError('');
    setDeleteTarget(selectedWorkflow);
  };

  const closeDeleteDialog = () => {
    if (activeAction !== 'delete') setDeleteTarget(null);
  };

  const confirmDeleteWorkflow = async () => {
    if (!deleteTarget || activeAction === 'delete') return;

    const workflow = deleteTarget;
    setActiveAction('delete');
    setDeleteError('');
    try {
      await workflowApi.deleteWorkflow(workflow.id);
      setWorkflows(current => current.filter(item => item.id !== workflow.id));
      if (selectedWorkflow?.id === workflow.id) {
        selectionRequest.current += 1;
        setSelectedWorkflow(null);
        setConversationId(undefined);
        setChatMessages([]);
        setWorkflowUsage(null);
        setHistoryLoading(false);
      }
      setDeleteTarget(null);
      setOperationError('');
      void loadWorkflows();
      void loadUserUsage();
    } catch (error) {
      console.error('Failed to delete workflow:', error);
      setDeleteError(errorMessage(error, 'Workflow could not be deleted. Undeploy it and stop active process instances first.'));
    } finally {
      setActiveAction(null);
    }
  };

  const handleLogout = () => {
    authApi.logout();
    navigate('/login');
  };

  const filteredWorkflows = workflows.filter(workflow =>
    workflow.name.toLowerCase().includes(workflowQuery.trim().toLowerCase())
  );

  return (
    <div className="app">
      <header className="app-header">
        <Link className="brand" to="/" aria-label="AI Workflow Designer home">
          <span className="brand-mark" aria-hidden="true">W</span>
          <span><strong>AI Workflow Designer</strong><small>Process design workspace</small></span>
        </Link>
        <div className="header-actions">
          <button onClick={createNewWorkflow} className="btn btn-primary" disabled={creatingWorkflow}>
            {creatingWorkflow ? 'Creating…' : '+ New workflow'}
          </button>
          <button onClick={() => navigate('/knowledge')} className="btn btn-secondary">
            Knowledge Base
          </button>
          <span className="user-info">
            <span className="user-avatar" aria-hidden="true">{user?.username?.slice(0, 1).toUpperCase()}</span>
            <span>{user?.username}<small>{user?.role}</small></span>
          </span>
          <button onClick={handleLogout} className="btn btn-secondary">
            Logout
          </button>
        </div>
      </header>

      <div className="app-container">
        <aside className="sidebar">
          <div className="sidebar-heading">
            <div><p className="eyebrow">Workspace</p><h2>My workflows</h2></div>
            <span className="count-badge">{workflows.length}</span>
          </div>
          <label className="workflow-search">
            <span className="sr-only">Search workflows</span>
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              value={workflowQuery}
              onChange={e => setWorkflowQuery(e.target.value)}
              placeholder="Find a workflow"
            />
          </label>
          {workflowsLoading ? (
            <p className="sidebar-message">Loading workflows…</p>
          ) : filteredWorkflows.length ? (
            <ul className="workflow-list">
              {filteredWorkflows.map(workflow => {
                const usage = userUsage?.byWorkflow?.[workflow.id];
                return (
                  <li key={workflow.id}>
                    <button
                      className={`workflow-item ${selectedWorkflow?.id === workflow.id ? 'active' : ''}`}
                      onClick={() => selectWorkflow(workflow)}
                      aria-current={selectedWorkflow?.id === workflow.id ? 'true' : undefined}
                    >
                      <span className="workflow-icon" aria-hidden="true">◇</span>
                      <span className="workflow-item-copy">
                        <span className="workflow-name">{workflow.name}</span>
                        <span className="workflow-status">
                          {workflow.status.toLowerCase()}
                          {usage && usage.llmCalls > 0 && ` · ${formatTokens(usage.totalTokens)} tokens`}
                        </span>
                      </span>
                      <span className="workflow-chevron" aria-hidden="true">›</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="sidebar-empty">
              <span aria-hidden="true">◇</span>
              <p>{workflowQuery ? 'No matching workflows.' : 'Your workflows will appear here.'}</p>
              {!workflowQuery && <button className="text-button" onClick={createNewWorkflow}>Create your first one</button>}
            </div>
          )}
          <div className="usage-card" aria-label="Your LLM token usage">
            <div className="usage-card-heading">
              <div>
                <p className="eyebrow">LLM usage</p>
                <strong>{userUsage ? formatTokens(userUsage.totalTokens) : '—'}</strong>
              </div>
              <span>tokens</span>
            </div>
            <p className="usage-card-detail">
              {userUsage
                ? `${formatTokens(userUsage.llmCalls)} calls · ${formatTokens(userUsage.promptTokens)} in / ${formatTokens(userUsage.completionTokens)} out`
                : 'Usage appears after assistant requests.'}
            </p>
          </div>
          <div className="sidebar-footer">
            <span className="status-dot" />
            Private workspace
          </div>
        </aside>

        <main className="main-content">
          {selectedWorkflow ? (
            <>
              <div className="workflow-header">
                <div className="workflow-title">
                  <p className="eyebrow">Workflow canvas</p>
                  <h1>{selectedWorkflow.name}</h1>
                  <span className="workflow-meta">
                    Version {selectedWorkflow.version} <span>·</span> {selectedWorkflow.status.toLowerCase()}
                    {workflowUsage && workflowUsage.llmCalls > 0 && (
                      <>
                        {' '}<span>·</span>{' '}
                        <span
                          className="usage-inline"
                          title={`Prompt: ${formatTokens(workflowUsage.promptTokens)} · Completion: ${formatTokens(workflowUsage.completionTokens)} · ${formatTokens(workflowUsage.llmCalls)} LLM calls`}
                        >
                          {formatTokens(workflowUsage.totalTokens)} tokens
                        </span>
                      </>
                    )}
                  </span>
                </div>
                <div className="workflow-actions">
                  <button onClick={handleValidate} className="btn btn-secondary" disabled={!!activeAction}>
                    {activeAction === 'validate' ? 'Validating…' : 'Validate'}
                  </button>
                  <button onClick={handleGenerateBpmn} className="btn btn-secondary" disabled={!!activeAction}>
                    {activeAction === 'generate' ? 'Generating…' : 'Generate BPMN'}
                  </button>
                  <button onClick={handleSimulate} className="btn btn-secondary" disabled={!!activeAction}>
                    {activeAction === 'simulate' ? 'Simulating…' : 'Simulate'}
                  </button>
                  <button onClick={handleDeploy} className="btn btn-primary" disabled={!!activeAction}>
                    {activeAction === 'deploy' ? 'Deploying…' : 'Deploy'}
                  </button>
                  <button onClick={handleExport} className="btn btn-secondary" disabled={!!activeAction}>
                    {activeAction === 'export' ? 'Exporting…' : 'Export'}
                  </button>
                  <button onClick={requestDeleteWorkflow} className="btn btn-danger" disabled={!!activeAction}>
                    Delete
                  </button>
                </div>
              </div>
              {operationError && <div className="notice notice-error" role="alert">{operationError}</div>}

              <div className="workflow-content">
                <div className="bpmn-canvas">
                  <div className="view-tabs" role="tablist" aria-label="Workflow view">
                    <button
                      className={viewMode === 'simple' ? 'tab active' : 'tab'}
                      onClick={() => setViewMode('simple')}
                      role="tab"
                      aria-selected={viewMode === 'simple'}
                    >
                      Overview
                    </button>
                    <button
                      className={viewMode === 'steps' ? 'tab active' : 'tab'}
                      onClick={() => setViewMode('steps')}
                      role="tab"
                      aria-selected={viewMode === 'steps'}
                    >
                      Steps
                    </button>
                    <button
                      className={viewMode === 'advanced' ? 'tab active' : 'tab'}
                      onClick={() => setViewMode('advanced')}
                      role="tab"
                      aria-selected={viewMode === 'advanced'}
                    >
                      BPMN
                    </button>
                  </div>
                  {viewMode === 'advanced' ? (
                    selectedWorkflow.bpmnXml ? (
                      <BpmnViewer bpmnXml={selectedWorkflow.bpmnXml} />
                    ) : (
                      <div className="canvas-placeholder">
                        <p>No BPMN XML generated yet. Click "Generate BPMN" to create it.</p>
                      </div>
                    )
                  ) : selectedWorkflow.definition?.nodes?.length ? (
                    viewMode === 'simple' ? (
                      <SimpleFlowViewer definition={selectedWorkflow.definition} />
                    ) : (
                      <ProcessStepsView definition={selectedWorkflow.definition} />
                    )
                  ) : (
                    <div className="canvas-placeholder">
                      <p>No workflow steps yet — describe your process to the assistant.</p>
                    </div>
                  )}
                </div>

                <div className="chat-panel">
                  <div className="chat-heading">
                    <div className="assistant-avatar" aria-hidden="true">✦</div>
                    <div><h2>Workflow assistant</h2><p>Describe a process or ask for a change</p></div>
                  </div>
                  <FileUpload onResult={handleDocumentUpload} allowKnowledge={user?.role === 'ADMIN'} />
                  <div className="chat-messages" role="log" aria-live="polite" aria-relevant="additions text">
                    {!chatMessages.length && !historyLoading && (
                      <div className="chat-welcome">
                        <span aria-hidden="true">✦</span>
                        <strong>Let’s shape this workflow.</strong>
                        <p>Describe the process, people involved, and any decisions or exceptions.</p>
                      </div>
                    )}
                    {historyLoading && <div className="history-loading">Loading conversation…</div>}
                    {chatMessages.map((msg, index) => (
                      <div key={index} className={`message ${msg.role}`}>
                        <strong>{msg.role === 'user' ? 'You' : 'Assistant'}</strong>
                        <span>{msg.content}</span>
                      </div>
                    ))}
                    {loading && <div className="message assistant thinking"><strong>Assistant</strong><span>Thinking…</span></div>}
                    <div ref={messagesEndRef} />
                  </div>
                  <form className="chat-input" onSubmit={e => { e.preventDefault(); handleSendMessage(); }}>
                    <input
                      type="text"
                      value={currentMessage}
                      onChange={(e) => setCurrentMessage(e.target.value)}
                      placeholder="Message your assistant…"
                      aria-label="Message your workflow assistant"
                      disabled={loading || historyLoading}
                    />
                    <button type="submit" className="btn btn-primary send-button" disabled={loading || historyLoading || !currentMessage.trim()} aria-label="Send message">
                      {loading ? '…' : '↑'}
                    </button>
                  </form>
                  <p className="chat-disclaimer">AI can make mistakes. Review workflows before deployment.</p>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <div className="welcome-mark" aria-hidden="true">✦</div>
              <p className="eyebrow">AI-powered process design</p>
              <h1>Turn your process into a workflow.</h1>
              <p>Describe how work moves through your team. Build, validate, and visualize the process in one workspace.</p>
              <button onClick={createNewWorkflow} className="btn btn-primary" disabled={creatingWorkflow}>
                {creatingWorkflow ? 'Creating your workspace…' : 'Create a workflow'}
              </button>
              {!workflowsLoading && workflows.length > 0 && <span className="empty-hint">Or choose a workflow from the left.</span>}
              {operationError && <div className="notice notice-error" role="alert">{operationError}</div>}
            </div>
          )}
        </main>
      </div>

      {deleteTarget && (
        <div
          className="modal-backdrop"
          onMouseDown={event => {
            if (event.target === event.currentTarget) closeDeleteDialog();
          }}
        >
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="delete-workflow-title">
            <p className="eyebrow">Workflow</p>
            <h2 id="delete-workflow-title">Delete “{deleteTarget.name}”?</h2>
            <p className="modal-copy">
              This permanently removes the workflow, its versions, conversations, and related records.
              Deployed workflows and active process instances must be undeployed or completed first.
            </p>
            {deleteError && <div className="notice notice-error" role="alert">{deleteError}</div>}
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={closeDeleteDialog} disabled={activeAction === 'delete'}>
                Cancel
              </button>
              <button type="button" className="btn btn-danger" onClick={confirmDeleteWorkflow} disabled={activeAction === 'delete'}>
                {activeAction === 'delete' ? 'Deleting…' : 'Delete workflow'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RequireAuth({ children }: { children: React.ReactElement }) {
  return authStore.getToken() ? children : <Navigate to="/login" replace />;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/knowledge" element={<RequireAuth><KnowledgeBase /></RequireAuth>} />
      <Route path="/" element={<RequireAuth><DesignerHome /></RequireAuth>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
