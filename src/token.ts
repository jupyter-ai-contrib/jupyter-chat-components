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
 * A single file diff entry.
 */
export interface IInlineDiff {
  path: string;
  newText: string;
  oldText?: string;
}

/**
 * Metadata for rendering inline diffs.
 */
export interface IInlineDiffMetadata {
  diffs: IInlineDiff[];
}
