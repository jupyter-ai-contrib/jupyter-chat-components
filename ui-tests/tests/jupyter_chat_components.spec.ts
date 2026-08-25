import { expect, test } from '@jupyterlab/galata';

const MIME_TYPE = 'application/vnd.jupyter.chat.components';

/**
 * Generate Python code that displays a chat component via the custom MIME type.
 * Uses json.loads() to safely embed JSON metadata in a Python string literal.
 */
function makeDisplayCode(
  componentName: string,
  metadata: Record<string, unknown>
): string {
  // Escape backslashes first, then single quotes, so the JSON can be safely
  // embedded inside a Python single-quoted string literal. Python treats \"
  // as " (stripping the backslash), which breaks json.loads; doubling the
  // backslash ensures json.loads receives the correct escaped form.
  const metadataJson = JSON.stringify(metadata)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'");
  return [
    'import json',
    'from IPython.display import display',
    `_metadata = json.loads('${metadataJson}')`,
    'display(',
    `    {'${MIME_TYPE}': '${componentName}'},`,
    `    metadata={'${MIME_TYPE}': _metadata},`,
    '    raw=True',
    ')'
  ].join('\n');
}

test.describe('jupyter-chat-components MIME renderer', () => {
  test.beforeEach(async ({ page }) => {
    await page.notebook.createNew();
  });

  test.afterEach(async ({ page }) => {
    await page.notebook.close(true);
  });

  test.describe('error component', () => {
    test('renders with custom title and message', async ({ page }) => {
      await page.notebook.setCell(
        0,
        'code',
        makeDisplayCode('error', {
          errorMessage: 'Something went wrong',
          title: 'Test Error'
        })
      );
      await page.notebook.runCell(0, true);

      const container = page.locator('.jp-RenderedChatComponents').first();
      await expect(container).toBeVisible();
      await expect(container.locator('.jp-ai-error-title')).toHaveText(
        'Test Error'
      );
      await expect(container.locator('.jp-ai-error-text')).toHaveText(
        'Something went wrong'
      );
    });

    test('renders default "Error" title when title is not provided', async ({
      page
    }) => {
      await page.notebook.setCell(
        0,
        'code',
        makeDisplayCode('error', { errorMessage: 'An error occurred' })
      );
      await page.notebook.runCell(0, true);

      const container = page.locator('.jp-RenderedChatComponents').first();
      await expect(container.locator('.jp-ai-error-title')).toHaveText('Error');
      await expect(container.locator('.jp-ai-error-text')).toHaveText(
        'An error occurred'
      );
    });
  });

  test.describe('tool-call component', () => {
    test('renders a pending tool call with tool name and status', async ({
      page
    }) => {
      await page.notebook.setCell(
        0,
        'code',
        makeDisplayCode('tool-call', {
          toolName: 'execute_code',
          input: 'print("hello")',
          status: 'pending'
        })
      );
      await page.notebook.runCell(0, true);

      const container = page.locator('.jp-RenderedChatComponents').first();
      await expect(container).toBeVisible();
      const toolCall = container.locator('.jp-ai-tool-call');
      await expect(toolCall).toBeVisible();
      await expect(toolCall.locator('.jp-ai-tool-title')).toContainText(
        'execute_code'
      );
      await expect(
        toolCall.locator('.jp-ai-tool-status-pending')
      ).toBeVisible();
    });

    test('renders a completed tool call with output', async ({ page }) => {
      await page.notebook.setCell(
        0,
        'code',
        makeDisplayCode('tool-call', {
          toolName: 'execute_code',
          input: 'print("hello")',
          status: 'completed',
          output: 'hello'
        })
      );
      await page.notebook.runCell(0, true);

      const container = page.locator('.jp-RenderedChatComponents').first();
      await expect(container.locator('.jp-ai-tool-completed')).toBeVisible();
      await expect(
        container.locator('.jp-ai-tool-status-completed')
      ).toBeVisible();
    });

    test('renders awaiting approval tool call with approve and reject buttons', async ({
      page
    }) => {
      await page.notebook.setCell(
        0,
        'code',
        makeDisplayCode('tool-call', {
          toolName: 'delete_file',
          input: '/home/user/file.txt',
          status: 'awaiting_approval',
          approvalId: 'approval-1',
          targetId: 'target-1'
        })
      );
      await page.notebook.runCell(0, true);

      const container = page.locator('.jp-RenderedChatComponents').first();
      await expect(container.locator('.jp-ai-approval-approve')).toBeVisible();
      await expect(container.locator('.jp-ai-approval-reject')).toBeVisible();
    });
  });

  test.describe('grouped-tool-calls component', () => {
    test('renders all provided tool calls', async ({ page }) => {
      await page.notebook.setCell(
        0,
        'code',
        makeDisplayCode('grouped-tool-calls', {
          toolCalls: [
            {
              toolCallId: 'tc1',
              title: 'Reading file.py',
              kind: 'read',
              status: 'completed'
            },
            {
              toolCallId: 'tc2',
              title: 'Editing main.py',
              kind: 'edit',
              status: 'in_progress'
            }
          ]
        })
      );
      await page.notebook.runCell(0, true);

      const container = page.locator('.jp-RenderedChatComponents').first();
      await expect(container).toBeVisible();
      await expect(container.locator('.jp-ai-tool-calls')).toBeVisible();
      await expect(container.locator('.jp-ai-tool-call-item')).toHaveCount(2);
    });

    test('applies correct status CSS classes to each tool call item', async ({
      page
    }) => {
      await page.notebook.setCell(
        0,
        'code',
        makeDisplayCode('grouped-tool-calls', {
          toolCalls: [
            { toolCallId: 'tc1', title: 'Completed task', status: 'completed' },
            {
              toolCallId: 'tc2',
              title: 'Running task',
              status: 'in_progress'
            },
            { toolCallId: 'tc3', title: 'Failed task', status: 'failed' }
          ]
        })
      );
      await page.notebook.runCell(0, true);

      const container = page.locator('.jp-RenderedChatComponents').first();
      await expect(
        container.locator('.jp-ai-tool-call-item-completed')
      ).toHaveCount(1);
      await expect(
        container.locator('.jp-ai-tool-call-item-in-progress')
      ).toHaveCount(1);
      await expect(
        container.locator('.jp-ai-tool-call-item-failed')
      ).toHaveCount(1);
    });

    test('derives display title from tool kind when no title is given', async ({
      page
    }) => {
      await page.notebook.setCell(
        0,
        'code',
        makeDisplayCode('grouped-tool-calls', {
          toolCalls: [
            { toolCallId: 'tc1', kind: 'think', status: 'in_progress' }
          ]
        })
      );
      await page.notebook.runCell(0, true);

      const container = page.locator('.jp-RenderedChatComponents').first();
      await expect(
        container.locator('.jp-ai-tool-call-item-title')
      ).toContainText('Thinking');
    });

    test('shows permission buttons when permission is pending', async ({
      page
    }) => {
      await page.notebook.setCell(
        0,
        'code',
        makeDisplayCode('grouped-tool-calls', {
          toolCalls: [
            {
              toolCallId: 'tc1',
              title: 'Delete file.py',
              kind: 'delete',
              status: 'in_progress',
              permissionStatus: 'pending',
              sessionId: 'session-1',
              permissionOptions: [
                { optionId: 'opt1', name: 'Allow once', kind: 'allow_once' },
                { optionId: 'opt2', name: 'Deny', kind: 'reject' }
              ]
            }
          ]
        })
      );
      await page.notebook.runCell(0, true);

      const container = page.locator('.jp-RenderedChatComponents').first();
      await expect(
        container.locator('.jp-ai-tool-call-permission-buttons')
      ).toBeVisible();
      const buttons = container.locator('.jp-ai-tool-call-permission-btn');
      await expect(buttons).toHaveCount(2);
      await expect(buttons.nth(0)).toContainText('Allow once');
      await expect(buttons.nth(1)).toContainText('Deny');
    });
  });

  test.describe('message-queue component', () => {
    test('renders queued messages with count in header', async ({ page }) => {
      await page.notebook.setCell(
        0,
        'code',
        makeDisplayCode('message-queue', {
          messages: [
            { id: 'msg1', body: 'Hello world' },
            { id: 'msg2', body: 'Second message' }
          ]
        })
      );
      await page.notebook.runCell(0, true);

      const container = page.locator('.jp-RenderedChatComponents').first();
      await expect(container).toBeVisible();
      await expect(container.locator('.jp-chat-message-queue')).toBeVisible();
      await expect(
        container.locator('.jp-chat-message-queue-count')
      ).toContainText('2');

      const messages = container.locator('.jp-chat-message-queue-text');
      await expect(messages).toHaveCount(2);
      await expect(messages.nth(0)).toHaveText('Hello world');
      await expect(messages.nth(1)).toHaveText('Second message');
    });

    test('collapses and expands the message list on toggle click', async ({
      page
    }) => {
      await page.notebook.setCell(
        0,
        'code',
        makeDisplayCode('message-queue', {
          messages: [{ id: 'msg1', body: 'Hello world' }]
        })
      );
      await page.notebook.runCell(0, true);

      const container = page.locator('.jp-RenderedChatComponents').first();
      const list = container.locator('.jp-chat-message-queue-list');
      const toggleBtn = container.locator('.jp-chat-message-queue-toggle');

      await expect(list).toBeVisible();

      await toggleBtn.click();
      await expect(list).not.toBeVisible();

      await toggleBtn.click();
      await expect(list).toBeVisible();
    });
  });
});

