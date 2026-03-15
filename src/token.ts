import { IRenderMime } from '@jupyterlab/rendermime-interfaces';

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
 * The token providing the chat components registry.
 */
export const IComponentRegistry = new Token<IComponentRegistry>(
  'jupyter-chat-components:IComponentRegistry',
  'The chat components registry'
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
