// we use tiktoken-node instead of @dqbd/tiktoken because the latter one, while having more
// github stars and being more supported, is extremely slow
// the @dqbq/tiktoken runs tiktoken in wasm, and since we're in node there is no reason
// for us not to use napi bindings to run the native tiktoken
// it may be well worth forking tiktoken-node though, as it is not super well maintained
// and we probably want to compile our own tiktoken because i'm slightly worried about
// supply-chain attacks here
import tiktoken, { getTokenizer } from '@anysphere/tiktoken-node';
import { UsableModel, UsableTokenizer } from './openai';

export function getTokenizerName(model: UsableModel): UsableTokenizer {
	switch (model) {
		case 'gpt-4':
		case 'gpt-4-0613':
		case 'gpt-4-32k':
		case 'gpt-4-32k-0613':
		case 'text-embedding-ada-002':
		case 'ft:gpt-3.5-turbo-0613:anysphere::8Dp3FfRl':
		case 'gpt-3.5-turbo':
		case 'gpt-3.5-turbo-0613':
		case 'gpt-3.5-turbo-16k':
		case 'codellama_7b_reranker': // pretty sure this is wrong
		case 'gpt-3.5-turbo-instruct':
		case 'azure-3.5-turbo':
		case 'gpt-ft-cursor-0810':
			return 'cl100k_base';
		case 'text-davinci-003':
			return 'p50k_base';
	}
}

export const tokenizerObject = tiktoken.getTokenizer();

export async function numTokens(text: string, opts: {
	model?: UsableModel;
	tokenizer?: UsableTokenizer;
}) {
	const tokenizerName = opts.tokenizer ?? (opts.model !== undefined ? getTokenizerName(opts.model) : 'cl100k_base');

	switch (tokenizerName) {
		case 'cl100k_base':
			return await tokenizerObject.exactNumTokensCl100KNoSpecialTokens(text);
		default:
			throw new Error(`Unknown tokenizer ${tokenizerName} ${opts.model}`);
	}
}

export async function encodeTokens(text: string, opts?: {
	model?: UsableModel;
	tokenizer?: UsableTokenizer;
}): Promise<number[]> {
	const tokenizerName = opts?.tokenizer ?? (opts?.model !== undefined ? getTokenizerName(opts?.model) : 'cl100k_base');

	switch (tokenizerName) {
		case 'cl100k_base':
			return await tokenizerObject.encodeCl100KNoSpecialTokens(text);
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
		default:
			// conservative!
			return [length / 10, length];
	}
}