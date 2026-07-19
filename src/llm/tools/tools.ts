/**
 * Tool registry for LLM function calling.
 *
 * Each tool has two parts kept deliberately separate:
 *  - `definition`: the schema we expose TO the model (name, description, args).
 *    The model only ever sees this — it never sees or runs our code.
 *  - `handler`: the actual backend function WE execute when the model asks.
 *
 * The model can only *request* a tool; the backend decides to run it.
 */

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface RegisteredTool {
  definition: ToolDefinition;
  handler: (args: Record<string, unknown>) => string | Promise<string>;
}

export const TOOL_REGISTRY: Record<string, RegisteredTool> = {
  getCurrentDate: {
    definition: {
      type: 'function',
      function: {
        name: 'getCurrentDate',
        description:
          "Get the current date and time as an ISO 8601 string. Use when the user asks about today's date, the current time, or the day of week. The model cannot know this on its own.",
        parameters: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
    },
    handler: () => new Date().toISOString(),
  },

  countWords: {
    definition: {
      type: 'function',
      function: {
        name: 'countWords',
        description:
          'Count the exact number of words in a piece of text. Use when the user asks how many words are in some text, instead of guessing.',
        parameters: {
          type: 'object',
          properties: {
            text: {
              type: 'string',
              description: 'The text whose words should be counted',
            },
          },
          required: ['text'],
        },
      },
    },
    handler: (args) => {
      const text = typeof args.text === 'string' ? args.text : '';
      const count = text.trim().split(/\s+/).filter(Boolean).length;
      return String(count);
    },
  },
};

/** All tool definitions, ready to send to the model. */
export const TOOL_DEFINITIONS: ToolDefinition[] = Object.values(
  TOOL_REGISTRY,
).map((tool) => tool.definition);

/** Run a tool by name. Returns a string result the model can read. */
export async function runTool(
  name: string,
  args: Record<string, unknown>,
): Promise<string> {
  const tool = TOOL_REGISTRY[name];

  if (!tool) {
    return `Error: unknown tool "${name}"`;
  }

  try {
    return await tool.handler(args);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    return `Error running ${name}: ${message}`;
  }
}
