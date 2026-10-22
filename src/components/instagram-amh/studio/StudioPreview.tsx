import { useState } from 'react';
import { ArrowLeft, MoreHorizontal, Instagram, RotateCcw } from 'lucide-react';
import type { StudioGraph } from './graph';
export function StudioPreview({ graph, label }: { graph: StudioGraph; label: string }) {
  const [confirmed, setConfirmed] = useState(false);
  const [variant, setVariant] = useState(0);
  const invitation = graph.nodes.find(n => n.type === 'invitation');
  const delivery = graph.nodes.find(n => n.type === 'delivery');
  const variants = graph.nodes.find(n => n.type === 'public_reply')?.data.variants || [];
  const render = (text?: string) => text?.split('{{primeiro_nome}}').join('Jonas') || 'Configure a mensagem neste bloco.';
  return <div className="studio-preview"><span className="studio-eyebrow">PRÉVIA INTERATIVA</span><h2>Como a pessoa recebe</h2><p className="studio-preview-label">{label} · nenhum envio real</p>
    <div className="studio-comment"><Instagram size={16} /><div><strong>Jonas · exemplo</strong><p>Quero AMH!</p>{variants.length > 0 && <><blockquote>{variants[variant % variants.length]}</blockquote>{variants.length > 1 && <button onClick={() => setVariant(v => v + 1)}>Ver outra variação</button>}</>}</div></div>
    <div className="studio-phone"><header><ArrowLeft size={16} /><span className="studio-avatar">IG</span><div><strong>Seu perfil</strong><small>Instagram Direct</small></div><MoreHorizontal size={20} /></header><div className="studio-phone-body"><small>HOJE · EXEMPLO ILUSTRATIVO</small><div className="studio-bubble">{render(invitation?.data.text)}</div><button className="studio-quick-reply" onClick={() => setConfirmed(true)}>Pode enviar</button>{confirmed && <><div className="studio-incoming">Pode enviar</div><div className="studio-bubble">{render(delivery?.data.text)}<button disabled>{delivery?.data.buttonLabel || 'Acessar material'}</button></div></>}</div></div>
    <button className="studio-text-button" onClick={() => setConfirmed(false)}><RotateCcw size={14} /> Reiniciar prévia</button><small>Em fluxos com ramificações, esta prévia ilustra as primeiras mensagens configuradas. Use a simulação para conferir o caminho e o material de um conteúdo específico.</small>
  </div>;
}
