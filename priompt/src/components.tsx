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

export function AssistantMessage(props: PromptProps): PromptElement {
  return {
    type: "chat",
    role: "assistant",
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
  return {
    type: "functionDefinition",
    name: props.name,
    description: props.description,
    parameters: props.parameters,
  };
}
