import { IRenderMime } from '@jupyterlab/rendermime-interfaces';

import { nullTranslator, TranslationBundle } from '@jupyterlab/translation';

import { ReactWidget } from '@jupyterlab/ui-components';

import { ReadonlyPartialJSONValue } from '@lumino/coreutils';

import * as React from 'react';

import { IToolCallMetadata, IToolCallProps, ToolCall } from './components';

import { IComponentsRendererFactory, ToolCallApproval } from './token';

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
    this.addClass(CLASS_NAME);
  }

  /**
   * Render  into this widget's node.
   */
  async renderModel(model: IRenderMime.IMimeModel): Promise<void> {
    this._data = model.data[this._mimeType] as string;
    this._metadata = { ...model.metadata };
    return this.update();
  }

  protected render(): ReactRenderElement | null {
    if (this._data === 'tool-call') {
      const toolCallOptions: IToolCallProps = {
        ...(this._metadata as unknown as IToolCallMetadata),
        trans: this._trans,
        toolCallApproval: this._toolCallApproval
      };
      return <ToolCall {...toolCallOptions} />;
    }
    return null;
  }

  private _trans: TranslationBundle;
  private _mimeType: string;
  private _toolCallApproval?: ToolCallApproval;
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
  toolCallApproval: ToolCallApproval = null;
  createRenderer = (options: IRenderMime.IRendererOptions) => {
    return new ComponentsRenderer({
      ...options,
      toolCallApproval: this.toolCallApproval
    });
  };
}
