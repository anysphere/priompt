import * as Priompt from "./lib";
import { PromptElement, PromptProps } from "./types";
import { JSONSchema7 } from "json-schema";

export function SystemMessage(props: PromptProps): PromptElement {
  return {
    type: "chat",
    role: "system",
    children:
      props.children !== undefined
        ? Array.isArray(props.children)
          ? props.children.flat()
          : [props.children]
        : [],
  };
}

export function UserMessage(props: PromptProps): PromptElement {
  return {
    type: "chat",
    role: "user",
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
  }>
): PromptElement {
  return {
    type: "chat",
    role: "assistant",
    functionCall: props.functionCall,
    children:
      props.children !== undefined
        ? Array.isArray(props.children)
          ? props.children.flat()
          : [props.children]
        : [],
  };
}

export function FunctionMessage(
  props: PromptProps<{
    name: string;
  }>
): PromptElement {
  return {
    type: "chat",
    role: "function",
    name: props.name,
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
  }>
): PromptElement {
  if (!validFunctionName(props.name)) {
    throw new Error(
      `Invalid function name: ${props.name}. Function names must be between 1 and 64 characters long and may only contain a-z, A-Z, 0-9, and underscores.`
    );
  }

  return {
    type: "functionDefinition",
    name: props.name,
    description: props.description,
    parameters: props.parameters,
  };
}

// May contain a-z, A-Z, 0-9, and underscores, with a maximum length of 64 characters.
function validFunctionName(name: string): boolean {
  return /^[a-zA-Z0-9_]{1,64}$/.test(name);
}
