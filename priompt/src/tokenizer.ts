// we use tiktoken-node instead of @dqbd/tiktoken because the latter one, while having more
// github stars and being more supported, is extremely slow
// the @dqbq/tiktoken runs tiktoken in wasm, and since we're in node there is no reason
// for us not to use napi bindings to run the native tiktoken
// it may be well worth forking tiktoken-node though, as it is not super well maintained
// and we probably want to compile our own tiktoken because i'm slightly worried about
// supply-chain attacks here
import tiktoken, { SyncTokenizer } from '@anysphere/tiktoken-node';
import { PromptContent } from './types';


const CL100K_BASE = 'cl100k_base';
const R50K_BASE = 'r50k_base';
const P50K_BASE = 'p50k_base';
const GPT2_TOKENIZER = 'gpt2';
const LLAMA3_TOKENIZER = 'llama3';
const O200K_BASE = 'o200k_base';


const usableTokenizers = [
	CL100K_BASE,
	'cl100k_base_special_tokens',
	R50K_BASE,
	P50K_BASE,
	GPT2_TOKENIZER,
	LLAMA3_TOKENIZER,
	O200K_BASE
] as const;

export type UsableTokenizer = typeof usableTokenizers[number];

const tokenizerObject = tiktoken.getTokenizer();
const syncTokenizer = new SyncTokenizer();

export type OpenAIMessageRole = 'system' | 'user' | 'assistant' | 'tool'

export type PriomptTokenizer = {
	name: string;
	encodeTokens: (text: string) => Promise<number[]>;
	numTokens: (text: string) => Promise<number>;
	estimateNumTokensFast_SYNCHRONOUS_BE_CAREFUL: (text: string) => number;
	estimateTokensUsingCharCount: (text: string) => [number, number];
	getHeaderStringForMessage: (message: { role: OpenAIMessageRole, name?: string, to?: string }) => string;
	getHeaderTokensForMessage: (message: { role: OpenAIMessageRole, name?: string, to?: string }) => Promise<number[]>;
	getEosTokenId: () => number;
	getEosToken: () => string;
	applyChatTemplate: (messages: { role: OpenAIMessageRole, name?: string, to?: string, content: string | string[] }[], options?: { doNotAddGenerationPrompt?: boolean }) => string;
	applyChatTemplateTokens: (messages: { role: OpenAIMessageRole, name?: string, to?: string, content: string | string[] }[], options?: { doNotAddGenerationPrompt?: boolean }) => Promise<number[]>;
	shouldAddEosTokenToEachMessage: boolean;
}

function contentArrayToStringContent(content: Array<string | PromptContent>): string[] {
	const newContent: string[] = []
	content.forEach(c => {
		if (typeof c === 'string') {
			newContent.push(c);
		} else if (c.type === 'text') {
			newContent.push(c.text);
		} else if (c.type === 'image_url') {
			// Do nothing with images
		}
	});
	return newContent;
}

