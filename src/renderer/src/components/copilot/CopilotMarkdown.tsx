import { useMemo, type MouseEvent } from 'react'
import { voidOpenExternalUrl } from '@/lib/open-external'
import { cn } from '@/lib/utils'
import { copilotMarkdownToSafeHtml } from '@/components/copilot/copilot-markdown'

export function CopilotMarkdown({
  markdown,
  className
}: {
  markdown: string
  className?: string
}): JSX.Element {
  const html = useMemo(() => copilotMarkdownToSafeHtml(markdown), [markdown])

  const onClick = (e: MouseEvent<HTMLDivElement>): void => {
    const target = e.target
    if (!(target instanceof Element)) return
    const a = target.closest('a')
    if (!(a instanceof HTMLAnchorElement)) return
    const href = a.getAttribute('href')?.trim()
    if (!href) return
    e.preventDefault()
    e.stopPropagation()
    if (href.startsWith('#copilot-cite-')) {
      const el = document.getElementById(href.slice(1))
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      el?.classList.add('ring-2', 'ring-primary/40')
      window.setTimeout(() => {
        el?.classList.remove('ring-2', 'ring-primary/40')
      }, 1200)
      return
    }
    voidOpenExternalUrl(href, 'CopilotMarkdown')
  }

  return (
    <div
      className={cn(
        'copilot-md text-xs leading-relaxed text-foreground',
        '[&_h1]:mb-1.5 [&_h1]:mt-2 [&_h1]:text-sm [&_h1]:font-semibold',
        '[&_h2]:mb-1.5 [&_h2]:mt-2 [&_h2]:text-sm [&_h2]:font-semibold',
        '[&_h3]:mb-1 [&_h3]:mt-1.5 [&_h3]:text-xs [&_h3]:font-semibold',
        '[&_p]:mb-2 [&_p]:last:mb-0',
        '[&_ul]:mb-2 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-4',
        '[&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-4',
        '[&_li]:leading-snug',
        '[&_strong]:font-semibold',
        '[&_a]:text-primary [&_a]:underline-offset-2 hover:[&_a]:underline',
        '[&_hr]:my-2 [&_hr]:border-border/60',
        '[&_code]:rounded [&_code]:bg-muted/50 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-2xs',
        className
      )}
      onClick={onClick}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
