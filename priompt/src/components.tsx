import { ChatCompletionResponseMessage } from "openai";
import * as Priompt from "./lib";
import {
  BasePromptProps,
  ImageProps,
  PromptElement,
  PromptProps,
} from "./types";
import { JSONSchema7 } from "json-schema";
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
    to?: string;
  }>
): PromptElement {
  return {
    type: "chat",
    role: "assistant",
    functionCall: props.functionCall,
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