test.describe('factory', () => {
  test.describe('registry', () => {
    test('has all built-in components registered', async ({ page }) => {
      const names = await page.evaluate(() => {
        const app = (window as any).jupyterapp;
        const registry = app?.pluginRegistry._plugins?.get(
          'jupyter-chat-components:factory'
        )?.service?.registry;
        return registry?.getNames() ?? [];
      });
      expect(names).toEqual(
        expect.arrayContaining([
          'tool-call',
          'grouped-tool-calls',
          'message-queue',
          'inline-diff',
          'error'
        ])
      );
    });

    test('get() returns a function for each built-in component', async ({
      page
    }) => {
      const types = await page.evaluate(() => {
        const app = (window as any).jupyterapp;
        const registry = app?.pluginRegistry._plugins?.get(
          'jupyter-chat-components:factory'
        )?.service?.registry;
        return {
          'tool-call': typeof registry?.get('tool-call'),
          'grouped-tool-calls': typeof registry?.get('grouped-tool-calls'),
          'message-queue': typeof registry?.get('message-queue'),
          'inline-diff': typeof registry?.get('inline-diff'),
          error: typeof registry?.get('error')
        };
      });

      for (const [name, type] of Object.entries(types)) {
        expect(type, `${name} should be registered as a function`).toBe(
          'function'
        );
      }
    });

    test('get() returns undefined for an unregistered name', async ({
      page
    }) => {
      const type = await page.evaluate(() => {
        const app = (window as any).jupyterapp;
        const registry = app?.pluginRegistry._plugins?.get(
          'jupyter-chat-components:factory'
        )?.service?.registry;
        return typeof registry?.get('non-existent-component');
      });
      expect(type).toBe('undefined');
    });
  });

  test.describe('custom component', () => {
    test.beforeEach(async ({ page }) => {
      await page.notebook.createNew();
    });

    test.afterEach(async ({ page }) => {
      await page.notebook.close(true);
    });

    test('can be added to the registry and rendered via the MIME type', async ({
      page
    }) => {
      // React elements are plain objects identified by Symbol.for('react.element'),
      // so we can register a functional component without importing React directly.
      await page.evaluate(() => {
        const app = (window as any).jupyterapp;
        const factory = app?.pluginRegistry._plugins?.get(
          'jupyter-chat-components:factory'
        )?.service;
        if (!factory) {
          throw new Error('jupyter-chat-components factory not found');
        }
        const REACT_ELEMENT_TYPE = Symbol.for('react.element');
        const CustomComponent = (props: any) => ({
          $$typeof: REACT_ELEMENT_TYPE,
          type: 'div',
          key: null,
          ref: null,
          props: {
            className: 'jp-test-custom-component',
            children: props.message ?? 'Custom content'
          },
          _owner: null,
          _store: {}
        });
        factory.registry.add('custom-test', CustomComponent);
      });

      await page.notebook.setCell(
        0,
        'code',
        makeDisplayCode('custom-test', { message: 'Hello from custom!' })
      );
      await page.notebook.runCell(0, true);

      const container = page.locator('.jp-RenderedChatComponents').first();
      await expect(container).toBeVisible();
      await expect(
        container.locator('.jp-test-custom-component')
      ).toBeVisible();
      await expect(container.locator('.jp-test-custom-component')).toHaveText(
        'Hello from custom!'
      );
    });
  });

  test.describe('callbacks', () => {
    test.beforeEach(async ({ page }) => {
      await page.notebook.createNew();
    });

    test.afterEach(async ({ page }) => {
      // Clear all callbacks so they don't leak into subsequent tests.
      await page.evaluate(() => {
        const app = (window as any).jupyterapp;
        const factory = app?.pluginRegistry._plugins?.get(
          'jupyter-chat-components:factory'
        )?.service;
        if (factory) {
          factory.toolCallCallbacks = undefined;
          factory.groupedToolCallCallbacks = undefined;
          factory.queueMessageCallbacks = undefined;
        }
      });
      await page.notebook.close(true);
    });

    test.describe('tool-call', () => {
      test('calls toolCallApproval with approve=true when Approve is clicked', async ({
        page
      }) => {
        await page.evaluate(() => {
          (window as any).__callbackResult = null;
          const app = (window as any).jupyterapp;
          const factory = app?.pluginRegistry._plugins?.get(
            'jupyter-chat-components:factory'
          )?.service;
          factory.toolCallCallbacks = {
            toolCallApproval: (
              targetId: string,
              approvalId: string,
              approve: boolean
            ) => {
              (window as any).__callbackResult = {
                targetId,
                approvalId,
                approve
              };
            }
          };
        });

        await page.notebook.setCell(
          0,
          'code',
          makeDisplayCode('tool-call', {
            toolName: 'delete_file',
            input: '/home/user/file.txt',
            status: 'awaiting_approval',
            targetId: 'tid-1',
            approvalId: 'aid-1'
          })
        );
        await page.notebook.runCell(0, true);

        await page.locator('.jp-ai-approval-approve').click();

        const result = await page.evaluate(
          () => (window as any).__callbackResult
        );
        expect(result).toEqual({
          targetId: 'tid-1',
          approvalId: 'aid-1',
          approve: true
        });
      });

      test('calls toolCallApproval with approve=false when Reject is clicked', async ({
        page
      }) => {
        await page.evaluate(() => {
          (window as any).__callbackResult = null;
          const app = (window as any).jupyterapp;
          const factory = app?.pluginRegistry._plugins?.get(
            'jupyter-chat-components:factory'
          )?.service;
          factory.toolCallCallbacks = {
            toolCallApproval: (
              targetId: string,
              approvalId: string,
              approve: boolean
            ) => {
              (window as any).__callbackResult = {
                targetId,
                approvalId,
                approve
              };
            }
          };
        });

        await page.notebook.setCell(
          0,
          'code',
          makeDisplayCode('tool-call', {
            toolName: 'delete_file',
            input: '/home/user/file.txt',
            status: 'awaiting_approval',
            targetId: 'tid-1',
            approvalId: 'aid-1'
          })
        );
        await page.notebook.runCell(0, true);

        await page.locator('.jp-ai-approval-reject').click();

        const result = await page.evaluate(
          () => (window as any).__callbackResult
        );
        expect(result).toEqual({
          targetId: 'tid-1',
          approvalId: 'aid-1',
          approve: false
        });
      });
    });

    test.describe('grouped-tool-calls', () => {
      test('calls toolCallPermissionDecision with correct args when a permission option is clicked', async ({
        page
      }) => {
        await page.evaluate(() => {
          (window as any).__callbackResult = null;
          const app = (window as any).jupyterapp;
          const factory = app?.pluginRegistry._plugins?.get(
            'jupyter-chat-components:factory'
          )?.service;
          factory.groupedToolCallCallbacks = {
            toolCallPermissionDecision: (
              sessionId: string,
              toolCallId: string,
              optionId: string
            ) => {
              (window as any).__callbackResult = {
                sessionId,
                toolCallId,
                optionId
              };
            }
          };
        });

        await page.notebook.setCell(
          0,
          'code',
          makeDisplayCode('grouped-tool-calls', {
            toolCalls: [
              {
                toolCallId: 'tc-1',
                title: 'Delete file.py',
                kind: 'delete',
                status: 'in_progress',
                permissionStatus: 'pending',
                sessionId: 'session-1',
                permissionOptions: [
                  { optionId: 'opt-allow', name: 'Allow', kind: 'allow_once' },
                  { optionId: 'opt-deny', name: 'Deny', kind: 'reject' }
                ]
              }
            ]
          })
        );
        await page.notebook.runCell(0, true);

        await page.locator('.jp-ai-tool-call-permission-btn').first().click();

        const result = await page.evaluate(
          () => (window as any).__callbackResult
        );
        expect(result).toEqual({
          sessionId: 'session-1',
          toolCallId: 'tc-1',
          optionId: 'opt-allow'
        });
      });
    });

    test.describe('message-queue', () => {
      test('calls removeQueuedMessage with correct args when remove is clicked', async ({
        page
      }) => {
        await page.evaluate(() => {
          (window as any).__callbackResult = null;
          const app = (window as any).jupyterapp;
          const factory = app?.pluginRegistry._plugins?.get(
            'jupyter-chat-components:factory'
          )?.service;
          factory.queueMessageCallbacks = {
            removeQueuedMessage: (targetId: string, messageId: string) => {
              (window as any).__callbackResult = { targetId, messageId };
            }
          };
        });

        await page.notebook.setCell(
          0,
          'code',
          makeDisplayCode('message-queue', {
            messages: [{ id: 'msg-1', body: 'Hello world' }],
            targetId: 'queue-1'
          })
        );
        await page.notebook.runCell(0, true);

        await page.locator('.jp-chat-message-queue-bubble').hover();
        await page.locator('.jp-chat-message-queue-remove').click();

        const result = await page.evaluate(
          () => (window as any).__callbackResult
        );
        expect(result).toEqual({ targetId: 'queue-1', messageId: 'msg-1' });
      });

      test('calls editQueuedMessage with the updated body when the edit is saved', async ({
        page
      }) => {
        await page.evaluate(() => {
          (window as any).__callbackResult = null;
          const app = (window as any).jupyterapp;
          const factory = app?.pluginRegistry._plugins?.get(
            'jupyter-chat-components:factory'
          )?.service;
          factory.queueMessageCallbacks = {
            editQueuedMessage: (
              targetId: string,
              messageId: string,
              newBody: string
            ) => {
              (window as any).__callbackResult = {
                targetId,
                messageId,
                newBody
              };
            }
          };
        });

        await page.notebook.setCell(
          0,
          'code',
          makeDisplayCode('message-queue', {
            messages: [{ id: 'msg-1', body: 'Original message' }],
            targetId: 'queue-1'
          })
        );
        await page.notebook.runCell(0, true);

        await page.locator('.jp-chat-message-queue-bubble').hover();
        await page.locator('.jp-chat-message-queue-edit').click();
        const textarea = page.locator('.jp-chat-message-queue-edit-textarea');
        await textarea.fill('Updated message');
        await textarea.press('Enter');

        const result = await page.evaluate(
          () => (window as any).__callbackResult
        );
        expect(result).toEqual({
          targetId: 'queue-1',
          messageId: 'msg-1',
          newBody: 'Updated message'
        });
      });
    });
  });
});
