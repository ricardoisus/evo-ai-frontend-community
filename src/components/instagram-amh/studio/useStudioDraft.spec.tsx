import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AxiosError } from 'axios';
import { useStudioDraft } from './useStudioDraft';
import { initialStudioGraph, type StudioProof } from './graph';
import { studioApi, type StudioApi } from './studioApi';
vi.mock('../useUnsavedNavigationGuard', () => ({ useUnsavedNavigationGuard: vi.fn() }));
function fixture(): StudioProof { const graph = initialStudioGraph('90001'); return { id: 'qa', name: 'Teste', draft: graph, versions: [{ id: 'v1', number: 1, graph: structuredClone(graph), at: '', actor: '', digest: '', state: 'paused' }], lock_version: 2, ledger: [], state: 'test', outbound_enabled: false, active_version_id: 'v1' }; }
function setup(overrides: Partial<StudioApi> = {}) {
  let proof = fixture();
  const api = { ...studioApi, get: vi.fn(async () => structuredClone(proof)), save: vi.fn(async (_p, graph, name) => { proof = { ...proof, draft: structuredClone(graph), name, lock_version: proof.lock_version + 1 }; return structuredClone(proof); }), discard: vi.fn(async () => { proof = { ...proof, draft: structuredClone(proof.versions[0].graph), lock_version: proof.lock_version + 1 }; return structuredClone(proof); }), ...overrides } as StudioApi;
  return { api, hook: renderHook(() => useStudioDraft(api, 'qa')) };
}
afterEach(() => vi.restoreAllMocks());
describe('Instagram studio automatic draft', () => {
  it('saves an edit automatically without publishing or activating', async () => {
    const { api, hook } = setup({ publish: vi.fn(), activate: vi.fn() });
    await waitFor(() => expect(hook.result.current.status).toBe('saved'));
    act(() => hook.result.current.rename('Nova mensagem'));
    await waitFor(() => expect(api.save).toHaveBeenCalledOnce(), { timeout: 2000 });
    await waitFor(() => expect(hook.result.current.status).toBe('saved'));
    expect(api.publish).not.toHaveBeenCalled(); expect(api.activate).not.toHaveBeenCalled();
  });
  it('does not overwrite edits made while an earlier save is in flight', async () => {
    let resolve!: (p: StudioProof) => void;
    const save = vi.fn().mockImplementationOnce(() => new Promise<StudioProof>(r => { resolve = r; })).mockImplementation(async (_p, graph, name) => ({ ...fixture(), draft: graph, name, lock_version: 4 }));
    const { hook } = setup({ save });
    await waitFor(() => expect(hook.result.current.status).toBe('saved'));
    act(() => hook.result.current.rename('Primeira'));
    await waitFor(() => expect(save).toHaveBeenCalledOnce(), { timeout: 2000 });
    act(() => hook.result.current.rename('Segunda'));
    await act(async () => resolve({ ...fixture(), name: 'Primeira', lock_version: 3 }));
    expect(hook.result.current.name).toBe('Segunda');
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2), { timeout: 2000 });
    expect(save.mock.calls[1][0].lock_version).toBe(3);
    expect(save.mock.calls[1][2]).toBe('Segunda');
  });
  it('restores the exact published graph and leaves execution untouched', async () => {
    const { hook } = setup(); await waitFor(() => expect(hook.result.current.status).toBe('saved'));
    act(() => hook.result.current.change(g => ({ ...g, nodes: g.nodes.map(n => ({ ...n, position: { x: 999, y: 10 } })) })));
    await act(async () => { await hook.result.current.discard(); });
    expect(hook.result.current.graph).toEqual(fixture().versions[0].graph);
    expect(hook.result.current.proof?.active_version_id).toBe('v1');
    expect(hook.result.current.proof?.state).toBe('test');
  });
  it('refreshes server activation readiness without replacing an unsaved local edit', async () => {
    const { hook } = setup();
    await waitFor(() => expect(hook.result.current.status).toBe('saved'));
    act(() => hook.result.current.rename('Edição local'));
    act(() => hook.result.current.syncMetadata({ ...fixture(), activation_readiness: { eligible: true } }));
    expect(hook.result.current.name).toBe('Edição local');
    expect(hook.result.current.status).toBe('pending');
    expect(hook.result.current.proof?.activation_readiness?.eligible).toBe(true);
  });
  it('stops autosaving after a concurrency conflict and preserves local edits', async () => {
    const conflict = new AxiosError('Outra edição', '409', undefined, undefined, { status: 409, data: { error: { message: 'Outra edição' }, success: false }, headers: {}, statusText: 'Conflict', config: { headers: {} } } as never);
    const { hook, api } = setup({ save: vi.fn().mockRejectedValue(conflict) });
    await waitFor(() => expect(hook.result.current.status).toBe('saved'));
    act(() => hook.result.current.rename('Local'));
    await waitFor(() => expect(hook.result.current.status).toBe('conflict'), { timeout: 2000 });
    expect(hook.result.current.name).toBe('Local');
    expect(api.save).toHaveBeenCalledOnce();
  });
});

describe('Instagram draft loading failure', () => {
  it('retries reading the original automation instead of creating a new one', async () => {
    const get = vi.fn().mockRejectedValueOnce(new Error('Falha de leitura')).mockResolvedValue(fixture());
    const create = vi.fn();
    const { hook } = setup({ get, create });
    await waitFor(() => expect(hook.result.current.status).toBe('error'));
    act(() => hook.result.current.retry());
    await waitFor(() => expect(hook.result.current.status).toBe('saved'));
    expect(get).toHaveBeenCalledTimes(2);
    expect(create).not.toHaveBeenCalled();
  });
});
