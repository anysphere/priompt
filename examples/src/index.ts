import { promptToOpenAIChatMessages, promptToOpenAIChatRequest, render } from 'priompt';
import { handlePriomptPreview } from './priompt-preview-handlers';
import { ExamplePrompt } from './prompt';
import fastifyCors from "@fastify/cors";
import Fastify, { FastifyError, FastifyLoggerOptions, FastifyReply, FastifyRequest, RawServerDefault, RouteGenericInterface } from "fastify";
import { Configuration, CreateChatCompletionRequest, OpenAIApi } from 'openai';
import { FunctionCallingPrompt } from './function-calling-prompt';

const portString = process.env.SERVER_PORT;
if (portString === undefined || Number.isNaN(parseInt(portString))) {
	throw new Error("SERVER_PORT is undefined. Please run the ./init.sh script to create a .env file.");
}
const port = parseInt(portString);

const S = Fastify();

if (process.env.OPENAI_API_KEY === undefined || process.env.OPENAI_API_KEY === "" || process.env.OPENAI_API_KEY === "sk-your-openai-secret-key") {
	throw new Error("OPENAI_API_KEY is undefined. Please run the ./init.sh script to create a .env file, and then insert your API key in the .env file.");
}

const configuration = new Configuration({
	apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);


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
		const query = request.query as { message: string; name: string };
		if (query.message === undefined || query.name === undefined) {
			return reply.status(400).send("Bad request; message and name are required.");
		}
		const message = query.message as string;
		const name = query.name as string;
		const prompt = ExamplePrompt({ message, name }, { dump: process.env.NODE_ENV === "development" });
		const output = render(prompt, {
			model: "gpt-3.5-turbo"
		});

		const requestConfig: CreateChatCompletionRequest = {
			model: "gpt-3.5-turbo",
			messages: promptToOpenAIChatMessages(output.prompt),
		};

		try {
			const openaiResult = await openai.createChatCompletion(requestConfig);

			const openaiOutput = openaiResult.data.choices[0].message;

			return reply.type("text/plain").send(openaiOutput?.content);
		} catch (error) {
			console.error(error);
			return reply.status(500).send("Internal server error.");
		}
	});
	S.get("/database", async (request, reply) => {
		const query = request.query as { message: string; confuse: string | undefined; };
		if (query.message === undefined) {
			return reply.status(400).send("Bad request; message is required.");
		}
		const message = query.message as string;
		const prompt = FunctionCallingPrompt({ message, includeFunctions: ["insert_sql_row", "update_sql_row"], causeConfusion: query.confuse === "true" }, { dump: process.env.NODE_ENV === "development" });
		const output = render(prompt, {
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

	await S.listen({ host: "0.0.0.0", port });

	console.log(`Server listening on port ${port}.`);
}

void main();