import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Priompt from "./index";
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
  ToolResultMessage,
  ImageComponent,
  SystemMessage,
  UserMessage,
} from "./components";
import { PromptElement, PromptProps } from "./types";

describe("SystemMessage", () => {
  function TestSystemMessage(props: PromptProps): PromptElement {
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
    return (
      <>
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
    return (
      <>
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
        <SystemMessage>System message</SystemMessage>
        <UserMessage>User message</UserMessage>
        <AssistantMessage
          functionCall={{
            name: "echo",
            arguments: '{"message": "this is a test echo"}',
          }}
        ></AssistantMessage>
        <FunctionMessage name={"echo"}>this is a test echo</FunctionMessage>
        {/* // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore */}
        <AssistantMessage to="python">print("Hello world!")</AssistantMessage>
        {/* // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore */}
        <ToolResultMessage name={"python"} to="all">
          Hello world!
        </ToolResultMessage>
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
      {
        role: "assistant",
        to: "python",
        content: 'print("Hello world!")',
      },
      {
        role: "tool",
        name: "python",
        to: "all",
        content: "Hello world!",
      },
    ]);
    const openaiMessage = promptToOpenAIChatMessages(rendered.prompt);
    expect(openaiMessage.length).toBe(6);
    expect(openaiMessage[0].role).toBe("system");
    expect(openaiMessage[1].role).toBe("user");
    expect(openaiMessage[2].role).toBe("assistant");
    expect(openaiMessage[3].role).toBe("function");
    expect(openaiMessage[4].role).toBe("assistant");
    // the tool shall not be sent to openai! it's unsupported
    expect(openaiMessage[5].role).toBe("system");
    // assert none of them contain "to"
    expect("to" in openaiMessage[4]).toBe(false);
    expect("to" in openaiMessage[5]).toBe(false);
  });
});

describe("Images", () => {
  function TestImageMessage(props: PromptProps): PromptElement {
    return (
      <>
        <SystemMessage>System message</SystemMessage>
        <UserMessage>
          {/* // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore */}
          <ImageComponent
            bytes={new Uint8Array([0, 0, 0, 0, 0])}
            dimensions={{ width: 10, height: 10 }}
            detail="auto"
          />
          <br />
          If the instructions mention this image, use it to help you write the
          code with the utmost precision and detail.
          <br />
          {"<instructions>"}
          <br />
          TEST, THIS IS A TEST,
          <br />
          {"</instructions>"}
          <br />
        </UserMessage>
      </>
    );
  }

  it("should create all kinds of messages", async () => {
    const rendered = await render(TestImageMessage({}), {
      tokenLimit: 1000,
      tokenizer: "cl100k_base",
    });
    expect(isChatPrompt(rendered.prompt)).toBe(true);
    if (!isChatPrompt(rendered.prompt)) return;
    // make sure the prompt string part is in the right order
    expect(rendered.prompt.messages[1].content).toBe(
      "\n" +
        "If the instructions mention this image, use it to help you write the code with the utmost precision and detail.\n" +
        "<instructions>\n" +
        "TEST, THIS IS A TEST,\n" +
        "</instructions>\n"
    );
  });
});
