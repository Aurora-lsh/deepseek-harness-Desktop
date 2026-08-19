import type { Context } from '@deepseek-ai/cordis'
import type { AssistantRequestConfig, ConversationNodeDefinition } from '@deepseek-ai/dsh-client-runtime/client'

declare module '@deepseek-ai/dsh-client-runtime/client' {
  interface ConversationStepDataMap {
    /** Effective provider request configuration recorded for this Assistant step. */
    'assistant-request-config': AssistantRequestConfig
  }
}

/** Request-header state projected onto the Step that issued the model call. */
export interface RequestConfigState {
  readonly config: AssistantRequestConfig
}

interface RequestStepConfigState {
  readonly turn: number
  readonly step: number
  readonly config: AssistantRequestConfig | undefined
}

/** Retain each effective request configuration for the following Assistant Step. */
export const requestConfigDefinition: ConversationNodeDefinition<RequestConfigState> = {
  kind: 'assistant-request-header',
  match: event => event.type === 'request/header'
    ? { id: String(event.seq), role: 'start' }
    : null,
  start: (_context, match) => {
    if (match.event.type !== 'request/header') throw new Error('assistant-request-config requires request/header')
    return { config: match.event.data.header.config }
  },
  update: context => context.state,
}

/** Bind the latest preceding request header to one Step without rebuilding its Chat node. */
export const requestStepConfigDefinition: ConversationNodeDefinition<RequestStepConfigState> = {
  kind: 'assistant-request-config',
  match: event => event.type === 'step/start'
    ? { id: `${event.data.turn}:${event.data.step}`, role: 'start' }
    : null,
  start: (_context, match, reader) => {
    if (match.event.type !== 'step/start') throw new Error('assistant-step-request-config requires step/start')
    return {
      turn: match.event.data.turn,
      step: match.event.data.step,
      config: reader.previous<RequestConfigState>('assistant-request-header')?.state.config,
    }
  },
  update: context => context.state,
  buildLocationData: (context, scope) => {
    if (scope !== 'step' || context.state?.config === undefined) return null
    return {
      kind: 'step',
      turn: context.state.turn,
      step: context.state.step,
      key: 'assistant-request-config',
      value: context.state.config,
    }
  },
}

/**
 * Register effective Assistant request metadata for message rows.
 * @param ctx - owning UI Conversation context.
 */
export function registerRequestConfigConversationNode(ctx: Context): void {
  ctx.conversationEvents.register(requestConfigDefinition)
  ctx.conversationEvents.register(requestStepConfigDefinition)
}
