import { create } from 'zustand'
import {
  adjustZoneSplitRatioByDelta,
  removeZoneLeaf,
  setZoneLeafPanel,
  splitZoneLeaf,
  swapZoneLeafPanels
} from '@/app/layout-studio/layout-zone-ops'
import type { LayoutZoneNode } from '@/app/layout-studio/layout-zone-model'
import type { LayoutStudioPanelId } from '@/app/layout-studio/layout-studio-panel-ids'
import {
  buildZoneTemplate,
  type LayoutZoneTemplateId
} from '@/app/layout-studio/layout-zone-templates'
import {
  createCustomViewId,
  readActiveCustomViewId,
  readCustomViewTopbarOrder,
  readCustomViews,
  reconcileCustomViewTopbarOrder,
  writeActiveCustomViewId,
  writeCustomViewTopbarOrder,
  writeCustomViews,
  type CustomViewDefinition
} from '@/app/custom-views/custom-views-storage'
import { CUSTOM_VIEW_DEFAULT_ICON_ID, normalizeCustomViewIconId } from '@/lib/custom-view-tab-icon'
import { snapshotLocalStorage } from '@/lib/local-storage-snapshot'
import { useAppModeStore } from '@/stores/app-mode'

export const CUSTOM_VIEWS_CHANGED_EVENT = 'mailclient:custom-views-changed'

function notifyChanged(): void {
  window.dispatchEvent(new Event(CUSTOM_VIEWS_CHANGED_EVENT))
}

/** UI-Prefs-Cache für Cloud-Sync (storage-Event feuert nicht im gleichen Fenster). */
async function pushProfileUiPrefsCache(): Promise<void> {
  try {
    await window.mailClient.profileSync.cacheUiPrefs(snapshotLocalStorage())
  } catch {
    // ignore
  }
}

export type CreateCustomViewWizardStep = 1 | 2 | 3

export type CreateCustomViewWizardDraft = {
  step: CreateCustomViewWizardStep
  zoneRoot: LayoutZoneNode
  name: string
  iconId: string
  /** Gesetzt beim Bearbeiten einer bestehenden Ansicht. */
  editingViewId: string | null
}

function cloneZoneRoot(root: LayoutZoneNode): LayoutZoneNode {
  return JSON.parse(JSON.stringify(root)) as LayoutZoneNode
}

type CustomViewEditSnapshot = {
  viewId: string
  zoneRoot: LayoutZoneNode
  name: string
  iconId?: string
}

interface CustomViewsState {
  views: CustomViewDefinition[]
  topbarOrder: string[]
  activeViewId: string | null
  editMode: boolean
  selectedLeafId: string | null
  editSnapshot: CustomViewEditSnapshot | null
  templatePickerOpen: boolean
  wizardOpen: boolean
  wizardDraft: CreateCustomViewWizardDraft | null
  openWizard: () => void
  /** Layout-Labor-Bearbeitung in der Ansicht (kein Assistent). */
  startEditingView: (viewId: string) => void
  focusCustomView: (viewId: string) => void
  toggleViewEditMode: (viewId: string) => void
  openTemplatePickerForView: (viewId: string) => void
  setTemplatePickerOpen: (open: boolean) => void
  ensureEditSnapshot: (viewId: string) => void
  revertViewLayout: (viewId: string) => void
  reorderViews: (orderedIds: readonly string[]) => void
  setEditMode: (edit: boolean) => void
  setSelectedLeafId: (id: string | null) => void
  setActiveViewName: (name: string) => void
  renameView: (viewId: string, name: string) => void
  setViewIcon: (viewId: string, iconId: string | undefined) => void
  setActiveViewZoneRoot: (root: LayoutZoneNode) => void
  setActiveViewZonePanel: (leafId: string, panel: LayoutStudioPanelId) => void
  swapActiveViewZonePanels: (leafIdA: string, leafIdB: string) => void
  splitActiveViewZone: (leafId: string, direction: 'vertical' | 'horizontal') => void
  removeActiveViewZone: (leafId: string) => void
  adjustActiveViewZoneRatio: (splitId: string, deltaPx: number, containerSizePx: number) => void
  applyActiveViewTemplate: (id: LayoutZoneTemplateId) => void
  revertActiveViewLayout: () => void
  closeWizard: () => void
  setWizardStep: (step: CreateCustomViewWizardStep) => void
  setWizardZoneRoot: (root: LayoutZoneNode) => void
  setWizardName: (name: string) => void
  setWizardIconId: (iconId: string | undefined) => void
  setWizardLeafPanel: (leafId: string, panel: LayoutStudioPanelId) => void
  finishWizard: () => CustomViewDefinition | null
  deleteView: (id: string) => void
  setActiveView: (id: string) => void
  getViewById: (id: string) => CustomViewDefinition | undefined
  orderedViews: () => CustomViewDefinition[]
}

