import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { EditorView } from 'prosemirror-view';
import { toggleMark, wrapIn } from 'prosemirror-commands';
import { wrapInList } from 'prosemirror-schema-list';
import { Bold, Italic, Strikethrough, Code, ListOrdered, List, Quote } from 'lucide-react';

import { messageSchema } from './schema';
import { cn } from '@/lib/utils';

export interface BubbleMenuRect {
  top: number;
  left: number;
}

interface FormattingBubbleMenuProps {
  view: EditorView;
  rect: BubbleMenuRect;
  onClose: () => void;
}

const ITEM_BOX = 'h-9 w-9 flex items-center justify-center rounded-md flex-shrink-0 transition-colors';

/**
 * Ancorado no topo-centro da seleção via `translate(-50%, calc(-100% - 8px))`
 * para não depender de medir a altura do próprio menu (mount-time layout
 * ainda não tem essa medida). Portal pro body: `coordsAtPos` é viewport-relative
 * e `.prosemirror-editor` tem overflow-y-auto que cortaria um menu absolute.
 */
const FormattingBubbleMenu: React.FC<FormattingBubbleMenuProps> = ({ view, rect, onClose }) => {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  const { state, dispatch } = view;
  const { from, to } = state.selection;

  const isMarkActive = (markType: typeof messageSchema.marks.strong) =>
    state.doc.rangeHasMark(from, to, markType);

  const runMarkCommand = (command: (state: typeof view.state, dispatch: typeof view.dispatch) => boolean) => {
    command(view.state, dispatch);
    view.focus();
  };

  const items = [
    {
      key: 'bold',
      label: 'Negrito',
      icon: <Bold className="h-4 w-4" />,
      active: isMarkActive(messageSchema.marks.strong),
      onClick: () => runMarkCommand(toggleMark(messageSchema.marks.strong)),
    },
    {
      key: 'italic',
      label: 'Itálico',
      icon: <Italic className="h-4 w-4" />,
      active: isMarkActive(messageSchema.marks.em),
      onClick: () => runMarkCommand(toggleMark(messageSchema.marks.em)),
    },
    {
      key: 'strike',
      label: 'Tachado',
      icon: <Strikethrough className="h-4 w-4" />,
      active: isMarkActive(messageSchema.marks.strike),
      onClick: () => runMarkCommand(toggleMark(messageSchema.marks.strike)),
    },
    {
      key: 'code',
      label: 'Código',
      icon: <Code className="h-4 w-4" />,
      active: isMarkActive(messageSchema.marks.code),
      onClick: () => runMarkCommand(toggleMark(messageSchema.marks.code)),
    },
    {
      key: 'orderedList',
      label: 'Lista numerada',
      icon: <ListOrdered className="h-4 w-4" />,
      active: false,
      onClick: () => runMarkCommand(wrapInList(messageSchema.nodes.ordered_list)),
    },
    {
      key: 'bulletList',
      label: 'Lista',
      icon: <List className="h-4 w-4" />,
      active: false,
      onClick: () => runMarkCommand(wrapInList(messageSchema.nodes.bullet_list)),
    },
    {
      key: 'quote',
      label: 'Citação',
      icon: <Quote className="h-4 w-4" />,
      active: false,
      onClick: () => runMarkCommand(wrapIn(messageSchema.nodes.blockquote)),
    },
  ];

  return createPortal(
    <div
      ref={rootRef}
      style={{
        position: 'fixed',
        top: rect.top,
        left: rect.left,
        transform: 'translate(-50%, calc(-100% - 8px))',
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        borderRadius: 12,
        padding: 5,
        zIndex: 100,
      }}
      role="toolbar"
      aria-label="Formatação do texto selecionado"
      className="border border-border bg-popover text-popover-foreground shadow-[0_16px_40px_rgba(0,0,0,.3)]"
    >
      {items.map(item => (
        <button
          key={item.key}
          type="button"
          title={item.label}
          aria-label={item.label}
          aria-pressed={item.active}
          onMouseDown={e => e.preventDefault()}
          onClick={item.onClick}
          className={cn(
            ITEM_BOX,
            'cursor-pointer border-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            item.active
              ? 'bg-primary/15 text-primary'
              : 'bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground',
          )}
        >
          {item.icon}
        </button>
      ))}
    </div>,
    document.body,
  );
};

export default FormattingBubbleMenu;
