import { IRenderMime } from '@jupyterlab/rendermime-interfaces';

import { Token } from '@lumino/coreutils';

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
   * The callback to approve or reject a tool.
   */
  toolCallApproval: ToolCallApproval;
}
