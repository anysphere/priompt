import { describe, expect, it } from "vitest";
import * as Priompt from "./index";
import {
  isChatPrompt,
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
import { getTokenizerByName_ONLY_FOR_OPENAI_TOKENIZERS } from "./tokenizer";
import {
  ChatCompletionResponseMessage,
  StreamChatCompletionResponse,
} from "./openai";

describe("SystemMessage", () => {
  function TestSystemMessage(props: PromptProps): PromptElement {
    return <SystemMessage>hi this is a system message</SystemMessage>;
  }

  it("should create a chat message", async () => {
    const rendered = await render(TestSystemMessage({}), {
      tokenLimit: 1000,
      tokenizer: getTokenizerByName_ONLY_FOR_OPENAI_TOKENIZERS("cl100k_base"),
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
        tokenizer: getTokenizerByName_ONLY_FOR_OPENAI_TOKENIZERS("cl100k_base"),
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
      tokenizer: getTokenizerByName_ONLY_FOR_OPENAI_TOKENIZERS("cl100k_base"),
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
      tokenizer: getTokenizerByName_ONLY_FOR_OPENAI_TOKENIZERS("cl100k_base"),
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
    expect(openaiMessage[5].role).toBe("tool");
    // assert none of them contain "to"
    expect("to" in openaiMessage[4]).toBe(false);
    expect("to" in openaiMessage[5]).toBe(false);
  });
});

describe.skip("Images", () => {
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
      tokenizer: getTokenizerByName_ONLY_FOR_OPENAI_TOKENIZERS("cl100k_base"),
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

describe("Large prompts with many new lines and priority levels", () => {
  function TestLargePrompt(props: PromptProps): PromptElement {
    return (
      <>
        <SystemMessage>You are a helpful assistant.</SystemMessage>
        <UserMessage>
          {Array(100)
            .fill(null)
            .map((_, i) => (
              <scope p={i * 10}>
                This is line {i + 1} of the large prompt.
                {i % 10 === 0 && <br />}
                {i % 20 === 0 && <hr />}
              </scope>
            ))}
        </UserMessage>
        <AssistantMessage>
          Understood. How can I help you with this large prompt?
        </AssistantMessage>
        <UserMessage>
          <scope p={1000}>
            This is a high priority message that should always be included.
          </scope>
          <scope p={500}>
            This is a medium priority message that might be included.
          </scope>
          {Array(50)
            .fill(null)
            .map((_, i) => (
              <scope p={i * 10}>
                This is a message with priority {i * 10}.
              </scope>
            ))}
        </UserMessage>
      </>
    );
  }

  it("should render the large prompt correctly", async () => {
    const rendered = await render(TestLargePrompt({}), {
      tokenLimit: 1000,
      tokenizer: getTokenizerByName_ONLY_FOR_OPENAI_TOKENIZERS("cl100k_base"),
    });
    expect(isChatPrompt(rendered.prompt)).toBe(true);
    if (!isChatPrompt(rendered.prompt)) return;

    expect(rendered.prompt.messages.length).toBe(4);
    expect(rendered.prompt.messages[0].role).toBe("system");
    expect(rendered.prompt.messages[1].role).toBe("user");
    expect(rendered.prompt.messages[2].role).toBe("assistant");
    expect(rendered.prompt.messages[3].role).toBe("user");

    // Check that the high priority message is included
    expect(rendered.prompt.messages[3].content).toContain(
      "This is a high priority message that should always be included."
    );

    // Check that some of the dynamic priority messages are included
    const dynamicPriorityCount =
      (rendered.prompt.messages[3].content as string).match(
        /This is a message with priority/g
      )?.length ?? 0;
    expect(dynamicPriorityCount).toBeGreaterThan(0);
    expect(dynamicPriorityCount).toBeLessThan(50);

    // Check that the token count is within the limit
    expect(rendered.tokenCount).toBeLessThanOrEqual(2000);
  });

  it("should handle different token limits", async () => {
    const tokenLimits = [500, 1000, 1500, 2000, 3000];

    for (const limit of tokenLimits) {
      const rendered = await render(TestLargePrompt({}), {
        tokenLimit: limit,
        tokenizer: getTokenizerByName_ONLY_FOR_OPENAI_TOKENIZERS("cl100k_base"),
      });

      expect(isChatPrompt(rendered.prompt)).toBe(true);
      if (!isChatPrompt(rendered.prompt)) return;

      expect(rendered.tokenCount).toBeLessThanOrEqual(limit);

      // Check that the number of included messages increases with the token limit
      const userMessageContent = rendered.prompt.messages[3].content as string;
      const dynamicPriorityCount =
        userMessageContent.match(/This is a message with priority/g)?.length ??
        0;

      if (limit > 1000) {
        expect(dynamicPriorityCount).toBeGreaterThan(0);
      }
    }
  });

  function TestNestedPriorityLevels(props: PromptProps): PromptElement {
    return (
      <UserMessage>
        <scope p={1000}>
          Top level high priority
          <scope p={500}>
            Nested medium priority
            <scope p={100}>
              Deeply nested low priority
              <scope p={50}>Very deeply nested very low priority</scope>
            </scope>
          </scope>
        </scope>
        {Array(10)
          .fill(null)
          .map((_, i) => (
            <scope p={(10 - i) * 100}>
              Priority level {(10 - i) * 100}
              <scope p={(10 - i) * 50}>
                Nested priority level {(10 - i) * 50}
              </scope>
            </scope>
          ))}
      </UserMessage>
    );
  }

  it("should handle nested priority levels correctly", async () => {
    const rendered = await render(TestNestedPriorityLevels({}), {
      tokenLimit: 70,
      tokenizer: getTokenizerByName_ONLY_FOR_OPENAI_TOKENIZERS("cl100k_base"),
    });

    expect(isChatPrompt(rendered.prompt)).toBe(true);
    if (!isChatPrompt(rendered.prompt)) return;

    const content = rendered.prompt.messages[0].content as string;

    expect(content).toContain("Top level high priority");
    expect(content).toContain("Nested medium priority");
    expect(content).toContain("Priority level 1000");
    expect(content).toContain("Priority level 900");

    // Lower priority items might be excluded due to token limit
    const lowerPriorityCount = (content.match(/Priority level [1-9]/g) || [])
      .length;
    expect(lowerPriorityCount).toBeLessThan(9);

    expect(rendered.tokenCount).toBeLessThanOrEqual(500);
  });
});

describe("Complex PromptElement Regression Tests", () => {
  const tokenizer =
    getTokenizerByName_ONLY_FOR_OPENAI_TOKENIZERS("cl100k_base");

  it("should render a complex PromptElement with nested elements", async () => {
    function ComplexPrompt(props: PromptProps): PromptElement {
      return (
        <>
          <SystemMessage>
            This is a complex system message with{" "}
            <scope p={1000}>high priority content</scope> and{" "}
            <scope p={500}>medium priority content</scope>.
            <br />
            New line in system message.
          </SystemMessage>
          <UserMessage>
            User message with a <breaktoken /> break and <br /> line break.
            <scope p={800}>
              <ImageComponent
                bytes={new Uint8Array([0, 1, 2, 3])}
                dimensions={{ width: 100, height: 100 }}
                detail="auto"
              />
              Image with some text
            </scope>
          </UserMessage>
          <AssistantMessage>
            Assistant response with{" "}
            <scope prel={-100}>lower priority information</scope>
            <breaktoken />
            After break token in assistant message
          </AssistantMessage>
          <Function
            name="testFunction"
            description="A test function"
            parameters={{
              type: "object",
              properties: {
                param1: { type: "string" },
                param2: { type: "number" },
              },
              required: ["param1"],
            }}
          />
          <FunctionMessage name="testFunction">
            Function result with nested scopes:
            <scope p={700}>
              <scope p={750}>Highest priority</scope>
              Medium priority
              <br />
              New line in function message
            </scope>
          </FunctionMessage>
          {[1, 2, 3].map((num) => (
            <UserMessage>
              Message {num} in array
              {num % 2 === 0 && (
                <scope p={600}>
                  Even numbered message
                  <breaktoken />
                  After break in even message
                </scope>
              )}
              <br />
            </UserMessage>
          ))}
          <empty tokens={5} />
        </>
      );
    }

    const rendered = await Priompt.render(ComplexPrompt({}), {
      tokenLimit: 1000,
      tokenizer,
      shouldBuildSourceMap: true,
    });
    // Remove 'durationMs' from rendered since its non deterministic for the snapshot
    delete rendered.durationMs;
    expect(rendered).toMatchSnapshot();
  });

  it("should render a PromptElement with multiple nested arrays and first elements", async () => {
    function NestedArraysPrompt(props: PromptProps): PromptElement {
      return (
        <>
          <SystemMessage>
            System message for nested arrays test
            <br />
            New line in system message
          </SystemMessage>
          {[
            [1, 2],
            [3, 4],
          ].map((subArray, i) => (
            <scope p={1000 - i * 100}>
              {subArray.map((num) => (
                <UserMessage>
                  Nested array message {num}
                  <breaktoken />
                  After break in nested message
                  <first>
                    <scope p={800}>First choice for {num}</scope>
                    <scope p={700}>Second choice for {num}</scope>
                    <scope p={600}>
                      Third choice for {num}
                      <br />
                      New line in third choice
                    </scope>
                  </first>
                </UserMessage>
              ))}
            </scope>
          ))}
          <AssistantMessage>
            <first>
              <scope p={900}>
                High priority assistant response
                <breaktoken />
                After break in high priority
              </scope>
              <scope p={800}>Medium priority assistant response</scope>
              <scope p={700}>
                Low priority assistant response
                <br />
                New line in low priority
              </scope>
            </first>
          </AssistantMessage>
        </>
      );
    }

    const rendered = await Priompt.render(NestedArraysPrompt({}), {
      tokenLimit: 1000,
      tokenizer,
      shouldBuildSourceMap: true,
    });
    // Remove 'durationMs' from rendered since its non deterministic for the snapshot
    delete rendered.durationMs;
    expect(rendered).toMatchSnapshot();
  });

  it("should render a PromptElement with isolate and capture elements", async () => {
    const capturedOutput: ChatCompletionResponseMessage[] = [];
    const capturedStream: string[] = [];
    const capturedStreamResponse: StreamChatCompletionResponse[] = [];

    function IsolateAndCapturePrompt(props: PromptProps): PromptElement {
      return (
        <>
          <SystemMessage>
            System message for isolate and capture test
          </SystemMessage>
          <isolate tokenLimit={200}>
            <UserMessage>
              This is an isolated user message with a token limit of 200
              <scope p={900}>High priority isolated content</scope>
              <scope p={800}>Medium priority isolated content</scope>
              <scope p={700}>Low priority isolated content</scope>
            </UserMessage>
          </isolate>
          <capture
            onOutput={async (output) => {
              capturedOutput.push(output);
            }}
            onStream={async (stream) => {
              for await (const chunk of stream) {
                capturedStream.push(JSON.stringify(chunk));
              }
            }}
            onStreamResponseObject={async (stream) => {
              for await (const chunk of stream) {
                capturedStreamResponse.push(chunk);
              }
            }}
          />
          <AssistantMessage>
            Assistant message after capture
            <scope p={950}>Very high priority content</scope>
            <scope p={850}>High priority content</scope>
          </AssistantMessage>
        </>
      );
    }

    const rendered = await Priompt.render(IsolateAndCapturePrompt({}), {
      tokenLimit: 1000,
      tokenizer,
      shouldBuildSourceMap: true,
    });

    // Simulate some output and streams to test the capture
    if (rendered.outputHandlers.length > 0) {
      await rendered.outputHandlers[0]({
        role: "assistant",
        content: "Test output",
      });
    }

    if (rendered.streamHandlers.length > 0) {
      const testStream = async function* (): AsyncGenerator<
        ChatCompletionResponseMessage,
        void,
        unknown
      > {
        yield { role: "assistant", content: "Stream " };
        yield { role: "assistant", content: "test " };
        yield { role: "assistant", content: "output" };
      };
      await rendered.streamHandlers[0](testStream());
    }

    if (rendered.streamResponseObjectHandlers.length > 0) {
      const testStreamResponse = async function* (): AsyncGenerator<
        StreamChatCompletionResponse,
        void,
        unknown
      > {
        yield {
          id: "1",
          object: "chat.completion.chunk",
          created: 1234567890,
          model: "gpt-3.5-turbo",
          choices: [
            { index: 0, delta: { role: "assistant", content: "Response " } },
          ],
        };
        yield {
          id: "2",
          object: "chat.completion.chunk",
          created: 1234567891,
          model: "gpt-3.5-turbo",
          choices: [{ index: 0, delta: { role: "user", content: "object " } }],
        };
        yield {
          id: "3",
          object: "chat.completion.chunk",
          created: 1234567892,
          model: "gpt-3.5-turbo",
          choices: [
            { index: 0, delta: { role: "assistant", content: "stream" } },
          ],
        };
      };
      await rendered.streamResponseObjectHandlers[0](testStreamResponse());
    }

    // Remove 'durationMs' from rendered since its non deterministic for the snapshot
    delete rendered.durationMs;
    // Include captured data in the snapshot
    const snapshotData = {
      rendered,
      capturedOutput,
      capturedStream,
      capturedStreamResponse,
    };

    expect(snapshotData).toMatchSnapshot();
  });

  it("should render a PromptElement with config and complex nested structures", async () => {
    function ComplexNestedPrompt(props: PromptProps): PromptElement {
      return (
        <>
          <config maxResponseTokens={100} stop={["STOP", "END"]} />
          <SystemMessage>
            System message for complex nested structures test
            <br />
            New line in system message
          </SystemMessage>
          <UserMessage>
            User message with nested structures
            <scope p={900}>
              High priority scope
              <first>
                <scope p={950}>
                  First choice in high priority
                  <breaktoken />
                  After break in first choice
                </scope>
                <scope p={940}>Second choice in high priority</scope>
              </first>
              <isolate tokenLimit={150}>
                <UserMessage>
                  Nested isolated user message
                  <br />
                  New line in isolated message
                </UserMessage>
                <AssistantMessage>
                  Nested isolated assistant message
                  <breaktoken />
                  After break in isolated assistant message
                </AssistantMessage>
              </isolate>
            </scope>
            <scope p={800}>
              Medium priority scope
              <breaktoken />
              After break token
              <ImageComponent
                bytes={new Uint8Array([4, 5, 6, 7])}
                dimensions={{ width: 200, height: 200 }}
                detail="high"
              />
            </scope>
          </UserMessage>
          <AssistantMessage
            functionCall={{
              name: "testFunction",
              arguments: JSON.stringify({ param1: "test", param2: 42 }),
            }}
          >
            Assistant message with function call
            <br />
            New line in assistant message
          </AssistantMessage>
          <FunctionMessage name="testFunction">
            Function result for complex nested test
            <breaktoken />
            After break in function message
          </FunctionMessage>
          <empty tokens={10} />
        </>
      );
    }

    const rendered = await Priompt.render(ComplexNestedPrompt({}), {
      tokenLimit: 1500,
      tokenizer,
      shouldBuildSourceMap: true,
    });
    // Remove 'durationMs' from rendered since its non deterministic for the snapshot
    delete rendered.durationMs;
    expect(rendered).toMatchSnapshot();
  });

  it("should render a complex PromptElement with nested elements and arrays", async () => {
    function ComplexPrompt(props: PromptProps): PromptElement {
      const priorityLevels = [1000, 800, 600, 400, 200, 100];
      const messageTypes = ["user", "assistant", "system"] as const;

      return (
        <>
          <SystemMessage>
            This is a complex system message with nested elements and arrays.
          </SystemMessage>
          {priorityLevels.map((priority, index) => (
            <scope p={priority}>
              <UserMessage>
                Priority level {priority} message
                {index % 2 === 0 && <breaktoken />}
                {[...Array(20)].map((_, i) => (
                  <scope p={priority - i * 50}>
                    Nested scope {i + 1} in priority {priority}
                    <br />
                  </scope>
                ))}
              </UserMessage>
            </scope>
          ))}
          <AssistantMessage>
            Assistant message with nested elements
            <first>
              {messageTypes.map((type, index) => (
                <scope p={900 - index * 100}>
                  {type === "user" && (
                    <UserMessage>Nested user message</UserMessage>
                  )}
                  {type === "assistant" && (
                    <AssistantMessage>
                      Nested assistant message
                    </AssistantMessage>
                  )}
                  {type === "system" && (
                    <SystemMessage>Nested system message</SystemMessage>
                  )}
                </scope>
              ))}
            </first>
          </AssistantMessage>
          {[...Array(3)].map((_, i) => (
            <Function
              name={`testFunction${i + 1}`}
              description={`Test function ${i + 1}`}
              parameters={{
                type: "object",
                properties: {
                  param1: { type: "string" },
                  param2: { type: "number" },
                },
                required: ["param1"],
              }}
            />
          ))}
          <isolate tokenLimit={300}>
            {[...Array(4)].map((_, i) => (
              <scope p={1000 - i * 100}>
                <UserMessage>
                  Isolated message {i + 1}
                  <ImageComponent
                    bytes={new Uint8Array([i, i + 1, i + 2, i + 3])}
                    dimensions={{ width: 100 * (i + 1), height: 100 * (i + 1) }}
                    detail={i % 2 === 0 ? "auto" : "high"}
                  />
                </UserMessage>
              </scope>
            ))}
          </isolate>
          {[...Array(3)].map((_, i) => (
            <FunctionMessage name={`testFunction${i + 1}`}>
              Function {i + 1} result with nested scopes:
              {[...Array(3)].map((_, j) => (
                <scope p={700 - j * 50}>
                  Nested scope {j + 1} in function {i + 1}
                  {j === 1 && <breaktoken />}
                </scope>
              ))}
            </FunctionMessage>
          ))}
          <empty tokens={10} />
        </>
      );
    }

    const rendered = await Priompt.render(ComplexPrompt({}), {
      tokenLimit: 5000,
      tokenizer,
      shouldBuildSourceMap: true,
    });
    delete rendered.durationMs;
    expect(rendered).toMatchSnapshot();
  });

  it("should render a PromptElement with multiple nested arrays and conditional elements", async () => {
    function NestedArraysPrompt(props: PromptProps): PromptElement {
      const generateNestedArray = (rows: number, cols: number): number[][] => {
        return Array.from({ length: rows }, (_, i) =>
          Array.from({ length: cols }, (_, j) => i * cols + j + 1)
        );
      };

      const nestedArray = generateNestedArray(6, 6);

      return (
        <>
          <SystemMessage>
            System message for nested arrays and conditional elements test
          </SystemMessage>
          {nestedArray.map((subArray, i) => (
            <scope p={1000 - i * 100}>
              {subArray.map((num) => (
                <UserMessage>
                  Nested array message {num}
                  <isolate tokenLimit={500}>
                    <breaktoken />
                    <first>
                      {[...Array(10)].map((_, j) => (
                        <scope p={800 - j * 50}>
                          Choice {j + 1} for {num}
                        </scope>
                      ))}
                    </first>
                  </isolate>
                </UserMessage>
              ))}
            </scope>
          ))}
          <AssistantMessage>
            <first>
              {[...Array(10)].map((_, i) => (
                <scope p={900 - i * 50}>
                  Priority {900 - i * 50} assistant response
                  <br />
                  <br />
                  {i % 2 === 0 && <breaktoken />}
                  {i % 3 === 0 && (
                    <ImageComponent
                      bytes={new Uint8Array([i, i + 1, i + 2, i + 3])}
                      dimensions={{ width: 50 * (i + 1), height: 50 * (i + 1) }}
                      detail="auto"
                    />
                  )}
                </scope>
              ))}
            </first>
          </AssistantMessage>
        </>
      );
    }

    const rendered = await Priompt.render(NestedArraysPrompt({}), {
      tokenLimit: 5000,
      tokenizer,
      shouldBuildSourceMap: true,
    });
    delete rendered.durationMs;
    expect(rendered).toMatchSnapshot();
  });
});