function openaiChatMessagesToPrompt(messages: { role: OpenAIMessageRole, name?: string, to?: string, content: string | string[] }[], tokenizer: UsableTokenizer): string {
	if (tokenizer !== 'o200k_base' && tokenizer !== 'cl100k_base' && tokenizer !== 'cl100k_base_special_tokens') {
		throw new Error(`Invalid tokenizer: ${tokenizer}. Only o200k_base, cl100k_base, and cl100k_base_special_tokens tokenizers are supported.`);
	}

	const parts = messages.map((msg, i) => {
		const headerString = openaiGetHeaderStringForMessage(msg, tokenizer);
		let newContent: string;
		if (Array.isArray(msg.content)) {
			newContent = contentArrayToStringContent(msg.content).join('');
		} else {
			newContent = msg.content;
		}
		if (i !== 0) {
			// Openai always adds the eos token before every non-starting message
			const endTokenString = tokenizer === O200K_BASE ? O200K_END_TOKEN_STRING : CL100K_END_TOKEN_STRING;
			return endTokenString + headerString + newContent;
		} else {
			return headerString + newContent;
		}
	})
	return parts.join('');
}
async function openaiChatMessagesToTokens(messages: { role: OpenAIMessageRole, name?: string, to?: string, content: string | string[] }[], tokenizer: UsableTokenizer): Promise<number[]> {
	if (tokenizer !== 'o200k_base' && tokenizer !== 'cl100k_base' && tokenizer !== 'cl100k_base_special_tokens') {
		throw new Error(`Invalid tokenizer: ${tokenizer}. Only o200k_base, cl100k_base, and cl100k_base_special_tokens tokenizers are supported.`);
	}

	const parts = await Promise.all(messages.map(async (msg, i) => {
		const headerTokens = await openaiGetHeaderTokensForMessage(msg, tokenizer);
		let contentTokens: number[]
		if (Array.isArray(msg.content)) {
			const stringContentArray = contentArrayToStringContent(msg.content)
			contentTokens = (await Promise.all(stringContentArray.map(content => encodeTokens(content, { tokenizer: tokenizer })))).flat()
		} else {
			contentTokens = await encodeTokens(msg.content, { tokenizer: tokenizer });
		}
		if (i !== 0) {
			// Openai always adds the eos token before every non-starting message
			const eosTokenId = tokenizer === 'o200k_base' ? O200K_END_TOKEN : CL100K_END_TOKEN
			return [eosTokenId, ...headerTokens, ...contentTokens]
		} else {
			return [...headerTokens, ...contentTokens]
		}
	}))
	return parts.flat();
}

export const CL100K: PriomptTokenizer = {
	name: 'cl100k_base',
	encodeTokens: (text) => encodeTokens(text, { tokenizer: 'cl100k_base' }),
	numTokens: (text) => numTokens(text, { tokenizer: 'cl100k_base' }),
	estimateNumTokensFast_SYNCHRONOUS_BE_CAREFUL: (text) => estimateNumTokensFast_SYNCHRONOUS_BE_CAREFUL(text, { tokenizer: 'cl100k_base' }),
	estimateTokensUsingCharCount: (text) => estimateTokensUsingCharcount(text, 'cl100k_base'),
	getEosToken: () => CL100K_END_TOKEN_STRING,
	getEosTokenId: () => CL100K_END_TOKEN,
	getHeaderStringForMessage: (message) => openaiGetHeaderStringForMessage(message, 'cl100k_base'),
	getHeaderTokensForMessage: (message) => openaiGetHeaderTokensForMessage(message, 'cl100k_base'),
	applyChatTemplate: (messages) => openaiChatMessagesToPrompt(messages, 'cl100k_base'),
	applyChatTemplateTokens: async (messages) => openaiChatMessagesToTokens(messages, 'cl100k_base'),
	shouldAddEosTokenToEachMessage: true
}
export const CL100K_SPECIAL_TOKENS: PriomptTokenizer = {
	name: 'cl100k_base_special_tokens',
	encodeTokens: (text) => encodeTokens(text, { tokenizer: 'cl100k_base_special_tokens' }),
	numTokens: (text) => numTokens(text, { tokenizer: 'cl100k_base_special_tokens' }),
	estimateNumTokensFast_SYNCHRONOUS_BE_CAREFUL: (text) => estimateNumTokensFast_SYNCHRONOUS_BE_CAREFUL(text, { tokenizer: 'cl100k_base_special_tokens' }),
	estimateTokensUsingCharCount: (text) => estimateTokensUsingCharcount(text, 'cl100k_base_special_tokens'),
	getEosToken: () => CL100K_END_TOKEN_STRING,
	getEosTokenId: () => CL100K_END_TOKEN,
	getHeaderStringForMessage: (message) => openaiGetHeaderStringForMessage(message, 'cl100k_base_special_tokens'),
	getHeaderTokensForMessage: (message) => openaiGetHeaderTokensForMessage(message, 'cl100k_base_special_tokens'),
	applyChatTemplate: (messages) => openaiChatMessagesToPrompt(messages, 'cl100k_base_special_tokens'),
	applyChatTemplateTokens: async (messages) => openaiChatMessagesToTokens(messages, 'cl100k_base_special_tokens'),
	shouldAddEosTokenToEachMessage: true
}

