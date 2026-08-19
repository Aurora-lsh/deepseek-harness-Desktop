import { memo, useMemo } from 'react'
import type { ChatNodeViewProps, TurnTailOwnerProps } from '../contract/slots.ts'
import { AssistantMarkdown } from './AssistantMarkdown.tsx'
import css from './AssistantNodeView.module.css'

/** Product labels for canonical reasoning effort ids. */
function effortLabel(effort: string, t: ChatNodeViewProps<'assistant-step'>['t']): string {
  switch (effort) {
    case 'low': return t('message.effort.low')
    case 'medium': return t('message.effort.medium')
    case 'high': return t('message.effort.high')
    case 'xhigh': return t('message.effort.xhigh')
    default: return effort
  }
}

/** Streaming, settled, and interrupted Assistant states share one keyed renderer instance. */
export const AssistantNodeView = memo(function AssistantNodeView({
  node, useTurnData, openFile, loadImage, fileMentions, t,
}: ChatNodeViewProps<'assistant-step'>) {
  const data = node.data
  const requestConfig = useTurnData('assistant-request-config')
  const turn = node.location.kind === 'turn' || node.location.kind === 'step'
    ? node.location.turn
    : undefined
  const tail = useTurnData('turn-tail')
  const owner = useMemo<TurnTailOwnerProps | undefined>(() => {
    if (turn?.status !== 'closed' || data.finalNode === undefined) return undefined
    if (tail?.closing?.finalNode.seq !== data.finalNode.seq) return undefined
    return { turn, seq: data.finalNode.seq, openFile }
  }, [data.finalNode, openFile, tail, turn])
  const mentions = useMemo(
    () => owner === undefined ? undefined : fileMentions(owner),
    [fileMentions, owner],
  )
  const model = data.finalNode?.provenance?.model ?? requestConfig?.model
  const effort = requestConfig?.reasoningEffort
  return (
    <div className={css.root}>
      <AssistantMarkdown
        blocks={data.blocks}
        streaming={data.status === 'running'}
        interrupted={data.status === 'interrupted'}
        loadImage={loadImage}
        mentions={mentions}
        t={t}
      />
      {model !== undefined && (
        <div className={css.metadata} aria-label={t('message.modelMetadata')}>
          <span>{model}</span>
          {effort !== undefined && <span>{effortLabel(effort, t)}</span>}
        </div>
      )}
    </div>
  )
})
