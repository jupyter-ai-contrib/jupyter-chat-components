import { PageConfig, PathExt } from '@jupyterlab/coreutils';
import { nullTranslator, TranslationBundle } from '@jupyterlab/translation';

import * as React from 'react';
import { structuredPatch } from 'diff';
import type { StructuredPatchHunk } from 'diff';

import {
  IComponentProps,
  IToolCallDiff,
  IToolCallsEntry,
  IToolCallsMetadata,
  OpenToolCallPath,
  ToolCallPermissionDecision
} from '../token';

/** Maximum number of rendered diff lines before truncation. */
const MAX_DIFF_LINES = 20;

/** Maximum number of lines shown in an expanded detail. */
const MAX_DETAIL_LINES = 15;

/** Tool kinds where expanded view shows file paths from locations. */
const FILE_KINDS = new Set(['read', 'edit', 'delete', 'move']);

const TOOL_KIND_LABELS: Record<string, string> = {
  read: 'Reading',
  edit: 'Editing',
  delete: 'Deleting',
  move: 'Moving',
  search: 'Searching',
  execute: 'Running command',
  think: 'Thinking',
  fetch: 'Fetching',
  switch_mode: 'Switching mode'
};

interface IDiffLineInfo {
  cssClass: string;
  prefix: string;
  text: string;
  key: string;
}

/**
 * Props for rendering grouped tool calls.
 */
export interface IGroupedToolCallsProps
  extends IComponentProps, IToolCallsMetadata {
  toolCallPermissionDecision?: ToolCallPermissionDecision;
  openToolCallPath?: OpenToolCallPath;
}

function getConfiguredServerRoot(): string | null {
  const rootUri = PageConfig.getOption('rootUri');

  if (rootUri) {
    try {
      return new URL(rootUri, 'http://localhost').pathname;
    } catch (error) {
      console.warn(
        'Could not parse rootUri while rendering tool calls.',
        error
      );
    }
  }

  const serverRoot = PageConfig.getOption('serverRoot');
  return serverRoot || null;
}

/**
 * Convert an absolute filesystem path to a server-relative path when possible.
 */
export function toServerRelativePath(absolutePath: string): string {
  const serverRoot = getConfiguredServerRoot();

  if (!serverRoot) {
    return absolutePath;
  }

  const relativePath = PathExt.relative(serverRoot, absolutePath);
  if (relativePath.startsWith('..')) {
    return absolutePath;
  }

  return relativePath;
}

/**
 * Format tool payload (input/output) for display.
 */
export function formatToolCallIO(payload: unknown): string {
  if (typeof payload === 'string') {
    return payload;
  }

  if (
    Array.isArray(payload) &&
    payload.every(
      item =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as { text?: unknown }).text === 'string'
    )
  ) {
    return payload.map(item => (item as { text: string }).text).join('\n');
  }

  return JSON.stringify(payload, null, 2);
}

function getLocationSummary(toolCall: IToolCallsEntry): string | null {
  const firstLocation = toolCall.locations?.[0];

  if (!firstLocation) {
    return null;
  }

  return PathExt.basename(firstLocation) || firstLocation;
}

/**
 * Compute the line title shown for a tool call.
 */
export function getToolCallDisplayTitle(toolCall: IToolCallsEntry): string {
  const title = toolCall.title?.trim();

  if (title) {
    return title;
  }

  const verb = TOOL_KIND_LABELS[toolCall.kind ?? ''] ?? 'Working';
  const location = getLocationSummary(toolCall);

  if (location) {
    return `${verb} ${location}`;
  }

  return `${verb}...`;
}

/**
 * Compute the pre-permission detail text for a tool call, or null if the
 * title alone is enough.
 */
