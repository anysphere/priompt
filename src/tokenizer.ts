// we use tiktoken-node instead of @dqbd/tiktoken because the latter one, while having more
// github stars and being more supported, is extremely slow
// the @dqbq/tiktoken runs tiktoken in wasm, and since we're in node there is no reason
// for us not to use napi bindings to run the native tiktoken
// it may be well worth forking tiktoken-node though, as it is not super well maintained
// and we probably want to compile our own tiktoken because i'm slightly worried about
// supply-chain attacks here
import tiktoken from 'tiktoken-node';
import { UsableModel, UsableTokenizer } from './openai';

export const CLK_TOKENIZER = tiktoken.getEncoding('cl100k_base');
export const P50_TOKENIZER = tiktoken.getEncoding('p50k_base');
export const GPT2_TOKENIZER = tiktoken.getEncoding('gpt2');

export function getTokenizer(model: UsableModel): tiktoken.Encoding {
	return getTokenizerFromName(getTokenizerName(model));
}

export function getTokenizerName(model: UsableModel): UsableTokenizer {
	switch (model) {
		case 'gpt-4':
		case 'gpt-4-32k':
		case 'text-embedding-ada-002':
		case 'gpt-3.5-turbo':
			return 'cl100k_base';
		case 'text-davinci-003':
			return 'p50k_base';
	}
}

export function getTokenizerFromName(tokenizer: UsableTokenizer): tiktoken.Encoding {
	switch (tokenizer) {
		case 'gpt2':
			return GPT2_TOKENIZER;
		case 'p50k_base':
			return P50_TOKENIZER;
		case 'cl100k_base':
			return CLK_TOKENIZER;
		case 'r50k_base':
			throw new Error('r50k_base not supported');
	}
}

CLK_TOKENIZER.encode('test')

export function numTokens(text: string, model?: UsableModel) {
	const tokenizer = model ? getTokenizer(model) : CLK_TOKENIZER;
	return tokenizer.encode(text).length;
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