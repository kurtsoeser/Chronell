import type { EntityGraphClusterMode, EntityGraphEdge, EntityGraphNode } from '@shared/entity-links'
import { resolveLayoutClusterKey } from '@/app/connections/connections-cluster-keys'
import { computeConnectedComponentKeys } from '@/app/connections/graph-components'

export interface MeasuredGraphNode {
  key: string
  node: EntityGraphNode
  w: number
  h: number
  titleLines: string[]
  subtitleLine: string | null
  layoutClusterKey: string
}

export interface LayoutNode extends MeasuredGraphNode {
  x: number
  y: number
}

export interface ClusterHull {
  key: string
  x: number
  y: number
  w: number
  h: number
  label: string
}

const MAX_TITLE_CHARS = 26
const MIN_NODE_W = 108
const MAX_NODE_W = 220
const NODE_PAD_X = 10
const NODE_PAD_Y = 8
const LINE_H = 12
const TITLE_LINES_MAX = 2

/** Hull-Padding wie in `computeClusterHulls` — fuer Insel-Trennung. */
const CLUSTER_HULL_PAD_X = 22
const CLUSTER_HULL_PAD_TOP = 32
const CLUSTER_HULL_PAD_BOTTOM = 22
/** Mindestabstand zwischen Insel-Rahmen nur bei echter Überlappung. */
const CLUSTER_ISLAND_GAP = 6

function wrapLine(text: string, maxChars: number): string[] {
  const t = text.trim()
  if (!t) return ['—']
  if (t.length <= maxChars) return [t]
  const words = t.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let cur = ''
  for (const word of words) {
    const next = cur ? `${cur} ${word}` : word
    if (next.length <= maxChars) {
      cur = next
    } else {
      if (cur) lines.push(cur)
      cur = word.length > maxChars ? `${word.slice(0, maxChars - 1)}…` : word
    }
    if (lines.length >= TITLE_LINES_MAX) break
  }
  if (lines.length < TITLE_LINES_MAX && cur) lines.push(cur)
  if (lines.length === 0) return [t.slice(0, maxChars)]
  if (lines.length === TITLE_LINES_MAX) {
    const last = lines[TITLE_LINES_MAX - 1]!
    if (t.length > lines.join(' ').length && !last.endsWith('…')) {
      lines[TITLE_LINES_MAX - 1] =
        last.length > maxChars - 1 ? `${last.slice(0, maxChars - 2)}…` : `${last}…`
    }
  }
  return lines
}

export function measureGraphNode(
  node: EntityGraphNode,
  clusterMode: EntityGraphClusterMode,
  componentByKey?: Map<string, string>
): MeasuredGraphNode {
  const titleLines = wrapLine(node.title, MAX_TITLE_CHARS)
  const subtitleLine = node.subtitle?.trim()
    ? wrapLine(node.subtitle, MAX_TITLE_CHARS)[0] ?? null
    : null
  const textW = Math.max(
    ...titleLines.map((l) => l.length),
    subtitleLine?.length ?? 0,
    6
  )
  const w = Math.min(MAX_NODE_W, Math.max(MIN_NODE_W, textW * 6.2 + NODE_PAD_X * 2))
  const h =
    NODE_PAD_Y * 2 +
    14 +
    titleLines.length * LINE_H +
    (subtitleLine ? LINE_H + 2 : 0)
  const layoutClusterKey = resolveLayoutClusterKey(
    node,
    clusterMode,
    componentByKey?.get(node.key)
  )
  return {
    key: node.key,
    node,
    w,
    h,
    titleLines,
    subtitleLine,
    layoutClusterKey
  }
}

/** Alle Cluster starten in der Mitte — kein Ring-/Raster-Start. */
function layoutClusterCentroids(
  clusterKeys: string[],
  width: number,
  height: number
): Map<string, { cx: number; cy: number }> {
  const cx0 = width / 2
  const cy0 = height / 2
  const out = new Map<string, { cx: number; cy: number }>()
  for (const key of clusterKeys) {
    out.set(key, { cx: cx0, cy: cy0 })
  }
  return out
}

export type ForceLayoutOptions = {
  /** Knoten mit fixer Position (gespeicherter Graph-Stand). */
  pinnedKeys?: ReadonlySet<string>
  /** Cluster ohne Schwerkraft zur Mitte (manuell verschobene Inseln). */
  manualClusterKeys?: ReadonlySet<string>
}

export function applyClusterIslandOffsets(
  layout: LayoutNode[],
  offsets: Readonly<Record<string, { dx: number; dy: number }>>
): LayoutNode[] {
  if (Object.keys(offsets).length === 0) return layout
  return layout.map((n) => {
    const o = offsets[n.layoutClusterKey]
    if (!o || (o.dx === 0 && o.dy === 0)) return n
    return { ...n, x: n.x + o.dx, y: n.y + o.dy }
  })
}

