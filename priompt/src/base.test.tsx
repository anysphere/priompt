import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Priompt from "./lib";
import { isChatPrompt, isPlainPrompt, promptHasFunctions, render } from "./lib";
import { PromptElement, PromptProps } from "./types";

describe("isolate", () => {
  function Isolate(
    props: PromptProps<{ isolate: boolean; tokenLimit: number }>
  ): PromptElement {
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

  function Test(props: PromptProps<{ isolate: boolean }>): PromptElement {
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

  it("should have isolate work", () => {
    const renderedIsolated = render(Test({ isolate: true }), {
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

    const renderedUnIsolated = render(Test({ isolate: false }), {
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
});
