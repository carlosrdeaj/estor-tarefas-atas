import { z } from "zod";
import { isRealDate, isRealDateTime } from "../shared/dates";
import { PRIORITIES, STATUSES } from "../shared/types";

function requiredDueDate(value: string | null | undefined, ctx: z.RefinementCtx): string | null {
  if (value == null || value === "") return null;
  if (!isRealDate(value)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Data inválida." });
    return z.NEVER;
  }
  return value;
}

const createDueDate = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value, ctx) => requiredDueDate(value, ctx));

const patchDueDate = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value, ctx): string | null | undefined => {
    if (value === undefined) return undefined;
    return requiredDueDate(value, ctx);
  });

const tagsSchema = z.array(z.string().trim().min(1, "Tag vazia.").max(40, "Tag longa demais.")).max(12, "No máximo 12 tags.");

export const taskCreateSchema = z.object({
  title: z.string({ required_error: "Informe um título." }).trim().min(1, "Informe um título.").max(200, "O título é longo demais."),
  description: z.string().trim().max(5000, "A descrição é longa demais.").optional().default(""),
  status: z.enum(STATUSES).optional().default("todo"),
  priority: z.enum(PRIORITIES).optional().default("medium"),
  dueDate: createDueDate,
  assignee: z.string().trim().max(120, "O nome do responsável é longo demais.").optional().default(""),
  tags: tagsSchema.optional().default([]),
});

export const taskPatchSchema = z
  .object({
    title: z.string().trim().min(1, "Informe um título.").max(200, "O título é longo demais.").optional(),
    description: z.string().trim().max(5000, "A descrição é longa demais.").optional(),
    status: z.enum(STATUSES).optional(),
    priority: z.enum(PRIORITIES).optional(),
    dueDate: patchDueDate,
    assignee: z.string().trim().max(120, "O nome do responsável é longo demais.").optional(),
    tags: tagsSchema.optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), "Nada para atualizar.");

export const reorderSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().uuid("Tarefa inválida."),
        status: z.enum(STATUSES),
        position: z.number().int().min(0).max(100000),
      }),
    )
    .min(1, "Nenhuma tarefa para reordenar.")
    .max(500),
});

const actionItemSchema = z.object({
  id: z.string().uuid("Item de ação inválido.").optional(),
  title: z.string().trim().min(1, "Informe o item de ação.").max(200, "O item de ação é longo demais."),
  assignee: z.string().trim().max(120, "O nome do responsável é longo demais.").optional().default(""),
  dueDate: createDueDate,
  priority: z.enum(PRIORITIES).optional().default("medium"),
});

export const meetingSchema = z.object({
  title: z.string({ required_error: "Informe um título." }).trim().min(1, "Informe um título.").max(200, "O título é longo demais."),
  startsAt: z
    .string({ required_error: "Informe data e hora." })
    .refine((value) => isRealDateTime(value), "Data ou hora inválida."),
  participants: z.array(z.string().trim().min(1).max(120)).max(30, "No máximo 30 participantes.").optional().default([]),
  agenda: z.string().max(20000, "A pauta é longa demais.").optional().default(""),
  notes: z.string().max(20000, "As notas são longas demais.").optional().default(""),
  decisions: z.array(z.string().trim().min(1, "Decisão vazia.").max(2000)).max(30, "No máximo 30 decisões.").optional().default([]),
  actionItems: z.array(actionItemSchema).max(30, "No máximo 30 itens de ação.").optional().default([]),
});
