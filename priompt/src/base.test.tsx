import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Priompt from "./lib";
import {
  isChatPrompt,
  isPlainPrompt,
  promptHasFunctions,
  promptToTokens,
  render,
} from "./lib";
import { PromptNode, PromptProps } from "./types";
import { AssistantMessage, SystemMessage, UserMessage } from "./components";

describe("isolate", () => {
  function Isolate(
    props: PromptProps<{ isolate: boolean; tokenLimit: number }>
  ): PromptNode {
    if (props.isolate) {
      return (
        <>
          {/* // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore */}
          <isolate p={props.p} prel={props.prel} tokenLimit={props.tokenLimit}>
            {props.children}
            {/* // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore */}
          </isolate>
        </>
      );
    } else {
      return (
        <>
          {/* // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore */}
          <scope p={props.p} prel={props.prel}>
            {props.children}
            {/* // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore */}
          </scope>
        </>
      );
    }
  }

  function Test(props: PromptProps<{ isolate: boolean }>): PromptNode {
    return (
      <>
        This is the start of the prompt.
        {/* // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore */}
        <Isolate tokenLimit={100} isolate={props.isolate}>
          {Array.from({ length: 1000 }, (_, i) => (
            <>
              {/* // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore */}
              <scope prel={-i - 2000}>
                This is an SHOULDBEINCLUDEDONLYIFISOLATED user message number{" "}
                {i}
                {/* // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore */}
              </scope>
            </>
          ))}
        </Isolate>
        {Array.from({ length: 1000 }, (_, i) => (
          <>
            {/* // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore */}
            <scope prel={-i - 1000}>This is user message number {i}</scope>
          </>
        ))}
        {/* // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore */}
        <Isolate tokenLimit={100} isolate={props.isolate}>
          {Array.from({ length: 1000 }, (_, i) => (
            <>
              {/* // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore */}
              <scope prel={-i}>
                {i},xl,x,,
                {i > 100 ? "SHOULDBEINCLUDEDONLYIFNOTISOLATED" : ""}
                {/* // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore */}
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
  ): PromptNode {
    return (
      <>
        This is the start of the p
        {/* // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore */}
        {props.breaktoken ? <breaktoken /> : <></>}
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
  ): PromptNode {
    return (
      <>
        {/* // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore */}
        <SystemMessage>
          This is the start of the prompt.
          {/* // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore */}
          <br />
          {/* // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore */}
          {props.breaktoken ? <breaktoken /> : <></>}
          {/* // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore */}
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

  function SpecialTokensPrompt(): PromptNode {
    return (
      <>
        {/* // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore */}
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