function layoutClusterBox(
  nodes: LayoutNode[]
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  if (nodes.length === 0) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const n of nodes) {
    minX = Math.min(minX, n.x - n.w / 2)
    minY = Math.min(minY, n.y - n.h / 2)
    maxX = Math.max(maxX, n.x + n.w / 2)
    maxY = Math.max(maxY, n.y + n.h / 2)
  }
  return {
    minX: minX - CLUSTER_HULL_PAD_X,
    minY: minY - CLUSTER_HULL_PAD_TOP,
    maxX: maxX + CLUSTER_HULL_PAD_X,
    maxY: maxY + CLUSTER_HULL_PAD_BOTTOM
  }
}

/** Verschiebt ganze Cluster, bis ihre Insel-Rahmen nicht mehr ueberlappen. */
function separateLayoutClusters(sim: LayoutNode[], spacingScale: number): void {
  const byKey = new Map<string, LayoutNode[]>()
  for (const n of sim) {
    const list = byKey.get(n.layoutClusterKey) ?? []
    list.push(n)
    byKey.set(n.layoutClusterKey, list)
  }
  if (byKey.size < 2) return

  type Island = {
    key: string
    nodes: LayoutNode[]
    minX: number
    minY: number
    maxX: number
    maxY: number
    dx: number
    dy: number
  }

  const islands: Island[] = []
  for (const [key, nodes] of byKey) {
    const box = layoutClusterBox(nodes)
    if (!box) continue
    islands.push({ key, nodes, ...box, dx: 0, dy: 0 })
  }
  if (islands.length < 2) return

  const gap = CLUSTER_ISLAND_GAP * spacingScale

  for (let iter = 0; iter < 48; iter++) {
    let moved = false
    for (let i = 0; i < islands.length; i++) {
      for (let j = i + 1; j < islands.length; j++) {
        const a = islands[i]!
        const b = islands[j]!
        const aMinX = a.minX + a.dx
        const aMinY = a.minY + a.dy
        const aMaxX = a.maxX + a.dx
        const aMaxY = a.maxY + a.dy
        const bMinX = b.minX + b.dx
        const bMinY = b.minY + b.dy
        const bMaxX = b.maxX + b.dx
        const bMaxY = b.maxY + b.dy

        const overlapX = Math.min(aMaxX, bMaxX) - Math.max(aMinX, bMinX)
        const overlapY = Math.min(aMaxY, bMaxY) - Math.max(aMinY, bMinY)
        if (overlapX <= 0 && overlapY <= 0) continue

        const aCx = (aMinX + aMaxX) / 2 + a.dx
        const aCy = (aMinY + aMaxY) / 2 + a.dy
        const bCx = (bMinX + bMaxX) / 2 + b.dx
        const bCy = (bMinY + bMaxY) / 2 + b.dy
        let pushX = 0
        let pushY = 0
        if (overlapX > 0) {
          const half = (overlapX + gap) / 2
          pushX = aCx <= bCx ? -half : half
        }
        if (overlapY > 0) {
          const half = (overlapY + gap) / 2
          pushY = aCy <= bCy ? -half : half
        }
        if (pushX === 0 && pushY === 0) continue
        a.dx += pushX
        a.dy += pushY
        b.dx -= pushX
        b.dy -= pushY
        moved = true
      }
    }
    if (!moved) break
  }

  for (const island of islands) {
    if (island.dx === 0 && island.dy === 0) continue
    for (const n of island.nodes) {
      n.x += island.dx
      n.y += island.dy
    }
  }
}

