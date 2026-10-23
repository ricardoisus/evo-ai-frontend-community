import { useEffect, useRef, type ReactNode } from 'react';
export function StudioModal({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    return () => { dialog?.close(); previous?.focus(); };
  }, []);
  return <dialog ref={ref} className="studio-native-dialog" aria-labelledby="studio-dialog-title" onCancel={e => { e.preventDefault(); onClose(); }}><section className="studio-dialog">{children}</section></dialog>;
}
