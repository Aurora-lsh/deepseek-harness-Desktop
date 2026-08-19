/**
 * `model` namespace dictionaries.
 *
 * `trigger.selectAria` reads identically to `trigger.fallback` today and is
 * still a separate key: the visible fallback label and the accessible name of
 * an unset trigger are free to diverge per locale, and folding it into
 * `trigger.aria` would announce the degenerate "Select model, current Select
 * model".
 */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'command.description': '选择本会话使用的模型',
  'option.loadError': '目录加载失败：{message}',
  'trigger.fallback': '选择模型',
  'trigger.selectAria': '选择模型',
  'trigger.aria': '选择模型，当前 {model}',
  'trigger.ariaEffort': '选择模型，当前 {model}，推理等级 {effort}',
  'menu.aria': '模型与推理等级',
  'menu.model': '模型',
  'menu.effort': '推理等级',
  'menu.advanced': '高级',
  'effort.providerDefault': '自动',
  'effort.low': '低',
  'effort.medium': '中',
  'effort.high': '高',
  'effort.xhigh': '极高',
  'status.loading': '正在刷新模型列表…',
  'error.action': '模型操作失败：{message}',
  'notice.fallback': '原模型 {model} 已被删除，已切换到默认模型 {fallback}',
  'action.reload': '重新加载',
  'warning.groupLoad': '{name} 加载失败：{message}',
  'empty.models': '没有可用的模型。',
  'blocked.composer': '当前模型不可用，请先选择模型',
  'empty.efforts': '当前模型不支持推理强度设置',
} satisfies Record<string, string>

/** The model namespace key union. */
export type ModelKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'command.description': 'Select the model for this conversation',
  'option.loadError': 'Catalog failed to load: {message}',
  'trigger.fallback': 'Select model',
  'trigger.selectAria': 'Select model',
  'trigger.aria': 'Select model, current {model}',
  'trigger.ariaEffort': 'Select model, current {model}, reasoning effort {effort}',
  'menu.aria': 'Model and reasoning effort',
  'menu.model': 'Model',
  'menu.effort': 'Effort',
  'menu.advanced': 'Advanced',
  'effort.providerDefault': 'Default',
  'effort.low': 'Low',
  'effort.medium': 'Medium',
  'effort.high': 'High',
  'effort.xhigh': 'Very high',
  'status.loading': 'Refreshing model list…',
  'error.action': 'Model operation failed: {message}',
  'notice.fallback': 'The removed model {model} was replaced with the default model {fallback}.',
  'action.reload': 'Reload',
  'warning.groupLoad': '{name} failed to load: {message}',
  'empty.models': 'No models available.',
  'blocked.composer': 'This model is unavailable — select one to continue',
  'empty.efforts': 'This model does not support reasoning effort controls.',
} satisfies Record<ModelKey, string>
