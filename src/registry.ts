import * as React from 'react';

import { IComponentRegistry } from './token';

/**
 * A registry for React components.
 */
export class ComponentRegistry implements IComponentRegistry {
  /**
   * Register a React component.
   *
   * @param name - The unique name/identifier for the component
   * @param component - The React component
   */
  add(name: string, component: React.ComponentType<any>): void {
    if (this._components.has(name)) {
      console.warn(
        `Component '${name}' is already registered and will be overwritten.`
      );
    }
    this._components.set(name, component);
  }

  /**
   * Get a registered component by name.
   *
   * @param name - The name of the component
   * @returns the React component, or undefined if not found
   */
  get(name: string): React.ComponentType<any> | undefined {
    return this._components.get(name);
  }

  /**
   * Check if a component is registered.
   *
   * @param name - The name of the component
   * @returns whether the component is registered
   */
  has(name: string): boolean {
    return this._components.has(name);
  }

  /**
   * Get all registered component names.
   *
   * @returns the component names
   */
  getNames(): string[] {
    return Array.from(this._components.keys());
  }

  private _components: Map<string, React.ComponentType<any>> = new Map();
}
