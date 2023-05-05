export const GPT_3_5_TURBO = 'gpt-3.5-turbo';
export const GPT_4 = 'gpt-4';
export const GPT_4_32K = 'gpt-4-32k';
export const TEXT_EMBEDDING_ADA_002 = 'text-embedding-ada-002';
export const TEXT_DAVINCI_003 = 'text-davinci-003';
export const CL100K_BASE = 'cl100k_base';
export const R50K_BASE = 'r50k_base';
export const P50K_BASE = 'p50k_base';
export const GPT2_TOKENIZER = 'gpt2';

export const usableModels = [
	GPT_3_5_TURBO,
	GPT_4,
	GPT_4_32K,
	TEXT_EMBEDDING_ADA_002,
	TEXT_DAVINCI_003
] as const;

export const usableLanguageModels = [
	GPT_3_5_TURBO,
	GPT_4,
	GPT_4_32K,
] as const;

export const usableTokenizers = [
	CL100K_BASE,
	R50K_BASE,
	P50K_BASE,
	GPT2_TOKENIZER
] as const;

// (arvid) why do these not correspond to reality?
export const MODEL_CONTEXTS: {
	[key in UsableLanguageModel]: number;
} = {
	[GPT_3_5_TURBO]: 2_000,
	[GPT_4]: 4_000,
	[GPT_4_32K]: 32_000,
};

export const MAX_TOKENS: {
	[key in UsableLanguageModel]: number;
} = {
	[GPT_3_5_TURBO]: 4096,
	[GPT_4]: 8192,
	[GPT_4_32K]: 32_768,
};


// Specify the UsableModel type, which is one of usableModels
export type UsableModel = typeof usableModels[number];
export type UsableLanguageModel = typeof usableLanguageModels[number];
export type UsableTokenizer = typeof usableTokenizers[number];



// docs here: https://platform.openai.com/docs/guides/chat/introduction
export const CHATML_PROMPT_EXTRA_TOKEN_COUNT_LINEAR_FACTOR = 4;
export const CHATML_PROMPT_EXTRA_TOKEN_COUNT_CONSTANT = 2;