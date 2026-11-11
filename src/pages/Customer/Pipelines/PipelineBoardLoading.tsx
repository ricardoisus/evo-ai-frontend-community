import { previousStageCount } from './pipelineStageCount';

export default function PipelineBoardLoading({ pipelineId }: { pipelineId?: string }) {
  return <div className="pipeline-board-root board-loading" aria-busy="true" role="status" aria-label="Carregando quadro">
    <span className="sr-only">Carregando quadro…</span>
    <div className="board-loading-header" aria-hidden="true"><i /><i /></div>
    <div className="board-loading-columns" aria-hidden="true">{Array.from({ length: previousStageCount(pipelineId) }, (_, index) => <div className="kanban-column kanban-column-surface" key={index}>
      <div className="board-loading-stage"><i /></div>
      {[0, 1, 2].map(card => <div className="board-loading-card" key={card}><i /><i /><i /></div>)}
    </div>)}</div>
  </div>;
}
