import {
	OpenAIApi, Configuration, CreateChatCompletionRequest, ChatCompletionResponseMessage,
	CreateChatCompletionResponseChoicesInner,
	CreateChatCompletionResponse
} from 'openai';

export const GPT_3_5_TURBO = 'gpt-3.5-turbo';
export const GPT_3_5_TURBO_NIGHTLY_0613 = 'gpt-3.5-turbo-0613';
export const GPT_3_5_TURBO_16K = 'gpt-3.5-turbo-16k';
export const GPT3_3_5_TURBO_DOTHISFORME = 'gpt-ft-cursor-0810';
export const GPT_3_5_TURBO_INSTRUCT = 'gpt-3.5-turbo-instruct';
export const GPT_4 = 'gpt-4';
export const GPT_4_NIGHTLY_0613 = 'gpt-4-0613';
export const GPT_4_TURBO = 'gpt-4-1106-preview';
export const GPT_3_5_1106 = 'gpt-3.5-turbo-1106';
export const GPT_4_32K = 'gpt-4-32k';
export const GPT_4_32K_NIGHTLY_0613 = 'gpt-4-32k-0613';
export const AZURE_3_5_TURBO = 'azure-3.5-turbo';
export const TEXT_EMBEDDING_ADA_002 = 'text-embedding-ada-002';
export const TEXT_DAVINCI_003 = 'text-davinci-003';
export const CL100K_BASE = 'cl100k_base';
export const R50K_BASE = 'r50k_base';
export const P50K_BASE = 'p50k_base';
export const GPT2_TOKENIZER = 'gpt2';
export const GPT_3_5_FINETUNE_CPP = 'ft:gpt-3.5-turbo-0613:anysphere::8ERu98np';
export const GPT_3_5_FINETUNE_RERANKER = 'ft:gpt-3.5-turbo-0613:anysphere::8GgLaVNe'
export const CODE_LLAMA_RERANKER = 'codellama_7b_reranker';

export const usableModels = [
	GPT_3_5_TURBO,
	GPT_3_5_TURBO_NIGHTLY_0613,
	GPT_3_5_TURBO_INSTRUCT,
	GPT3_3_5_TURBO_DOTHISFORME,
	GPT_4,
	GPT_4_NIGHTLY_0613,
	GPT_3_5_TURBO_16K,
	GPT_4_32K,
	GPT_4_TURBO,
	GPT_3_5_1106,
	GPT_4_32K_NIGHTLY_0613,
	AZURE_3_5_TURBO,
	TEXT_EMBEDDING_ADA_002,
	TEXT_DAVINCI_003,
	GPT_3_5_FINETUNE_CPP,
	GPT_3_5_FINETUNE_RERANKER,
	CODE_LLAMA_RERANKER
] as const;

export const usableLanguageModels = [
	GPT_3_5_TURBO,
	GPT_3_5_TURBO_NIGHTLY_0613,
	GPT_3_5_TURBO_16K,
	GPT_3_5_TURBO_INSTRUCT,
	GPT3_3_5_TURBO_DOTHISFORME,
	GPT_4,
	GPT_4_NIGHTLY_0613,
	GPT_4_32K,
	GPT_4_TURBO,
	GPT_3_5_1106,
	GPT_4_32K_NIGHTLY_0613,
	AZURE_3_5_TURBO,
	GPT_3_5_FINETUNE_CPP,
	GPT_3_5_FINETUNE_RERANKER,
	CODE_LLAMA_RERANKER
] as const;

export function isUsableLanguageModel(s: string): s is UsableLanguageModel {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return usableLanguageModels.includes(s as any);
}

export const usableTokenizers = [
	CL100K_BASE,
	R50K_BASE,
	P50K_BASE,
	GPT2_TOKENIZER
] as const;

// (arvid) why do these not correspond to reality?
// (aman) Because we want to make it cheaper lol
export const MODEL_CONTEXTS: {
	[key in UsableLanguageModel]: number;
} = {
	[GPT_3_5_TURBO]: 2_000,
	[GPT_3_5_FINETUNE_CPP]: 2_000,
	[GPT_3_5_FINETUNE_RERANKER]: 2_000,
	[GPT_3_5_TURBO_NIGHTLY_0613]: 2_000,
	[GPT_3_5_TURBO_16K]: 10_000,
	[GPT_3_5_1106]: 16_000,
	[GPT3_3_5_TURBO_DOTHISFORME]: 4_000,
	[AZURE_3_5_TURBO]: 2_000,
	[GPT_3_5_TURBO_INSTRUCT]: 4_000,
	[GPT_4]: 4_000,
	[GPT_4_32K]: 32_000,
	[GPT_4_TURBO]: 128_000,
	[GPT_4_NIGHTLY_0613]: 4_000,
	[GPT_4_32K_NIGHTLY_0613]: 32_000,
	[CODE_LLAMA_RERANKER]: 4_000,
};

export const MAX_TOKENS: {
	[key in UsableLanguageModel]: number;
} = {
	[GPT_3_5_TURBO]: 4096,
	[GPT_3_5_FINETUNE_CPP]: 4096,
	[GPT_3_5_FINETUNE_RERANKER]: 2000,
	[GPT_3_5_TURBO_NIGHTLY_0613]: 4096,
	[GPT_3_5_TURBO_16K]: 16_384,
	[GPT_3_5_TURBO_INSTRUCT]: 4096,
	[GPT_3_5_1106]: 16_000,
	[GPT3_3_5_TURBO_DOTHISFORME]: 4_000,
	[AZURE_3_5_TURBO]: 4096,
	[GPT_4]: 8000,
	[GPT_4_NIGHTLY_0613]: 8000,
	[GPT_4_32K]: 32000,
	[GPT_4_TURBO]: 128_000,
	[GPT_4_32K_NIGHTLY_0613]: 32000,
	[CODE_LLAMA_RERANKER]: 4_000,
};


// Specify the UsableModel type, which is one of usableModels
export type UsableModel = typeof usableModels[number];
export type UsableLanguageModel = typeof usableLanguageModels[number];
export type UsableTokenizer = typeof usableTokenizers[number];

export const EMBEDDING_MODEL = 'text-embedding-ada-002';

// docs here: https://platform.openai.com/docs/guides/chat/introduction (out of date!)
// linear factor is <|im_start|>system<|im_sep|>  and <|im_end|>
export const CHATML_PROMPT_EXTRA_TOKEN_COUNT_LINEAR_FACTOR = 4;
// this is <|im_start|>assistant<|im_sep|>
export const CHATML_PROMPT_EXTRA_TOKEN_COUNT_CONSTANT = 3;

export interface StreamChatCompletionResponse extends CreateChatCompletionResponse {
	/**
	 *
	 * @type {Array<StreamChatCompletionResponseChoicesInner>}
	 * @memberof StreamChatCompletionResponse
	 */
	'choices': Array<StreamChatCompletionResponseChoicesInner>;
}

interface StreamChatCompletionResponseChoicesInner extends CreateChatCompletionResponseChoicesInner {
	delta?: ChatCompletionResponseMessage;
}
