import * as React from 'react';

import { PathExt } from '@jupyterlab/coreutils';
import {
  checkIcon,
  closeIcon,
  editIcon,
  fileIcon,
  notebookIcon
} from '@jupyterlab/ui-components';

import {
  EditQueuedMessage,
  IComponentProps,
  IMessageQueueMetadata,
  IQueuedMessageAttachment,
  RemoveQueuedMessage,
  ReorderQueuedMessages
} from '../token';

export interface IMessageQueueProps
  extends IComponentProps, IMessageQueueMetadata {
  removeQueuedMessage?: RemoveQueuedMessage;
  reorderQueuedMessages?: ReorderQueuedMessages;
  editQueuedMessage?: EditQueuedMessage;
}

function AttachmentIcon({
  type
}: {
  type: IQueuedMessageAttachment['type'];
}): JSX.Element {
  const Icon = type === 'notebook' ? notebookIcon.react : fileIcon.react;
  return <Icon tag="span" className="jp-chat-message-queue-attachment-icon" />;
}

function attachmentName(attachment: IQueuedMessageAttachment): string {
  return PathExt.basename(attachment.value) || attachment.value;
}

export const MessageQueue: React.FC<IMessageQueueProps> = ({
  messages,
  targetId,
  trans,
  removeQueuedMessage,
  reorderQueuedMessages,
  editQueuedMessage
}) => {
  const [expanded, setExpanded] = React.useState(true);
  const [draggedIndex, setDraggedIndex] = React.useState<number | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editBody, setEditBody] = React.useState('');
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (editingId && textareaRef.current) {
      const ta = textareaRef.current;
      ta.focus();
      ta.selectionStart = ta.selectionEnd = ta.value.length;
      ta.style.height = 'auto';
      ta.style.height = ta.scrollHeight + 'px';
    }
  }, [editingId]);

  if (!messages || messages.length === 0) {
    return null;
  }

  const canDrag = !!reorderQueuedMessages && !!targetId;

  const handleDrop =
    (targetIndex: number) => (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (
        draggedIndex === null ||
        draggedIndex === targetIndex ||
        !reorderQueuedMessages ||
        !targetId
      ) {
        setDraggedIndex(null);
        return;
      }
      const reordered = [...messages];
      const [moved] = reordered.splice(draggedIndex, 1);
      reordered.splice(targetIndex, 0, moved);
      reorderQueuedMessages(
        targetId,
        reordered.map(m => m.id)
      );
      setDraggedIndex(null);
    };

  const handleEditStart = (id: string, body: string) => {
    setEditingId(id);
    setEditBody(body);
  };

  const handleEditSave = () => {
    if (!editQueuedMessage || !targetId || editingId === null) {
      return;
    }
    editQueuedMessage(targetId, editingId, editBody.trim());
    setEditingId(null);
  };

  const handleEditCancel = () => {
    setEditingId(null);
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleEditSave();
    } else if (e.key === 'Escape') {
      handleEditCancel();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditBody(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
  };

  return (
    <div className="jp-chat-message-queue">
      <div className="jp-chat-message-queue-header">
        <span className="jp-chat-message-queue-count">
          {trans.__('%1 queued', messages.length)}
        </span>
        <button
          className="jp-chat-message-queue-toggle"
          onClick={() => setExpanded(e => !e)}
          type="button"
          title={
            expanded ? trans.__('Collapse queue') : trans.__('Expand queue')
          }
          aria-expanded={expanded}
        >
          {expanded ? '▲' : '▼'}
        </button>
      </div>
      {expanded && (
        <div className="jp-chat-message-queue-list">
          {messages.map((msg, index) => (
            <div
              key={msg.id}
              className="jp-chat-message-queue-row"
              onDragOver={canDrag ? e => e.preventDefault() : undefined}
              onDrop={canDrag ? handleDrop(index) : undefined}
            >
              <div
                className={[
                  'jp-chat-message-queue-bubble',
                  draggedIndex === index
                    ? 'jp-chat-message-queue-bubble-dragging'
                    : ''
                ]
                  .filter(Boolean)
                  .join(' ')}
                draggable={canDrag && editingId !== msg.id}
                onDragStart={
                  canDrag && editingId !== msg.id
                    ? () => setDraggedIndex(index)
                    : undefined
                }
                onDragEnd={canDrag ? () => setDraggedIndex(null) : undefined}
                title={editingId === msg.id ? undefined : msg.body}
              >
                {canDrag && (
                  <span
                    className="jp-chat-message-queue-drag-handle"
                    aria-hidden="true"
                  />
                )}
                <div className="jp-chat-message-queue-content">
                  {editingId === msg.id ? (
                    <textarea
                      ref={textareaRef}
                      className="jp-chat-message-queue-edit-textarea"
                      value={editBody}
                      onChange={handleTextareaChange}
                      onKeyDown={handleEditKeyDown}
                      rows={1}
                      title={trans.__(
                        'Enter to save, Escape to cancel, Shift+Enter for newline'
                      )}
                    />
                  ) : (
                    msg.body && (
                      <span className="jp-chat-message-queue-text">
                        {msg.body}
                      </span>
                    )
                  )}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="jp-chat-message-queue-attachments">
                      {msg.attachments.map((attachment, i) => (
                        <span
                          key={i}
                          className="jp-chat-message-queue-attachment-item"
                          title={attachment.value}
                        >
                          <AttachmentIcon type={attachment.type} />
                          {attachmentName(attachment)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {editQueuedMessage && targetId && (
                  <button
                    className="jp-chat-message-queue-edit"
                    onClick={
                      editingId === msg.id
                        ? handleEditSave
                        : () => handleEditStart(msg.id, msg.body)
                    }
                    title={
                      editingId === msg.id
                        ? trans.__('Save')
                        : trans.__('Edit message')
                    }
                    type="button"
                  >
                    {editingId === msg.id ? (
                      <checkIcon.react
                        tag="span"
                        className="jp-chat-message-queue-btn-icon"
                      />
                    ) : (
                      <editIcon.react
                        tag="span"
                        className="jp-chat-message-queue-btn-icon"
                      />
                    )}
                  </button>
                )}
                {removeQueuedMessage && targetId && editingId !== msg.id && (
                  <button
                    className="jp-chat-message-queue-remove"
                    onClick={() => removeQueuedMessage(targetId, msg.id)}
                    title={trans.__('Remove from queue')}
                    type="button"
                  >
                    <closeIcon.react
                      tag="span"
                      className="jp-chat-message-queue-btn-icon"
                    />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
