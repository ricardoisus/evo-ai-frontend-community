import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PipelineBoardLoading from './PipelineBoardLoading';
import { rememberStageCount } from './pipelineStageCount';

describe('board loading stage count', () => {
  beforeEach(() => { sessionStorage.clear(); vi.restoreAllMocks(); });
  it('uses three stages on first visit and the last successful count per pipeline', () => {
    const { rerender, container } = render(<PipelineBoardLoading pipelineId="one" />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(container.querySelectorAll('.kanban-column')).toHaveLength(3);
    rememberStageCount('one', 6); rememberStageCount('two', 2);
    rerender(<PipelineBoardLoading pipelineId="one" />);
    expect(container.querySelectorAll('.kanban-column')).toHaveLength(6);
    rerender(<PipelineBoardLoading pipelineId="two" />);
    expect(container.querySelectorAll('.kanban-column')).toHaveLength(2);
    rememberStageCount('two', 0);
    rerender(<PipelineBoardLoading pipelineId="two" />);
    expect(container.querySelectorAll('.kanban-column')).toHaveLength(0);
  });
  it('survives unavailable storage and rejects corrupt counts', () => {
    sessionStorage.setItem('pipeline-stage-count:one', 'NaN');
    const { container, rerender } = render(<PipelineBoardLoading pipelineId="one" />);
    expect(container.querySelectorAll('.kanban-column')).toHaveLength(3);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('disabled'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('disabled'); });
    expect(() => rememberStageCount('one', 6)).not.toThrow();
    rerender(<PipelineBoardLoading pipelineId="one" />);
    expect(container.querySelectorAll('.kanban-column')).toHaveLength(3);
  });
});