/** Zieht Inseln zur Gesamtmitte, solange keine Überlappung entsteht. */
function compactLayoutClusters(sim: LayoutNode[], spacingScale: number): void {
  const byKey = new Map<string, LayoutNode[]>()
  for (const n of sim) {
    const list = byKey.get(n.layoutClusterKey) ?? []
    list.push(n)
    byKey.set(n.layoutClusterKey, list)
  }
  if (byKey.size < 2) return

  type Island = {
    key: string
    nodes: LayoutNode[]
    minX: number
    minY: number
    maxX: number
    maxY: number
    dx: number
    dy: number
  }

  const buildIslands = (): Island[] => {
    const out: Island[] = []
    for (const [key, nodes] of byKey) {
      const box = layoutClusterBox(nodes)
      if (!box) continue
      out.push({ key, nodes, ...box, dx: 0, dy: 0 })
    }
    return out
  }

  let islands = buildIslands()
  if (islands.length < 2) return

  let cx = 0
  let cy = 0
  for (const i of islands) {
    cx += (i.minX + i.maxX) / 2
    cy += (i.minY + i.maxY) / 2
  }
  cx /= islands.length
  cy /= islands.length

  const step = 3 * Math.max(0.35, spacingScale)
  const gap = CLUSTER_ISLAND_GAP * spacingScale

  const overlaps = (a: Island, b: Island): boolean => {
    const aMinX = a.minX + a.dx
    const aMinY = a.minY + a.dy
    const aMaxX = a.maxX + a.dx
    const aMaxY = a.maxY + a.dy
    const bMinX = b.minX + b.dx
    const bMinY = b.minY + b.dy
    const bMaxX = b.maxX + b.dx
    const bMaxY = b.maxY + b.dy
    return (
      Math.min(aMaxX, bMaxX) - Math.max(aMinX, bMinX) > -gap &&
      Math.min(aMaxY, bMaxY) - Math.max(aMinY, bMinY) > -gap
    )
  }

  for (let round = 0; round < 24; round++) {
    let moved = false
    for (const island of islands) {
      const icx = (island.minX + island.maxX) / 2 + island.dx
      const icy = (island.minY + island.maxY) / 2 + island.dy
      const dist = Math.hypot(icx - cx, icy - cy)
      if (dist < 1) continue
      const pull = Math.min(step, dist * 0.12)
      const tryDx = (-(icx - cx) / dist) * pull
      const tryDy = (-(icy - cy) / dist) * pull
      island.dx += tryDx
      island.dy += tryDy
      let ok = true
      for (const other of islands) {
        if (other === island) continue
        if (overlaps(island, other)) {
          ok = false
          break
        }
      }
      if (ok) {
        moved = true
      } else {
        island.dx -= tryDx
        island.dy -= tryDy
      }
    }
    if (!moved) break
  }

  for (const island of islands) {
    if (island.dx === 0 && island.dy === 0) continue
    for (const n of island.nodes) {
      n.x += island.dx
      n.y += island.dy
    }
  }
}

export function mergeLayoutWithSavedPositions(
  layout: LayoutNode[],
  saved: { structureKey: string; nodePositions: Record<string, { x: number; y: number }> } | null,
  structureKey: string
): LayoutNode[] {
  if (!saved || saved.structureKey !== structureKey) return layout
  return layout.map((n) => {
    const p = saved.nodePositions[n.key]
    return p ? { ...n, x: p.x, y: p.y } : n
  })
}

function shuffleKeys<T>(keys: T[]): T[] {
  const out = [...keys]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = out[i]!
    out[i] = out[j]!
    out[j] = tmp
  }
  return out
}

function islandBoxOverlaps(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  placed: { x: number; y: number; w: number; h: number }[],
  gap: number
): boolean {
  for (const p of placed) {
    if (
      ax < p.x + p.w + gap &&
      ax + aw + gap > p.x &&
      ay < p.y + p.h + gap &&
      ay + ah + gap > p.y
    ) {
      return true
    }
  }
  return false
}

const INTRA_NODE_GAP_BASE = 14

function intraNodeGap(spacingScale: number): number {
  return INTRA_NODE_GAP_BASE * Math.max(0.75, spacingScale)
}

function nodesOverlapAabb(a: LayoutNode, b: LayoutNode, gap: number): boolean {
  return (
    a.x - a.w / 2 < b.x + b.w / 2 + gap &&
    a.x + a.w / 2 + gap > b.x - b.w / 2 &&
    a.y - a.h / 2 < b.y + b.h / 2 + gap &&
    a.y + a.h / 2 + gap > b.y - b.h / 2
  )
}

/** Trennt überlappende Knoten (Achsen-AABB); gibt true zurück wenn noch eine Überlappung besteht. */
function resolveIntraClusterOverlaps(nodes: LayoutNode[], gap: number, maxIter = 96): boolean {
  let hasOverlap = false
  for (let iter = 0; iter < maxIter; iter++) {
    let moved = false
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i]!
        const b = nodes[j]!
        const overlapX =
          Math.min(a.x + a.w / 2, b.x + b.w / 2) - Math.max(a.x - a.w / 2, b.x - b.w / 2)
        const overlapY =
          Math.min(a.y + a.h / 2, b.y + b.h / 2) - Math.max(a.y - a.h / 2, b.y - b.h / 2)
        if (overlapX <= -gap || overlapY <= -gap) continue

        if (overlapX > 0 && overlapY > 0) {
          if (overlapX <= overlapY) {
            const half = (overlapX + gap) / 2
            const dir = a.x <= b.x ? -1 : 1
            a.x += dir * -half
            b.x += dir * half
          } else {
            const half = (overlapY + gap) / 2
            const dir = a.y <= b.y ? -1 : 1
            a.y += dir * -half
            b.y += dir * half
          }
          moved = true
        } else if (overlapX > -gap) {
          const push = (overlapX + gap) / 2
          const dir = a.x <= b.x ? -1 : 1
          a.x += dir * -push
          b.x += dir * push
          moved = true
        } else if (overlapY > -gap) {
          const push = (overlapY + gap) / 2
          const dir = a.y <= b.y ? -1 : 1
          a.y += dir * -push
          b.y += dir * push
          moved = true
        }
      }
    }
    if (!moved) break
  }
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (nodesOverlapAabb(nodes[i]!, nodes[j]!, gap)) {
        hasOverlap = true
        break
      }
    }
    if (hasOverlap) break
  }
  return hasOverlap
}

