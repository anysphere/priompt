import * as Priompt from "./lib";
import { PromptElement, PromptProps } from "./types";

export function SystemMessage(props: PromptProps): PromptElement {
  console.log("children of the system message", { children: props.children });
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
