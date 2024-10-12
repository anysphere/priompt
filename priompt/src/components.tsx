import * as Priompt from "./lib";
import {
  BasePromptProps,
  ChatAssistantFunctionToolCall,
  ImageProps,
  OutputHandler,
  PromptElement,
  PromptProps,
} from "./types";
import { JSONSchema7 } from "json-schema";
import { ChatCompletionResponseMessage } from "openai";
import { z } from "zod";
import zodToJsonSchemaImpl from "zod-to-json-schema";

export function SystemMessage(
  props: PromptProps<{
    name?: string;
    to?: string;
  }>
): PromptElement {
  return {
    type: "chat",
    role: "system",
    name: props.name,
    to: props.to,
    children:
      props.children !== undefined
        ? Array.isArray(props.children)
          ? props.children.flat()
          : [props.children]
        : [],
  };
}

export function UserMessage(
  props: PromptProps<{
    name?: string;
    to?: string;
  }>
): PromptElement {
  return {
    type: "chat",
    role: "user",
    name: props.name,
    to: props.to,
    children:
      props.children !== undefined
        ? Array.isArray(props.children)
          ? props.children.flat()
          : [props.children]
        : [],
  };
}

export function AssistantMessage(
  props: PromptProps<{
    functionCall?: {
      name: string;
      arguments: string; // json string
    };
    toolCalls?: {
      id: string;
      index: number;
      tool: ChatAssistantFunctionToolCall;
    }[];
    to?: string;
  }>
): PromptElement {
  return {
    type: "chat",
    role: "assistant",
    functionCall: props.functionCall,
    toolCalls: props.toolCalls,
    to: props.to,
    children:
      props.children !== undefined
        ? Array.isArray(props.children)
          ? props.children.flat()
          : [props.children]
        : [],
  };
}

export function ImageComponent(props: PromptProps<ImageProps>): PromptElement {
  return {
    type: "image",
    bytes: props.bytes,
    dimensions: props.dimensions,
    detail: props.detail,
  };
}

export function FunctionMessage(
  props: PromptProps<{
    name: string;
    to?: string;
  }>
): PromptElement {
  return {
    type: "chat",
    role: "function",
    name: props.name,
    to: props.to,
    children:
      props.children !== undefined
        ? Array.isArray(props.children)
          ? props.children.flat()
          : [props.children]
        : [],
  };
}

export function ToolResultMessage(
  props: PromptProps<{
    name: string;
    to?: string;
  }>
): PromptElement {
  return {
    type: "chat",
    role: "tool",
    name: props.name,
    to: props.to,
    children:
      props.children !== undefined
        ? Array.isArray(props.children)
          ? props.children.flat()
          : [props.children]
        : [],
  };
}

// design choice: can only have 1 tools component per prompt, and cannot have any other onStream
export function Tools(
  props: PromptProps<{
    tools: {
      name: string;
      description: string;
      parameters: JSONSchema7;
      onCall?: (
        args: string,
        toolCallId: string,
        toolName: string,
        toolIndex: number
      ) => Promise<void>;
      onFormatAndYield?: (
        args: string,
        toolCallId: string,
        toolName: string,
        toolIndex: number
      ) => Promise<string>;
    }[];
    onReturn: OutputHandler<AsyncIterable<string>>;
  }>
): PromptElement {
  return (
    <>
      {props.tools.map((tool) => (
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        <Tool
          name={tool.name}
          description={tool.description}
          parameters={tool.parameters}
        />
      ))}
      {{
        type: "capture",
        onStream: async (
          stream: AsyncIterable<ChatCompletionResponseMessage>
        ) => {
          await props.onReturn(
            (async function* () {
              // index -> {name, args}
              const toolCallsMap = new Map<
                number,
                { name: string; args: string; toolCallId: string }
              >();
              for await (const message of stream) {
                if (message.content !== undefined) {
                  yield message.content;
                }
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                const toolCalls = message.tool_calls as any[];
                if (!Array.isArray(toolCalls)) {
                  continue;
                }
                for (const toolCall of toolCalls) {
                  const { index, id } = toolCall;
                  let toolInfo = toolCallsMap.get(index);
                  if (toolInfo === undefined) {
                    toolInfo = { name: "", args: "", toolCallId: id };
                  }
                  if (toolCall.function.name !== undefined) {
                    toolInfo.name = toolCall.function.name;
                  }
                  if (toolCall.function.arguments !== undefined) {
                    toolInfo.args += toolCall.function.arguments;

                    const tool = props.tools.find(
                      (tool) => tool.name === toolInfo?.name
                    );
                    if (
                      tool !== undefined &&
                      tool.onFormatAndYield !== undefined
                    ) {
                      // try parsing as JSON, if successful, yield the parsed JSON
                      try {
                        const parsedArgs = JSON.parse(toolInfo.args);
                        yield tool.onFormatAndYield(
                          toolInfo.args,
                          toolInfo.toolCallId,
                          toolInfo.name,
                          index
                        );
                      } catch (error) {
                        // do nothing
                      }
                    }
                  }
                  toolCallsMap.set(index, toolInfo);
                }
              }
              for (const [toolIndex, toolInfo] of toolCallsMap.entries()) {
                if (
                  toolInfo.name !== undefined &&
                  toolInfo.args !== undefined
                ) {
                  const tool = props.tools.find(
                    (tool) => tool.name === toolInfo.name
                  );
                  if (tool !== undefined && tool.onCall !== undefined) {
                    await tool.onCall(
                      toolInfo.args,
                      toolInfo.toolCallId,
                      toolInfo.name,
                      toolIndex
                    );
                  }
                }
              }
            })()
          );
        },
      }}
    </>
  );
}

