import React, { useEffect, useRef, useState } from 'react';

import {
  MessageSquareText,
  FileText,
  Image,
  StickyNote,
  CalendarClock,
  LayoutTemplate,
} from 'lucide-react';

import { useLanguage } from '@/hooks/useLanguage';

interface ComposerPlusMenuProps {
  disabled?: boolean;
  onOpenQuickReplies: () => void;
  onPickDocuments: () => void;
  onPickMedia: () => void;
  onOpenConversationNote: () => void;
  onSchedule: () => void;
  /** WhatsApp Cloud templates — sem equivalente no protótipo, mantido como 6º item quando disponível. */
  onOpenTemplates?: () => void;
}

const ITEM_ICON_BOX =
  'w-[34px] h-[34px] rounded-[9px] bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary';

/**
 * Menu "+" do composer — popover custom (não Dropdown genérico), estilo/cores
 * do protótipo de referência (Melhorias CRM Chat §3.8): abre pra cima,
 * cada item com ícone em um tile de acento. Ordem fixa: Mensagens
 * Rápidas, Documentos, Fotos e Vídeos, Notas da Conversa, Agendar.
 */
const ComposerPlusMenu: React.FC<ComposerPlusMenuProps> = ({
  disabled = false,
  onOpenQuickReplies,
  onPickDocuments,
  onPickMedia,
  onOpenConversationNote,
  onSchedule,
  onOpenTemplates,
}) => {
  const { t } = useLanguage('chat');
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const items = [
    {
      key: 'rapidas',
      label: t('messageInput.composerMenu.quickReplies'),
      icon: <MessageSquareText className="h-4 w-4" />,
      onClick: onOpenQuickReplies,
    },
    {
      key: 'docs',
      label: t('messageInput.composerMenu.documents'),
      icon: <FileText className="h-4 w-4" />,
      onClick: onPickDocuments,
    },
    {
      key: 'midia',
      label: t('messageInput.composerMenu.media'),
      icon: <Image className="h-4 w-4" />,
      onClick: onPickMedia,
    },
    {
      key: 'notas',
      label: t('messageInput.composerMenu.conversationNote'),
      icon: <StickyNote className="h-4 w-4" />,
      onClick: onOpenConversationNote,
    },
    {
      key: 'agendar',
      label: t('messageInput.composerMenu.schedule'),
      icon: <CalendarClock className="h-4 w-4" />,
      onClick: onSchedule,
    },
    ...(onOpenTemplates
      ? [
          {
            key: 'templates',
            label: t('messageTemplates.button.title'),
            icon: <LayoutTemplate className="h-4 w-4" />,
            onClick: onOpenTemplates,
          },
        ]
      : []),
  ];

  return (
    <div ref={rootRef} className="relative flex-shrink-0" style={{ position: 'relative' }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(prev => !prev)}
        aria-label={t('messageInput.composerMenu.tooltip')}
        aria-expanded={open}
        aria-haspopup="menu"
        className="h-9 w-9 flex items-center justify-center rounded-md hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className="text-primary">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          aria-label={t('messageInput.composerMenu.tooltip')}
          className="absolute bottom-11 -left-1.5 z-[100] w-[248px] rounded-[14px] border border-border bg-popover p-[7px] text-popover-foreground shadow-[0_16px_40px_rgba(0,0,0,.28)]"
        >
          {items.map(item => (
            <button
              type="button"
              role="menuitem"
              key={item.key}
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
              className="flex w-full cursor-pointer items-center gap-3 rounded-[10px] px-2.5 py-[9px] text-left transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className={ITEM_ICON_BOX}>{item.icon}</span>
              <span className="text-[14.5px] font-medium text-popover-foreground">{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ComposerPlusMenu;
