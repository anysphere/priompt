import * as Priompt from "priompt";
import {
  PreviewConfig,
  PreviewManager,
  PromptElement,
  PromptProps,
  SystemMessage,
  UserMessage,
  Function,
} from "priompt";

const FunctionCallingPromptConfig: PreviewConfig<FunctionCallingPromptProps> = {
  id: "functionCallingPrompt",
  prompt: FunctionCallingPrompt,
};

export type FunctionCallingPromptProps = PromptProps<{
  message: string;
  includeFunctions: string[];
}>;

PreviewManager.register(FunctionCallingPromptConfig);

// array of 10000 integers
const arr = Array.from(Array(1000).keys());

export function FunctionCallingPrompt(
  props: FunctionCallingPromptProps,
  args?: { dump?: boolean }
): PromptElement {
  if (args?.dump === true) {
    PreviewManager.dump(FunctionCallingPromptConfig, props);
  }
  return (
    <>
      {props.includeFunctions.includes("insert_sql_row") && (
        <Function
          p={200}
          name={"insert_sql_row"}
          description={"Insert a row into the `feedback` database."}
          parameters={{
            type: "object",
            properties: {
              sentiment: {
                enum: ["positive", "negative", "neutral"],
              },
              summary: {
                type: "string",
                description:
                  "A 1-sentence summary of the core part of the feedback.",
              },
            },
            required: ["summary", "sentiment"],
          }}
        />
      )}
      <SystemMessage>
        You are a database manager, responsible for taking the user's message
        and inserting it into our database.
      </SystemMessage>
      <UserMessage>
        {props.message}
        {arr.map((i) => (
          <scope prel={-i}>{props.message}</scope>
        ))}
      </UserMessage>
    </>
  );
}
