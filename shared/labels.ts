import { PRIORITIES, STATUSES, type Priority, type Status } from "./types";

export const STATUS_LABEL: Record<Status, string> = {
  todo: "A fazer",
  in_progress: "Em andamento",
  done: "Concluída",
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
};

export function isStatus(value: string): value is Status {
  return (STATUSES as readonly string[]).includes(value);
}

export function isPriority(value: string): value is Priority {
  return (PRIORITIES as readonly string[]).includes(value);
}
