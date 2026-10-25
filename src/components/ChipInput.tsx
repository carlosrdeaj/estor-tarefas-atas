import { useState } from "react";

export function ChipInput({
  label,
  values,
  onChange,
  placeholder,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");

  function add(raw: string) {
    const parts = raw
      .split(/[,;\n]/)
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    const next = [...values];
    for (const part of parts) {
      if (!next.some((value) => value.toLocaleLowerCase("pt-BR") === part.toLocaleLowerCase("pt-BR"))) next.push(part);
    }
    onChange(next);
    setDraft("");
  }

  return (
    <label className="field">
      <span>{label}</span>
      <div className="chips">
        {values.map((value) => (
          <span className="chip" key={value}>
            {value}
            <button type="button" aria-label={`Remover ${value}`} onClick={() => onChange(values.filter((item) => item !== value))}>
              ×
            </button>
          </span>
        ))}
        <input
          value={draft}
          placeholder={values.length === 0 ? placeholder : "Adicionar"}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              add(draft);
            } else if (event.key === "Backspace" && draft === "" && values.length > 0) {
              onChange(values.slice(0, -1));
            }
          }}
          onBlur={() => {
            if (draft.trim()) add(draft);
          }}
        />
      </div>
    </label>
  );
}
