import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { InstagramStudio } from './InstagramStudio';
import { initialStudioGraph } from './graph';

vi.mock('./useStudioDraft', () => ({ useStudioDraft: () => ({
  graph: initialStudioGraph('account'), name: 'Automação de exemplo', status: 'saved',
  change: vi.fn(), rename: vi.fn(), unsaved: false,
}) }));
vi.mock('./StudioCanvas', () => ({ StudioCanvas: ({ select }: { select: (id: string) => void }) => <button onClick={() => select('keyword')}>Selecionar condição no canvas</button> }));
vi.mock('./StudioPreview', () => ({ StudioPreview: () => <div>Conversa ilustrativa</div> }));

describe('Studio inspector', () => {
  it('starts collapsed, toggles panels and reopens properties when selecting a block', () => {
    render(<InstagramStudio catalog={null} permissions={{ create: true, edit: true, publish: true }} onBack={vi.fn()} />);
    const properties = screen.getByRole('button', { name: 'Propriedades' });
    expect(screen.queryByRole('complementary')).toBeNull();
    fireEvent.click(properties);
    expect(properties.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('complementary', { name: 'Propriedades' })).toBeTruthy();
    fireEvent.click(properties);
    expect(screen.queryByRole('complementary')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Prévia' }));
    expect(screen.getByText('Conversa ilustrativa')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Recolher painel' }));
    expect(screen.queryByRole('complementary')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Selecionar condição no canvas' }));
    expect(screen.getByRole('complementary', { name: 'Propriedades' })).toBeTruthy();
  });
});
