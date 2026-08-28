import { IRenderMime } from '@jupyterlab/rendermime-interfaces';

import { nullTranslator, TranslationBundle } from '@jupyterlab/translation';

import { ReactWidget } from '@jupyterlab/ui-components';

import { ReadonlyPartialJSONValue } from '@lumino/coreutils';

import * as React from 'react';

import {
  GroupedToolCalls,
  InlineDiff,
  MessageQueue,
  ToolCall,
  ErrorMessage,
  AudioPlayer
} from './components';

import { ComponentRegistry } from './registry';

import {
  IComponentRegistry,
  IComponentsRendererFactory,
  IGroupedToolCallCallbacks,
  IQueueMessageCallbacks,
  IToolCallCallbacks
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
   * Callbacks for the ToolCall component.
   */
  toolCallCallbacks?: IToolCallCallbacks;

  /**
   * Callbacks for the GroupedToolCalls component.
   */
  groupedToolCallCallbacks?: IGroupedToolCallCallbacks;

  /**
   * Callbacks for the MessageQueue component.
   */
  queueMessageCallbacks?: IQueueMessageCallbacks;

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
    this._toolCallCallbacks = options.toolCallCallbacks;
    this._groupedToolCallCallbacks = options.groupedToolCallCallbacks;
    this._queueMessageCallbacks = options.queueMessageCallbacks;
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

    let componentsProps = { ...(this._metadata as any) };

    if (this._data === 'tool-call') {
      componentsProps = { ...componentsProps, ...this._toolCallCallbacks };
    } else if (this._data === 'message-queue') {
      componentsProps = { ...componentsProps, ...this._queueMessageCallbacks };
    } else if (this._data === 'grouped-tool-calls') {
      componentsProps = {
        ...componentsProps,
        ...this._groupedToolCallCallbacks
      };
    }

    return <Component {...componentsProps} trans={this._trans} />;
  }

  private _trans: TranslationBundle;
  private _mimeType: string;
  private _toolCallCallbacks?: IToolCallCallbacks;
  private _groupedToolCallCallbacks?: IGroupedToolCallCallbacks;
  private _queueMessageCallbacks?: IQueueMessageCallbacks;
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

  toolCallCallbacks?: IToolCallCallbacks;
  groupedToolCallCallbacks?: IGroupedToolCallCallbacks;
  queueMessageCallbacks?: IQueueMessageCallbacks;

  constructor() {
    this.registry = new ComponentRegistry();
    this.registry.add('tool-call', ToolCall);
    this.registry.add('grouped-tool-calls', GroupedToolCalls);
    this.registry.add('inline-diff', InlineDiff);
    this.registry.add('message-queue', MessageQueue);
    this.registry.add('error', ErrorMessage);
    this.registry.add('audio-player', AudioPlayer);
  }

  createRenderer = (options: IRenderMime.IRendererOptions) => {
    return new ComponentsRenderer({
      ...options,
      toolCallCallbacks: this.toolCallCallbacks,
      groupedToolCallCallbacks: this.groupedToolCallCallbacks,
      queueMessageCallbacks: this.queueMessageCallbacks,
      registry: this.registry
    });
  };
}