export const O200K: PriomptTokenizer = {
	name: 'o200k_base',
	encodeTokens: (text) => encodeTokens(text, { tokenizer: 'o200k_base' }),
	numTokens: (text) => numTokens(text, { tokenizer: 'o200k_base' }),
	estimateNumTokensFast_SYNCHRONOUS_BE_CAREFUL: (text) => estimateNumTokensFast_SYNCHRONOUS_BE_CAREFUL(text, { tokenizer: 'o200k_base' }),
	estimateTokensUsingCharCount: (text) => estimateTokensUsingCharcount(text, 'o200k_base'),
	getEosToken: () => O200K_END_TOKEN_STRING,
	getEosTokenId: () => O200K_END_TOKEN,
	getHeaderStringForMessage: (message) => openaiGetHeaderStringForMessage(message, 'o200k_base'),
	getHeaderTokensForMessage: (message) => openaiGetHeaderTokensForMessage(message, 'o200k_base'),
	applyChatTemplate: (messages) => openaiChatMessagesToPrompt(messages, 'o200k_base'),
	applyChatTemplateTokens: async (messages) => openaiChatMessagesToTokens(messages, 'o200k_base'),
	shouldAddEosTokenToEachMessage: true
}

export const getTokenizerByName_ONLY_FOR_OPENAI_TOKENIZERS = (name: UsableTokenizer): PriomptTokenizer => {
	switch (name) {
		case 'cl100k_base':
			return CL100K;
		case 'cl100k_base_special_tokens':
			return CL100K_SPECIAL_TOKENS;
		case 'o200k_base':
			return O200K;
		default:
			throw new Error(`Unknown tokenizer ${name}`);
	}
}
export async function numTokens(text: string, opts: {
	tokenizer: UsableTokenizer;
}) {
	const tokenizerName = opts.tokenizer;

	switch (tokenizerName) {
		case 'cl100k_base':
			return await tokenizerObject.exactNumTokensNoSpecialTokens(text, tiktoken.SupportedEncoding.Cl100k);
		case 'cl100k_base_special_tokens':
			return await tokenizerObject.exactNumTokens(text, tiktoken.SupportedEncoding.Cl100k, tiktoken.SpecialTokenAction.Special, {});
		case 'o200k_base':
			return await tokenizerObject.exactNumTokensNoSpecialTokens(text, tiktoken.SupportedEncoding.O200k);
		default:
			throw new Error(`Unknown tokenizer ${tokenizerName}`);
	}
}

// if you tokenize a lot of tokens, this can block the event loop
// only use this in a data job or with very few tokens
export function estimateNumTokensFast_SYNCHRONOUS_BE_CAREFUL(text: string, opts: {
	tokenizer: UsableTokenizer;
}) {
	const tokenizerName = opts.tokenizer;

	switch (tokenizerName) {
		case 'cl100k_base':
		case 'cl100k_base_special_tokens':
			return syncTokenizer.approxNumTokens(text, tiktoken.SupportedEncoding.Cl100k);
		case 'o200k_base':
			return syncTokenizer.approxNumTokens(text, tiktoken.SupportedEncoding.O200k);
		default:
			throw new Error(`Unknown tokenizer ${tokenizerName}`);
	}
}


export async function encodeTokens(text: string, opts: {
	tokenizer: UsableTokenizer;
}): Promise<number[]> {
	const tokenizerName = opts.tokenizer;

	switch (tokenizerName) {
		case 'cl100k_base':
			return await tokenizerObject.encodeCl100KNoSpecialTokens(text);
		case 'cl100k_base_special_tokens':
			return await tokenizerObject.encode(text, tiktoken.SupportedEncoding.Cl100k, tiktoken.SpecialTokenAction.Special, {});
		case 'o200k_base':
			return await tokenizerObject.encode(text, tiktoken.SupportedEncoding.O200k, tiktoken.SpecialTokenAction.NormalText, {});
		default:
			throw new Error(`Unknown tokenizer ${tokenizerName}`);
	}
}

