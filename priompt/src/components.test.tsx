import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Priompt from "./lib";
import {
  isChatPrompt,
  isPlainPrompt,
  promptHasFunctions,
  promptToOpenAIChatMessages,
  render,
} from "./lib";
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

  function TestSystemMessageWithName(
    props: PromptProps<{ systemName?: string; userName?: string }>
  ): PromptElement {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return (
      <>
        <SystemMessage name={props.systemName}>
          hi this is a system message
        </SystemMessage>
        <UserMessage name={props.userName}>
          hi this is a user message
        </UserMessage>
        <UserMessage>hi this is a user message</UserMessage>
      </>
    );
  }

  it("should test the 'name' field of the SystemMessage", async () => {
    const rendered = await render(
      TestSystemMessageWithName({ systemName: "TestName", userName: "carl" }),
      {
        tokenLimit: 1000,
        tokenizer: "cl100k_base",
      }
    );
    expect(isChatPrompt(rendered.prompt)).toBe(true);
    if (!isChatPrompt(rendered.prompt)) return;
    expect(rendered.prompt.messages[0].role === "system").toBe(true);
    if (rendered.prompt.messages[0].role !== "system") return;
    expect(rendered.prompt.messages[0].name).toBe("TestName");
    expect(rendered.prompt.messages[1].role === "user").toBe(true);
    if (rendered.prompt.messages[1].role !== "user") return;
    expect(rendered.prompt.messages[1].name).toBe("carl");
    expect(rendered.prompt.messages[2].role === "user").toBe(true);
    if (rendered.prompt.messages[2].role !== "user") return;
    expect(rendered.prompt.messages[2].name).toBeUndefined();

    const openAIPrompt = promptToOpenAIChatMessages(rendered.prompt);
    expect(openAIPrompt[0].role === "system").toBe(true);
    if (openAIPrompt[0].role !== "system") return;
    expect(openAIPrompt[0].name).toBe("TestName");
    expect(openAIPrompt[1].role === "user").toBe(true);
    if (openAIPrompt[1].role !== "user") return;
    expect(openAIPrompt[1].name).toBe("carl");
    expect(openAIPrompt[2].role === "user").toBe(true);
    if (openAIPrompt[2].role !== "user") return;
    expect(openAIPrompt[2].name).toBeUndefined();
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