/** Groesse der lokalen Layout-Flaeche aus Knotenmasse — Insel darf wachsen statt zu quetschen. */
function estimateIntraClusterCanvas(
  measured: MeasuredGraphNode[],
  spacingScale: number
): { localW: number; localH: number } {
  const gap = intraNodeGap(spacingScale)
  const maxW = Math.max(...measured.map((n) => n.w))
  const maxH = Math.max(...measured.map((n) => n.h))
  const totalArea = measured.reduce((s, n) => s + (n.w + gap) * (n.h + gap), 0)
  const cols = Math.max(1, Math.ceil(Math.sqrt(measured.length * 1.25)))
  const rows = Math.ceil(measured.length / cols)
  const localW = Math.max(
    maxW * cols + gap * (cols + 1) + CLUSTER_HULL_PAD_X * 2,
    Math.sqrt(totalArea) * 1.35,
    maxW + gap * 2 + CLUSTER_HULL_PAD_X * 2
  )
  const localH = Math.max(
    maxH * rows + gap * (rows + 1) + CLUSTER_HULL_PAD_TOP + CLUSTER_HULL_PAD_BOTTOM,
    Math.sqrt(totalArea) * 1.1,
    maxH + gap * 2 + CLUSTER_HULL_PAD_TOP + CLUSTER_HULL_PAD_BOTTOM
  )
  return { localW, localH }
}

/** Raster-Pack ohne Überlappung (Fallback / Absicherung). */
function packIntraClusterNodes(
  measured: MeasuredGraphNode[],
  spacingScale: number
): LayoutNode[] {
  const gap = intraNodeGap(spacingScale)
  const padL = CLUSTER_HULL_PAD_X
  const padT = CLUSTER_HULL_PAD_TOP
  const totalArea = measured.reduce((s, n) => s + (n.w + gap) * (n.h + gap), 0)
  const maxW = Math.max(...measured.map((n) => n.w))
  const cols = Math.max(1, Math.ceil(Math.sqrt(measured.length * 1.35)))
  const targetInnerW = Math.max(
    maxW * cols + gap * (cols - 1),
    Math.sqrt(totalArea) * 1.15,
    maxW + gap
  )

  const sorted = [...measured].sort((a, b) => b.w * b.h - a.w * a.h || b.h - a.h)
  let cursorX = padL
  let cursorY = padT
  let rowH = 0
  const rowStartX = padL
  const placed: LayoutNode[] = []

  for (const n of sorted) {
    if (cursorX + n.w > padL + targetInnerW && cursorX > rowStartX) {
      cursorX = rowStartX
      cursorY += rowH + gap
      rowH = 0
    }
    placed.push({
      ...n,
      x: cursorX + n.w / 2,
      y: cursorY + n.h / 2
    })
    cursorX += n.w + gap
    rowH = Math.max(rowH, n.h)
  }

  normalizeIntraClusterOrigin(placed)
  return placed
}

function normalizeIntraClusterOrigin(nodes: LayoutNode[]): void {
  let minX = Infinity
  let minY = Infinity
  for (const n of nodes) {
    minX = Math.min(minX, n.x - n.w / 2 - CLUSTER_HULL_PAD_X)
    minY = Math.min(minY, n.y - n.h / 2 - CLUSTER_HULL_PAD_TOP)
  }
  if (!Number.isFinite(minX)) return
  for (const n of nodes) {
    n.x -= minX
    n.y -= minY
  }
}

