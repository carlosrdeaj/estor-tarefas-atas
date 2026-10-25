import { useState } from 'react'

type ChipInputProps = {
  label: string
  name: string
  value: string[]
  onChange: (value: string[]) => void
  placeholder: string
}

export function ChipInput({ label, name, value, onChange, placeholder }: ChipInputProps) {
  const [draft, setDraft] = useState('')

  function add(raw: string) {
    const parts = raw
      .split(/[,;\n]/)
      .map((part) => part.trim())
      .filter(Boolean)
    if (parts.length === 0) return
    const next = [...value]
    for (const part of parts) {
      if (!next.some((item) => item.toLowerCase() === part.toLowerCase())) next.push(part)
    }
    onChange(next)
    setDraft('')
  }

  return (
    <label className="field">
      <span>{label}</span>
      <div className="chips">
        {value.map((chip) => (
          <span className="chip" key={chip}>
            {chip}
            <button
              type="button"
              aria-label={`Remover ${chip}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onChange(value.filter((item) => item !== chip))}
            >
              ×
            </button>
          </span>
        ))}
        <input
          name={name}
          value={draft}
          placeholder={value.length === 0 ? placeholder : ''}
          autoComplete="off"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ',') {
              event.preventDefault()
              add(draft)
            } else if (event.key === 'Backspace' && draft === '' && value.length > 0) {
              onChange(value.slice(0, -1))
            }
          }}
          onBlur={() => {
            if (draft.trim()) add(draft)
          }}
        />
      </div>
    </label>
  )
}
