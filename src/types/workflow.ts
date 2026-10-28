export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  version: number;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  variables: Record<string, any>;
  metadata: Record<string, any>;
}

export interface WorkflowNode {
  id: string;
  type: string;
  name: string;
  description?: string;
  properties: Record<string, any>;
  metadata: Record<string, any>;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  condition?: string;
  type: string;
  properties: Record<string, any>;
  metadata: Record<string, any>;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  version: number;
  status: string;
  definition: WorkflowDefinition;
  bpmnXml?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface AgentState {
  id: string;
  agentType: string;
  currentStep: string;
  status: string;
  context: Record<string, any>;
  toolResults: Record<string, any>;
  lastToolCalled?: string;
  lastUserMessage?: string;
  lastAgentResponse?: string;
  startedAt: string;
  lastActivityAt: string;
  stepsCompleted: number;
  totalSteps: number;
}

export interface SimulationResult {
  workflowName: string;
  inputVariables: Record<string, any>;
  outputVariables: Record<string, any>;
  executionPath: string[];
  executionDetails: ExecutionStep[];
  gatewayDecisions: Record<string, GatewayDecision>;
  success: boolean;
  errorMessage?: string;
  startTime: number;
  endTime: number;
  duration: number;
}

export interface ExecutionStep {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  status: string;
  timestamp: number;
  variables: Record<string, any>;
}

export interface GatewayDecision {
  gatewayId: string;
  gatewayName: string;
  condition: string;
  conditionMet: boolean;
  selectedPath?: string;
}

export interface Deployment {
  id: string;
  workflowId: string;
  workflowVersion: number;
  deploymentId: string;
  processDefinitionKey: string;
  status: string;
  deployedAt: string;
  deployedBy: string;
  environment: string;
}

export interface ProcessInstance {
  id: string;
  workflowId: string;
  deploymentId: string;
  processInstanceId: string;
  processDefinitionKey: string;
  status: string;
  currentActivityId: string;
  variables: Record<string, any>;
  startedAt: string;
  completedAt?: string;
  errorMessage?: string;
}

export interface AuthResponse {
  token: string;
  username: string;
  role: string;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  workflowId?: string;
  userId?: string;
  role: string;
  content: string;
  metadata?: string;
  createdAt: string;
}

export interface DocumentUploadResult {
  filename: string;
  purpose: string;
  extractedCharacters: number;
  chunkCount?: number;
  documentSourceId?: string;
  workflow?: WorkflowDefinition;
  message?: string;
}

export interface KnowledgeEntry {
  id: string;
  content: string;
  knowledgeType: string;
  source?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}