/** Kleines Force-Layout nur innerhalb einer Insel — mit Nachbearbeitung gegen Überlappungen. */
function layoutIntraCluster(
  measured: MeasuredGraphNode[],
  edges: EntityGraphEdge[],
  spacingScale: number
): LayoutNode[] {
  if (measured.length === 0) return []
  if (measured.length === 1) {
    const n = measured[0]!
    return [
      {
        ...n,
        x: CLUSTER_HULL_PAD_X + n.w / 2,
        y: CLUSTER_HULL_PAD_TOP + n.h / 2
      }
    ]
  }

  const gap = intraNodeGap(spacingScale)
  const keySet = new Set(measured.map((n) => n.key))
  const localEdges = edges.filter((e) => keySet.has(e.aKey) && keySet.has(e.bKey))
  const { localW, localH } = estimateIntraClusterCanvas(measured, spacingScale)

  type SimNode = LayoutNode & { vx: number; vy: number }
  const sim: SimNode[] = measured.map((n) => ({
    ...n,
    x: localW / 2 + (Math.random() - 0.5) * Math.min(48, localW * 0.12),
    y: localH / 2 + (Math.random() - 0.5) * Math.min(48, localH * 0.12),
    vx: 0,
    vy: 0
  }))

  const iterations = Math.min(140, 50 + measured.length * 8)
  for (let iter = 0; iter < iterations; iter++) {
    const alpha = 1 - iter / iterations
    for (let i = 0; i < sim.length; i++) {
      for (let j = i + 1; j < sim.length; j++) {
        const a = sim[i]!
        const b = sim[j]!
        const dx = b.x - a.x
        const dy = b.y - a.y
        const minDistX = (a.w + b.w) / 2 + gap
        const minDistY = (a.h + b.h) / 2 + gap
        const overlapX = minDistX - Math.abs(dx)
        const overlapY = minDistY - Math.abs(dy)
        if (overlapX > 0 && overlapY > 0) {
          if (overlapX <= overlapY) {
            const push = (overlapX / Math.max(1, Math.abs(dx))) * 0.45 * alpha
            const dir = dx >= 0 ? 1 : -1
            a.vx -= dir * push
            b.vx += dir * push
          } else {
            const push = (overlapY / Math.max(1, Math.abs(dy))) * 0.45 * alpha
            const dir = dy >= 0 ? 1 : -1
            a.vy -= dir * push
            b.vy += dir * push
          }
        }
      }
    }
    for (const e of localEdges) {
      const a = sim.find((n) => n.key === e.aKey)
      const b = sim.find((n) => n.key === e.bKey)
      if (!a || !b) continue
      const dx = b.x - a.x
      const dy = b.y - a.y
      const dist = Math.max(1, Math.hypot(dx, dy))
      const target = (a.w + b.w) / 2 + (a.h + b.h) / 2 + gap * 2
      const pull = ((dist - target) / dist) * 0.035 * alpha
      a.vx += dx * pull
      a.vy += dy * pull
      b.vx -= dx * pull
      b.vy -= dy * pull
    }
    const margin = 8
    for (const n of sim) {
      n.vx *= 0.84
      n.vy *= 0.84
      n.x += n.vx
      n.y += n.vy
      n.x = Math.max(n.w / 2 + margin, Math.min(localW - n.w / 2 - margin, n.x))
      n.y = Math.max(n.h / 2 + margin, Math.min(localH - n.h / 2 - margin, n.y))
    }
  }

  const stillOverlapping = resolveIntraClusterOverlaps(sim, gap)
  let result: LayoutNode[] = stillOverlapping ? packIntraClusterNodes(measured, spacingScale) : sim
  resolveIntraClusterOverlaps(result, gap)
  normalizeIntraClusterOrigin(result)
  return result
}

/** Ordnet nur die Knoten innerhalb einer Insel neu an (Insel-Position bleibt). */
export function relayoutIslandClusterNodes(
  hull: ClusterHull,
  clusterNodes: LayoutNode[],
  edges: EntityGraphEdge[],
  spacingScale: number
): LayoutNode[] {
  if (clusterNodes.length <= 1) return clusterNodes

  const measured: MeasuredGraphNode[] = clusterNodes.map((n) => ({
    key: n.key,
    node: n.node,
    w: n.w,
    h: n.h,
    titleLines: n.titleLines,
    subtitleLine: n.subtitleLine,
    layoutClusterKey: n.layoutClusterKey
  }))

  const local = layoutIntraCluster(measured, edges, spacingScale)
  return local.map((n) => ({
    ...n,
    x: hull.x + n.x,
    y: hull.y + n.y
  }))
}

type IslandPlacement = {
  key: string
  nodes: LayoutNode[]
  w: number
  h: number
}

/**
 * Automatisches Layout: Inseln zufaellig auf der Flaeche, Objekte pro Insel intern angeordnet.
 * Nur bei explizitem „Aktualisieren“ aufrufen — nicht bei jedem Render.
 */