export function buildPermissionDetail(
  toolCall: IToolCallsEntry
): string | null {
  const { kind, title, locations, rawInput } = toolCall;

  if (kind === 'execute') {
    const rawObject =
      typeof rawInput === 'object' &&
      rawInput !== null &&
      !Array.isArray(rawInput)
        ? (rawInput as Record<string, unknown>)
        : null;
    const command =
      rawObject && typeof rawObject.command === 'string'
        ? rawObject.command
        : title
            ?.replace(/^Running:\s*/i, '')
            .replace(/\.\.\.$/, '')
            .trim() || null;

    if (!command || command === title) {
      return null;
    }

    return '$ ' + command;
  }

  if (
    (kind === 'delete' || kind === 'move' || kind === 'read') &&
    locations?.length
  ) {
    return kind === 'move' && locations.length >= 2
      ? `${toServerRelativePath(locations[0])}  \u2192  ${toServerRelativePath(
          locations[1]
        )}`
      : locations.map(toServerRelativePath).join('\n');
  }

  if (
    rawInput !== null &&
    rawInput !== undefined &&
    typeof rawInput === 'object' &&
    !Array.isArray(rawInput)
  ) {
    const rawObject = rawInput as Record<string, unknown>;
    const purpose =
      typeof rawObject.__tool_use_purpose === 'string'
        ? rawObject.__tool_use_purpose
        : null;
    const paramEntries = Object.entries(rawObject).filter(
      ([key]) => !key.startsWith('__')
    );
    const filteredParams = paramEntries.reduce<Record<string, unknown>>(
      (result, [key, value]) => {
        result[key] = value;
        return result;
      },
      {}
    );
    const params =
      paramEntries.length > 0 ? formatToolCallIO(filteredParams) : null;

    if (purpose && params) {
      return `${purpose}\n${params}`;
    }

    if (purpose) {
      return purpose;
    }

    if (params) {
      return params;
    }

    return null;
  }

  if (rawInput !== null && rawInput !== undefined) {
    return formatToolCallIO(rawInput);
  }

  return null;
}

/**
 * Returns true when a completed/failed tool call has expandable detail content.
 */
function hasDetailContent(toolCall: IToolCallsEntry): boolean {
  const { kind, locations, rawInput, rawOutput } = toolCall;
  const hasInput = rawInput !== null && rawInput !== undefined;
  const hasOutput = rawOutput !== null && rawOutput !== undefined;

  if (kind && FILE_KINDS.has(kind) && locations?.length) {
    return true;
  }
  return hasInput || hasOutput;
}

function toDiffLineInfo(
  type: 'added' | 'removed' | 'context',
  text: string,
  key: string
): IDiffLineInfo {
  switch (type) {
    case 'added':
      return {
        cssClass: 'jp-mod-added',
        prefix: '+',
        text,
        key
      };
    case 'removed':
      return {
        cssClass: 'jp-mod-removed',
        prefix: '-',
        text,
        key
      };
    case 'context':
      return {
        cssClass: 'jp-mod-context',
        prefix: ' ',
        text,
        key
      };
  }
}

function buildDiffLinesFromHunk(
  hunk: StructuredPatchHunk,
  hunkIndex: number
): IDiffLineInfo[] {
  return hunk.lines
    .filter(line => !line.startsWith('\\'))
    .map((line, lineIndex) => {
      const prefix = line[0] ?? ' ';
      const text = line.slice(1);
      const key = `${hunkIndex}-${hunk.oldStart}-${hunk.newStart}-${lineIndex}`;

      if (prefix === '+') {
        return toDiffLineInfo('added', text, key);
      }

      if (prefix === '-') {
        return toDiffLineInfo('removed', text, key);
      }

      return toDiffLineInfo('context', text, key);
    });
}

function buildDiffLines(diff: IToolCallDiff): IDiffLineInfo[] {
  const patch = structuredPatch(
    diff.path,
    diff.path,
    diff.oldText ?? '',
    diff.newText,
    undefined,
    undefined,
    { context: Infinity }
  );

  return patch.hunks.reduce<IDiffLineInfo[]>((lines, hunk, index) => {
    lines.push(...buildDiffLinesFromHunk(hunk, index));
    return lines;
  }, []);
}

/**
 * A labeled section with a capped height and show-all/show-less toggle.
 */
