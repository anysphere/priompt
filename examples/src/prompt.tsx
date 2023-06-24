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
PreviewManager.register(ExamplePromptConfig);

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
