import { TranslationBundle } from '@jupyterlab/translation';

import * as React from 'react';

import { IComponentProps, ToolCallApproval } from '../token';

/**
 * Configuration for rendering tool call status.
 */
interface IStatusConfig {
  cssClass: string;
  statusClass: string;
  open?: boolean;
}

/**
 * Tool call status types.
 */
export type ToolCallStatus =
  | 'pending'
  | 'awaiting_approval'
  | 'approved'
  | 'rejected'
  | 'completed'
  | 'error';

const STATUS_CONFIG: Record<ToolCallStatus, IStatusConfig> = {
  pending: {
    cssClass: 'jp-ai-tool-pending',
    statusClass: 'jp-ai-tool-status-pending'
  },
  awaiting_approval: {
    cssClass: 'jp-ai-tool-pending',
    statusClass: 'jp-ai-tool-status-approval',
    open: true
  },
  approved: {
    cssClass: 'jp-ai-tool-pending',
    statusClass: 'jp-ai-tool-status-completed'
  },
  rejected: {
    cssClass: 'jp-ai-tool-error',
    statusClass: 'jp-ai-tool-status-error'
  },
  completed: {
    cssClass: 'jp-ai-tool-completed',
    statusClass: 'jp-ai-tool-status-completed'
  },
  error: {
    cssClass: 'jp-ai-tool-error',
    statusClass: 'jp-ai-tool-status-error'
  }
};

/**
 * Options for building tool call HTML.
 */
export interface IToolCallMetadata {
  toolName: string;
  input: string;
  status: ToolCallStatus;
  summary?: string;
  output?: string;
  targetId?: string;
  approvalId?: string;
}

/**
 * Options for building tool call HTML.
 */
export interface IToolCallProps extends IComponentProps, IToolCallMetadata {
  toolCallApproval?: ToolCallApproval;
}

export function escapeHtml(value: string): string {
  // Prefer the same native escaping approach used in JupyterLab itself
  // (e.g. `@jupyterlab/completer`).
  if (typeof document !== 'undefined') {
    const node = document.createElement('span');
    node.textContent = value;
    return node.innerHTML;
  }

  // Fallback
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Returns the translated status text for a given tool status.
 */
const getStatusText = (
  status: ToolCallStatus,
  trans: TranslationBundle
): string => {
  switch (status) {
    case 'pending':
      return trans.__('Running...');
    case 'awaiting_approval':
      return trans.__('Awaiting Approval');
    case 'approved':
      return trans.__('Approved - Executing...');
    case 'rejected':
      return trans.__('Rejected');
    case 'completed':
      return trans.__('Completed');
    case 'error':
      return trans.__('Error');
  }
};

/**
 * React functional component for displaying a tool call.
 *
 * Renders a collapsible details element showing tool execution information
 * including input, output, and approval buttons if needed.
 */
export const ToolCall: React.FC<IToolCallProps> = ({
  toolName,
  input,
  status,
  summary,
  output,
  targetId,
  approvalId,
  trans,
  toolCallApproval
}) => {
  const config = STATUS_CONFIG[status];
  const statusText = getStatusText(status, trans);
  const resultLabel =
    status === 'error' ? trans.__('Error') : trans.__('Result');

  if (status === 'awaiting_approval' && !toolCallApproval) {
    console.error(
      'The tool call has no approval function, approval, it will not work as expected'
    );
  }

  return (
    <details
      className={`jp-ai-tool-call ${config.cssClass}`}
      open={config.open}
    >
      <summary className="jp-ai-tool-header">
        <div className="jp-ai-tool-icon">⚡</div>
        <div className="jp-ai-tool-title">
          {toolName}
          {summary && <span className="jp-ai-tool-summary">{summary}</span>}
        </div>
        <div className={`jp-ai-tool-status ${config.statusClass}`}>
          {statusText}
        </div>
      </summary>
      <div className="jp-ai-tool-body">
        {/* Input section */}
        <div className="jp-ai-tool-section">
          <div className="jp-ai-tool-label">{trans.__('Input')}</div>
          <pre className="jp-ai-tool-code">
            <code>{input}</code>
          </pre>
        </div>

        {/* Approval buttons */}
        {status === 'awaiting_approval' && approvalId && targetId && (
          <div
            className={`jp-ai-tool-approval-buttons jp-ai-approval-id--${approvalId}`}
          >
            <button
              className="jp-ai-approval-btn jp-ai-approval-approve"
              onClick={() => toolCallApproval?.(targetId, approvalId, true)}
            >
              {trans.__('Approve')}
            </button>
            <button
              className="jp-ai-approval-btn jp-ai-approval-reject"
              onClick={() => toolCallApproval?.(targetId, approvalId, false)}
            >
              {trans.__('Reject')}
            </button>
          </div>
        )}

        {/* Output section */}
        {output !== undefined && (
          <div className="jp-ai-tool-section">
            <div className="jp-ai-tool-label">{resultLabel}</div>
            <pre className="jp-ai-tool-code">
              <code>{output}</code>
            </pre>
          </div>
        )}
      </div>
    </details>
  );
};
