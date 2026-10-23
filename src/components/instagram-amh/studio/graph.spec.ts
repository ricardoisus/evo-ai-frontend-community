import { describe, it, expect } from 'vitest';
import { initialStudioGraph, localIssues, changesBetween, toStudioGraph } from './graph';
import { initialGraph } from '../contract';
describe('Instagram graph editing', () => {
  it('starts with a complete safe graph and converts legacy drafts without mutating published data', () => {
    expect(localIssues(initialStudioGraph('90001'))).toEqual([]);
    const legacy = initialGraph(); const before = structuredClone(legacy);
    const converted = toStudioGraph(legacy);
    expect(converted.schema_version).toBe(2); expect(legacy).toEqual(before);
    expect(converted.nodes.some(n => n.type === 'confirmation')).toBe(true);
  });
  it('identifies disconnected outputs, cycles and a missing real confirmation', () => {
    const graph = initialStudioGraph('90001');
    graph.edges.find(e => e.source === 'like' && e.sourceHandle === 'success')!.target = 'delivery';
    expect(localIssues(graph).some(i => i.field === 'safety' && i.message.includes('clique real'))).toBe(true);
    graph.edges.find(e => e.source === 'keyword' && e.sourceHandle === 'match')!.target = 'scope';
    expect(localIssues(graph).some(i => i.message.includes('ciclo'))).toBe(true);
  });
  it('distinguishes a message edit from a visual layout change in the review', () => {
    const graph = initialStudioGraph('90001'); const changed = structuredClone(graph);
    changed.nodes[0].position.x = 500;
    expect(changesBetween(graph, changed)).toEqual(['Organização visual dos blocos']);
    changed.nodes.find(n => n.type === 'invitation')!.data.text = 'Outra mensagem';
    expect(changesBetween(graph, changed)).toContain('Configuração: Convite no Direct');
  });
});
