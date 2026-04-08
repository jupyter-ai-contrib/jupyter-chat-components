import { IRenderMime } from '@jupyterlab/rendermime-interfaces';

import { TranslationBundle } from '@jupyterlab/translation';

import { Token } from '@lumino/coreutils';

import * as React from 'react';

/**
 * The token providing the chat components renderer.
 */
export const IComponentsRendererFactory = new Token<IComponentsRendererFactory>(
  'jupyter-chat-components:IComponentsRendererFactory',
  'The chat components renderer factory'
);

/**
 * The callback to approve or reject a tool.
 */
export type ToolCallApproval =
  | ((targetId: string, approvalId: string, approve: boolean) => void)
  | null;

/**
 * The callback to submit a tool-call permission decision.
 */
export type ToolCallPermissionDecision =
  | ((
      sessionId: string,
      toolCallId: string,
      optionId: string
    ) => Promise<void> | void)
  | null;

/**
 * The callback to remove a queued message.
 */
export type RemoveQueuedMessage =
  | ((targetId: string, messageId: string) => void)
  | null;

/**
 * The callback to open a file or resource path referenced by a tool call.
 */
export type OpenToolCallPath = ((path: string) => void) | null;

/**
 * The interface for components renderer factory.
 */
export interface IComponentsRendererFactory
  extends IRenderMime.IRendererFactory {
  /**
   * The registry of React components available for rendering.
   */
  registry: IComponentRegistry;

  /**
   * The callback to approve or reject a tool.
   */
  toolCallApproval: ToolCallApproval;

  /**
   * The callback to remove a queued message.
   */
  removeQueuedMessage: RemoveQueuedMessage;

  /**
   * The callback to submit a permission decision for grouped tool calls.
   */
  toolCallPermissionDecision: ToolCallPermissionDecision;

  /**
   * The callback to open a path referenced by grouped tool calls.
   */
  openToolCallPath: OpenToolCallPath;
}

/**
 * The interface for the component registry.
 */
export interface IComponentRegistry {
  /**
   * Register a React component.
   *
   * @param name - The unique name/identifier for the component
   * @param component - The React component
   */
  add(name: string, component: React.ComponentType<any>): void;

  /**
   * Get a registered component by name.
   *
   * @param name - The name of the component
   * @returns The React component, or undefined if not found
   */
  get(name: string): React.ComponentType<any> | undefined;

  /**
   * Check if a component is registered.
   *
   * @param name - The name of the component
   * @returns True if the component is registered
   */
  has(name: string): boolean;

  /**
   * Get all registered component names.
   *
   * @returns Array of component names
   */
  getNames(): string[];
}

/**
 * The minimal required properties for the component.
 */
export interface IComponentProps {
  /**
   * The translation bundle.
   */
  trans: TranslationBundle;
}

/**
 * A file diff entry for grouped tool calls.
 */
export interface IToolCallDiff {
  /**
   * Path of the file being diffed.
   */
  path: string;
  /**
   * Updated text content.
   */
  newText: string;
  /**
   * Previous text content.
   */
  oldText?: string;
}

/**
 * A permission option for grouped tool calls.
 */
export interface IToolCallPermissionOption {
  /**
   * Stable permission option identifier.
   */
  optionId: string;
  /**
   * Human-readable button label.
   */
  name: string;
  /**
   * Optional semantic option kind, such as allow_once or reject_once.
   */
  kind?: string;
}

/**
 * A single grouped tool call entry.
 */
export interface IToolCallsEntry {
  /**
   * Unique tool call identifier.
   */
  toolCallId: string;
  /**
   * Human-readable title displayed in the UI.
   */
  title?: string;
  /**
   * Tool operation category.
   */
  kind?: string;
  /**
   * Current tool call status.
   */
  status?: string;
  /**
   * Tool input payload.
   */
  rawInput?: unknown;
  /**
   * Tool output payload.
   */
  rawOutput?: unknown;
  /**
   * File paths or resource locations referenced by the tool call.
   */
  locations?: string[];
  /**
   * Permission options presented to the user.
   */
  permissionOptions?: IToolCallPermissionOption[];
  /**
   * Permission request lifecycle state.
   */
  permissionStatus?: 'pending' | 'resolved';
  /**
   * Selected permission option identifier.
   */
  selectedOptionId?: string;
  /**
   * Session identifier used to route permission decisions.
   */
  sessionId?: string;
  /**
   * Optional inline file diffs associated with the tool call.
   */
  diffs?: IToolCallDiff[];
}

/**
 * Metadata for rendering grouped tool calls.
 */
export interface IToolCallsMetadata {
  /**
   * List of tool call entries.
   */
  toolCalls: IToolCallsEntry[];
}

/**
 * A file diff target.
 */
export interface IInlineDiffFileTarget {
  /**
   * Discriminator for a regular file diff target.
   */
  kind: 'file';
  /**
   * Path of the file being diffed.
   */
  path: string;
}

/**
 * A notebook cell diff target.
 */
export interface IInlineDiffNotebookCellTarget {
  /**
   * Discriminator for a notebook cell source diff target.
   */
  kind: 'cell';
  /**
   * Path of the notebook containing the cell.
   */
  notebookPath: string;
  /**
   * Stable cell identifier, when available from the producer.
   */
  cellId?: string;
  /**
   * Zero-based notebook cell index used for the default display label.
   */
  cellIndex?: number;
}

/**
 * A supported inline diff target.
 */
export type IInlineDiffTarget =
  | IInlineDiffFileTarget
  | IInlineDiffNotebookCellTarget;

/**
 * A single inline diff entry.
 */
export interface IInlineDiff {
  /**
   * Structured target metadata.
   */
  target: IInlineDiffTarget;
  /**
   * Optional explicit label for the diff header.
   */
  label?: string;
  /**
   * Updated text content for the diff target.
   */
  newText: string;
  /**
   * Previous text content for the diff target.
   */
  oldText?: string;
}

/**
 * Metadata for rendering inline diffs.
 */
export interface IInlineDiffMetadata {
  /**
   * List of inline diff entries to render.
   */
  diffs: IInlineDiff[];
}

/**
 * A single queued message entry.
 */
export interface IQueuedMessage {
  id: string;
  body: string;
}

/**
 * Metadata for the message queue component.
 */
export interface IMessageQueueMetadata {
  messages: IQueuedMessage[];
  targetId?: string;
}
