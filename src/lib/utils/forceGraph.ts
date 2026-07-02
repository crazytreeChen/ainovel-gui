/**
 * 力导向图布局算法
 * 从 CharactersPage.tsx 提取的物理模拟引擎
 */

export interface ForceGraphNode {
  id: string
  x: number
  y: number
  vx: number
  vy: number
  connections: number
}

export interface ForceGraphLink {
  source: string
  target: string
}

export interface ForceGraphOptions {
  width: number
  height: number
  iterations?: number
  repulsion?: number
  linkStrength?: number
  centerStrength?: number
  damping?: number
  initialRadius?: number
}

export const DEFAULT_OPTIONS: Required<Omit<ForceGraphOptions, 'width' | 'height'>> = {
  iterations: 100,
  repulsion: 4000,
  linkStrength: 0.01,
  centerStrength: 0.001,
  damping: 0.85,
  initialRadius: 200,
}

export const DRAG_OPTIONS: Required<Omit<ForceGraphOptions, 'width' | 'height'>> = {
  iterations: 3,
  repulsion: 5000,
  linkStrength: 0.012,
  centerStrength: 0,
  damping: 0.85,
  initialRadius: 200,
}

/**
 * 创建并运行力导向图模拟
 */
export function createForceGraph(
  nodes: ForceGraphNode[],
  links: ForceGraphLink[],
  options: ForceGraphOptions
): ForceGraphNode[] {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const cx = opts.width / 2
  const cy = opts.height / 2

  // 初始化位置（圆形分布）
  nodes.forEach((node, i) => {
    const angle = (i / nodes.length) * 2 * Math.PI - Math.PI / 2
    const rx = Math.min(opts.initialRadius, opts.width * 0.25)
    const ry = Math.min(140, opts.height * 0.25)
    node.x = cx + rx * Math.cos(angle)
    node.y = cy + ry * Math.sin(angle)
    node.vx = 0
    node.vy = 0
  })

  return runForceLayout(nodes, links, opts.iterations, opts)
}

/**
 * 运行力导向布局迭代
 */
export function runForceLayout(
  nodes: ForceGraphNode[],
  links: ForceGraphLink[],
  iterations: number,
  options?: Partial<ForceGraphOptions>
): ForceGraphNode[] {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const cx = opts.width / 2
  const cy = opts.height / 2

  for (let iter = 0; iter < iterations; iter++) {
    // 斥力（节点间相互排斥）
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i]
        const b = nodes[j]
        let dx = b.x - a.x
        let dy = b.y - a.y
        let dist = Math.sqrt(dx * dx + dy * dy) || 1
        const f = opts.repulsion / (dist * dist)
        a.vx -= (f * dx) / dist
        a.vy -= (f * dy) / dist
        b.vx += (f * dx) / dist
        b.vy += (f * dy) / dist
      }
    }

    // 引力（连线节点相互吸引）
    for (const link of links) {
      const a = nodes.find(n => n.id === link.source)
      const b = nodes.find(n => n.id === link.target)
      if (!a || !b) continue
      let dx = b.x - a.x
      let dy = b.y - a.y
      let d = Math.sqrt(dx * dx + dy * dy) || 1
      const f = d * opts.linkStrength
      a.vx += (f * dx) / d
      a.vy += (f * dy) / d
      b.vx -= (f * dx) / d
      b.vy -= (f * dy) / d
    }

    // 中心引力 + 阻尼 + 位置更新
    for (const node of nodes) {
      if (opts.centerStrength > 0) {
        node.vx += (cx - node.x) * opts.centerStrength
        node.vy += (cy - node.y) * opts.centerStrength
      }
      node.x += node.vx
      node.y += node.vy
      node.vx *= opts.damping
      node.vy *= opts.damping
    }
  }

  return nodes
}