const encoder = new TextEncoder();
// returns a very conservative [lower, upper] bound on the number of tokens
export function estimateTokensUsingBytecount(text: string, tokenizer: UsableTokenizer): [number, number] {
	const byteLength = encoder.encode(text).length;
	switch (tokenizer) {
		case 'cl100k_base':
			return [byteLength / 10, byteLength / 2.5];
		case 'cl100k_base_special_tokens':
			return [byteLength / 10, byteLength / 2.5];
		case 'o200k_base':
			return [byteLength / 10, byteLength / 2.5];
		default:
			// conservative!
			return [byteLength / 10, byteLength / 2];
	}
}
export function estimateTokensUsingCharcount(text: string, tokenizer: UsableTokenizer): [number, number] {
	const length = text.length;
	switch (tokenizer) {
		case 'cl100k_base':
			return [length / 10, length / 1.5];
		case 'cl100k_base_special_tokens':
			return [length / 10, length / 1.5];
		case 'o200k_base':
			return [length / 10, length / 1.5];
		default:
			// conservative!
			return [length / 10, length];
	}
}

export function numTokensForImage(dimensions: { width: number; height: number; }, detail: 'low' | 'high' | 'auto'): number {
	if (detail === 'low') {
		return 85
	} else if (detail === 'high' || detail === 'auto') {
		// First, we rescale to fit within 2048 x 2048
		const largestRatio = Math.max(dimensions.width / 2048, dimensions.height / 2048);
		if (largestRatio > 1) {
			dimensions.width = Math.floor(dimensions.width / largestRatio);
			dimensions.height = Math.floor(dimensions.height / largestRatio);
		}

		// Next, we scale the shortest side to be 768 px
		const smallestRatio = Math.min(dimensions.width / 768, dimensions.height / 768);

		dimensions.width = Math.floor(dimensions.width / smallestRatio);
		dimensions.height = Math.floor(dimensions.height / smallestRatio);

		// Finally, we calculate the number of 512 x 512 blocks needed to cover the image
		// and pay 85 tokens per block
		const numWidthBlocks = Math.ceil(dimensions.width / 512);
		const numHeightBlocks = Math.ceil(dimensions.height / 512);
		return numWidthBlocks * numHeightBlocks * 85;
	} else {
		throw new Error(`Unknown detail level ${detail}`);
	}
}

const CL100K_SYSTEM_TOKENS = [100264, 9125, 100266];
const CL100K_USER_TOKENS = [100264, 882, 100266];
const CL100K_TOOL_TOKENS = [100264, 14506, 100266];
const CL100K_ASSISTANT_TOKENS = [100264, 78191, 100266];
const CL100K_END_TOKEN = 100265;
const CL100K_SYSTEM_TOKENS_STRING = "<|im_start|>system<|im_sep|>";
const CL100K_USER_TOKENS_STRING = "<|im_start|>user<|im_sep|>";
const CL100K_ASSISTANT_TOKENS_STRING = "<|im_start|>assistant<|im_sep|>";
const CL100K_END_TOKEN_STRING = "<|im_end|>";

const O200K_SYSTEM_TOKENS = [200006, 17360, 200008];
const O200K_USER_TOKENS = [200006, 1428, 200008];
const O200K_TOOL_TOKENS = [200006, 17952, 200008];
const O200K_ASSISTANT_TOKENS = [200006, 173781, 200008];
const O200K_END_TOKEN = 200007;
const O200K_SYSTEM_TOKENS_STRING = "<|im_start|>system<|im_sep|>";
const O200K_USER_TOKENS_STRING = "<|im_start|>user<|im_sep|>";
const O200K_TOOL_TOKENS_STRING = "<|im_start|>tool<|im_sep|>";
const O200K_ASSISTANT_TOKENS_STRING = "<|im_start|>assistant<|im_sep|>";
const O200K_END_TOKEN_STRING = "<|im_end|>";

