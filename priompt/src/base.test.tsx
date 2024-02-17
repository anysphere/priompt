import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Priompt from "./index";
import {
  isChatPrompt,
  isPlainPrompt,
  promptHasFunctions,
  promptToTokens,
  render,
} from "./lib";
import { PromptElement, PromptProps } from "./types";
import { AssistantMessage, SystemMessage, UserMessage } from "./components";

describe("isolate", () => {
  function Isolate(
    props: PromptProps<{ isolate: boolean; tokenLimit: number }>
  ): PromptElement {
    if (props.isolate) {
      return (
        <>
          <isolate p={props.p} prel={props.prel} tokenLimit={props.tokenLimit}>
            {props.children}
          </isolate>
        </>
      );
    } else {
      return (
        <>
          <scope p={props.p} prel={props.prel}>
            {props.children}
          </scope>
        </>
      );
    }
  }

  function Test(props: PromptProps<{ isolate: boolean }>): PromptElement {
    return (
      <>
        This is the start of the prompt.
        <Isolate tokenLimit={100} isolate={props.isolate}>
          {Array.from({ length: 1000 }, (_, i) => (
            <>
              <scope prel={-i - 2000}>
                This is an SHOULDBEINCLUDEDONLYIFISOLATED user message number{" "}
                {i}
              </scope>
            </>
          ))}
        </Isolate>
        {Array.from({ length: 1000 }, (_, i) => (
          <>
            <scope prel={-i - 1000}>This is user message number {i}</scope>
          </>
        ))}
        <Isolate tokenLimit={100} isolate={props.isolate}>
          {Array.from({ length: 1000 }, (_, i) => (
            <>
              <scope prel={-i}>
                {i},xl,x,,
                {i > 100 ? "SHOULDBEINCLUDEDONLYIFNOTISOLATED" : ""}
              </scope>
            </>
          ))}
        </Isolate>
      </>
    );
  }

  it("should have isolate work", async () => {
    const renderedIsolated = await render(Test({ isolate: true }), {
      tokenLimit: 1000,
      tokenizer: "cl100k_base",
    });
    expect(renderedIsolated.tokenCount).toBeLessThanOrEqual(1000);
    expect(isPlainPrompt(renderedIsolated.prompt)).toBe(true);
    if (!isPlainPrompt(renderedIsolated.prompt)) return;
    expect(
      renderedIsolated.prompt.includes("SHOULDBEINCLUDEDONLYIFISOLATED")
    ).toBe(true);
    expect(
      renderedIsolated.prompt.includes("SHOULDBEINCLUDEDONLYIFNOTISOLATED")
    ).toBe(false);

    const renderedUnIsolated = await render(Test({ isolate: false }), {
      tokenLimit: 1000,
      tokenizer: "cl100k_base",
    });
    expect(renderedUnIsolated.tokenCount).toBeLessThanOrEqual(1000);
    expect(isPlainPrompt(renderedUnIsolated.prompt)).toBe(true);
    if (!isPlainPrompt(renderedUnIsolated.prompt)) return;
    expect(
      renderedUnIsolated.prompt.includes("SHOULDBEINCLUDEDONLYIFISOLATED")
    ).toBe(false);
    expect(
      renderedUnIsolated.prompt.includes("SHOULDBEINCLUDEDONLYIFNOTISOLATED")
    ).toBe(true);
  });

  function SimplePrompt(
    props: PromptProps<{ breaktoken: boolean }>
  ): PromptElement {
    return (
      <>
        This is the start of the p{props.breaktoken ? <breaktoken /> : <></>}
        rompt. This is the second part of the prompt.
      </>
    );
  }

  it("promptToTokens should work", async () => {
    const donotbreak = await render(SimplePrompt({ breaktoken: false }), {
      tokenLimit: 1000,
      tokenizer: "cl100k_base",
    });
    const toTokens = await promptToTokens(donotbreak.prompt, "cl100k_base");
    expect(donotbreak.tokenCount).toBe(toTokens.length);
    expect(toTokens).toStrictEqual([
      2028, 374, 279, 1212, 315, 279, 10137, 13, 1115, 374, 279, 2132, 961, 315,
      279, 10137, 13,
    ]);

    const dobreak = await render(SimplePrompt({ breaktoken: true }), {
      tokenLimit: 1000,
      tokenizer: "cl100k_base",
    });
    expect(dobreak.tokenCount).toBe(donotbreak.tokenCount + 1);
    const toTokens2 = await promptToTokens(dobreak.prompt, "cl100k_base");
    expect(dobreak.tokenCount).toBe(toTokens2.length);
    expect(toTokens2).toStrictEqual([
      2028, 374, 279, 1212, 315, 279, 281, 15091, 13, 1115, 374, 279, 2132, 961,
      315, 279, 10137, 13,
    ]);
  });

  function SimpleMessagePrompt(
    props: PromptProps<{ breaktoken: boolean }>
  ): PromptElement {
    return (
      <>
        <SystemMessage>
          This is the start of the prompt.
          <br />
          {props.breaktoken ? <breaktoken /> : <></>}
          <br />
          This is the second part of the prompt.
        </SystemMessage>
        <UserMessage>hi!</UserMessage>
      </>
    );
  }

  it("promptToTokens should work", async () => {
    const donotbreak = await render(
      SimpleMessagePrompt({ breaktoken: false }),
      {
        tokenLimit: 1000,
        tokenizer: "cl100k_base",
        lastMessageIsIncomplete: true,
      }
    );
    const toTokens = await promptToTokens(donotbreak.prompt, "cl100k_base");
    expect(donotbreak.tokenCount).toBe(toTokens.length);
    expect(toTokens).toStrictEqual([
      100264, 9125, 100266, 2028, 374, 279, 1212, 315, 279, 10137, 382, 2028,
      374, 279, 2132, 961, 315, 279, 10137, 13, 100265, 100264, 882, 100266,
      6151, 0,
    ]);

    const dobreak = await render(SimpleMessagePrompt({ breaktoken: true }), {
      tokenLimit: 1000,
      tokenizer: "cl100k_base",
      lastMessageIsIncomplete: true,
    });
    expect(dobreak.tokenCount).toBe(donotbreak.tokenCount + 1);
    const toTokens2 = await promptToTokens(dobreak.prompt, "cl100k_base");
    expect(dobreak.tokenCount).toBe(toTokens2.length);
    expect(toTokens2).toStrictEqual([
      100264, 9125, 100266, 2028, 374, 279, 1212, 315, 279, 10137, 627, 198,
      2028, 374, 279, 2132, 961, 315, 279, 10137, 13, 100265, 100264, 882,
      100266, 6151, 0,
    ]);
  });

  function SpecialTokensPrompt(): PromptElement {
    return (
      <>
        <SystemMessage>{"<|im_start|>"}</SystemMessage>
        <UserMessage>{"<|diff_marker|>"}</UserMessage>
        <AssistantMessage>{"<|endoftext|>"}</AssistantMessage>
      </>
    );
  }

  it("handle special tokens", async () => {
    const specialTokens = await render(SpecialTokensPrompt(), {
      tokenLimit: 1000,
      tokenizer: "cl100k_base",
      lastMessageIsIncomplete: true,
    });
    expect(specialTokens.tokenCount).toBeGreaterThanOrEqual(24);
    const toTokens = await promptToTokens(specialTokens.prompt, "cl100k_base");
    expect(specialTokens.tokenCount).toBe(toTokens.length);
  });
});

describe("config", () => {
  function TestConfig(
    props: PromptProps<{ numConfigs: number }>
  ): PromptElement {
    return (
      <>
        This is the start of the prompt.
        <config stop={"\n"} />
        <config maxResponseTokens="tokensReserved" />
      </>
    );
  }

  it("should have config work", async () => {
    const rendered = await render(TestConfig({ numConfigs: 1 }), {
      tokenLimit: 1000,
      tokenizer: "cl100k_base",
    });
    expect(rendered.tokenCount).toBeLessThanOrEqual(1000);
    expect(isPlainPrompt(rendered.prompt)).toBe(true);
    expect(rendered.config.stop).toBe("\n");
    expect(rendered.config.maxResponseTokens).toBe("tokensReserved");
  });
});
