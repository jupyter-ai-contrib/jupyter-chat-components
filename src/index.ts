import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { IRenderMimeRegistry } from '@jupyterlab/rendermime';

import { ToolCall } from './components';

import { RendererFactory } from './factory';

import { ComponentRegistry } from './registry';

import { IComponentsRendererFactory, IComponentRegistry } from './token';

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

/**
 * The plugin providing the chat components registry.
 */
const registry: JupyterFrontEndPlugin<IComponentRegistry> = {
  id: 'jupyter-chat-components:registry',
  description: 'Provides a registry of React components for jupyter-chat',
  autoStart: true,
  provides: IComponentRegistry,
  activate: (app: JupyterFrontEnd): IComponentRegistry => {
    const componentRegistry = new ComponentRegistry();

    // Register default components
    componentRegistry.add('tool-call', ToolCall);

    return componentRegistry;
  }
};

export * from './token';
export * from './factory';
export * from './registry';

const plugins: JupyterFrontEndPlugin<any>[] = [factory, registry];

export default plugins;
