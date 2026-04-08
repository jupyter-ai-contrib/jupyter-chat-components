import { IRenderMime } from '@jupyterlab/rendermime-interfaces';

import { nullTranslator, TranslationBundle } from '@jupyterlab/translation';

import { ReactWidget } from '@jupyterlab/ui-components';

import { ReadonlyPartialJSONValue } from '@lumino/coreutils';

import * as React from 'react';

import {
  GroupedToolCalls,
  InlineDiff,
  MessageQueue,
  ToolCall
} from './components';

import { ComponentRegistry } from './registry';

import {
  IComponentRegistry,
  IComponentsRendererFactory,
  OpenToolCallPath,
  RemoveQueuedMessage,
  ToolCallApproval,
  ToolCallPermissionDecision
} from './token';

/**
 * The default mime type for the extension.
 */
const MIME_TYPE = 'application/vnd.jupyter.chat.components';

/**
 * The class name added to the extension.
 */
const CLASS_NAME = 'jp-RenderedChatComponents';

type ReactRenderElement =
  | Array<React.ReactElement<any>>
  | React.ReactElement<any>;

/**
 * The options for the chat components renderer.
 */
interface IComponentsRendererOptions extends IRenderMime.IRendererOptions {
  /**
   * The callback to approve or reject a tool.
   */
  toolCallApproval?: ToolCallApproval;

  /**
   * The callback to remove a queued message.
   */
  removeQueuedMessage?: RemoveQueuedMessage;

  /**
   * The callback to submit a permission decision for grouped tool calls.
   */
  toolCallPermissionDecision?: ToolCallPermissionDecision;

  /**
   * The callback to open a path referenced by grouped tool calls.
   */
  openToolCallPath?: OpenToolCallPath;

  /**
   * The component registry.
   */
  registry: IComponentRegistry;
}

/**
 * A widget for rendering components from mime bundle.
 */
export class ComponentsRenderer
  extends ReactWidget
  implements IRenderMime.IRenderer
{
  /**
   * Construct a new output widget.
   */
  constructor(options: IComponentsRendererOptions) {
    super();
    this._trans = (options.translator ?? nullTranslator).load('jupyterlab');
    this._mimeType = options.mimeType;
    this._toolCallApproval = options.toolCallApproval;
    this._removeQueuedMessage = options.removeQueuedMessage;
    this._toolCallPermissionDecision = options.toolCallPermissionDecision;
    this._openToolCallPath = options.openToolCallPath;
    this._registry = options.registry;
    this.addClass(CLASS_NAME);
  }

  /**
   * Render  into this widget's node.
   */
  async renderModel(model: IRenderMime.IMimeModel): Promise<void> {
    this._data = model.data[this._mimeType] as string;
    const metadata = model.metadata;
    this._metadata = (metadata[this._mimeType] as ReadonlyPartialJSONValue) ?? {
      ...metadata
    };
    return this.update();
  }

  protected render(): ReactRenderElement | null {
    if (!this._data) {
      return null;
    }
    const Component = this._registry.get(this._data);
    if (!Component) {
      return null;
    }

    const componentsProps = { ...(this._metadata as any) };

    if (this._data === 'tool-call') {
      componentsProps.toolCallApproval = this._toolCallApproval;
    }

    if (this._data === 'message-queue') {
      componentsProps.removeQueuedMessage = this._removeQueuedMessage;
    }

    if (this._data === 'grouped-tool-calls') {
      componentsProps.toolCallPermissionDecision =
        this._toolCallPermissionDecision;
      componentsProps.openToolCallPath = this._openToolCallPath;
    }

    return <Component {...componentsProps} trans={this._trans} />;
  }

  private _trans: TranslationBundle;
  private _mimeType: string;
  private _toolCallApproval?: ToolCallApproval;
  private _removeQueuedMessage?: RemoveQueuedMessage;
  private _toolCallPermissionDecision?: ToolCallPermissionDecision;
  private _openToolCallPath?: OpenToolCallPath;
  private _registry: IComponentRegistry;
  private _data: string | null = null;
  private _metadata: ReadonlyPartialJSONValue | null = null;
}

/**
 * A mime renderer factory for chat components.
 */
export class RendererFactory implements IComponentsRendererFactory {
  readonly safe = true;
  readonly mimeTypes = [MIME_TYPE];
  readonly defaultRank = 100;
  readonly registry: ComponentRegistry;
  toolCallApproval: ToolCallApproval = null;
  removeQueuedMessage: RemoveQueuedMessage = null;
  toolCallPermissionDecision: ToolCallPermissionDecision = null;
  openToolCallPath: OpenToolCallPath = null;

  constructor() {
    this.registry = new ComponentRegistry();
    this.registry.add('tool-call', ToolCall);
    this.registry.add('grouped-tool-calls', GroupedToolCalls);
    this.registry.add('inline-diff', InlineDiff);
    this.registry.add('message-queue', MessageQueue);
  }

  createRenderer = (options: IRenderMime.IRendererOptions) => {
    return new ComponentsRenderer({
      ...options,
      toolCallApproval: this.toolCallApproval,
      removeQueuedMessage: this.removeQueuedMessage,
      toolCallPermissionDecision: this.toolCallPermissionDecision,
      openToolCallPath: this.openToolCallPath,
      registry: this.registry
    });
  };
}
