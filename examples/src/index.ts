import { promptToOpenAIChatMessages, promptToOpenAIChatRequest, render, renderun } from '@anysphere/priompt';
import { CL100K } from '@anysphere/priompt/dist/tokenizer';
import { handlePriomptPreview } from './priompt-preview-handlers';
import { ArvidStory, ExamplePrompt, SimplePrompt } from './prompt';
import fastifyCors from "@fastify/cors";
import Fastify, { FastifyError, FastifyLoggerOptions, FastifyReply, FastifyRequest, RawServerDefault, RouteGenericInterface } from "fastify";
import { OpenAI as OpenAIV4 } from 'openai-v4';
import { FunctionCallingPrompt, SimpleFunction } from './function-calling-prompt';
import { ChatCompletionResponseMessage, Configuration, CreateChatCompletionRequest, OpenAIApi } from 'openai';

const portString = process.env.SERVER_PORT;
if (portString === undefined || Number.isNaN(parseInt(portString))) {
	throw new Error("SERVER_PORT is undefined. Please run the ./init.sh script to create a .env file.");
}
const port = parseInt(portString);

const S = Fastify();

if (process.env.OPENAI_API_KEY === undefined || process.env.OPENAI_API_KEY === "" || process.env.OPENAI_API_KEY === "sk-your-openai-secret-key") {
	throw new Error("OPENAI_API_KEY is undefined. Please run the ./init.sh script to create a .env file, and then insert your API key in the .env file.");
}

const openaiV4 = new OpenAIV4({
	apiKey: process.env.OPENAI_API_KEY,
});
const configuration = new Configuration({
	apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

function messageAdapter(old: ChatCompletionResponseMessage[]): OpenAIV4.Chat.CompletionCreateParams.CreateChatCompletionRequestNonStreaming.Message[] {
	return old as OpenAIV4.Chat.CompletionCreateParams.CreateChatCompletionRequestNonStreaming.Message[];
}
function messageAdapterReverse(n: OpenAIV4.Chat.CompletionCreateParams.CreateChatCompletionRequestNonStreaming.Message): ChatCompletionResponseMessage {
	return n as ChatCompletionResponseMessage;
}
function requestAdapter(old: CreateChatCompletionRequest): OpenAIV4.Chat.CompletionCreateParams.CreateChatCompletionRequestNonStreaming {
	return old as OpenAIV4.Chat.CompletionCreateParams.CreateChatCompletionRequestNonStreaming;
}

async function main() {

	if (process.env.NODE_ENV === "development") {
		await handlePriomptPreview(S);
	}

	await S.register(fastifyCors, {
		origin: [
			`http://localhost:${process.env.PRIOMPT_PREVIEW_PORT}`
		],
	});

	// here we can add any other routes we want! this can be good for testing stuff
	S.get("/", (_, reply) => {
		return reply.type("text/plain").send(`Welcome to Priompt examples.`);
	});
	S.get("/message", async (request, reply) => {
		const query = request.query as { message: string; name: string; numTokens: string };
		const tokenLimit = parseInt(query.numTokens);

		const prompt = ExamplePrompt({
			message: query.message,
			name: query.name
		});

		const rendered = await render(prompt, {
			tokenizer: CL100K,
			tokenLimit: tokenLimit
		});

		return rendered;
	});
	S.get("/database", async (request, reply) => {
		const query = request.query as { message: string; confuse: string | undefined; };
		if (query.message === undefined) {
			return reply.status(400).send("Bad request; message is required.");
		}
		const message = query.message as string;
		const prompt = FunctionCallingPrompt({ message, includeFunctions: ["insert_sql_row", "update_sql_row"], causeConfusion: query.confuse === "true" }, { dump: process.env.NODE_ENV === "development" });
		const output = await render(prompt, {
			model: "gpt-3.5-turbo"
		});

		console.log(JSON.stringify(output.prompt, null, 2));

		const requestConfig: CreateChatCompletionRequest = {
			...promptToOpenAIChatRequest(output.prompt),
			model: "gpt-3.5-turbo-0613",
		};

		// make this print all nested values in node
		console.log(JSON.stringify(requestConfig, null, 2));

		try {
			const openaiResult = await openai.createChatCompletion(requestConfig);

			const openaiOutput = openaiResult.data.choices[0];

			return reply.type("text/json").send(JSON.stringify(openaiOutput));
		} catch (error) {
			console.error(error);
			return reply.status(500).send("Internal server error.");
		}
	});

	S.get("/simple", async (request, reply) => {
		const query = request.query as { language: string; };
		if (query.language === undefined) {
			return reply.status(400).send("Bad request; language is required.");
		}
		const language = query.language as string;
		const text = "Cursor är den bästa plattformen för att skriva kod.";
		try {
			const answer = await renderun({
				prompt: SimplePrompt,
				props: { text, language },
				renderOptions: {
					model: "gpt-3.5-turbo",
				},
				modelCall: async (x) => { return { type: "output", value: (await openai.createChatCompletion({ ...x, model: "gpt-3.5-turbo" })).data } }
			});
			return reply.type("text/plain").send(JSON.stringify({ answer }));
		} catch (error) {
			console.error(error);
			return reply.status(500).send("Internal server error.");
		}
	});

	S.get("/arvidstory", async (request, reply) => {
		try {
			const answer = await renderun({
				prompt: ArvidStory,
				props: {},
				renderOptions: {
					model: "gpt-3.5-turbo",
				},
				modelCall: async (x) => {
					const y = await openaiV4.chat.completions.create({ ...requestAdapter({ ...x, model: "gpt-3.5-turbo" }), stream: true });
					return {
						type: "stream",
						value: (async function* () {
							for await (const message of y) {
								// eslint-disable-next-line @typescript-eslint/no-explicit-any
								yield messageAdapterReverse(message.choices[0].delta as any);
							}
						})()
					}
				}
			});
			let s = "";
			for await (const part of answer) {
				s += part;
				console.log(part);
			}
			return reply.type("text/plain").send(JSON.stringify({ answer: s }));
		} catch (error) {
			console.error(error);
			return reply.status(500).send("Internal server error.");
		}
	});

	S.get("/fixcode", async (request, reply) => {
		const query = request.query as { type: string; };
		let code, error: string;
		if (query.type === undefined || query.type !== 'code') {
			code = "function x() {\n\treturn z.object({\n\t\ta: z.string(),\n\t\tb: z.number(),\n\t});\n}";
			error = "'z' is not defined";
		} else {
			code = "function x() {\n\treturn z.object({\n\t\ta: z.string(),\n\t\tb: z.umber(),\n\t});\n}";
			error = "'umber' is not defined";
		}
		try {
			const action = await renderun({
				prompt: SimpleFunction,
				props: { code, error },
				renderOptions: {
					model: "gpt-4",
				},
				modelCall: async (x) => { return { type: 'output', value: (await openai.createChatCompletion({ ...x, model: "gpt-4" })).data } }
			});
			return reply.type("text/plain").send(JSON.stringify(action));
		} catch (error) {
			console.error(error);
			return reply.status(500).send("Internal server error.");
		}
	});

	await S.listen({ host: "0.0.0.0", port });

	console.log(`Server listening on port ${port}.`);
}

void main();