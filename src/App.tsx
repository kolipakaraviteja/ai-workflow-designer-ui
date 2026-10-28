import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { workflowApi, agentApi, simulationApi, deploymentApi, conversationApi, authApi, authStore } from './services/api';
import type { Workflow, ConversationMessage, DocumentUploadResult } from './types/workflow';
import BpmnViewer from './components/BpmnViewer';
import SimpleFlowViewer from './components/SimpleFlowViewer';
import ProcessStepsView from './components/ProcessStepsView';
import LoginPage from './components/LoginPage';
import KnowledgeBase from './components/KnowledgeBase';
import FileUpload from './components/FileUpload';
import './App.css';

function DesignerHome() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [chatMessages, setChatMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [viewMode, setViewMode] = useState<'simple' | 'steps' | 'advanced'>('simple');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const user = authStore.getUser();

  useEffect(() => {
    loadWorkflows();
  }, []);

  const loadWorkflows = async () => {
    try {
      const data = await workflowApi.getAllWorkflows();
      setWorkflows(data);
    } catch (error) {
      console.error('Failed to load workflows:', error);
    }
  };

  const selectWorkflow = async (workflow: Workflow) => {
    setSelectedWorkflow(workflow);
    setConversationId(undefined);
    // Restore the user's latest conversation for this workflow so the agent
    // continues where it left off (spec state, memory).
    try {
      const latest = await conversationApi.getLatestForWorkflow(workflow.id);
      if (latest?.conversationId) {
        setConversationId(latest.conversationId);
        const history = await conversationApi.getMessages(latest.conversationId);
        setChatMessages(history.map((m: ConversationMessage) => ({
          role: m.role.toLowerCase(),
          content: m.content
        })));
        return;
      }
      const history = await conversationApi.getWorkflowMessages(workflow.id);
      setChatMessages(history.map((m: ConversationMessage) => ({
        role: m.role.toLowerCase(),
        content: m.content
      })));
    } catch (error) {
      console.error('Failed to load conversation history:', error);
      setChatMessages([]);
    }
  };

  const createNewWorkflow = async () => {
    try {
      const newWorkflow = await workflowApi.createWorkflow({
        name: 'New Workflow',
        description: 'Created by AI Workflow Designer'
      });
      setWorkflows([...workflows, newWorkflow]);
      setSelectedWorkflow(newWorkflow);
      setChatMessages([]);
      setConversationId(undefined);
    } catch (error) {
      console.error('Failed to create workflow:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!currentMessage.trim()) return;

    const userMessage = currentMessage;
    setCurrentMessage('');
    setChatMessages([...chatMessages, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const response = await agentApi.chat(userMessage, selectedWorkflow?.id, conversationId);
      setChatMessages(prev => [...prev, { role: 'assistant', content: response.message }]);
      if (response.conversationId) {
        setConversationId(response.conversationId);
      }

      if (response.modifiedWorkflow) {
        await loadWorkflows();
        const targetWorkflowId = response.workflowId ?? selectedWorkflow?.id;
        if (targetWorkflowId) {
          const updatedWorkflow = await workflowApi.getWorkflow(targetWorkflowId);
          setSelectedWorkflow(updatedWorkflow);
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleDocumentUpload = (result: DocumentUploadResult) => {
    setChatMessages(prev => [...prev, {
      role: 'assistant',
      content: `Document "${result.filename}" processed (${result.extractedCharacters} chars extracted). ${result.message ?? ''}`
    }]);
    if (result.workflow) {
      loadWorkflows();
    }
  };

  const handleValidate = async () => {
    if (!selectedWorkflow) return;

    try {
      const validationResult = await workflowApi.validateWorkflow(selectedWorkflow.id);
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: `Validation Result:\nStatus: ${validationResult.status}\nErrors: ${validationResult.errors?.join(', ') || 'None'}\nWarnings: ${validationResult.warnings?.join(', ') || 'None'}`
      }]);
    } catch (error) {
      console.error('Failed to validate workflow:', error);
    }
  };

  const handleGenerateBpmn = async () => {
    if (!selectedWorkflow) return;

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
    }
  };

  const handleSimulate = async () => {
    if (!selectedWorkflow) return;

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
    }
  };

  const handleDeploy = async () => {
    if (!selectedWorkflow) return;

    try {
      const deploymentResult = await deploymentApi.deployWorkflow(selectedWorkflow.id, user?.username);
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: `Deployment Result:\nStatus: ${deploymentResult.success ? 'Success' : 'Failed'}\nDeployment ID: ${deploymentResult.deploymentId}\nWorkflow: ${deploymentResult.workflowName}`
      }]);
    } catch (error) {
      console.error('Failed to deploy workflow:', error);
    }
  };

  const handleExport = async () => {
    if (!selectedWorkflow) return;

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
    }
  };

  const handleLogout = () => {
    authApi.logout();
    navigate('/login');
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>AI Workflow Designer</h1>
        <div className="header-actions">
          <button onClick={createNewWorkflow} className="btn btn-primary">
            + New Workflow
          </button>
          <button onClick={() => navigate('/knowledge')} className="btn btn-secondary">
            Knowledge Base
          </button>
          <span className="user-info">
            {user?.username} ({user?.role})
          </span>
          <button onClick={handleLogout} className="btn btn-secondary">
            Logout
          </button>
        </div>
      </header>

      <div className="app-container">
        <aside className="sidebar">
          <h2>Workflows</h2>
          <ul className="workflow-list">
            {workflows.map(workflow => (
              <li
                key={workflow.id}
                className={`workflow-item ${selectedWorkflow?.id === workflow.id ? 'active' : ''}`}
                onClick={() => selectWorkflow(workflow)}
              >
                <div className="workflow-name">{workflow.name}</div>
                <div className="workflow-status">{workflow.status}</div>
              </li>
            ))}
          </ul>
        </aside>

        <main className="main-content">
          {selectedWorkflow ? (
            <>
              <div className="workflow-header">
                <h2>{selectedWorkflow.name}</h2>
                <div className="workflow-actions">
                  <button onClick={handleValidate} className="btn btn-secondary">
                    Validate
                  </button>
                  <button onClick={handleGenerateBpmn} className="btn btn-secondary">
                    Generate BPMN
                  </button>
                  <button onClick={handleSimulate} className="btn btn-secondary">
                    Simulate
                  </button>
                  <button onClick={handleDeploy} className="btn btn-primary">
                    Deploy
                  </button>
                  <button onClick={handleExport} className="btn btn-secondary">
                    Export
                  </button>
                </div>
              </div>

              <div className="workflow-content">
                <div className="bpmn-canvas">
                  <div className="view-tabs">
                    <button
                      className={viewMode === 'simple' ? 'tab active' : 'tab'}
                      onClick={() => setViewMode('simple')}
                    >
                      Simple
                    </button>
                    <button
                      className={viewMode === 'steps' ? 'tab active' : 'tab'}
                      onClick={() => setViewMode('steps')}
                    >
                      Steps
                    </button>
                    <button
                      className={viewMode === 'advanced' ? 'tab active' : 'tab'}
                      onClick={() => setViewMode('advanced')}
                    >
                      Advanced (BPMN)
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
                  <h3>AI Assistant</h3>
                  <FileUpload onResult={handleDocumentUpload} />
                  <div className="chat-messages">
                    {chatMessages.map((msg, index) => (
                      <div key={index} className={`message ${msg.role}`}>
                        <strong>{msg.role}:</strong> {msg.content}
                      </div>
                    ))}
                    {loading && <div className="message assistant">Thinking...</div>}
                  </div>
                  <div className="chat-input">
                    <input
                      type="text"
                      value={currentMessage}
                      onChange={(e) => setCurrentMessage(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                      placeholder="Describe your workflow changes..."
                      disabled={loading}
                    />
                    <button onClick={handleSendMessage} disabled={loading}>
                      Send
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <h2>Select a workflow or create a new one</h2>
              <p>Use the AI assistant to design and modify BPMN workflows</p>
            </div>
          )}
        </main>
      </div>
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
