import { PathExt } from '@jupyterlab/coreutils';
import { nullTranslator, TranslationBundle } from '@jupyterlab/translation';

import * as React from 'react';
import { structuredPatch } from 'diff';
import type { StructuredPatchHunk } from 'diff';

import {
  IInlineDiff,
  IInlineDiffMetadata,
  IInlineDiffNotebookCellTarget
} from '../token';

/** Maximum number of rendered lines before truncation. */
const MAX_DIFF_LINES = 20;

interface IDiffLineInfo {
  cssClass: string;
  prefix: string;
  text: string;
  key: string;
}

export interface IInlineDiffProps extends IInlineDiffMetadata {
  trans?: TranslationBundle;
}

export function getDiffFilename(path: string): string {
  return PathExt.basename(path);
}

function getNotebookCellLabel(target: IInlineDiffNotebookCellTarget): string {
  if (typeof target.cellIndex === 'number') {
    return `Cell ${target.cellIndex + 1}`;
  }

  if (target.cellId) {
    return `Cell ${target.cellId}`;
  }

  return 'Notebook Cell';
}

function getInlineDiffPatchPath(diff: IInlineDiff): string {
  const target = diff.target;

  if (target.kind === 'file') {
    return target.path;
  }

  return [target.notebookPath, target.cellId ?? target.cellIndex]
    .filter(value => value !== undefined && value !== '')
    .join('#');
}

export function getInlineDiffLabel(diff: IInlineDiff): string {
  if (diff.label) {
    return diff.label;
  }

  const target = diff.target;

  if (target.kind === 'file') {
    return getDiffFilename(target.path);
  }

  const notebookName = getDiffFilename(target.notebookPath);
  const cellLabel = getNotebookCellLabel(target);

  return [notebookName, cellLabel].join(' · ');
}

export function getInlineDiffTitle(diff: IInlineDiff): string {
  const target = diff.target;

  if (target.kind === 'file') {
    return target.path;
  }

  const cellLabel = getNotebookCellLabel(target);
  const cellIdLabel =
    typeof target.cellIndex === 'number' && target.cellId
      ? `Cell ID ${target.cellId}`
      : null;

  return [target.notebookPath, cellLabel, cellIdLabel]
    .filter(part => part !== null && part !== undefined && part !== '')
    .join(' · ');
}

function toLineInfo(
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
        return toLineInfo('added', text, key);
      }

      if (prefix === '-') {
        return toLineInfo('removed', text, key);
      }

      return toLineInfo('context', text, key);
    });
}

function buildDiffLines(diff: IInlineDiff): IDiffLineInfo[] {
  const patchPath = getInlineDiffPatchPath(diff);
  const patch = structuredPatch(
    patchPath,
    patchPath,
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

function DiffBlock({
  diff,
  trans
}: {
  diff: IInlineDiff;
  trans: TranslationBundle;
}): JSX.Element {
  const filename = getInlineDiffLabel(diff);
  const title = getInlineDiffTitle(diff);
  const [expanded, setExpanded] = React.useState(false);
  const allLines = React.useMemo(() => buildDiffLines(diff), [diff]);
  const canTruncate = allLines.length > MAX_DIFF_LINES;
  const visibleLines =
    canTruncate && !expanded ? allLines.slice(0, MAX_DIFF_LINES) : allLines;
  const hiddenCount = allLines.length - MAX_DIFF_LINES;

  return (
    <div className="jp-ai-inline-diff-block">
      <div className="jp-ai-inline-diff-header" title={title}>
        {filename}
      </div>
      <div className="jp-ai-inline-diff-content">
        {visibleLines.length ? (
          visibleLines.map(line => (
            <div
              key={line.key}
              className={`jp-ai-inline-diff-line ${line.cssClass}`}
            >
              <span className="jp-ai-inline-diff-line-prefix">
                {line.prefix}
              </span>
              <span className="jp-ai-inline-diff-line-text">{line.text}</span>
            </div>
          ))
        ) : (
          <div className="jp-ai-inline-diff-empty">
            {trans.__('No changes')}
          </div>
        )}
        {canTruncate && !expanded && (
          <button
            className="jp-ai-inline-diff-toggle"
            onClick={() => setExpanded(true)}
            type="button"
          >
            {trans.__('... %1 more lines', hiddenCount)}
          </button>
        )}
        {canTruncate && expanded && (
          <button
            className="jp-ai-inline-diff-toggle"
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

/**
 * React component for rendering one or more inline diffs.
 */
export const InlineDiff: React.FC<IInlineDiffProps> = ({ diffs, trans }) => {
  const transBundle = trans ?? nullTranslator.load('jupyterlab');

  return (
    <div className="jp-ai-inline-diff-container">
      {diffs.map((diff, index) => (
        <DiffBlock
          key={`${getInlineDiffPatchPath(diff)}-${index}`}
          diff={diff}
          trans={transBundle}
        />
      ))}
    </div>
  );
};
