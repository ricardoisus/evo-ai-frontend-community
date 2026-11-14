import { useEffect, useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@evoapi/design-system';
import {
  conversationIA,
  controlIA,
  errorMessage,
  type ConversationIA as IAState,
} from '@/services/agents/vetorialService';
import { Status } from './Shared';
export function ConversationIA({
  id,
  assignee,
  editable,
}: {
  id: string;
  assignee: boolean;
  editable: boolean;
}) {
  const [state, setState] = useState<IAState>();
  const [absent, setAbsent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setState(undefined);
    setAbsent(false);
    setError('');
    const refresh = () =>
      conversationIA(id)
        .then(x => {
          if (active) {
            setState(x);
            setError('');
          }
        })
        .catch(e => {
          if (active) {
            if (e?.response?.status === 404) setAbsent(true);
            else setError(errorMessage(e));
          }
        });
    void refresh();
    const timer = window.setInterval(refresh, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [id, retry]);
  async function control(action: 'pause' | 'resume', clear = false) {
    if (!state) return;
    setBusy(true);
    setError('');
    try {
      await controlIA(id, action, state.version, clear);
      setConfirm(false);
      setRetry(x => x + 1);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  if (absent) return null;
  const label = error
    ? 'IA indisponível'
    : !state
      ? 'Consultando IA…'
      : state.mode === 'off'
        ? 'IA desligada'
        : !state.eligible
          ? 'Fora do piloto'
          : state.paused
            ? 'IA pausada · por pessoa'
            : state.health !== 'healthy'
              ? 'IA indisponível'
              : 'IA atendendo';
  return (
    <aside className="va-conversation" aria-label="Controle interno da IA">
      <div className="va-row va-between">
        <Status value={error ? 'unavailable' : state?.health || 'unavailable'} label={label} />
        {editable && state && (
          <div className="va-row">
            <Button
              variant="outline"
              disabled={busy || state.paused}
              onClick={() => control('pause')}
            >
              Pausar IA
            </Button>
            <Button
              variant="outline"
              disabled={busy || !!error || !state.eligible || state.mode === 'off'}
              onClick={() => (assignee ? setConfirm(true) : control('resume'))}
            >
              Devolver à IA
            </Button>
          </div>
        )}
      </div>
      {state?.reason && (
        <p>
          Somente equipe · Motivo:{' '}
          {{
            pausa_manual: 'Pausa manual',
            human: 'Atendimento humano',
            humano: 'Atendimento humano',
            human_message: 'Mensagem de uma pessoa',
            assignment: 'Responsável humano',
          }[state.reason] || 'Pausa registrada pela equipe'}
        </p>
      )}
      {error && (
        <p role="alert">
          {error}{' '}
          <Button variant="outline" onClick={() => setRetry(x => x + 1)}>
            Atualizar
          </Button>
        </p>
      )}
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent className="va-dialog">
          <DialogHeader>
            <DialogTitle>Devolver à IA?</DialogTitle>
            <DialogDescription>
              O responsável humano será removido. O status e a leitura da conversa serão
              preservados.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(false)}>
              Cancelar
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => control('resume', true)}>
              Remover responsável e devolver
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  );
}