function ToolCallSection({
  label,
  children,
  trans
}: {
  label: string;
  children: React.ReactNode;
  trans: TranslationBundle;
}): JSX.Element {
  const [expanded, setExpanded] = React.useState(false);
  const [isOverflowing, setIsOverflowing] = React.useState(false);
  const preRef = React.useRef<HTMLPreElement>(null);

  React.useEffect(() => {
    const details = preRef.current?.closest('details');
    if (!details) {
      return;
    }
    const handleToggle = () => {
      if (!details.open) {
        setExpanded(false);
      }
    };
    details.addEventListener('toggle', handleToggle);
    return () => details.removeEventListener('toggle', handleToggle);
  }, []);

  React.useLayoutEffect(() => {
    const el = preRef.current;
    if (!el) {
      return;
    }
    const measure = () => {
      if (!expanded) {
        setIsOverflowing(el.scrollHeight > el.clientHeight);
      }
    };
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    measure();
    return () => observer.disconnect();
  }, [expanded]);

  return (
    <div className="jp-ai-tool-call-detail-section">
      <div className="jp-ai-tool-call-detail-label">{label}</div>
      <pre
        ref={preRef}
        className="jp-ai-tool-call-detail-code"
        style={{
          maxHeight: expanded
            ? undefined
            : `calc(${MAX_DETAIL_LINES} * var(--jp-content-line-height) * var(--jp-ui-font-size1))`
        }}
      >
        <code>{children}</code>
      </pre>
      {!expanded && isOverflowing && (
        <button
          className="jp-ai-tool-call-diff-toggle"
          onClick={() => setExpanded(true)}
          type="button"
        >
          {trans.__('Show all')}
        </button>
      )}
      {expanded && (
        <button
          className="jp-ai-tool-call-diff-toggle"
          onClick={() => setExpanded(false)}
          type="button"
        >
          {trans.__('Show less')}
        </button>
      )}
    </div>
  );
}

/**
 * Expandable detail view for a completed or failed tool call.
 */