function loadState(): Pick<CustomViewsState, 'views' | 'topbarOrder' | 'activeViewId'> {
  const views = readCustomViews()
  return {
    views,
    topbarOrder: reconcileCustomViewTopbarOrder(views, readCustomViewTopbarOrder()),
    activeViewId: readActiveCustomViewId()
  }
}

function persistViews(views: CustomViewDefinition[], notify = true): void {
  writeCustomViews(views)
  if (!notify) return
  void (async (): Promise<void> => {
    await pushProfileUiPrefsCache()
    notifyChanged()
  })()
}

function updateViewInState(
  set: (partial: Partial<CustomViewsState>) => void,
  get: () => CustomViewsState,
  viewId: string,
  patch: Partial<Pick<CustomViewDefinition, 'name' | 'zoneRoot' | 'iconId'>>
): void {
  const views = get().views.map((v) =>
    v.id === viewId
      ? {
          ...v,
          ...patch,
          ...(patch.zoneRoot ? { zoneRoot: cloneZoneRoot(patch.zoneRoot) } : {})
        }
      : v
  )
  set({ views })
  persistViews(views, true)
}

export const useCustomViewsStore = create<CustomViewsState>((set, get) => ({
  ...loadState(),
  editMode: false,
  selectedLeafId: null,
  editSnapshot: null,
  templatePickerOpen: false,
  wizardOpen: false,
  wizardDraft: null,

  openWizard(): void {
    set({
      wizardOpen: true,
      wizardDraft: {
        step: 1,
        zoneRoot: { type: 'leaf', id: 'wizard-root', panel: 'none' },
        name: '',
        iconId: CUSTOM_VIEW_DEFAULT_ICON_ID,
        editingViewId: null
      }
    })
  },

  focusCustomView(viewId): void {
    const view = get().views.find((v) => v.id === viewId)
    if (!view) return
    writeActiveCustomViewId(viewId)
    useAppModeStore.getState().setCustomView(viewId)
    set({ activeViewId: viewId })
  },

  ensureEditSnapshot(viewId): void {
    if (get().editSnapshot?.viewId === viewId) return
    const view = get().views.find((v) => v.id === viewId)
    if (!view) return
    set({
      editSnapshot: {
        viewId,
        zoneRoot: cloneZoneRoot(view.zoneRoot),
        name: view.name,
        iconId: view.iconId
      }
    })
  },

  startEditingView(viewId): void {
    get().focusCustomView(viewId)
    get().ensureEditSnapshot(viewId)
    set({ editMode: true, selectedLeafId: null })
  },

  toggleViewEditMode(viewId): void {
    if (get().activeViewId === viewId && get().editMode) {
      set({ editMode: false, selectedLeafId: null })
      return
    }
    get().startEditingView(viewId)
  },

  openTemplatePickerForView(viewId): void {
    get().focusCustomView(viewId)
    get().ensureEditSnapshot(viewId)
    set({ editMode: true, selectedLeafId: null, templatePickerOpen: true })
  },

  setTemplatePickerOpen(open): void {
    set({ templatePickerOpen: open })
  },

  revertViewLayout(viewId): void {
    const snap = get().editSnapshot
    if (!snap || snap.viewId !== viewId) return
    get().focusCustomView(viewId)
    updateViewInState(set, get, viewId, {
      zoneRoot: cloneZoneRoot(snap.zoneRoot),
      name: snap.name,
      iconId: snap.iconId
    })
    set({ selectedLeafId: null })
  },

  setEditMode(edit): void {
    set({ editMode: edit, selectedLeafId: edit ? get().selectedLeafId : null })
  },

  setSelectedLeafId(id): void {
    set({ selectedLeafId: id })
  },

  setActiveViewName(name): void {
    const id = get().activeViewId
    if (!id) return
    get().renameView(id, name)
  },

  renameView(viewId, name): void {
    const trimmed = name.trim()
    if (!trimmed) return
    updateViewInState(set, get, viewId, { name: trimmed })
    const snap = get().editSnapshot
    if (snap?.viewId === viewId) {
      set({ editSnapshot: { ...snap, name: trimmed } })
    }
  },

  setViewIcon(viewId, iconId): void {
    const normalized = normalizeCustomViewIconId(iconId) ?? CUSTOM_VIEW_DEFAULT_ICON_ID
    updateViewInState(set, get, viewId, { iconId: normalized })
    const snap = get().editSnapshot
    if (snap?.viewId === viewId) {
      set({ editSnapshot: { ...snap, iconId: normalized } })
    }
  },

  setActiveViewZoneRoot(root): void {
    const id = get().activeViewId
    if (!id) return
    updateViewInState(set, get, id, { zoneRoot: cloneZoneRoot(root) })
  },

  setActiveViewZonePanel(leafId, panel): void {
    const id = get().activeViewId
    if (!id) return
    const view = get().views.find((v) => v.id === id)
    if (!view) return
    updateViewInState(set, get, id, {
      zoneRoot: setZoneLeafPanel(view.zoneRoot, leafId, panel)
    })
  },

  swapActiveViewZonePanels(leafIdA, leafIdB): void {
    const id = get().activeViewId
    if (!id) return
    const view = get().views.find((v) => v.id === id)
    if (!view) return
    updateViewInState(set, get, id, {
      zoneRoot: swapZoneLeafPanels(view.zoneRoot, leafIdA, leafIdB)
    })
  },

  splitActiveViewZone(leafId, direction): void {
    const id = get().activeViewId
    if (!id) return
    const view = get().views.find((v) => v.id === id)
    if (!view) return
    updateViewInState(set, get, id, {
      zoneRoot: splitZoneLeaf(view.zoneRoot, leafId, direction)
    })
  },

  removeActiveViewZone(leafId): void {
    const id = get().activeViewId
    if (!id) return
    const view = get().views.find((v) => v.id === id)
    if (!view) return
    updateViewInState(set, get, id, { zoneRoot: removeZoneLeaf(view.zoneRoot, leafId) })
    if (get().selectedLeafId === leafId) set({ selectedLeafId: null })
  },

  adjustActiveViewZoneRatio(splitId, deltaPx, containerSizePx): void {
    const id = get().activeViewId
    if (!id) return
    const view = get().views.find((v) => v.id === id)
    if (!view) return
    updateViewInState(set, get, id, {
      zoneRoot: adjustZoneSplitRatioByDelta(view.zoneRoot, splitId, deltaPx, containerSizePx)
    })
  },

  applyActiveViewTemplate(templateId): void {
    const id = get().activeViewId
    if (!id) return
    updateViewInState(set, get, id, { zoneRoot: buildZoneTemplate(templateId) })
    set({ selectedLeafId: null })
  },

  revertActiveViewLayout(): void {
    const snap = get().editSnapshot
    const id = get().activeViewId
    if (!snap || snap.viewId !== id) return
    updateViewInState(set, get, id!, {
      zoneRoot: cloneZoneRoot(snap.zoneRoot),
      name: snap.name,
      iconId: snap.iconId
    })
    set({ selectedLeafId: null })
  },

  reorderViews(orderedIds): void {
    const views = get().views
    const topbarOrder = reconcileCustomViewTopbarOrder(views, orderedIds)
    writeCustomViewTopbarOrder(topbarOrder)
    notifyChanged()
    set({ topbarOrder })
  },

  closeWizard(): void {
    set({ wizardOpen: false, wizardDraft: null })
  },

  setWizardStep(step): void {
    const draft = get().wizardDraft
    if (!draft) return
    set({ wizardDraft: { ...draft, step } })
  },

  setWizardZoneRoot(zoneRoot): void {
    const draft = get().wizardDraft
    if (!draft) return
    set({ wizardDraft: { ...draft, zoneRoot } })
  },

  setWizardName(name): void {
    const draft = get().wizardDraft
    if (!draft) return
    set({ wizardDraft: { ...draft, name } })
  },

  setWizardIconId(iconId): void {
    const draft = get().wizardDraft
    if (!draft) return
    const normalized = normalizeCustomViewIconId(iconId) ?? CUSTOM_VIEW_DEFAULT_ICON_ID
    set({ wizardDraft: { ...draft, iconId: normalized } })
  },

  setWizardLeafPanel(leafId, panel): void {
    const draft = get().wizardDraft
    if (!draft) return
    set({
      wizardDraft: {
        ...draft,
        zoneRoot: setZoneLeafPanel(draft.zoneRoot, leafId, panel)
      }
    })
  },

  finishWizard(): CustomViewDefinition | null {
    const draft = get().wizardDraft
    if (!draft) return null
    const name = draft.name.trim()
    if (!name) return null

    const iconId = normalizeCustomViewIconId(draft.iconId) ?? CUSTOM_VIEW_DEFAULT_ICON_ID

    if (draft.editingViewId) {
      const views = get().views.map((v) =>
        v.id === draft.editingViewId
          ? { ...v, name, iconId, zoneRoot: cloneZoneRoot(draft.zoneRoot) }
          : v
      )
      const updated = views.find((v) => v.id === draft.editingViewId)
      if (!updated) return null
      set({ views, wizardOpen: false, wizardDraft: null })
      writeCustomViews(views)
      void (async (): Promise<void> => {
        await pushProfileUiPrefsCache()
        notifyChanged()
      })()
      return updated
    }

    const view: CustomViewDefinition = {
      id: createCustomViewId(),
      name,
      iconId,
      zoneRoot: draft.zoneRoot,
      createdAt: Date.now()
    }

    const views = [...get().views, view]
    const topbarOrder = [...get().topbarOrder, view.id]
    set({
      views,
      topbarOrder,
      activeViewId: view.id,
      wizardOpen: false,
      wizardDraft: null
    })
    writeCustomViews(views)
    writeCustomViewTopbarOrder(topbarOrder)
    writeActiveCustomViewId(view.id)
    void (async (): Promise<void> => {
      await pushProfileUiPrefsCache()
      notifyChanged()
    })()

    useAppModeStore.getState().setCustomView(view.id)
    return view
  },

  deleteView(id): void {
    const views = get().views.filter((v) => v.id !== id)
    const topbarOrder = get().topbarOrder.filter((x) => x !== id)
    const wasActive = get().activeViewId === id
    const nextActiveId = wasActive ? null : get().activeViewId
    set({ views, topbarOrder, activeViewId: nextActiveId })
    writeCustomViews(views)
    writeCustomViewTopbarOrder(topbarOrder)
    writeActiveCustomViewId(nextActiveId)
    void (async (): Promise<void> => {
      await pushProfileUiPrefsCache()
      notifyChanged()
    })()

    if (wasActive && useAppModeStore.getState().mode === 'customView') {
      useAppModeStore.getState().setMode('home')
    }
  },

  setActiveView(id): void {
    writeActiveCustomViewId(id)
    set({ activeViewId: id, editMode: false, selectedLeafId: null })
    useAppModeStore.getState().setCustomView(id)
  },

  getViewById(id): CustomViewDefinition | undefined {
    return get().views.find((v) => v.id === id)
  },

  orderedViews(): CustomViewDefinition[] {
    const { views, topbarOrder } = get()
    const byId = new Map(views.map((v) => [v.id, v]))
    return topbarOrder
      .map((id) => byId.get(id))
      .filter((v): v is CustomViewDefinition => v != null)
  }
}))
