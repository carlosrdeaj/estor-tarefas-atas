import { useEffect } from "react";

export function useTitle(title: string) {
  useEffect(() => {
    document.title = title === "Nexo" ? "Nexo — tarefas e atas" : `${title} — Nexo`;
  }, [title]);
}
