// we use tiktoken-node instead of @dqbd/tiktoken because the latter one, while having more
// github stars and being more supported, is extremely slow
// the @dqbq/tiktoken runs tiktoken in wasm, and since we're in node there is no reason
// for us not to use napi bindings to run the native tiktoken
// it may be well worth forking tiktoken-node though, as it is not super well maintained
// and we probably want to compile our own tiktoken because i'm slightly worried about
// supply-chain attacks here
import tiktoken, { getTokenizer, SyncTokenizer } from '@anysphere/tiktoken-node';
import { UsableTokenizer } from './openai';


export const tokenizerObject = tiktoken.getTokenizer();
export const syncTokenizer = new SyncTokenizer();

export async function numTokens(text: string, opts: {
	tokenizer: UsableTokenizer;
}) {
	const tokenizerName = opts.tokenizer;

	switch (tokenizerName) {
		case 'cl100k_base':
			return await tokenizerObject.exactNumTokensCl100KNoSpecialTokens(text);
		case 'cl100k_base_special_tokens':
			return await tokenizerObject.exactNumTokens(text, tiktoken.SupportedEncoding.Cl100k, tiktoken.SpecialTokenAction.Special, {});
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
		default:
			// conservative!
			return [length / 10, length];
	}
}