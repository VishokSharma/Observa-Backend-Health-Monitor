import { API_BASE_URL } from '../config/api';
import { getToken } from './auth';

async function extractErrorMessage(response: Response, fallback: string): Promise<string> {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    try {
      const payload = await response.json();
      if (payload?.error) return payload.error;
      if (payload?.message) return payload.message;
    } catch {
    }
  }

  try {
    const text = await response.text();
    if (text) {
      const trimmed = text.trim();
      if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html')) {
        return `${fallback} (received HTML error response)`;
      }
      return trimmed;
    }
  } catch {
  }

  return `${fallback} (status ${response.status})`;
}

export interface Project {
  id: string;
  name: string;
  apiKey: string;
  description?: string | null;
  region: string;
  status: string;
  slackWebhookUrl?: string | null;
  userId: string;
  createdAt: string;
  apiKeys?: ApiKey[];
  services?: Service[];
  _count?: {
    services: number;
  };
}

export interface ApiKey {
  id: string;
  key: string;
  projectId: string;
  createdAt: string;
  isActive: boolean;
}

export interface Service {
  id: string;
  name: string;
  status: string;
  uptime: number;
  projectId: string;
  createdAt: string;
}

export interface CreateProjectInput {
  name: string;
  description: string;
  region: string;
  status: string;
}

export interface CreateServiceInput {
  projectId: string;
  serviceName: string;
  status: string;
  uptime: number;
}

export interface SystemMetricPoint {
  bucket: string | number;
  avgCpu: number;
  maxCpu: number;
  avgMemoryMb: number;
  maxMemoryMb: number;
}

export interface RequestMetricPoint {
  route: string;
  method: string;
  totalRequests: number;
  successCount: number;
  clientErrorCount: number;
  serverErrorCount: number;
  avgResponseTime: number;
  maxResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime?: number;
  minuteBucket?: string | number;
  hourBucket?: string | number;
  dayBucket?: string | number;
}

export interface RequestMetricsFilters {
  method?: string;
  endpoint?: string;
}

export type AlertMetricType = 'system' | 'request';
export type AlertMetricField = 'avgCpu' | 'avgMemoryMb' | 'errorRate' | 'avgLatencyMs';
export type AlertOperator = '>' | '<';

export interface AlertRule {
  id: string;
  projectId: string;
  serviceName: string;
  metricType: AlertMetricType;
  metricField: string;
  operator: AlertOperator;
  threshold: number;
  windowSec: number;
  endpoint?: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface CreateAlertRuleInput {
  projectId: string;
  serviceName: string;
  metricType: AlertMetricType;
  metricField: AlertMetricField;
  operator: AlertOperator;
  threshold: number;
  windowSec: number;
  endpoint?: string;
  isActive?: boolean;
}

export interface UpdateAlertRuleInput {
  threshold?: number;
  windowSec?: number;
}

export async function setProjectSlackWebhook(projectId: string, slackWebhookUrl: string): Promise<Project> {
  const token = getToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`${API_BASE_URL}/projects/${projectId}/slack-webhook`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ slackWebhookUrl }),
  });

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, 'Failed to set project slack webhook'));
  }

  const data = await response.json();
  return data.project;
}

// Get all projects for user
export async function getProjects(): Promise<Project[]> {
  const token = getToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`${API_BASE_URL}/projects`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, 'Failed to fetch projects'));
  }

  const data = await response.json();
  return data.projects;
}

// Get single project details
export async function getProjectDetails(projectId: string): Promise<Project> {
  const token = getToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`${API_BASE_URL}/projects/${projectId}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, 'Failed to fetch project'));
  }

  const data = await response.json();
  return data.project;
}

// Get services for a project
export async function getProjectServices(projectId: string): Promise<Service[]> {
  const token = getToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`${API_BASE_URL}/projects/${projectId}/services`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, 'Failed to fetch services'));
  }

  const data = await response.json();
  return data.services;
}

// Create new project (via setup endpoint)
export async function createProject(input: CreateProjectInput): Promise<Project> {
  const token = getToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`${API_BASE_URL}/create/project`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, 'Failed to create project'));
  }

  return await response.json();
}

// Create service for a project
export async function createService(input: CreateServiceInput): Promise<Service> {
  const token = getToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`${API_BASE_URL}/create/service`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, 'Failed to create service'));
  }

  const data = await response.json();
  return data.service;
}

// Delete project
export async function deleteProject(projectId: string): Promise<void> {
  const token = getToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`${API_BASE_URL}/projects/${projectId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, 'Failed to delete project'));
  }
}

export async function updateProjectStatus(projectId: string, status: string): Promise<Project> {
  const token = getToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`${API_BASE_URL}/projects/${projectId}/status`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status }),
  });

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, 'Failed to update project status'));
  }

  const data = await response.json();
  return data.project;
}

export async function createProjectApiKey(projectId: string): Promise<string> {
  const token = getToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`${API_BASE_URL}/create/apikey/${projectId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, 'Failed to create API key'));
  }

  const data = await response.json();
  return data.apiKey;
}

export async function getSystemMetrics(
  projectId: string,
  serviceName: string,
  from: number,
  to: number
): Promise<SystemMetricPoint[]> {
  const token = getToken();
  if (!token) throw new Error('Not authenticated');

  const params = new URLSearchParams({
    projectId,
    serviceName,
    from: String(from),
    to: String(to),
  });

  const response = await fetch(`${API_BASE_URL}/metrics/system?${params.toString()}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, 'Failed to fetch system metrics'));
  }

  return await response.json();
}

export async function getRequestMetrics(
  projectId: string,
  serviceName: string,
  from: number,
  to: number,
  filters?: RequestMetricsFilters
): Promise<RequestMetricPoint[]> {
  const token = getToken();
  if (!token) throw new Error('Not authenticated');

  const params = new URLSearchParams({
    projectId,
    serviceName,
    from: String(from),
    to: String(to),
  });

  if (filters?.method) {
    params.set('method', filters.method);
  }

  if (filters?.endpoint) {
    params.set('endpoint', filters.endpoint);
  }

  const response = await fetch(`${API_BASE_URL}/metrics/request?${params.toString()}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, 'Failed to fetch request metrics'));
  }

  return await response.json();
}

export async function createAlertRule(input: CreateAlertRuleInput): Promise<any> {
  const token = getToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`${API_BASE_URL}/alerts`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, 'Failed to create alert rule'));
  }

  const data = await response.json();
  return data.alertRule;
}

export async function getAlertRules(projectId: string, serviceName: string): Promise<AlertRule[]> {
  const token = getToken();
  if (!token) throw new Error('Not authenticated');

  const params = new URLSearchParams({ projectId, serviceName });

  const response = await fetch(`${API_BASE_URL}/alerts?${params.toString()}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, 'Failed to fetch alert rules'));
  }

  const data = await response.json();
  return data.rules;
}

export async function updateAlertRule(alertRuleId: string, input: UpdateAlertRuleInput): Promise<AlertRule> {
  const token = getToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`${API_BASE_URL}/alerts/${alertRuleId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, 'Failed to update alert rule'));
  }

  const data = await response.json();
  return data.alertRule;
}
