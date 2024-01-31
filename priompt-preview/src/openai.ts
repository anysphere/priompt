import { ChatCompletionRequestMessage, CreateChatCompletionRequest, CreateCompletionRequest, CreateCompletionResponse, StreamChatCompletionResponse } from './openai_interfaces';
import { encodingForModel } from "js-tiktoken";


const API_KEY = 'PRIOMPT_PREVIEW_OPENAI_KEY';

export async function* streamChat(createChatCompletionRequest: CreateChatCompletionRequest, options?: RequestInit, abortSignal?: AbortSignal): AsyncGenerator<StreamChatCompletionResponse> {
	let streamer: AsyncGenerator<StreamChatCompletionResponse> | undefined = undefined;

	const newAbortSignal = new AbortController();
	abortSignal?.addEventListener('abort', () => {
		newAbortSignal.abort();
	});

	let timeout = setTimeout(() => {
		console.error("OpenAI request timed out after 40 seconds..... Not good.")
		// Next, we abort the signal
		newAbortSignal.abort();
	}, 40_000);

	try {
		const requestOptions: RequestInit = {
			...options,
			method: 'POST',
			headers: {
				...options?.headers,
				'Authorization': `Bearer ${API_KEY}`,
				'Content-Type': 'application/json',
			},
			signal: newAbortSignal.signal,
			body: JSON.stringify({
				...createChatCompletionRequest,
				stream: true
			}),
		};

		const response = await fetch('https://api.openai.com/v1/chat/completions', requestOptions);
		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}. message: ${await response.text()}`);
		}
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		streamer = streamSource<StreamChatCompletionResponse>(response.body!);
		for await (const data of streamer) {
			clearTimeout(timeout);

			timeout = setTimeout(() => {
				console.error("OpenAI request timed out after 10 seconds..... Not good.")
				newAbortSignal.abort();
			}, 10_000);

			yield data;

			clearTimeout(timeout);
		}
	} finally {
		clearTimeout(timeout);
		if (streamer !== undefined) {
			await streamer.return(undefined);
		}
		newAbortSignal.abort();
	}
}

const TOKEN_LIMIT: Record<string, number> = {
	"gpt-3.5-turbo": 4096,
	"azure-3.5-turbo": 4096,
	"gpt-4": 8192,
	"gpt-4-cursor-completions": 8192,
	"gpt-4-0314": 8192,
	"gpt-4-32k": 32000,
	"gpt-4-1106-preview": 128000,
	"gpt-3.5-turbo-1106": 16000,
	"text-davinci-003": 4096,
	"code-davinci-002": 4096,
};
const enc = encodingForModel("gpt-4");
const enc_old = encodingForModel("text-davinci-003");


export async function* streamChatCompletion(createChatCompletionRequest: CreateChatCompletionRequest, options?: RequestInit, abortSignal?: AbortSignal): AsyncGenerator<StreamChatCompletionResponse> {
	const prompt = joinMessages(createChatCompletionRequest.messages, true);
	let tokens = enc.encode(prompt).length;
	if (createChatCompletionRequest.model.includes('00')) {
		tokens = enc_old.encode(prompt).length;
	}
	const createCompletionRequest = {
		max_tokens: (TOKEN_LIMIT[createChatCompletionRequest.model] ?? 4096) - tokens,
		...createChatCompletionRequest,
		messages: undefined,
		prompt,
		stop: ['<|im_end|>', '<|diff_marker|>']
	} as CreateCompletionRequest;

	let streamer: AsyncGenerator<CreateCompletionResponse> | undefined = undefined;

	const newAbortSignal = new AbortController();
	abortSignal?.addEventListener('abort', () => {
		newAbortSignal.abort();
	});

	let timeout = setTimeout(() => {
		console.error("OpenAI request timed out after 40 seconds..... Not good.")
		newAbortSignal.abort();
	}, 40_000);

	try {
		const requestOptions: RequestInit = {
			...options,
			method: 'POST',
			headers: {
				...options?.headers,
				'Authorization': `Bearer ${API_KEY}`,
				'Content-Type': 'application/json',
			},
			signal: newAbortSignal.signal,
			body: JSON.stringify({
				...createCompletionRequest,
				stream: true
			}),
		};

		const response = await fetch('https://api.openai.com/v1/completions', requestOptions);
		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}. message: ${await response.text()}`);
		}
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		streamer = streamSource<CreateCompletionResponse>(response.body!);
		for await (const data of streamer) {
			clearTimeout(timeout);

			timeout = setTimeout(() => {
				console.error("OpenAI request timed out after 10 seconds..... Not good.")
				newAbortSignal.abort();
			}, 10_000);

			yield {
				...data,
				choices: data.choices.map((choice) => {
					return {
						delta: {
							role: 'assistant',
							content: choice.text?.replace(prompt, ''),
						}
					}
				})
			}

			clearTimeout(timeout);
		}
	} finally {
		clearTimeout(timeout);
		if (streamer !== undefined) {
			await streamer.return(undefined);
		}
		newAbortSignal.abort();
	}
}


async function* streamSource<T>(stream: ReadableStream): AsyncGenerator<T> {
	// Buffer exists for overflow when event stream doesn't end on a newline
	let buffer = '';

	// Create a reader to read the response body as a stream
	const reader = stream.getReader();

	// Loop until the stream is done
	while (true) {
		const { done, value } = await reader.read();
		if (done) {
			break;
		}

		buffer += new TextDecoder().decode(value);
		const lines = buffer.split('\n');
		for (const line of lines.slice(0, -1)) {
			if (line.startsWith('data: ')) {
				const jsonString = line.slice(6);
				if (jsonString === '[DONE]') {
					return;
				}
				try {
					const ans = JSON.parse(jsonString) as T;
					yield ans;
				} catch (e) {
					console.log(jsonString);
					throw e;
				}
			}
		}
		buffer = lines[lines.length - 1];
	}

	if (buffer.startsWith('data: ')) {
		const jsonString = buffer.slice(6);
		if (jsonString === '[DONE]') {
			return;
		}
		try {
			const ans = JSON.parse(jsonString) as T;
			yield ans;
		} catch (e) {
			console.log(jsonString);
			throw e;
		}
	}
}

export function joinMessages(messages: ChatCompletionRequestMessage[], lastIsIncomplete: boolean = false) {
	return messages.map((message, index) => {
		let ret = `<|im_start|>${message.role}<|im_sep|>${message.content}`;
		if (!lastIsIncomplete || index !== messages.length - 1) {
			ret += `<|im_end|>`;
		}
		return ret;
	}).join('');
}