function ToolCallDetail({
  toolCall,
  trans
}: {
  toolCall: IToolCallsEntry;
  trans: TranslationBundle;
}): JSX.Element {
  const { kind, locations, rawInput, rawOutput } = toolCall;
  const hasInput = rawInput !== null && rawInput !== undefined;
  const hasOutput = rawOutput !== null && rawOutput !== undefined;

  if (kind && FILE_KINDS.has(kind) && locations?.length) {
    return (
      <div className="jp-ai-tool-call-item-detail">
        {locations.map((loc, i) => (
          <div key={i} className="jp-ai-tool-call-item-detail-path">
            {toServerRelativePath(loc)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="jp-ai-tool-call-item-detail">
      {hasInput && (
        <ToolCallSection label={trans.__('Input')} trans={trans}>
          {formatToolCallIO(rawInput)}
        </ToolCallSection>
      )}
      {hasOutput && (
        <ToolCallSection label={trans.__('Output')} trans={trans}>
          {formatToolCallIO(rawOutput)}
        </ToolCallSection>
      )}
    </div>
  );
}

function ToolCallDiffBlock({
  diff,
  trans,
  openToolCallPath,
  pendingPermission
}: {
  diff: IToolCallDiff;
  trans: TranslationBundle;
  openToolCallPath?: OpenToolCallPath;
  pendingPermission?: boolean;
}): JSX.Element {
  const [expanded, setExpanded] = React.useState(false);
  const allLines = React.useMemo(() => buildDiffLines(diff), [diff]);
  const canTruncate = allLines.length > MAX_DIFF_LINES;
  const visibleLines =
    canTruncate && !expanded ? allLines.slice(0, MAX_DIFF_LINES) : allLines;
  const hiddenCount = allLines.length - MAX_DIFF_LINES;
  const displayPath = toServerRelativePath(diff.path);
  const canOpenPath =
    !!openToolCallPath && !(pendingPermission && !diff.oldText);

  return (
    <div className="jp-ai-tool-call-diff-block">
      <div
        className={`jp-ai-tool-call-diff-header${
          canOpenPath ? ' jp-ai-tool-call-diff-header-clickable' : ''
        }`}
        onClick={canOpenPath ? () => openToolCallPath!(displayPath) : undefined}
        title={displayPath}
      >
        {displayPath}
      </div>
      <div className="jp-ai-tool-call-diff-content">
        {visibleLines.length ? (
          visibleLines.map(line => (
            <div
              key={line.key}
              className={`jp-ai-tool-call-diff-line ${line.cssClass}`}
            >
              <span className="jp-ai-tool-call-diff-line-prefix">
                {line.prefix}
              </span>
              <span className="jp-ai-tool-call-diff-line-text">
                {line.text}
              </span>
            </div>
          ))
        ) : (
          <div className="jp-ai-tool-call-diff-empty">
            {trans.__('No changes')}
          </div>
        )}
        {canTruncate && !expanded && (
          <button
            className="jp-ai-tool-call-diff-toggle"
            onClick={() => setExpanded(true)}
            type="button"
          >
            {trans.__('... %1 more lines', hiddenCount)}
          </button>
        )}
        {canTruncate && expanded && (
          <button
            className="jp-ai-tool-call-diff-toggle"
            onClick={() => setExpanded(false)}
            type="button"
          >
            {trans.__('Show less')}
          </button>
        )}
      </div>
    </div>
  );
}

function ToolCallDiffView({
  diffs,
  trans,
  openToolCallPath,
  pendingPermission
}: {
  diffs: IToolCallDiff[];
  trans: TranslationBundle;
  openToolCallPath?: OpenToolCallPath;
  pendingPermission?: boolean;
}): JSX.Element {
  return (
    <div className="jp-ai-tool-call-diff-container">
      {diffs.map((diff, index) => (
        <ToolCallDiffBlock
          key={`${diff.path}-${index}`}
          diff={diff}
          trans={trans}
          openToolCallPath={openToolCallPath}
          pendingPermission={pendingPermission}
        />
      ))}
    </div>
  );
}

function PermissionLabel({
  toolCall
}: {
  toolCall: IToolCallsEntry;
}): JSX.Element | null {
  if (toolCall.permissionStatus !== 'resolved' || !toolCall.selectedOptionId) {
    return null;
  }

  const selectedName = toolCall.permissionOptions?.find(
    option => option.optionId === toolCall.selectedOptionId
  )?.name;

  if (!selectedName) {
    return null;
  }

  return (
    <span className="jp-ai-tool-call-permission-label"> - {selectedName}</span>
  );
}

function PermissionButtons({
  toolCall,
  trans,
  toolCallPermissionDecision
}: {
  toolCall: IToolCallsEntry;
  trans: TranslationBundle;
  toolCallPermissionDecision?: ToolCallPermissionDecision;
}): JSX.Element | null {
  const [submitting, setSubmitting] = React.useState(false);

  if (
    !toolCall.permissionOptions?.length ||
    toolCall.permissionStatus !== 'pending'
  ) {
    return null;
  }

  const canSubmit =
    !!toolCallPermissionDecision &&
    !!toolCall.sessionId &&
    !!toolCall.toolCallId;

  const handleClick = async (optionId: string) => {
    if (!canSubmit) {
      return;
    }

    setSubmitting(true);

    try {
      await toolCallPermissionDecision!(
        toolCall.sessionId!,
        toolCall.toolCallId,
        optionId
      );
    } catch (error) {
      console.error('Failed to submit tool call permission decision:', error);
      setSubmitting(false);
    }
  };

  return (
    <div className="jp-ai-tool-call-permission-buttons">
      <span className="jp-ai-tool-call-permission-tree">{'\u2514\u2500'}</span>
      <span>{trans.__('Allow?')}</span>
      {toolCall.permissionOptions.map(option => {
        const optionClass = option.kind
          ? ` jp-ai-tool-call-permission-btn-${option.kind.replace(/_/g, '-')}`
          : '';

        return (
          <button
            key={option.optionId}
            className={`jp-ai-tool-call-permission-btn${optionClass}`}
            onClick={() => handleClick(option.optionId)}
            disabled={submitting || !canSubmit}
            title={option.kind}
            type="button"
          >
            {option.name}
          </button>
        );
      })}
    </div>
  );
}

function ToolCallRow({
  toolCall,
  trans,
  openToolCallPath,
  toolCallPermissionDecision
}: {
  toolCall: IToolCallsEntry;
  trans: TranslationBundle;
  openToolCallPath?: OpenToolCallPath;
  toolCallPermissionDecision?: ToolCallPermissionDecision;
}): JSX.Element {
  const displayTitle = getToolCallDisplayTitle(toolCall);
  const selectedOption = toolCall.permissionOptions?.find(
    option => option.optionId === toolCall.selectedOptionId
  );
  const status = toolCall.status ?? 'in_progress';

  const isRejected =
    toolCall.permissionStatus === 'resolved' &&
    (!!selectedOption?.kind?.includes('reject') || status === 'rejected');
  const hasPendingPermission = toolCall.permissionStatus === 'pending';
  const isInProgress =
    !isRejected &&
    (status === 'in_progress' || status === 'pending' || hasPendingPermission);
  const isCompleted = status === 'completed';
  const isFailed = status === 'failed' || isRejected;
  const icon = isInProgress
    ? '\u2022'
    : isCompleted
      ? '\u2713'
      : isFailed
        ? '\u2717'
        : '\u2022';
  const effectiveStatus = (isRejected ? 'failed' : status).replace(/_/g, '-');

  const hasDiffs = !!toolCall.diffs?.length;
  const hasExpandableContent =
    hasDiffs ||
    (!hasDiffs && (isCompleted || isFailed) && hasDetailContent(toolCall));

  const cssClass = `jp-ai-tool-call-item jp-ai-tool-call-item-${effectiveStatus}${!hasExpandableContent && !hasPendingPermission ? ' jp-ai-tool-call-item-no-detail' : ''}`;

  if (hasDiffs && hasPendingPermission) {
    return (
      <div className={cssClass}>
        <details open>
          <summary>
            <span className="jp-ai-tool-call-item-icon">{icon}</span>{' '}
            <div className="jp-ai-tool-call-item-title">
              {displayTitle}
              {toolCall.summary && (
                <span className="jp-ai-tool-call-item-summary">
                  {'  '}
                  {toolCall.summary}
                </span>
              )}
            </div>
          </summary>
          <ToolCallDiffView
            diffs={toolCall.diffs!}
            trans={trans}
            openToolCallPath={openToolCallPath}
            pendingPermission
          />
        </details>
        <PermissionButtons
          toolCall={toolCall}
          trans={trans}
          toolCallPermissionDecision={toolCallPermissionDecision}
        />
      </div>
    );
  }

  if (!hasDiffs && hasPendingPermission) {
    const permissionDetail = buildPermissionDetail(toolCall);

    if (permissionDetail !== null) {
      return (
        <div className={cssClass}>
          <details open>
            <summary>
              <span className="jp-ai-tool-call-item-icon">{icon}</span>{' '}
              <div className="jp-ai-tool-call-item-title">
                {displayTitle}
                {toolCall.summary && (
                  <span className="jp-ai-tool-call-item-summary">
                    {'  '}
                    {toolCall.summary}
                  </span>
                )}
              </div>
            </summary>
            <div className="jp-ai-tool-call-item-detail">
              {permissionDetail}
            </div>
          </details>
          <PermissionButtons
            toolCall={toolCall}
            trans={trans}
            toolCallPermissionDecision={toolCallPermissionDecision}
          />
        </div>
      );
    }
  }

  if ((isCompleted || isFailed) && hasExpandableContent) {
    return (
      <details className={cssClass}>
        <summary>
          <span className="jp-ai-tool-call-item-icon">{icon}</span>{' '}
          <div className="jp-ai-tool-call-item-title">
            {displayTitle}
            {toolCall.summary && (
              <span className="jp-ai-tool-call-item-summary">
                {'  '}
                {toolCall.summary}
              </span>
            )}
          </div>
          <PermissionLabel toolCall={toolCall} />
        </summary>
        {hasDiffs ? (
          <ToolCallDiffView
            diffs={toolCall.diffs!}
            trans={trans}
            openToolCallPath={openToolCallPath}
          />
        ) : (
          <ToolCallDetail toolCall={toolCall} trans={trans} />
        )}
      </details>
    );
  }

  if (isInProgress) {
    return (
      <div className={cssClass}>
        <span className="jp-ai-tool-call-item-icon">{icon}</span>{' '}
        <div className="jp-ai-tool-call-item-title">
          {displayTitle}
          {toolCall.summary && (
            <span className="jp-ai-tool-call-item-summary">
              {'  '}
              {toolCall.summary}
            </span>
          )}
        </div>
        <PermissionButtons
          toolCall={toolCall}
          trans={trans}
          toolCallPermissionDecision={toolCallPermissionDecision}
        />
      </div>
    );
  }

  return (
    <div className={cssClass}>
      <span className="jp-ai-tool-call-item-icon">{icon}</span>
      <div className="jp-ai-tool-call-item-title">
        {displayTitle}
        {toolCall.summary && (
          <span className="jp-ai-tool-call-item-summary">
            {'  '}
            {toolCall.summary}
          </span>
        )}
      </div>
      <PermissionLabel toolCall={toolCall} />
    </div>
  );
}

/**
 * React component for rendering grouped tool calls.
 */
export const GroupedToolCalls: React.FC<IGroupedToolCallsProps> = props => {
  const trans = props.trans ?? nullTranslator.load('jupyterlab');
  const { toolCalls } = props;

  if (!toolCalls.length) {
    return null;
  }

  return (
    <div className="jp-ai-tool-calls">
      {toolCalls.map(toolCall => (
        <ToolCallRow
          key={toolCall.toolCallId}
          toolCall={toolCall}
          trans={trans}
          openToolCallPath={props.openToolCallPath}
          toolCallPermissionDecision={props.toolCallPermissionDecision}
        />
      ))}
    </div>
  );
};
