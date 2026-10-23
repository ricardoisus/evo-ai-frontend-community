import api from '@/services/core/api';
import { extractData } from '@/utils/apiHelpers';
import { automationApi, type Catalog, type Delivery, type TestEvent } from '../automationApi';
import type { StudioGraph, StudioProof, StudioRun } from './graph';
const path = '/instagram_amh_proofs';
export type StudioDelivery = Delivery & { execution_trace?: StudioRun['trace']; prompt_accepted_at?: string; public_reply_accepted_at?: string; graph_cursor?: string };
export const studioApi = {
  catalog: automationApi.catalog,
  testEvents: automationApi.testEvents,
  async get(id: string): Promise<StudioProof> { return extractData(await api.get(`${path}/${id}`)); },
  async create(name: string, graph: StudioGraph, create_key: string): Promise<StudioProof> { return extractData(await api.post(path, { name, graph, create_key })); },
  async save(proof: StudioProof, graph: StudioGraph, name: string): Promise<StudioProof> { return extractData(await api.patch(`${path}/${proof.id}`, { graph, name, lock_version: proof.lock_version })); },
  async discard(proof: StudioProof): Promise<StudioProof> { return extractData(await api.post(`${path}/${proof.id}/discard`, { lock_version: proof.lock_version })); },
  async validate(proof: StudioProof) { return extractData<{ valid: boolean }>(await api.post(`${path}/${proof.id}/validate_graph`)); },
  async publish(proof: StudioProof): Promise<StudioProof> { return extractData(await api.post(`${path}/${proof.id}/publish`, { lock_version: proof.lock_version })); },
  async activate(proof: StudioProof, version_id: string, audience: string): Promise<StudioProof> { return extractData(await api.post(`${path}/${proof.id}/activate`, { version_id, audience, lock_version: proof.lock_version })); },
  async simulate(proof: StudioProof, version_id: string, fixture: string, text: string, context: Record<string, string>): Promise<{ proof: StudioProof; run: StudioRun }> { return extractData(await api.post(`${path}/${proof.id}/simulate`, { version_id, fixture, text, context })); },
  async deliveries(id: string): Promise<StudioDelivery[]> { return automationApi.deliveries(id); },
  async testReply(id: string, event_id: string): Promise<StudioDelivery> { return automationApi.testReply(id, event_id); },
};
export type StudioApi = typeof studioApi;
export type { Catalog, TestEvent };
