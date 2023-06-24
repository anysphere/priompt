import * as Priompt from "@anysphere/priompt";
import {
  PreviewConfig,
  PreviewManager,
  PromptElement,
  PromptProps,
  SystemMessage,
  UserMessage,
  Function,
  FunctionMessage,
  AssistantMessage,
} from "@anysphere/priompt";

const FunctionCallingPromptConfig: PreviewConfig<FunctionCallingPromptProps> = {
  id: "functionCallingPrompt",
  prompt: FunctionCallingPrompt,
};

export type FunctionCallingPromptProps = PromptProps<{
  message: string;
  includeFunctions: string[];
  causeConfusion: boolean;
}>;

PreviewManager.register(FunctionCallingPromptConfig);

// array of 10000 integers
const arr = Array.from(Array(800).keys());

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
      {props.includeFunctions.includes("update_sql_row") && (
        <Function
          p={200}
          name={"update_sql_row"}
          description={"Update a row in the `feedback` database."}
          parameters={{
            type: "object",
            properties: {
              id: {
                type: "number",
                description: "The ID of the row to update.",
              },
              sentiment: {
                enum: ["positive", "negative", "neutral"],
              },
              summary: {
                type: "string",
                description:
                  "A 1-sentence summary of the core part of the feedback.",
              },
            },
            required: ["id", "summary", "sentiment"],
          }}
        />
      )}
      <SystemMessage>
        You are a database manager, responsible for taking the user's message
        and inserting it into our database.
      </SystemMessage>
      {props.causeConfusion && (
        <>
          <UserMessage>i love the color theme</UserMessage>
          <AssistantMessage
            functionCall={{
              name: "insert_sql_row",
              arguments: JSON.stringify({
                sentiment: "negative",
                summary: "The user hates the color theme.",
              }),
            }}
          />
          <FunctionMessage name={"insert_sql_row"}>
            Inserted 1 row.
          </FunctionMessage>
        </>
      )}
      <UserMessage>
        {props.message}
        {/* {arr.map((i) => (
          <scope prel={-i}>{props.message}</scope>
        ))} */}
      </UserMessage>
      <empty tokens={1000} />
    </>
  );
}