export function runAutoGraphLayout(
  nodes: EntityGraphNode[],
  edges: EntityGraphEdge[],
  width: number,
  height: number,
  clusterMode: EntityGraphClusterMode,
  spacingScale = 1
): LayoutNode[] {
  if (nodes.length === 0) return []

  const componentByKey =
    clusterMode === 'component' ? computeConnectedComponentKeys(nodes, edges) : undefined
  const measured = nodes.map((n) => measureGraphNode(n, clusterMode, componentByKey))
  const byCluster = new Map<string, MeasuredGraphNode[]>()
  for (const n of measured) {
    const list = byCluster.get(n.layoutClusterKey) ?? []
    list.push(n)
    byCluster.set(n.layoutClusterKey, list)
  }

  const gap = CLUSTER_ISLAND_GAP + 10 + 8 * Math.min(2, Math.max(0, spacingScale))
  const margin = 28
  const islands: IslandPlacement[] = []

  for (const [key, group] of byCluster) {
    const local = layoutIntraCluster(group, edges, spacingScale)
    let maxX = 0
    let maxY = 0
    for (const n of local) {
      maxX = Math.max(maxX, n.x + n.w / 2 + CLUSTER_HULL_PAD_X)
      maxY = Math.max(maxY, n.y + n.h / 2 + CLUSTER_HULL_PAD_BOTTOM)
    }
    islands.push({
      key,
      nodes: local,
      w: maxX + CLUSTER_HULL_PAD_X,
      h: maxY + CLUSTER_HULL_PAD_TOP
    })
  }

  const placed: { x: number; y: number; w: number; h: number }[] = []
  const originByKey = new Map<string, { x: number; y: number }>()

  const tryPlace = (iw: number, ih: number): { x: number; y: number } | null => {
    const maxX = Math.max(margin, width - iw - margin)
    const maxY = Math.max(margin, height - ih - margin)
    for (let attempt = 0; attempt < 280; attempt++) {
      const x = margin + Math.random() * maxX
      const y = margin + Math.random() * maxY
      if (!islandBoxOverlaps(x, y, iw, ih, placed, gap)) {
        return { x, y }
      }
    }
    return null
  }

  for (const island of shuffleKeys(islands)) {
    let pos = tryPlace(island.w, island.h)
    if (!pos) {
      const cx = width / 2
      const cy = height / 2
      for (let ring = 1; ring < 24 && !pos; ring++) {
        const angle = Math.random() * Math.PI * 2
        const dist = ring * (Math.max(island.w, island.h) + gap)
        const x = Math.max(margin, Math.min(width - island.w - margin, cx + Math.cos(angle) * dist - island.w / 2))
        const y = Math.max(margin, Math.min(height - island.h - margin, cy + Math.sin(angle) * dist - island.h / 2))
        if (!islandBoxOverlaps(x, y, island.w, island.h, placed, gap)) {
          pos = { x, y }
        }
      }
    }
    if (!pos) {
      pos = { x: margin + placed.length * 12, y: margin + placed.length * 12 }
    }
    originByKey.set(island.key, pos)
    placed.push({ x: pos.x, y: pos.y, w: island.w, h: island.h })
  }

  const out: LayoutNode[] = []
  for (const island of islands) {
    const origin = originByKey.get(island.key)!
    for (const n of island.nodes) {
      out.push({ ...n, x: n.x + origin.x, y: n.y + origin.y })
    }
  }
  return out
}

export function buildMeasuredLayout(
  nodes: EntityGraphNode[],
  edges: EntityGraphEdge[],
  clusterMode: EntityGraphClusterMode
): LayoutNode[] {
  const componentByKey =
    clusterMode === 'component' ? computeConnectedComponentKeys(nodes, edges) : undefined
  return nodes.map((node) => measureGraphNode(node, clusterMode, componentByKey)).map((n) => ({
    ...n,
    x: 0,
    y: 0
  }))
}

/** Gespeicherte Positionen für noch vorhandene Knoten (unabhängig vom Struktur-Schlüssel). */
export function pickSavedNodePositions(
  nodeKeys: readonly string[],
  saved: { nodePositions: Record<string, { x: number; y: number }> } | null | undefined
): Record<string, { x: number; y: number }> {
  if (!saved) return {}
  const out: Record<string, { x: number; y: number }> = {}
  for (const key of nodeKeys) {
    const p = saved.nodePositions[key]
    if (p) out[key] = p
  }
  return out
}

export function applyNodePositions(
  measured: LayoutNode[],
  positions: Readonly<Record<string, { x: number; y: number }>>,
  width: number,
  height: number
): LayoutNode[] {
  const cx = width / 2
  const cy = height / 2
  return measured.map((n, i) => {
    const p = positions[n.key]
    if (p) {
      return {
        ...n,
        x: Math.max(n.w / 2 + 8, Math.min(width - n.w / 2 - 8, p.x)),
        y: Math.max(n.h / 2 + 8, Math.min(height - n.h / 2 - 8, p.y))
      }
    }
    const angle = (i / Math.max(1, measured.length)) * Math.PI * 2
    const r = 24 + (i % 5) * 8
    return { ...n, x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r }
  })
}

export function layoutNodesToRecord(layout: LayoutNode[]): Record<string, { x: number; y: number }> {
  const out: Record<string, { x: number; y: number }> = {}
  for (const n of layout) {
    out[n.key] = { x: n.x, y: n.y }
  }
  return out
}

/** Force-Directed-Layout mit Cluster-Schwerkraft (ohne externe Bibliothek). */
export function graphLayoutStructureKey(
  nodes: EntityGraphNode[],
  edges: EntityGraphEdge[],
  clusterMode: EntityGraphClusterMode
): string {
  const nk = nodes.map((n) => n.key).sort().join('\0')
  const ek = edges
    .map((e) => `${e.linkId}:${e.aKey}:${e.bKey}`)
    .sort()
    .join('\0')
  return `${clusterMode}\x1f${nk}\x1f${ek}`
}

