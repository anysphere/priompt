import * as Priompt from "@anysphere/priompt";
import {
  PreviewConfig,
  PreviewManager,
  PromptElement,
  PromptProps,
  SystemMessage,
  UserMessage,
} from "@anysphere/priompt";

const ExamplePromptConfig: PreviewConfig<ExamplePromptProps> = {
  id: "examplePrompt",
  prompt: ExamplePrompt,
};
PreviewManager.registerConfig(ExamplePromptConfig);

export type ExamplePromptProps = PromptProps<{
  name: string;
  message: string;
}>;

export function ExamplePrompt(
  props: ExamplePromptProps,
  args?: { dump?: boolean }
): PromptElement {
  if (args?.dump === true) {
    PreviewManager.dump(ExamplePromptConfig, props);
  }
  return (
    <>
      <SystemMessage>
        The user's name is {props.name}. Please always greet them in an
        extremely formal, medieval style, with lots of fanfare. Then seamlessly
        proceed to reply to their message in the most casual, 2010s, cool dude
        texting style. Please be over-the-top in both respects, and make the
        transition seem like it never happened.
      </SystemMessage>
      <UserMessage>{props.message}</UserMessage>
      <empty tokens={1000} />
    </>
  );
}

PreviewManager.register(SimplePrompt);
export function SimplePrompt(
  props: PromptProps<
    {
      language: string;
      text: string;
    },
    boolean
  >
): PromptElement {
  return (
    <>
      <SystemMessage>
        Please determine if the following text is in {props.language}. If it is,
        please reply with "yes". If it is not, please reply with "no". Do not
        output anything else.
      </SystemMessage>
      <UserMessage>{props.text}</UserMessage>
      <empty tokens={1000} />
      <capture
        onOutput={async (output) => {
          if (output.content?.toLowerCase().includes("yes") === true) {
            return await props.onOutput(true);
          } else if (output.content?.toLowerCase().includes("no") === true) {
            return await props.onOutput(false);
          }
          // bad
          throw new Error(`Invalid output: ${output.content}`);
        }}
      />
    </>
  );
}
