import { useCallback, useEffect, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import { extractError } from '@/utils/apiHelpers';
import { useUnsavedNavigationGuard } from '../useUnsavedNavigationGuard';
import { cleanStudioGraph, initialStudioGraph, toStudioGraph, type StudioProof, type StudioGraph } from './graph';
import type { StudioApi } from './studioApi';
export type SaveStatus = 'loading' | 'saved' | 'pending' | 'saving' | 'error' | 'conflict';
export function useStudioDraft(api: StudioApi, id?: string) {
  const [proof, setProof] = useState<StudioProof | null>(null);
  const [graph, setGraph] = useState<StudioGraph>(() => initialStudioGraph());
  const [name, setName] = useState('Nova automação');
  const [status, setStatus] = useState<SaveStatus>(id ? 'loading' : 'saved');
  const [error, setError] = useState('');
  const revision = useRef(0);
  const savedRevision = useRef(0);
  const saving = useRef(false);
  const blocked = useRef(false);
  const proofRef = useRef<StudioProof | null>(null);
  const latest = useRef({ graph, name });
  const alive = useRef(true);
  const createKey = useRef(crypto.randomUUID());
  latest.current = { graph, name };
  const hydrate = useCallback((next: StudioProof) => {
    proofRef.current = next; setProof(next); setGraph(toStudioGraph(next.draft)); setName(next.name);
    revision.current = 0; savedRevision.current = 0; blocked.current = false; setStatus('saved'); setError('');
  }, []);
  useEffect(() => {
    alive.current = true;
    if (id) void api.get(id).then(next => { if (alive.current) hydrate(next); }).catch(e => { if (alive.current) { blocked.current = true; setStatus('error'); setError(extractError(e).message); } });
    return () => { alive.current = false; };
  }, [api, id, hydrate]);
  const change = useCallback((next: StudioGraph | ((old: StudioGraph) => StudioGraph)) => {
    revision.current++; setGraph(next); if (!blocked.current) setStatus('pending');
  }, []);
  const rename = (value: string) => { revision.current++; setName(value); if (!blocked.current) setStatus('pending'); };
  const save = useCallback(async (): Promise<StudioProof | null> => {
    if (saving.current || blocked.current || !alive.current || (id && !proofRef.current)) return null;
    if (revision.current === savedRevision.current && proofRef.current) return proofRef.current;
    saving.current = true;
    setStatus('saving'); setError('');
    const at = revision.current;
    const snapshot = latest.current;
    try {
      const next = proofRef.current ? await api.save(proofRef.current, cleanStudioGraph(snapshot.graph), snapshot.name) : await api.create(snapshot.name, cleanStudioGraph(snapshot.graph), createKey.current);
      proofRef.current = next;
      savedRevision.current = at;
      if (alive.current) { setProof(next); setStatus(revision.current === at ? 'saved' : 'pending'); }
      return next;
    } catch (e) {
      blocked.current = true;
      if (alive.current) { setStatus(isAxiosError(e) && e.response?.status === 409 ? 'conflict' : 'error'); setError(extractError(e).message); }
      return null;
    } finally { saving.current = false; }
  }, [api, id]);
  useEffect(() => {
    if (status !== 'pending') return;
    const timer = window.setTimeout(() => void save(), 800);
    return () => window.clearTimeout(timer);
  }, [graph, name, status, save]);
  const unsaved = status !== 'saved' && status !== 'loading';
  useUnsavedNavigationGuard(unsaved);
  useEffect(() => {
    if (!unsaved) return;
    const guard = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [unsaved]);
  const syncMetadata = useCallback((next: StudioProof) => {
    if (!alive.current || next.lock_version !== proofRef.current?.lock_version) return;
    proofRef.current = next;
    setProof(next);
  }, []);
  const failure = (e: unknown) => {
    blocked.current = true;
    setStatus(isAxiosError(e) && e.response?.status === 409 ? 'conflict' : 'error');
    setError(extractError(e).message);
  };
  const reload = async () => {
    const key = proofRef.current?.id || id;
    if (!key) return;
    try { hydrate(await api.get(key)); } catch (e) { failure(e); }
  };
  const retry = () => {
    if (id && !proofRef.current) { void reload(); return; }
    blocked.current = false; void save();
  };
  const discard = async () => {
    if (saving.current) throw new Error('Aguarde o salvamento terminar antes de descartar.');
    blocked.current = true;
    try {
      if (proofRef.current) hydrate(await api.discard(proofRef.current));
      else { setGraph(initialStudioGraph()); revision.current = 0; savedRevision.current = 0; blocked.current = false; setStatus('saved'); }
    } catch (e) { failure(e); throw e; }
  };
  return { proof, graph, name, status, error, change, rename, save, retry, reload, discard, hydrate, syncMetadata, unsaved };
}
