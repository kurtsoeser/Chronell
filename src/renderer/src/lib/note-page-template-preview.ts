import type { Locale } from 'date-fns'
import type { NotePlannerTemplateKind } from '@/lib/note-page-templates'
import { resolveNotePageTemplate } from '@/lib/note-page-templates'
import {
  buildInstantStructuredTemplateOverride,
  buildPlannerTemplateBody,
  isInstantStructuredTemplateId,
  isParametricPlannerTemplateId,
  type NotePlannerBuildOptions
} from '@/lib/note-planner-templates'
import { prepareNoteEditorHtml } from '@/lib/sanitize-compose-html'

function preparePreviewHtml(html: string): string {
  if (typeof window === 'undefined') return html
  return prepareNoteEditorHtml(html)
}

/** Festes Beispieldatum für Planer-Vorschauen (Juli 2026). */
export const NOTE_TEMPLATE_PREVIEW_SAMPLE_DATE = new Date(2026, 6, 6)

const PARAMETRIC_PREVIEW_ANCHOR: Record<NotePlannerTemplateKind, Date> = {
  weeklyOverview: NOTE_TEMPLATE_PREVIEW_SAMPLE_DATE,
  monthlyOverview: new Date(2026, 6, 1),
  monthlyFitnessTracker: new Date(2026, 6, 1),
  dailyPlanner: new Date(2026, 6, 4)
}

export function buildNotePageTemplatePreviewHtml(
  templateId: string,
  customTemplates: readonly { id: string; name: string; description: string; bodyHtml: string }[],
  translate: (key: string) => string,
  plannerOptions: NotePlannerBuildOptions
): string | null {
  if (templateId === 'blank') return null

  if (isInstantStructuredTemplateId(templateId)) {
    return preparePreviewHtml(
      buildInstantStructuredTemplateOverride(templateId, translate).bodyHtml
    )
  }

  if (isParametricPlannerTemplateId(templateId)) {
    const anchor = PARAMETRIC_PREVIEW_ANCHOR[templateId]
    return preparePreviewHtml(
      buildPlannerTemplateBody(templateId, anchor, plannerOptions)
    )
  }

  const resolved = resolveNotePageTemplate(templateId, customTemplates, translate)
  const html = resolved.bodyHtml.trim()
  if (!html) return null
  return preparePreviewHtml(html)
}

export function notePageTemplatePreviewScale(templateId: string): number {
  if (
    templateId === 'monthlyFitnessTracker' ||
    templateId === 'studentAttendanceList' ||
    templateId === 'weeklyOverview'
  ) {
    return 0.22
  }
  if (templateId === 'dailyPlanner') return 0.28
  if (templateId === 'monthlyOverview') return 0.32
  if (templateId === 'weeklyTimetable') return 0.38
  return 0.42
}
