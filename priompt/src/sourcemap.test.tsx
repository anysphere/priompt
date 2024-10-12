import { describe, expect, it } from "vitest";
import * as Priompt from "./index";
import {
  render,
} from "./lib";
import { PromptElement, PromptProps, SourceMap } from "./types";
import { SystemMessage, UserMessage } from "./components";
import { getTokenizerByName } from './tokenizer';

const validateSourceMap = (absoluteSourceMap: SourceMap, text: string): boolean => {
  // Leaves which are raw strings are annotated with the string field
  // If we have their absolute range they should be an exact match
  const getLeaves = (sourceMap: SourceMap): SourceMap[] => {
    const children = sourceMap.children || [];
    if (children.length > 0) {
      return children.flatMap(child => getLeaves(child));
    }
    return [sourceMap];
  };

  const leaves: SourceMap[] = getLeaves(absoluteSourceMap);
  const leavesWithString: SourceMap[] = leaves.filter(leaf => leaf.string !== undefined);

  const incorrectLeaves: SourceMap[] = leavesWithString.filter(leaf => {
    const expectedString = leaf.string;
    const actualString = text.substring(leaf.start, leaf.end);
    return expectedString !== actualString;
  });

  if (incorrectLeaves.length > 0) {
    console.log(
      "Failed to validate source map, incorrect leaves are",
      incorrectLeaves.sort((a, b) => a.start - b.start),
    );
    return false;
  }

  return true;
};

const absolutifySourceMap = (sourceMap: SourceMap, offset: number = 0): SourceMap => {
  const newOffset = sourceMap.start + offset;
  const children = sourceMap.children?.map(child => absolutifySourceMap(child, newOffset)) || [];
  return {
    ...sourceMap,
    start: newOffset,
    end: sourceMap.end + offset,
    children,
  };
};

describe("sourcemap", () => {
  function TestPromptTrivial(props: PromptProps<{ message: string }>): PromptElement {
    return (
      <>
        <SystemMessage>{props.message}</SystemMessage>
        <UserMessage>
          Testing sourcemap!
          <br/>
          abcdef
        </UserMessage>
      </>
    );
  }
  function TestPromptEmojiAndJapanese(): PromptElement {
    return (
      <>
        <SystemMessage>
          🫨
        </SystemMessage>
        <UserMessage>
          <scope name={'lemon'}>
          🍋
          </scope>
          <scope name={'japanese'}>
            これはレモン
          </scope>
        </UserMessage>
      </>
    )
  }

  function TestSourceMapMoreComplex(props: PromptProps<{message: string}>): PromptElement {
    const lines = props.message.split('\n')
    return (
      <>
        <SystemMessage>The System Message</SystemMessage>
        <UserMessage p={1000}>
          <scope name={'the first line'}>
            This is the first line

            <br/>
            <scope name={'buffer line'}>
              {lines[0]}
            </scope>
            <br/>
          </scope>
          <scope prel={-10} name={"lines"}>
          {lines.map((line, i) => (
            <scope prel={-i}>{line}</scope>
          ))}
          </scope>
        </UserMessage>
        <UserMessage>
        <scope name={'code'}>
          const rendered = await render(TestPromptSplit(props.message))

        tokenLimit: 100,
        tokenizer: getTokenizerByName("cl100k_base"),
        buildSourceMap: true,
        </scope>
        <scope name={'checks'} prel={-10}>
          const promptString = Priompt.promptToString_VULNERABLE_TO_PROMPT_INJECTION(rendered.prompt, getTokenizerByName("cl100k_base"))
          const sourceMap = rendered.sourceMap
        </scope>
        <scope name={'expects'}>
          expect(sourceMap).toBeDefined()
          expect(sourceMap?.start).toBe(0)
          <scope name={'lets put the mesage lines here again'}>
            {props.message.split('\n').map((line, i) => (
              <scope name={`line ${i}`}>{line}</scope>
            ))}
          </scope>

          expect(sourceMap?.end).toBe(promp<scope name='suspicious inline scope'>tString.length)</scope>
          expect(
            <scope name={'validate'} prel={-5}>
              validateSourceMap(
                <scope name={'absolutify'} prel={-4}>
                  absolutifySourceMap(sourceMap!, 0)
                </scope>,
                <scope name={'promptString'} prel={-3}>
                  promptString
                </scope>
              )
            </scope>
          ).toBe(true)
        </scope>
        </UserMessage>
      </>
    )
  }

  it("should generate simple sourcemap correctly", async () => {
    const rendered = await render(TestPromptTrivial({ message: "System message for sourcemap test." }), {
      tokenLimit: 1000,
      tokenizer: getTokenizerByName("cl100k_base"),
      shouldBuildSourceMap: true,
    });
    expect(rendered.sourceMap).toBeDefined();
    const promptString = Priompt.promptToString_VULNERABLE_TO_PROMPT_INJECTION(rendered.prompt, getTokenizerByName("cl100k_base"))
    expect(rendered.sourceMap?.start).toBe(0)
    expect(rendered.sourceMap?.end).toBe(promptString.length)
    expect(validateSourceMap(absolutifySourceMap(rendered.sourceMap!, 0), promptString)).toBe(true)
  });
  it("should work with emoji and japanese", async () => {
    const rendered = await render(TestPromptEmojiAndJapanese(), {
      tokenLimit: 1000,
      tokenizer: getTokenizerByName("cl100k_base"),
      shouldBuildSourceMap: true,
    });
    expect(rendered.sourceMap).toBeDefined();
    const promptString = Priompt.promptToString_VULNERABLE_TO_PROMPT_INJECTION(rendered.prompt, getTokenizerByName("cl100k_base"))
    expect(rendered.sourceMap?.start).toBe(0)
    expect(rendered.sourceMap?.end).toBe(promptString.length)
    expect(validateSourceMap(absolutifySourceMap(rendered.sourceMap!, 0), promptString)).toBe(true)
  })
  it("should generate sourcemap correctly", async () => {
    const message = `one lever that we haven’t really touched is
    creating features that depend substantially
    on the user investing time
    in configuring them to work well
    eg if a user could spend a day configuring an agent
    that would consistently make them 50% more productive, it’d be worth it
    or a big company spending a month to
    structure their codebase in such a way that many more things than before can be ai automated.
    The polish we’re missing on cmd+k is making it rly fast and snappy for the 1-2 line use case
    but it should be able to handle 100s of lines of code in a reasonable timeframe
    `
    const rendered = await render(TestSourceMapMoreComplex({ message }), {
      tokenLimit: 300,
      tokenizer: getTokenizerByName("cl100k_base"),
      shouldBuildSourceMap: true,
    });
    const promptString = Priompt.promptToString_VULNERABLE_TO_PROMPT_INJECTION(rendered.prompt, getTokenizerByName("cl100k_base"))
    const sourceMap = rendered.sourceMap
    expect(sourceMap).toBeDefined()
    expect(sourceMap?.start).toBe(0)
    expect(sourceMap?.end).toBe(promptString.length)
    expect(validateSourceMap(absolutifySourceMap(sourceMap!, 0), promptString)).toBe(true)
  });
});
