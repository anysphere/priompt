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
  ZFunction,
} from "@anysphere/priompt";
import { z } from "zod";

const FunctionCallingPromptConfig: PreviewConfig<FunctionCallingPromptProps> = {
  id: "functionCallingPrompt",
  prompt: FunctionCallingPrompt,
};

export type FunctionCallingPromptProps = PromptProps<{
  message: string;
  includeFunctions: string[];
  causeConfusion: boolean;
}>;

PreviewManager.registerConfig(FunctionCallingPromptConfig);

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

// returns the new code
PreviewManager.register(SimpleFunction);
export function SimpleFunction(
  props: PromptProps<
    {
      code: string;
      error: string;
    },
    | {
        type: "newImport";
        newImport: string;
      }
    | {
        type: "newCode";
        newCode: string;
      }
  >
) {
  return (
    <>
      <ZFunction
        name={"add_import"}
        description="Add an import statement in the file. Include the entire line and it will be added to the top of the file."
        parameters={z.object({
          import: z
            .string()
            .describe("The entire line of the import statement to add."),
        })}
        onCall={async (args) => {
          return await props.onOutput({
            type: "newImport",
            newImport: args.import,
          });
        }}
      />
      <SystemMessage>
        You are a coding assistant. The user will give you a function that has
        linter errors. Your job is to fix the errors. You have two options:
        either, you can call the `add_import` function, which adds an import
        statement at the top of the file, or you can rewrite the entire
        function. If you rewrite the function, start your message with ```.
      </SystemMessage>
      <UserMessage>
        Function:
        <br />
        ```
        <br />
        {props.code}
        <br />
        ```
        <br />
        <br />
        Errors:
        <br />
        ```
        <br />
        {props.error}
        <br />
        ```
        <br />
      </UserMessage>
      <capture
        onOutput={async (msg) => {
          if (msg.content !== undefined) {
            return await props.onOutput({
              type: "newCode",
              newCode: msg.content,
            });
          }
        }}
      />
    </>
  );
}
