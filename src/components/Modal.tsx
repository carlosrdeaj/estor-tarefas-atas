import { useEffect, useId, useRef, type ReactNode } from 'react'

let locks = 0
const closers: Array<() => void> = []

function useScrollLock() {
  useEffect(() => {
    locks += 1
    document.body.classList.add('modal-open')
    return () => {
      locks -= 1
      if (locks === 0) document.body.classList.remove('modal-open')
    }
  }, [])
}

function useEscape() {
  const onCloseRef = useRef<() => void>(() => {})
  useEffect(() => {
    const close = () => onCloseRef.current()
    closers.push(close)
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      if (closers[closers.length - 1] !== close) return
      event.preventDefault()
      close()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      const index = closers.lastIndexOf(close)
      if (index >= 0) closers.splice(index, 1)
    }
  }, [])
  return onCloseRef
}

type ModalProps = {
  title: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}

export function Modal({ title, onClose, children, wide }: ModalProps) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useEscape()
  onCloseRef.current = onClose
  useScrollLock()

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    panelRef.current?.querySelector<HTMLElement>('input, textarea, select, button')?.focus()
    return () => previous?.focus()
  }, [])

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        ref={panelRef}
        className={wide ? 'modal wide' : 'modal'}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="btn ghost" onClick={onClose}>
            Fechar
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

type ConfirmProps = {
  title: string
  message: string
  confirmLabel: string
  busy?: boolean
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmDialog({ title, message, confirmLabel, busy, onConfirm, onClose }: ConfirmProps) {
  return (
    <Modal title={title} onClose={onClose}>
      <p>{message}</p>
      <div className="form-actions">
        <button type="button" className="btn" onClick={onClose} disabled={busy}>
          Cancelar
        </button>
        <button type="button" className="btn danger-solid" onClick={onConfirm} disabled={busy}>
          {busy ? 'Excluindo…' : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
