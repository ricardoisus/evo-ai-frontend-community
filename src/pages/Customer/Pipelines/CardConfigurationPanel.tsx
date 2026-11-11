import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@evoapi/design-system';
import { usePermissions } from '@/contexts/PermissionsContext';
import type { CardConfiguration, Pipeline, PipelineItem } from '@/types/analytics/pipelines';
import { pipelinesService } from '@/services/pipelines';
import { configurationFor, defaultConfiguration, fixedFields, nativeFields } from './cardConfiguration';
import ConfiguredDealCard from './ConfiguredDealCard';

const preview = {
  id: 'preview', pipeline_id: 'preview', title: 'Diagnóstico · Dermatologia', value: 5250, currency: 'BRL',
  primary_contact: { id: 'preview', name: 'Dra. Pessoa Fictícia' }, owner: { id: 'preview', name: 'Equipe Vetorial' },
  labels: [{ name: 'Prioridade alta', color: '#55768A' }], entered_at: Date.now() / 1000 - 172800,
  created_at: Date.now() / 1000, custom_fields: { especialidade: 'Dermatologia' },
} as PipelineItem;

export default function CardConfigurationPanel({ pipeline, onClose, onSaved }: { pipeline: Pipeline; onClose: () => void; onSaved: (pipeline: Pipeline) => void }) {
  const { can } = usePermissions();
  const writable = can('pipelines', 'update');
  const initial = useRef(configurationFor(pipeline));
  const revision = useRef(pipeline.card_configuration_revision || 0);
  const [draft, setDraft] = useState<CardConfiguration>(initial.current);
  const [definitions, setDefinitions] = useState(pipeline.card_field_definitions || nativeFields);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [query, setQuery] = useState('');
  const dragging = useRef<string | null>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial.current);
  const close = () => { if (busy) return; if (dirty) setDiscard(true); else onClose(); };
  const reorder = (id: string, target: number) => setDraft(current => {
    const fields = [...current.fields];
    const index = fields.findIndex(field => field.id === id);
    if (fixedFields.has(id) || target < 1 || target >= fields.length || fixedFields.has(fields[target].id)) return current;
    const [field] = fields.splice(index, 1); fields.splice(target, 0, field);
    return { ...current, fields };
  });
  const move = (id: string, direction: number) => {
    let target = draft.fields.findIndex(field => field.id === id) + direction;
    while (target > 0 && target < draft.fields.length && fixedFields.has(draft.fields[target].id)) target += direction;
    reorder(id, target);
  };
  const reload = async () => {
    setBusy(true);
    try {
      const fresh = await pipelinesService.getPipeline(pipeline.id);
      revision.current = fresh.card_configuration_revision || 0;
      initial.current = configurationFor(fresh);
      setDraft(initial.current); setDefinitions(fresh.card_field_definitions || nativeFields); setConflict(false); setError('');
    } catch { setError('Não foi possível recarregar. Tente novamente.'); }
    finally { setBusy(false); }
  };
  const save = async () => {
    setBusy(true); setError('');
    try {
      const saved = await pipelinesService.updatePipeline(pipeline.id, { card_configuration: draft, card_configuration_revision: revision.current });
      onSaved(saved); onClose();
    } catch (failure: unknown) {
      const status = (failure as { response?: { status?: number } }).response?.status;
      setConflict(status === 409);
      setError(status === 409 ? 'A configuração mudou. Recarregue para continuar' : status === 403 || status === 401 ? 'Você não pode alterar este pipeline' : 'Não foi possível salvar. Tente novamente.');
    } finally { setBusy(false); }
  };
  return createPortal(<Dialog open onOpenChange={open => { if (!open) close(); }}>
    <DialogContent className="card-configuration-panel" onEscapeKeyDown={event => { event.preventDefault(); close(); }} onPointerDownOutside={event => { event.preventDefault(); close(); }}>
      <header><DialogTitle>Personalizar cartões</DialogTitle><DialogDescription>Aplicado a toda a equipe neste pipeline</DialogDescription><p>{pipeline.name}</p></header>
      <div className="card-configuration-body" aria-busy={busy}>
        {!writable ? <p role="status">Você não pode alterar este pipeline</p> : null}
        <fieldset disabled={busy || !writable}><legend>Campos</legend>
          {definitions.length > 12 ? <input aria-label="Buscar campo" placeholder="Buscar campo" value={query} onChange={event => setQuery(event.target.value)} /> : null}
          {draft.fields.map((field, index) => {
            const definition = definitions.find(entry => entry.id === field.id);
            const label = definition?.label || 'Campo removido';
            if (!label.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR'))) return null;
            return <div className="configuration-field" key={field.id} draggable={!fixedFields.has(field.id) && !busy && writable} onDragStart={() => { dragging.current = field.id; }} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); if (dragging.current) reorder(dragging.current, index); dragging.current = null; }}>
              <label>{!fixedFields.has(field.id) ? <span aria-hidden="true">⠿</span> : null}<input type="checkbox" checked={field.visible} disabled={field.id === 'title' || !definition} onChange={event => setDraft(current => ({ ...current, fields: current.fields.map(entry => entry.id === field.id ? { ...entry, visible: event.target.checked } : entry) }))} /><span>{label}<small>{field.id === 'title' ? 'Sempre visível' : fixedFields.has(field.id) ? 'Fixo no rodapé' : definition?.source === 'contact_attribute' ? 'Contato' : definition?.source === 'deal_attribute' ? 'Negócio' : ''}</small></span></label>
              {!definition ? <button onClick={() => setDraft(current => ({ ...current, fields: current.fields.filter(entry => entry.id !== field.id) }))}>Remover</button> : !fixedFields.has(field.id) ? <><button aria-label={`Subir ${label}`} onClick={() => move(field.id, -1)}>↑</button><button aria-label={`Descer ${label}`} onClick={() => move(field.id, 1)}>↓</button></> : null}
            </div>;
          })}
        </fieldset>
        <fieldset disabled={busy || !writable}><legend>Densidade</legend>{(['comfortable', 'compact'] as const).map(density => <label className="configuration-density" key={density}><input type="radio" name="density" checked={draft.density === density} onChange={() => setDraft(current => ({ ...current, density }))} />{density === 'compact' ? 'Compacta' : 'Confortável'}</label>)}</fieldset>
        {draft.fields.filter(field => field.visible).length > 8 ? <p>Mais campos deixam os cartões mais altos</p> : null}
        <h3>Prévia</h3><div className="configuration-preview"><ConfiguredDealCard item={preview} configuration={draft} definitions={definitions} preview /></div>
      </div>
      <footer>
        {error ? <p role="alert">{error} {conflict ? <button onClick={reload} disabled={busy}>Recarregar</button> : null}</p> : null}
        {discard ? <div role="alert"><p>Descartar alterações?</p><button onClick={() => setDiscard(false)}>Continuar editando</button><button onClick={onClose}>Descartar</button></div> : null}
        <div><button disabled={busy || !writable} onClick={() => setDraft(defaultConfiguration(definitions))}>Restaurar padrão</button><button disabled={busy} onClick={close}>Cancelar</button>{writable ? <button className="configuration-save" disabled={busy || conflict || !dirty} onClick={save}>{busy ? 'Salvando…' : 'Salvar'}</button> : null}</div>
      </footer>
    </DialogContent>
  </Dialog>, document.body);
}
