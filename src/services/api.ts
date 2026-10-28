import axios from 'axios';
import type { Workflow, WorkflowDefinition, AgentState, SimulationResult, AuthResponse, ConversationMessage, DocumentUploadResult, KnowledgeEntry } from '../types/workflow';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const api = axios.create({ baseURL: API_BASE_URL });

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

export const authStore = {
  getToken: () => localStorage.getItem(TOKEN_KEY),
  getUser: (): { username: string; role: string } | null => {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  },
  save: (auth: AuthResponse) => {
    localStorage.setItem(TOKEN_KEY, auth.token);
    localStorage.setItem(USER_KEY, JSON.stringify({ username: auth.username, role: auth.role }));
  },
  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
};

api.interceptors.request.use((config) => {
  const token = authStore.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      authStore.clear();
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  async login(username: string, password: string): Promise<AuthResponse> {
    const response = await api.post('/auth/login', { username, password });
    authStore.save(response.data);
    return response.data;
  },

  async register(username: string, password: string, email?: string): Promise<AuthResponse> {
    const response = await api.post('/auth/register', { username, password, email });
    authStore.save(response.data);
    return response.data;
  },

  async me(): Promise<AuthResponse> {
    const response = await api.get('/auth/me');
    return response.data;
  },

  logout() {
    authStore.clear();
  }
};

export const workflowApi = {
  async createWorkflow(data: { name: string; description: string; createdBy?: string }): Promise<Workflow> {
    const response = await api.post('/workflows', data);
    return response.data;
  },

  async getWorkflow(id: string): Promise<Workflow> {
    const response = await api.get(`/workflows/${id}`);
    return response.data;
  },

  async getAllWorkflows(params?: { status?: string; username?: string }): Promise<Workflow[]> {
    const response = await api.get('/workflows', { params });
    return response.data;
  },

  async updateWorkflow(id: string, data: { name: string; description: string; updatedBy?: string }): Promise<Workflow> {
    const response = await api.put(`/workflows/${id}`, data);
    return response.data;
  },

  async deleteWorkflow(id: string): Promise<void> {
    await api.delete(`/workflows/${id}`);
  },

  async validateWorkflow(id: string): Promise<any> {
    const response = await api.post(`/workflows/${id}/validate`);
    return response.data;
  },

  async generateBpmn(id: string): Promise<string> {
    const response = await api.post(`/workflows/${id}/generate-bpmn`);
    return response.data;
  },

  async getBpmnXml(id: string): Promise<string> {
    const response = await api.get(`/workflows/${id}/bpmn`);
    return response.data;
  },

  async importBpmn(bpmnXml: string, createdBy: string): Promise<Workflow> {
    const response = await api.post('/workflows/import-bpmn', bpmnXml, {
      params: { createdBy },
      headers: { 'Content-Type': 'application/xml' }
    });
    return response.data;
  }
};

export interface WorkflowSpec {
  id?: string;
  processName?: string;
  description?: string;
  steps?: any[];
  actors?: any[];
  decisions?: any[];
  conditions?: any[];
  missingInfo?: any[];
  status: string;
}

export interface AgentChatResponse {
  agentType: string;
  status: string;
  message: string;
  conversationId?: string;
  agentState: AgentState;
  modifiedWorkflow?: WorkflowDefinition;
  workflowId?: string;
  bpmnXml?: string;
  workflowSpec?: WorkflowSpec;
  correlationId?: string;
  agentPath?: string;
  toolCallCount?: number;
  tokenUsage?: { llmCalls: number; promptTokens: number; completionTokens: number; totalTokens: number };
  error?: string;
}

export const agentApi = {
  async processRequest(data: { workflowId?: string; conversationId?: string; message: string; agentType?: string }): Promise<AgentChatResponse> {
    const response = await api.post('/agent/process', data);
    return response.data;
  },

  async chat(message: string, workflowId?: string, conversationId?: string): Promise<AgentChatResponse> {
    const response = await api.post('/agent/chat', {
      message,
      workflowId,
      conversationId,
      agentType: 'ORCHESTRATOR'
    });
    return response.data;
  }
};

export const conversationApi = {
  async list(): Promise<string[]> {
    const response = await api.get('/conversations');
    return response.data;
  },

  async getMessages(conversationId: string): Promise<ConversationMessage[]> {
    const response = await api.get(`/conversations/${conversationId}/messages`);
    return response.data;
  },

  async getWorkflowMessages(workflowId: string): Promise<ConversationMessage[]> {
    const response = await api.get(`/conversations/workflow/${workflowId}`);
    return response.data;
  },

  async getLatestForWorkflow(workflowId: string): Promise<{ conversationId: string; spec: WorkflowSpec | null } | null> {
    try {
      const response = await api.get(`/conversations/workflow/${workflowId}/latest`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  async deleteConversation(conversationId: string): Promise<void> {
    await api.delete(`/conversations/${conversationId}`);
  }
};

export const documentApi = {
  async upload(file: File, purpose: 'KNOWLEDGE' | 'WORKFLOW'): Promise<DocumentUploadResult> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/documents/upload', formData, {
      params: { purpose },
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  }
};

export const knowledgeApi = {
  async search(q: string, topK = 5): Promise<any[]> {
    const response = await api.get('/knowledge/search', { params: { q, topK } });
    return response.data;
  },

  async add(entry: { title: string; content: string; category?: string; source?: string; tags?: string }): Promise<KnowledgeEntry> {
    const response = await api.post('/knowledge', entry);
    return response.data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/knowledge/${id}`);
  },

  async listDocuments(): Promise<any[]> {
    const response = await api.get('/knowledge/documents');
    return response.data;
  }
};

export const simulationApi = {
  async simulate(data: { workflowId: string; inputVariables: Record<string, any> }): Promise<SimulationResult> {
    const response = await api.post('/simulation/simulate', data);
    return response.data;
  },

  async whatIf(data: { workflowId: string; inputVariables: Record<string, any>; changeDescription: string }): Promise<any> {
    const response = await api.post('/simulation/what-if', data);
    return response.data;
  }
};

export const deploymentApi = {
  async deployWorkflow(workflowId: string, deployedBy?: string): Promise<any> {
    const response = await api.post(`/deployments/workflow/${workflowId}`, null, {
      params: { deployedBy }
    });
    return response.data;
  },

  async getWorkflowDeployments(workflowId: string): Promise<any[]> {
    const response = await api.get(`/deployments/workflow/${workflowId}`);
    return response.data;
  },

  async getDeployment(deploymentId: string): Promise<any> {
    const response = await api.get(`/deployments/${deploymentId}`);
    return response.data;
  },

  async getDeploymentStatus(deploymentId: string): Promise<any> {
    const response = await api.get(`/deployments/${deploymentId}/status`);
    return response.data;
  },

  async startProcessInstance(deploymentId: string, variables: Record<string, any>): Promise<any> {
    const response = await api.post(`/deployments/${deploymentId}/instances`, variables);
    return response.data;
  },

  async getProcessInstances(deploymentId: string): Promise<any[]> {
    const response = await api.get(`/deployments/${deploymentId}/instances`);
    return response.data;
  },

  async getProcessInstance(processInstanceId: string): Promise<any> {
    const response = await api.get(`/deployments/instances/${processInstanceId}`);
    return response.data;
  },

  async undeployWorkflow(deploymentId: string): Promise<void> {
    await api.delete(`/deployments/${deploymentId}`);
  }
};
