import api from '@/services/core/api';
import { extractData } from '@/utils/apiHelpers';

export type Draft = Partial<{
  trigger: string;
  frequency: string;
  event_name: string;
  destination_id: string;
  mode: string;
  filters: Record<string, string>;
  text: { operator: string; value: string };
}>;
export type Rule = { id: string; name: string; draft: Draft; published: Draft | null; active: boolean; lock_version: number };
export type RuntimeMode = 'disabled' | 'observation' | 'production';
type RuleList = { data: Rule[]; meta: { runtime_mode: RuntimeMode } };

export type Destination = { id: string; name: string; dataset_id: string; credential_configured: boolean };
export type Delivery = {
  id: string; event_id: string; event_name: string; dataset_id: string; mode: string; status: string;
  created_at: string; attempt_count: number;
  receipts: Array<{ attempt_number: number; status: string; http_status: number | null; error_code: number | null; error_subcode: number | null }>;
};
type History = { data: Delivery[]; meta: { page: number; per_page: number; total_count: number } };

const root = (inbox: string) => `/whatsapp_tracking/${inbox}`;

export const trackingApi = {
  rules: async (inbox: string) => (await api.get<RuleList>(`${root(inbox)}/rules`)).data,
  destinations: async (inbox: string) => extractData<Destination[]>(await api.get(`${root(inbox)}/destinations`)),
  saveRule: async (inbox: string, input: { name: string; draft: Draft }, rule?: Rule) =>
    extractData<Rule>(rule
      ? await api.patch(`${root(inbox)}/rules/${rule.id}`, { ...input, lock_version: rule.lock_version })
      : await api.post(`${root(inbox)}/rules`, input)),
  action: async (inbox: string, rule: Rule, action: 'publish' | 'pause') =>
    extractData<Rule>(await api.post(`${root(inbox)}/rules/${rule.id}/${action}`, { lock_version: rule.lock_version })),
  simulate: async (inbox: string, rule: Rule, event: Record<string, string | boolean>) =>
    extractData<{ result: string }>(await api.post(`${root(inbox)}/rules/${rule.id}/simulate`, { event })),
  saveDestination: async (inbox: string, input: { name: string; dataset_id?: string; credential_ref?: string }, id?: string) =>
    extractData<Destination>(id ? await api.patch(`${root(inbox)}/destinations/${id}`, input) : await api.post(`${root(inbox)}/destinations`, input)),
  history: async (inbox: string, params: { page: number; status?: string; dataset_id?: string; mode?: string }) =>
    (await api.get<History>(`${root(inbox)}/history`, { params })).data,
  retry: async (inbox: string, id: string) => api.post(`${root(inbox)}/history/${id}/retry`),
};
