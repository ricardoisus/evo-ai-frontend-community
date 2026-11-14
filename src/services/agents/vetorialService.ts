import api from '@/services/core/api';
import type { AgentListResponse } from '@/types/agents';
export type Mode = 'off' | 'pilot' | 'all';
export interface ManagedAgent {
  id: string;
  name: string;
  description: string;
  role: 'atendimento' | 'analista';
  model: string;
  prompt_version: string;
  mode: Mode;
  health: string;
  desired_version: number;
  applied_version: number | null;
}
export interface Snapshot {
  roles: Record<
    string,
    { model: string; prompt: string; prompt_version: string; [key: string]: unknown }
  >;
  activation: {
    atendimento: Mode;
    analista: Mode;
    allowlist: string[];
    internal_numbers: string[];
  };
  behavior: Record<string, unknown>;
  limits: Record<string, number>;
  binding: { agent_bot_id: string; inbox_ids: string[]; pipeline_id: string };
  [key: string]: unknown;
}
export interface Revision {
  id: string;
  revision: number;
  status: string;
  created_at: string;
  created_by?: string;
  payload: Snapshot;
}
export interface Profile extends ManagedAgent {
  linked_inboxes?: { id: string; name: string }[];
  can_manage: boolean;
  lock_version: number;
  control_source: string;
  published_revision: Revision;
}
export interface Metrics {
  conversations: number;
  appointments: number;
  errors: number;
  month_cost_micro_usd: number;
  month_usage_known?: number;
  month_usage_unknown?: number;
  usage_known: number;
  usage_unknown: number;
  input_tokens: number;
  output_tokens: number;
  measurement_started_at: string | null;
  latency: { n: number; p50_ms: number | null; p95_ms: number | null };
  recent_executions: {
    role: string;
    status: string;
    revision: number;
    occurred_at: string;
    latency_ms: number;
    cost_micro_usd: number | null;
  }[];
}
export interface TestSession {
  id: string;
  state: string;
  revision_id: string;
  messages: { request_id: string; text: string; status: string; response?: unknown }[];
  budget: Record<string, unknown>;
}
export const modeLabel: Record<Mode, string> = { off: 'Desligado', pilot: 'Piloto', all: 'Todos' };
export const healthLabel: Record<string, string> = {
  healthy: 'Saudável',
  delayed: 'Atrasado',
  unavailable: 'Indisponível',
  awaiting_configuration: 'Aguardando configuração',
};
export function errorMessage(error: unknown): string {
  const status = (error as { response?: { status?: number } })?.response?.status;
  return status === 409
    ? 'A configuração mudou. Atualize antes de tentar novamente.'
    : status === 403
      ? 'Você não tem permissão para esta ação.'
      : status === 429
        ? 'Limite do teste atingido.'
        : status === 422
          ? 'Revise os campos informados.'
          : 'Não foi possível concluir. Tente novamente.';
}
export async function catalog(page: number, pageSize: number, params: Record<string, string> = {}) {
  return (
    await api.get<{
      data: { managed: ManagedAgent[]; native: AgentListResponse | null };
      meta: { partial: boolean };
    }>('/agent_catalog', { params: { page, page_size: pageSize, ...params } })
  ).data;
}
export async function read<T>(id: string, path = '', params = {}): Promise<T> {
  return (await api.get(`/vetorial_agents/${id}${path}`, { params })).data.data;
}
// A mutation's key belongs to the intent; callers retain it after ambiguous failures.
export async function write<T>(
  id: string,
  path: string,
  data: unknown,
  version?: number,
  key: string = crypto.randomUUID(),
  method: 'post' | 'put' = 'post',
): Promise<T> {
  return (
    await api[method](`/vetorial_agents/${id}${path}`, data, {
      headers: {
        'Idempotency-Key': key,
        ...(version === undefined ? {} : { 'If-Match': String(version) }),
      },
    })
  ).data.data;
}
export interface ConversationIA {
  version: number;
  paused: boolean;
  reason: string | null;
  eligible: boolean;
  mode: Mode;
  health: string;
}
export async function conversationIA(id: string): Promise<ConversationIA> {
  return (await api.get(`/conversations/${id}/vetorial_ia`)).data.data;
}
export async function controlIA(
  id: string,
  action: string,
  version: number,
  clear_assignee = false,
) {
  return (await api.post(`/conversations/${id}/vetorial_ia/${action}`, { version, clear_assignee }))
    .data.data;
}
