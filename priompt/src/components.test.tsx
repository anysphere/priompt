import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Priompt from "./lib";
import { isChatPrompt, isPlainPrompt, promptHasFunctions, render } from "./lib";
import {
  AssistantMessage,
  Function,
  FunctionMessage,
  SystemMessage,
  UserMessage,
} from "./components";
import { PromptElement, PromptProps } from "./types";

describe("SystemMessage", () => {
  function TestSystemMessage(props: PromptProps): PromptElement {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return <SystemMessage>hi this is a system message</SystemMessage>;
  }

  it("should create a chat message", async () => {
    const rendered = await render(TestSystemMessage({}), {
      tokenLimit: 1000,
      tokenizer: "cl100k_base",
    });
    expect(isChatPrompt(rendered.prompt)).toBe(true);
  });
});

describe("Function", () => {
  function TestFunction(props: PromptProps): PromptElement {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return (
      <>
        {/* // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore */}
        <Function
          name={"echo"}
          description={"Echo a message to the user."}
          parameters={{
            type: "object",
            properties: {
              message: {
                type: "string",
                description: "The message to echo.",
              },
            },
            required: ["message"],
          }}
        />
        {/* // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore */}
        <UserMessage>say hi</UserMessage>
      </>
    );
  }

  it("should create a function message", async () => {
    const rendered = await render(TestFunction({}), {
      tokenLimit: 1000,
      tokenizer: "cl100k_base",
    });
    expect(isChatPrompt(rendered.prompt)).toBe(true);
    expect(promptHasFunctions(rendered.prompt)).toBe(true);
    if (!promptHasFunctions(rendered.prompt)) return;
    expect(rendered.prompt.functions).toEqual([
      {
        name: "echo",
        description: "Echo a message to the user.",
        parameters: {
          type: "object",
          properties: {
            message: {
              type: "string",
              description: "The message to echo.",
            },
          },
          required: ["message"],
        },
      },
    ]);
  });
});

describe("All kinds of messages", () => {
  function TestAllMessages(props: PromptProps): PromptElement {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return (
      <>
        {/* // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore */}
        <Function
          name={"echo"}
          description={"Echo a message to the user."}
          parameters={{
            type: "object",
            properties: {
              message: {
                type: "string",
                description: "The message to echo.",
              },
            },
            required: ["message"],
          }}
        />
        {/* // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore */}
        <SystemMessage>System message</SystemMessage>
        {/* // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore */}
        <UserMessage>User message</UserMessage>
        {/* // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore */}
        <AssistantMessage
          functionCall={{
            name: "echo",
            arguments: '{"message": "this is a test echo"}',
          }}
        ></AssistantMessage>
        {/* // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore */}
        <FunctionMessage name={"echo"}>this is a test echo</FunctionMessage>
      </>
    );
  }

  it("should create all kinds of messages", async () => {
    const rendered = await render(TestAllMessages({}), {
      tokenLimit: 1000,
      tokenizer: "cl100k_base",
    });
    expect(isChatPrompt(rendered.prompt)).toBe(true);
    if (!isChatPrompt(rendered.prompt)) return;
    expect(promptHasFunctions(rendered.prompt)).toBe(true);
    if (!promptHasFunctions(rendered.prompt)) return;
    expect(rendered.prompt.functions).toEqual([
      {
        name: "echo",
        description: "Echo a message to the user.",
        parameters: {
          type: "object",
          properties: {
            message: {
              type: "string",
              description: "The message to echo.",
            },
          },
          required: ["message"],
        },
      },
    ]);
    expect(rendered.prompt.messages).toEqual([
      {
        role: "system",
        content: "System message",
      },
      {
        role: "user",
        content: "User message",
      },
      {
        role: "assistant",
        functionCall: {
          name: "echo",
          arguments: '{"message": "this is a test echo"}',
        },
      },
      {
        role: "function",
        name: "echo",
        content: "this is a test echo",
      },
    ]);
  });
});
