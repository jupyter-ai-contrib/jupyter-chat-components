import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { IRenderMimeRegistry } from '@jupyterlab/rendermime';

import { RendererFactory } from './factory';

import { IComponentsRendererFactory } from './token';

/**
 * The plugin providing the chat component renderer.
 */
const factory: JupyterFrontEndPlugin<IComponentsRendererFactory> = {
  id: 'jupyter-chat-components:factory',
  description: 'Adds MIME type renderer for chat components',
  autoStart: true,
  provides: IComponentsRendererFactory,
  requires: [IRenderMimeRegistry],
  activate: (
    app: JupyterFrontEnd,
    rendermime: IRenderMimeRegistry
  ): IComponentsRendererFactory => {
    const rendererFactory = new RendererFactory();
    rendermime.addFactory(rendererFactory);
    return rendererFactory;
  }
};

export * from './token';
export * from './factory';
export * from './registry';
export * from './components';
export * from './icons';

export default factory;