export function runForceClusterLayout(
  nodes: EntityGraphNode[],
  edges: EntityGraphEdge[],
  width: number,
  height: number,
  clusterMode: EntityGraphClusterMode,
  fixedPositions?: Map<string, { x: number; y: number }>,
  /** Vorherige Positionen — verhindert Sprünge bei Resize/Neu-Render. */
  seedPositions?: Map<string, { x: number; y: number }>,
  /** Insel-Abstand: 1 = Standard; <1 kompakter, >1 weiter. */
  spacingScale = 1,
  options?: ForceLayoutOptions
): LayoutNode[] {
  if (nodes.length === 0) return []

  const componentByKey =
    clusterMode === 'component' ? computeConnectedComponentKeys(nodes, edges) : undefined

  const measured = nodes.map((n) => measureGraphNode(n, clusterMode, componentByKey))
  const byKey = new Map(measured.map((n) => [n.key, n]))

  const clusterKeys = [...new Set(measured.map((n) => n.layoutClusterKey))]
  const spacing =
    clusterMode === 'none' ? 1 : Math.min(2, Math.max(0, spacingScale))
  /** Abstoßung/Gap: quadratisch, damit 0 und 2 deutlich unterscheidbar sind. */
  const forceSpacing = spacing * spacing
  const centroids = layoutClusterCentroids(clusterKeys, width, height)
  const pinnedKeys = options?.pinnedKeys
  const manualClusterKeys = options?.manualClusterKeys
  const clusterGravity = clusterMode === 'none' ? 0.002 : 0.006
  const repulsionStrength = clusterMode === 'none' ? 0.85 : 0.48
  const clusterSeparation = clusterMode !== 'none'
  const clusterRepulseExtra = 6 + 10 * forceSpacing
  const crossClusterLinkExtra = 14 + 18 * forceSpacing

  const sim = measured.map((n) => {
    const c = centroids.get(n.layoutClusterKey) ?? { cx: width / 2, cy: height / 2 }
    const pin = fixedPositions?.get(n.key)
    const seed = pin ?? seedPositions?.get(n.key)
    const jitter = (Math.random() - 0.5) * 12
    if (seed) {
      return {
        ...n,
        x: Math.max(n.w / 2 + 8, Math.min(width - n.w / 2 - 8, seed.x)),
        y: Math.max(n.h / 2 + 8, Math.min(height - n.h / 2 - 8, seed.y)),
        vx: 0,
        vy: 0
      }
    }
    return {
      ...n,
      x: c.cx + jitter,
      y: c.cy + jitter,
      vx: 0,
      vy: 0
    }
  })

  const isPinned = (key: string): boolean =>
    Boolean(pinnedKeys?.has(key) || fixedPositions?.has(key))

  const seededCount = sim.filter(
    (n) => isPinned(n.key) || seedPositions?.has(n.key)
  ).length
  const allPinned = pinnedKeys && pinnedKeys.size >= measured.length && measured.length > 0
  const warmStart = allPinned || (seededCount >= measured.length && measured.length > 0)
  const iterations = allPinned
    ? 0
    : warmStart
      ? Math.min(80, 32 + nodes.length * 2)
      : Math.min(320, 80 + nodes.length * 8)
  for (let iter = 0; iter < iterations; iter++) {
    const alpha = 1 - iter / iterations

    for (let i = 0; i < sim.length; i++) {
      for (let j = i + 1; j < sim.length; j++) {
        const a = sim[i]!
        const b = sim[j]!
        if (isPinned(a.key) && isPinned(b.key)) continue
        const dx = b.x - a.x
        const dy = b.y - a.y
        const dist = Math.max(1, Math.hypot(dx, dy))
        const differentCluster =
          clusterSeparation && a.layoutClusterKey !== b.layoutClusterKey
        const minDist =
          (a.w + b.w) / 2 +
          (a.h + b.h) / 4 +
          (differentCluster ? clusterRepulseExtra : 28)
        if (dist < minDist) {
          const push =
            ((minDist - dist) / dist) *
            (differentCluster ? repulsionStrength * 1.1 : repulsionStrength) *
            alpha
          if (!isPinned(a.key)) {
            a.vx -= dx * push
            a.vy -= dy * push
          }
          if (!isPinned(b.key)) {
            b.vx += dx * push
            b.vy += dy * push
          }
        }
      }
    }

    for (const e of edges) {
      const a = sim.find((n) => n.key === e.aKey)
      const b = sim.find((n) => n.key === e.bKey)
      if (!a || !b) continue
      const dx = b.x - a.x
      const dy = b.y - a.y
      const dist = Math.max(1, Math.hypot(dx, dy))
      const crossCluster =
        clusterSeparation && a.layoutClusterKey !== b.layoutClusterKey
      const target =
        (a.w + b.w) / 2 + (a.h + b.h) / 4 + (crossCluster ? crossClusterLinkExtra : 72)
      const pull = ((dist - target) / dist) * (crossCluster ? 0.022 : 0.035) * alpha
      a.vx += dx * pull
      a.vy += dy * pull
      b.vx -= dx * pull
      b.vy -= dy * pull
    }

    for (const n of sim) {
      if (isPinned(n.key)) continue
      const manual = manualClusterKeys?.has(n.layoutClusterKey)
      if (!manual) {
        const c = centroids.get(n.layoutClusterKey)!
        n.vx += (c.cx - n.x) * clusterGravity * alpha
        n.vy += (c.cy - n.y) * clusterGravity * alpha
      }
      n.vx += (width / 2 - n.x) * 0.0004
      n.vy += (height / 2 - n.y) * 0.0004
    }

    for (const n of sim) {
      if (isPinned(n.key)) {
        const pin = fixedPositions?.get(n.key) ?? seedPositions?.get(n.key)
        if (pin) {
          n.x = Math.max(n.w / 2 + 8, Math.min(width - n.w / 2 - 8, pin.x))
          n.y = Math.max(n.h / 2 + 8, Math.min(height - n.h / 2 - 8, pin.y))
        }
        n.vx = 0
        n.vy = 0
        continue
      }
      n.vx *= 0.82
      n.vy *= 0.82
      n.x += n.vx
      n.y += n.vy
      n.x = Math.max(n.w / 2 + 8, Math.min(width - n.w / 2 - 8, n.x))
      n.y = Math.max(n.h / 2 + 8, Math.min(height - n.h / 2 - 8, n.y))
    }
  }

  if (fixedPositions?.size) {
    for (const n of sim) {
      const pin = fixedPositions.get(n.key)
      if (pin) {
        n.x = Math.max(n.w / 2 + 8, Math.min(width - n.w / 2 - 8, pin.x))
        n.y = Math.max(n.h / 2 + 8, Math.min(height - n.h / 2 - 8, pin.y))
      }
    }
  }

  if (clusterSeparation && !allPinned) {
    separateLayoutClusters(sim, forceSpacing)
    compactLayoutClusters(sim, forceSpacing)
  }

  void byKey
  return sim
}

