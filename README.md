# jupyter_chat_components

[![Github Actions Status](https://github.com/brichet/jupyter-chat-components/workflows/Build/badge.svg)](https://github.com/brichet/jupyter-chat-components/actions/workflows/build.yml)

A library of React components designed for use in Jupyter chat interfaces, with a focus on AI-powered interactions. These components are intended to be integrated into JupyterLab extensions that provide chat functionality.

## MIME renderer

Components are exposed through a custom MIME type: `application/vnd.jupyter.chat.components`.

This extension registers a MIME renderer factory with JupyterLab's render MIME registry. To display a component, produce output with the MIME type above, where:

- the **data** value is the component name (e.g. `"tool-call"`)
- the **metadata** contains the props to pass to the component

The MIME renderer looks up the component name in the factory's registry and renders the corresponding React component.

## Component registry

The registry is available directly on the `IComponentsRendererFactory` token as the `registry` property. It maps component names to React components and exposes the following methods:

- `add(name, component)` — register a new React component under a unique name
- `get(name)` — retrieve a registered component by name
- `has(name)` — check whether a component is registered
- `getNames()` — list all registered component names

Other JupyterLab extensions can consume the `IComponentsRendererFactory` token and use `registry.add()` to register their own components, which will then be available for rendering via the MIME bundle.

For live end-to-end metadata examples, see the deployed demo notebook at [brichet.github.io/jupyter-chat-components/lab/index.html?path=components_demo.ipynb](https://brichet.github.io/jupyter-chat-components/lab/index.html?path=components_demo.ipynb). The source notebook lives at [demo/contents/components_demo.ipynb](./demo/contents/components_demo.ipynb).

## Requirements

- JupyterLab >= 4.0.0

## Install

To install the extension, execute:

```bash
pip install jupyter_chat_components
```

## Uninstall

To remove the extension, execute:

```bash
pip uninstall jupyter_chat_components
```

## Contributing

### Development install

Note: You will need NodeJS to build the extension package.

The `jlpm` command is JupyterLab's pinned version of
[yarn](https://yarnpkg.com/) that is installed with JupyterLab. You may use
`yarn` or `npm` in lieu of `jlpm` below.

```bash
# Clone the repo to your local environment
# Change directory to the jupyter_chat_components directory

# Set up a virtual environment and install package in development mode
python -m venv .venv
source .venv/bin/activate
pip install --editable "."

# Link your development version of the extension with JupyterLab
jupyter labextension develop . --overwrite

# Rebuild extension Typescript source after making changes
# IMPORTANT: Unlike the steps above which are performed only once, do this step
# every time you make a change.
jlpm build
```

You can watch the source directory and run JupyterLab at the same time in different terminals to watch for changes in the extension's source and automatically rebuild the extension.

```bash
# Watch the source directory in one terminal, automatically rebuilding when needed
jlpm watch
# Run JupyterLab in another terminal
jupyter lab
```

With the watch command running, every saved change will immediately be built locally and available in your running JupyterLab. Refresh JupyterLab to load the change in your browser (you may need to wait several seconds for the extension to be rebuilt).

By default, the `jlpm build` command generates the source maps for this extension to make it easier to debug using the browser dev tools. To also generate source maps for the JupyterLab core extensions, you can run the following command:

```bash
jupyter lab build --minimize=False
```

### Development uninstall

```bash
pip uninstall jupyter_chat_components
```

In development mode, you will also need to remove the symlink created by `jupyter labextension develop`
command. To find its location, you can run `jupyter labextension list` to figure out where the `labextensions`
folder is located. Then you can remove the symlink named `jupyter-chat-components` within that folder.

### Testing the extension

#### Frontend tests

This extension is using [Jest](https://jestjs.io/) for JavaScript code testing.

To execute them, execute:

```sh
jlpm
jlpm test
```

#### Integration tests

This extension uses [Playwright](https://playwright.dev/docs/intro) for the integration tests (aka user level tests).
More precisely, the JupyterLab helper [Galata](https://github.com/jupyterlab/jupyterlab/tree/master/galata) is used to handle testing the extension in JupyterLab.

More information are provided within the [ui-tests](./ui-tests/README.md) README.

## AI Coding Assistant Support

This project includes an `AGENTS.md` file with coding standards and best practices for JupyterLab extension development. The file follows the [AGENTS.md standard](https://agents.md) for cross-tool compatibility.

### Compatible AI Tools

`AGENTS.md` works with AI coding assistants that support the standard, including Cursor, GitHub Copilot, Windsurf, Aider, and others. For a current list of compatible tools, see [the AGENTS.md standard](https://agents.md).

Other conventions you might encounter:

- `.cursorrules` - Cursor's YAML/JSON format (Cursor also supports AGENTS.md natively)
- `CONVENTIONS.md` / `CONTRIBUTING.md` - For CodeConventions.ai and GitHub bots
- Project-specific rules in JetBrains AI Assistant settings

All tool-specific files should be symlinks to `AGENTS.md` as the single source of truth.

### What's Included

The `AGENTS.md` file provides guidance on:

- Code quality rules and file-scoped validation commands
- Naming conventions for packages, plugins, and files
- Coding standards (TypeScript)
- Development workflow and debugging
- Common pitfalls and how to avoid them

### Customization

You can edit `AGENTS.md` to add project-specific conventions or adjust guidelines to match your team's practices. The file uses plain Markdown with Do/Don't patterns and references to actual project files.

**Note**: `AGENTS.md` is living documentation. Update it when you change conventions, add dependencies, or discover new patterns. Include `AGENTS.md` updates in commits that modify workflows or coding standards.

### Packaging the extension

See [RELEASE](RELEASE.md)
