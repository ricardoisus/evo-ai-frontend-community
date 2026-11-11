import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import type { PipelineItem } from '@/types/analytics/pipelines';
import { defaultConfiguration, nativeFields } from './cardConfiguration';
import ConfiguredDealCard from './ConfiguredDealCard';

const item = { id: 'deal', pipeline_id: 'pipeline', title: 'Título muito longo', value: 0, currency: 'BRL', owner: null, custom_fields: { active: false } } as PipelineItem;
describe('configured board and preview renderer', () => {
  it('renders a real title link, zero value and actionable missing contact', () => {
    render(<MemoryRouter><ConfiguredDealCard item={item} configuration={defaultConfiguration()} definitions={nativeFields} /></MemoryRouter>);
    expect(screen.getByRole('link', {name:item.title})).toHaveAttribute('href','/pipelines/pipeline/deals/deal');
    expect(screen.getByText(/R\$.*0,00/)).toBeInTheDocument();
    expect(screen.getByRole('link', {name:'Vincular contato'})).toHaveAttribute('href','/pipelines/pipeline/deals/deal?tab=contacts');
    expect(screen.getByText('Sem responsável')).toBeInTheDocument();
  });
  it('honors density, hides disabled fields and anchors owner to footer regardless of order', () => {
    const config = defaultConfiguration(); config.density = 'compact'; config.fields.find(field=>field.id==='value')!.visible=false;
    const {container}=render(<MemoryRouter><ConfiguredDealCard item={item} configuration={config} definitions={nativeFields} preview /></MemoryRouter>);
    expect(container.querySelector('.compact')).toBeInTheDocument();
    expect(container.querySelector('.deal-value')).toBeNull();
    expect(container.querySelector('.deal-footer')).toHaveTextContent('Sem responsável');
    expect(screen.queryByRole('link')).toBeNull();
  });
  it('renders message content as text and custom false values without interpreting markup', () => {
    const definitions=[...nativeFields,{id:'deal_attribute:active',label:'Ativo',type:'checkbox',source:'deal_attribute'}];
    const config=defaultConfiguration(definitions); config.fields.forEach(field=>{field.visible=true;});
    const unsafe={...item,latest_message:{id:'message',content:'<img src=x onerror=alert(1)>',message_type:'incoming',created_at:'2026-11-11',conversation_id:'c'}};
    const {container}=render(<MemoryRouter><ConfiguredDealCard item={unsafe} configuration={config} definitions={definitions} preview /></MemoryRouter>);
    expect(container.querySelector('img')).toBeNull(); expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument(); expect(screen.getByText('Não')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Ativo:'));
  });
});