export function computeClusterHulls(
  layout: LayoutNode[],
  labelForKey: (clusterKey: string) => string
): ClusterHull[] {
  const groups = new Map<string, LayoutNode[]>()
  for (const n of layout) {
    const list = groups.get(n.layoutClusterKey) ?? []
    list.push(n)
    groups.set(n.layoutClusterKey, list)
  }

  const hulls: ClusterHull[] = []
  for (const [key, group] of groups) {
    if (group.length < 2) continue
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const n of group) {
      minX = Math.min(minX, n.x - n.w / 2)
      minY = Math.min(minY, n.y - n.h / 2)
      maxX = Math.max(maxX, n.x + n.w / 2)
      maxY = Math.max(maxY, n.y + n.h / 2)
    }
    hulls.push({
      key,
      x: minX - CLUSTER_HULL_PAD_X,
      y: minY - CLUSTER_HULL_PAD_TOP,
      w: maxX - minX + CLUSTER_HULL_PAD_X * 2,
      h: maxY - minY + CLUSTER_HULL_PAD_TOP + CLUSTER_HULL_PAD_BOTTOM,
      label: labelForKey(key)
    })
  }
  return hulls
}

export function graphContentBounds(layout: LayoutNode[]): {
  minX: number
  minY: number
  maxX: number
  maxY: number
} | null {
  if (layout.length === 0) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const n of layout) {
    minX = Math.min(minX, n.x - n.w / 2)
    minY = Math.min(minY, n.y - n.h / 2)
    maxX = Math.max(maxX, n.x + n.w / 2)
    maxY = Math.max(maxY, n.y + n.h / 2)
  }
  return { minX, minY, maxX, maxY }
}

export function filterGraphByQuery(
  nodes: EntityGraphNode[],
  edges: EntityGraphEdge[],
  query: string
): { nodes: EntityGraphNode[]; edges: EntityGraphEdge[] } {
  const q = query.trim().toLowerCase()
  if (!q) return { nodes, edges }
  const keys = new Set(
    nodes
      .filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          (n.subtitle?.toLowerCase().includes(q) ?? false) ||
          n.kind.toLowerCase().includes(q)
      )
      .map((n) => n.key)
  )
  if (keys.size === 0) return { nodes: [], edges: [] }
  for (const e of edges) {
    if (keys.has(e.aKey)) keys.add(e.bKey)
    if (keys.has(e.bKey)) keys.add(e.aKey)
  }
  return {
    nodes: nodes.filter((n) => keys.has(n.key)),
    edges: edges.filter((e) => keys.has(e.aKey) && keys.has(e.bKey))
  }
}
