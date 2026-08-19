/**
 * ModelSelect: the composer's named model seat (`conversation.input.model`).
 * The root popover combines the provider-grouped model drill-in with a
 * four-level reasoning slider. Only canonical levels advertised by the exact
 * model appear on the slider. The trigger shows model and active level.
 * Data and submission ride the SAME per-session ModelDirectory as the
 * /model popup; exact-model reasoning metadata and the selected effort come
 * from the Host rather than a client-owned vocabulary. A rejected selection
 * announces through the shared transient Toast anchored to the composer
 * card; the in-menu strip with Retry remains the catalog-load surface.
 */
import {
  useEffect, useId, useMemo, useRef, useState, useSyncExternalStore,
  type KeyboardEvent, type FocusEvent,
} from 'react'
import clsx from 'clsx'
import type { ModelSelection } from '@deepseek-ai/dsh-api-remotes/client'
import {
  IconCheckOutline16, IconChevronDownOutline14, IconChevronRightOutline14,
  IconWarningOutline16, Toast,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { ModelSelectInjected } from './slots.ts'
import css from './ModelSelect.module.css'

/** Which pane the dropdown shows: the controls root or model list. */
type Pane = 'root' | 'model'

/** One product reasoning level backed by the adapter's canonical id. */
interface EffortChoice {
  effort: string
  label: string
}

const PRODUCT_EFFORTS = ['low', 'medium', 'high', 'xhigh'] as const

/**
 * Render the composer model seat.
 * @param props - owner share (locked) + injected face (shared directory
 * store/verbs) + the standard locale seat.
 * @returns the trigger and, while open, the two-level menu.
 */
export function ModelSelect(
  { locked, available, directory, load, select, t }:
  ModelSelectInjected & { locked: boolean } & PropsLocale<'model'>,
) {
  const state = useSyncExternalStore(
    fn => directory.subscribe(fn),
    () => directory.getSnapshot(),
  )
  const [open, setOpen] = useState(false)
  const [pane, setPane] = useState<Pane>('root')
  // The in-menu error strip serves catalog loads (its Retry re-runs the
  // load); a rejected SELECTION announces through the transient toast
  // instead, so the strip renders only while the latest failure-capable
  // action was a load.
  const lastActionRef = useRef<'load' | 'select'>('load')
  const [toast, setToast] = useState<{ seq: number; text: string } | null>(null)
  const toastSeq = useRef(0)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])
  const id = useId()

  const choices = useMemo(() => state.groups.flatMap(group =>
    group.models.map(model => ({
      group,
      model,
      selection: {
        provider: group.id,
        model: model.id,
        ...model.reasoning?.defaultEffort === undefined
          ? {}
          : { reasoningEffort: model.reasoning.defaultEffort },
      } satisfies ModelSelection,
    }))), [state.groups])
  const selectedIndex = state.current === null
    ? -1
    : choices.findIndex(c => c.selection.provider === state.current?.provider && c.selection.model === state.current.model)
  const currentChoice = choices[selectedIndex]
  const reasoning = currentChoice?.model.reasoning
  const effectiveEffort = state.current?.reasoningEffort ?? reasoning?.defaultEffort
  const effortChoices = useMemo<readonly EffortChoice[]>(() => {
    if (reasoning === undefined) return []
    const advertised = new Set(reasoning.efforts.map(effort => effort.id))
    return PRODUCT_EFFORTS
      .filter(effort => advertised.has(effort))
      .map(effort => ({ effort, label: t(`effort.${effort}`) }))
  }, [reasoning, t])
  const effectiveEffortIndex = effortChoices.findIndex(choice => choice.effort === effectiveEffort)
  const selectedEffortIndex = effectiveEffortIndex < 0 ? 0 : effectiveEffortIndex
  const effortLabel = reasoning === undefined
    ? undefined
    : effectiveEffortIndex < 0
      ? t('effort.providerDefault')
      : effortChoices[effectiveEffortIndex]?.label
  const busy = state.status === 'selecting'

  const reload = (): void => {
    lastActionRef.current = 'load'
    load()
  }

  // Mount-time load resolves the trigger label; every open refreshes.
  useEffect(() => {
    if (available) {
      lastActionRef.current = 'load'
      load()
    }
  }, [available, load])

  // A new conversation starts at Medium whenever its exact model advertises
  // that level. Once selected, the Host records it with the next request and
  // reopening the conversation restores that recorded value.
  const initializedModelRef = useRef<string | null>(null)
  const announcedFallbackRef = useRef<string | null>(null)
  useEffect(() => {
    if (state.fallbackFrom === null || state.current === null) return
    const key = `${state.fallbackFrom.provider}\u0000${state.fallbackFrom.model}\u0000${state.current.provider}\u0000${state.current.model}`
    if (announcedFallbackRef.current === key) return
    announcedFallbackRef.current = key
    toastSeq.current += 1
    setToast({
      seq: toastSeq.current,
      text: t('notice.fallback', { model: state.fallbackFrom.model, fallback: state.current.model }),
    })
  }, [state.current, state.fallbackFrom, t])

  useEffect(() => {
    if (state.status !== 'ready' || state.current === null || reasoning === undefined) return
    const key = `${state.current.provider}\u0000${state.current.model}`
    if (initializedModelRef.current === key) return
    initializedModelRef.current = key
    if (state.current.reasoningEffort !== undefined
      || !reasoning.efforts.some(effort => effort.id === 'medium')) return
    lastActionRef.current = 'select'
    void select({ ...state.current, reasoningEffort: 'medium' }).then((accepted) => {
      if (accepted) return
      const message = directory.getSnapshot().error
      if (message === null) return
      toastSeq.current += 1
      setToast({ seq: toastSeq.current, text: t('error.action', { message }) })
    })
  }, [directory, reasoning, select, state.current, state.status, t])

  useEffect(() => {
    if (!open) return
    const closeOutside = (event: MouseEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', closeOutside)
    return () => { document.removeEventListener('mousedown', closeOutside) }
  }, [open])

  if (!available) return null

  const show = (): void => {
    setPane('root')
    setOpen(true)
    reload()
  }

  const close = (restoreFocus = false): void => {
    setOpen(false)
    setPane('root')
    if (restoreFocus) queueMicrotask(() => { triggerRef.current?.focus() })
  }

  const moveFocus = (offset: number): void => {
    const items = itemRefs.current.filter(item => item !== null)
    if (items.length === 0) return
    const active = items.findIndex(item => item === document.activeElement)
    const next = (Math.max(active, 0) + offset + items.length) % items.length
    items[next]?.focus()
  }

  const onRootKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.target instanceof HTMLInputElement && event.target.type === 'range') return
    if (event.key === 'Escape' && open) {
      event.preventDefault()
      // Escape backs out of a drilled pane first, then closes.
      if (pane !== 'root') setPane('root')
      else close(true)
      return
    }
    if (!open) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      moveFocus(event.key === 'ArrowDown' ? 1 : -1)
    }
  }

  const onBlur = (event: FocusEvent<HTMLDivElement>): void => {
    if (event.relatedTarget instanceof Node && rootRef.current?.contains(event.relatedTarget)) return
    close()
  }

  const settleSelection = (accepted: boolean, closeAfter = true): void => {
    if (accepted) {
      if (closeAfter && rootRef.current !== null) close(true)
      return
    }
    const message = directory.getSnapshot().error
    if (message !== null) {
      toastSeq.current += 1
      setToast({ seq: toastSeq.current, text: t('error.action', { message }) })
    }
  }

  const choose = (selection: ModelSelection): void => {
    if (state.current?.provider === selection.provider && state.current.model === selection.model) {
      close(true)
      return
    }
    lastActionRef.current = 'select'
    void select(selection).then(settleSelection)
  }

  const chooseEffort = (effort: string): void => {
    if (state.current === null) return
    if (effectiveEffort === effort) {
      return
    }
    const selection: ModelSelection = {
      provider: state.current.provider,
      model: state.current.model,
      reasoningEffort: effort,
    }
    lastActionRef.current = 'select'
    void select(selection).then((accepted) => { settleSelection(accepted, false) })
  }

  const modelLabel = currentChoice?.model.name ?? t('trigger.fallback')
  const triggerLabel = effortLabel === undefined ? modelLabel : `${modelLabel} · ${effortLabel}`
  const triggerAria = currentChoice === undefined
    ? t('trigger.selectAria')
    : effortLabel === undefined
      ? t('trigger.aria', { model: modelLabel })
      : t('trigger.ariaEffort', { model: modelLabel, effort: effortLabel })
  itemRefs.current = []
  let itemIndex = 0
  const itemRef = () => {
    const at = itemIndex++
    return (node: HTMLButtonElement | null) => { itemRefs.current[at] = node }
  }

  return (
    <div ref={rootRef} className={css.root} onKeyDown={onRootKeyDown} onBlur={onBlur}>
      <button
        ref={triggerRef}
        type="button"
        className={css.trigger}
        aria-label={triggerAria}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? `${id}-menu` : undefined}
        title={triggerLabel}
        disabled={locked}
        onClick={() => {
          if (open) {
            close()
          } else {
            show()
          }
        }}
      >
        <span className={css.triggerLabel}>{modelLabel}</span>
        {effortLabel !== undefined && <span className={css.triggerEffort}>{effortLabel}</span>}
        <IconChevronDownOutline14 className={clsx(css.chevron, open && css.chevronOpen)} />
      </button>

      {open && (
        <div
          id={`${id}-menu`}
          className={css.menu}
          role="menu"
          aria-label={t('menu.aria')}
          aria-busy={state.status === 'loading' || busy}
        >
          {pane === 'root' && (
            <>
              <button ref={itemRef()} type="button" role="menuitem" className={css.cell} onClick={() => { setPane('model') }}>
                <span className={css.cellLabel}>{t('menu.model')}</span>
                <span className={css.cellValue}>{modelLabel}</span>
                <IconChevronRightOutline14 className={css.cellChevron} />
              </button>
              <div className={css.advancedHeader}>{t('menu.advanced')}</div>
              <div className={clsx(css.effortControl, effortChoices.length === 0 && css.effortUnsupported)}>
                <input
                  className={css.effortSlider}
                  type="range"
                  min={0}
                  max={Math.max(0, effortChoices.length - 1)}
                  step={1}
                  value={selectedEffortIndex}
                  disabled={busy || effortChoices.length === 0}
                  aria-label={t('menu.effort')}
                  aria-valuetext={effortChoices.length === 0
                    ? t('empty.efforts')
                    : effortChoices[selectedEffortIndex]?.label}
                  onChange={(event) => {
                    const choice = effortChoices[Number(event.currentTarget.value)]
                    if (choice !== undefined) chooseEffort(choice.effort)
                  }}
                  onClick={(event) => {
                    const choice = effortChoices[Number(event.currentTarget.value)]
                    if (choice !== undefined) chooseEffort(choice.effort)
                  }}
                />
                <div className={css.effortLabels} aria-hidden="true">
                  {effortChoices.map(choice => (
                    <span
                      className={clsx(choice.effort === effectiveEffort && css.effortLabelSelected)}
                      key={choice.effort}
                    >
                      {choice.label}
                    </span>
                  ))}
                </div>
                {effortChoices.length === 0 && (
                  <div className={css.effortHint}>{t('empty.efforts')}</div>
                )}
              </div>
            </>
          )}

          {pane === 'model' && (
            <>
              {state.status === 'loading' && (
                <div className={css.status}>{t('status.loading')}</div>
              )}
              {state.error !== null && lastActionRef.current === 'load' && (
                <div className={css.error}>
                  <span>{t('error.action', { message: state.error })}</span>
                  <button type="button" className={css.retry} onClick={reload}>{t('retry')}</button>
                </div>
              )}
              {state.failures.map(failure => (
                <div className={css.warning} key={failure.id}>
                  <span>{t('warning.groupLoad', { name: failure.name, message: failure.message })}</span>
                  <button type="button" className={css.retry} onClick={reload}>{t('retry')}</button>
                </div>
              ))}
              <div className={clsx(css.groups, 'scrollable')}>
                {state.groups.map((group) => {
                  const headingId = `${id}-${group.id}`
                  return (
                    <section role="group" aria-labelledby={headingId} className={css.group} key={group.id}>
                      <div className={css.groupTitle} id={headingId}>{group.name}</div>
                      {group.models.map((model) => {
                        const selected = state.current?.provider === group.id && state.current.model === model.id
                        return (
                          <button
                            ref={itemRef()}
                            type="button"
                            role="menuitemradio"
                            aria-checked={selected}
                            className={clsx(css.option, selected && css.selected)}
                            key={model.id}
                            title={model.name}
                            disabled={busy}
                            onClick={() => { choose({ provider: group.id, model: model.id }) }}
                          >
                            <span className={css.optionCopy}>
                              <span className={css.modelName}>{model.name}</span>
                              {model.description !== undefined && (
                                <span className={css.description}>{model.description}</span>
                              )}
                            </span>
                            <span className={css.check}>
                              {selected ? <IconCheckOutline16 /> : null}
                            </span>
                          </button>
                        )
                      })}
                    </section>
                  )
                })}
              </div>
              {state.status === 'ready' && choices.length === 0 && (
                <div className={css.empty}>{t('empty.models')}</div>
              )}
            </>
          )}

        </div>
      )}
      {toast !== null && (
        <Toast
          key={toast.seq}
          text={toast.text}
          icon={<IconWarningOutline16 />}
          anchor={rootRef.current?.closest<HTMLElement>('[data-composer-card]') ?? null}
          onDone={() => { setToast(null) }}
        />
      )}
    </div>
  )
}