async function injectName(tokens: number[], name: string, tokenizer: UsableTokenizer): Promise<number[]> {
	// i don't really know if this is the right way to format it....
	const nameTokens = await encodeTokens(":" + name, { tokenizer: tokenizer })
	return [...tokens.slice(0, -1), ...nameTokens, tokens[tokens.length - 1]];
}
async function injectTo(tokens: number[], to: string, tokenizer: UsableTokenizer): Promise<number[]> {
	// Adjusting the function to handle 'to' parameter injection
	const toTokens = await encodeTokens(" to=" + to, { tokenizer: tokenizer });
	return [...tokens.slice(0, -1), ...toTokens, tokens[tokens.length - 1]];
}

function injectNameString(tokens: string, name: string): string {
	return tokens.replace("<|im_sep|>", ":" + name + "<|im_sep|>");
}

export const openaiGetHeaderTokensForMessage = async (message: { role: 'system' | 'user' | 'assistant' | 'tool', name?: string, to?: string }, tokenizer: UsableTokenizer): Promise<number[]> => {
	if (tokenizer !== 'o200k_base' && tokenizer !== 'cl100k_base' && tokenizer !== 'cl100k_base_special_tokens') {
		throw new Error(`Invalid tokenizer: ${tokenizer}. Only o200k_base, cl100k_base, and cl100k_base_special_tokens tokenizers are supported.`);
	}

	let headerTokens: number[]
	switch (message.role) {
		case 'system':
			headerTokens = tokenizer === 'o200k_base' ? O200K_SYSTEM_TOKENS : CL100K_SYSTEM_TOKENS
			break
		case 'user':
			headerTokens = tokenizer === 'o200k_base' ? O200K_USER_TOKENS : CL100K_USER_TOKENS
			break
		case 'assistant':
			headerTokens = tokenizer === 'o200k_base' ? O200K_ASSISTANT_TOKENS : CL100K_ASSISTANT_TOKENS
			break
		case 'tool':
			headerTokens = tokenizer === 'o200k_base' ? O200K_TOOL_TOKENS : CL100K_TOOL_TOKENS
			break
		default:
			throw new Error(`Unknown role ${message.role}`)
	}
	if ('name' in message && message.name !== undefined) {
		headerTokens = await injectName(headerTokens, message.name, tokenizer);
	}
	if ('to' in message && message.to !== undefined) {
		headerTokens = await injectTo(headerTokens, message.to, tokenizer);
	}
	return headerTokens
}

export const openaiGetHeaderStringForMessage = (message: { role: 'system' | 'user' | 'assistant' | 'tool', name?: string, to?: string }, tokenizer: UsableTokenizer): string => {
	if (tokenizer !== 'o200k_base' && tokenizer !== 'cl100k_base' && tokenizer !== 'cl100k_base_special_tokens') {
		throw new Error(`Invalid tokenizer: ${tokenizer}. Only o200k_base, cl100k_base, and cl100k_base_special_tokens tokenizers are supported.`);
	}

	let headerString = '';
	switch (message.role) {
		case 'system':
			headerString = tokenizer === 'o200k_base' ? O200K_SYSTEM_TOKENS_STRING : CL100K_SYSTEM_TOKENS_STRING;
			break
		case 'user':
			headerString = tokenizer === 'o200k_base' ? O200K_USER_TOKENS_STRING : CL100K_USER_TOKENS_STRING;
			break
		case 'assistant':
			headerString = tokenizer === 'o200k_base' ? O200K_ASSISTANT_TOKENS_STRING : CL100K_ASSISTANT_TOKENS_STRING;
			break
		case 'tool':
			headerString = tokenizer === 'o200k_base' ? O200K_TOOL_TOKENS_STRING : CL100K_USER_TOKENS_STRING;
			break
		default:
			throw new Error(`Unknown role ${message.role}`)
	}
	if ('name' in message && message.name !== undefined) {
		headerString = injectNameString(headerString, message.name);
	}
	return headerString
}