export function ZTools<ParamT>(
  props: PromptProps<{
    tools: {
      name: string;
      description: string;
      parameters: z.ZodType<ParamT>;
      onCall?: (
        args: ParamT,
        toolCallId: string,
        toolName: string,
        toolIndex: number
      ) => Promise<void>;
      onParseError?: (error: z.ZodError, rawArgs: string) => Promise<void>;
      onFormatAndYield?: (
        args: ParamT,
        toolCallId: string,
        toolName: string,
        toolIndex: number
      ) => Promise<string>;
    }[];
    onReturn: OutputHandler<AsyncIterable<string>>;
    useAnthropic?: boolean;
  }>
): PromptElement {
  return (
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    <Tools
      tools={props.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: zodToJsonSchema(tool.parameters),
        onCall: async (
          args: string,
          toolCallId: string,
          toolName: string,
          toolIndex: number
        ) => {
          try {
            const parsedArgs = tool.parameters.parse(JSON.parse(args));
            await tool.onCall?.(parsedArgs, toolCallId, toolName, toolIndex);
          } catch (error) {
            console.error(
              `Error parsing arguments for tool ${tool.name}:`,
              error
            );
            if (tool.onParseError !== undefined) {
              await tool.onParseError(error, args);
            } else {
              throw error;
            }
          }
        },
        onFormatAndYield: tool.onFormatAndYield
          ? async (
              args: string,
              toolCallId: string,
              toolName: string,
              toolIndex: number
            ) => {
              try {
                const parsedArgs = tool.parameters.parse(JSON.parse(args));
                return (
                  tool.onFormatAndYield?.(
                    parsedArgs,
                    toolCallId,
                    toolName,
                    toolIndex
                  ) ?? args
                );
              } catch (error) {
                console.error(
                  `Error formatting arguments for tool ${tool.name}:`,
                  error
                );
                return args;
              }
            }
          : undefined,
      }))}
      onReturn={props.onReturn}
    />
  );
}

function Tool(
  props: PromptProps<{
    name: string;
    description: string;
    parameters: JSONSchema7;
  }>
): PromptElement {
  return (
    <>
      {{
        type: "toolDefinition",
        tool: {
          type: "function",
          function: {
            name: props.name,
            description: props.description,
            parameters: props.parameters,
          },
        },
      }}
    </>
  );
}

export function Function(
  props: PromptProps<{
    name: string;
    description: string;
    parameters: JSONSchema7;
    onCall?: (args: string) => Promise<void>;
  }>
): PromptElement {
  if (!validFunctionName(props.name)) {
    throw new Error(
      `Invalid function name: ${props.name}. Function names must be between 1 and 64 characters long and may only contain a-z, A-Z, 0-9, and underscores.`
    );
  }

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  return (
    <>
      {{
        type: "functionDefinition",
        name: props.name,
        description: props.description,
        parameters: props.parameters,
      }}
      {{
        type: "capture",
        onOutput: async (output: ChatCompletionResponseMessage) => {
          if (
            props.onCall !== undefined &&
            output.function_call !== undefined &&
            output.function_call.name === props.name &&
            output.function_call.arguments !== undefined
          ) {
            await props.onCall(output.function_call.arguments);
          }
        },
      }}
    </>
  );
}

// May contain a-z, A-Z, 0-9, and underscores, with a maximum length of 64 characters.
function validFunctionName(name: string): boolean {
  return /^[a-zA-Z0-9_]{1,64}$/.test(name);
}

export function ZFunction<ParamT>(
  props: PromptProps<{
    name: string;
    description: string;
    parameters: z.ZodType<ParamT>;
    // if the args fail to parse, we throw here
    onCall?: (args: ParamT) => Promise<void>;
    // if onParseError is provided, then we don't throw
    // this can be useful in case a failed parse can still be useful for us
    // in cases when we really want the output, we can also call a model here to parse the output
    onParseError?: (error: z.ZodError, rawArgs: string) => Promise<void>;
    // TODO: add an autoheal here
  }>
) {
  return (
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    <Function
      name={props.name}
      description={props.description}
      parameters={zodToJsonSchema(props.parameters)}
      onCall={async (rawArgs: string) => {
        if (props.onCall === undefined) {
          // do nothing
          return;
        }
        try {
          const args = props.parameters.parse(JSON.parse(rawArgs));
          await props.onCall(args);
        } catch (error) {
          if (props.onParseError !== undefined) {
            await props.onParseError(error, rawArgs);
          } else {
            throw error;
          }
        }
      }}
    />
  );
}

function zodToJsonSchema(schema: z.ZodType): JSONSchema7 {
  const fullSchema = zodToJsonSchemaImpl(schema, { $refStrategy: "none" });
  const {
    $schema,
    default: defaultVal,
    definitions,
    description,
    markdownDescription,
    ...rest
  } = fullSchema;
  // delete additionalProperties
  if ("additionalProperties" in rest) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    delete rest.additionalProperties;
  }
  return rest as JSONSchema7;
}
