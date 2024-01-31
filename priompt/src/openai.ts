import {
	ChatCompletionResponseMessage,
	CreateChatCompletionResponseChoicesInner,
	CreateChatCompletionResponse,
	ChatCompletionRequestMessageRoleEnum,
	ChatCompletionRequestMessageFunctionCall,
	ChatCompletionFunctions,
	CreateChatCompletionRequestFunctionCall,
	CreateChatCompletionRequestStop
} from 'openai';

export {
	CreateChatCompletionResponse,
	ChatCompletionResponseMessage,
	ChatCompletionFunctions,
	// Setup
	OpenAIApi,
	Configuration,
	// Embeddings
	CreateEmbeddingRequest,
	CreateEmbeddingResponse,
	CreateEmbeddingResponseDataInner,
	// Completions
	CreateCompletionRequest,
	CreateCompletionResponse,
	CreateCompletionRequestPrompt,
	ChatCompletionRequestMessageRoleEnum,
	// Function
	CreateChatCompletionRequestFunctionCall,
	ChatCompletionRequestMessageFunctionCall,
} from 'openai';


export const GPT_3_5_TURBO = 'gpt-3.5-turbo';
export const GPT_3_5_TURBO_NIGHTLY_0613 = 'gpt-3.5-turbo-0613';
export const GPT_3_5_TURBO_16K = 'gpt-3.5-turbo-16k';
export const GPT_3_5_TURBO_DOTHISFORME = 'gpt-ft-cursor-0810';
export const GPT_3_5_TURBO_INSTRUCT = 'gpt-3.5-turbo-instruct';
export const GPT_3_5_CPP_DEDCAP = 'gpt-3-5-turbo-cursor-ft';
export const GPT_3_5_DEDCAP_VIRTUAL = 'gpt-3-5-turbo-cursor-virtual';
export const GPT_3_5_CHARLES_DEDCAP = 'gpt-3-5-turbo-cursor-charles';
export const GPT_3_5_FINETUNE_CPP = 'ft:gpt-3.5-turbo-0613:anysphere::8ERu98np';
export const GPT_3_5_1106 = "gpt-3.5-turbo-1106";
export const GPT_3_5_FINETUNE_RERANKER = 'ft:gpt-3.5-turbo-0613:anysphere::8GgLaVNe'
export const CODE_LLAMA_RERANKER = 'codellama_7b_reranker';

export const AZURE_3_5_TURBO = 'azure-3.5-turbo';

export const GPT_4 = 'gpt-4';
export const GPT_4_VISION_PREVIEW = 'gpt-4-vision-preview';
export const GPT_4_COMPLETIONS = 'gpt-4-cursor-completions';
export const GPT_4_VINOD = 'gpt-4-cursor-vinod';
export const GPT_4_DEDCAP_FAST_VIRTUAL = 'gpt-4-cursor-fast-virtual';
export const GPT_4_DEDCAP_SLOW_VIRTUAL = 'gpt-4-cursor-slow-virtual'
export const GPT_4_NIGHTLY_0613 = 'gpt-4-0613';

export const GPT_4_32K = 'gpt-4-32k';
export const GPT_4_TURBO = 'gpt-4-1106-preview';
export const GPT_4_32K_NIGHTLY_0613 = 'gpt-4-32k-0613';

export const TEXT_EMBEDDING_ADA_002 = 'text-embedding-ada-002';
export const TEXT_EMBEDDING_ADA_DEDCAP = 'text-embedding-ada-002-cursor';
export const TEXT_DAVINCI_003 = 'text-davinci-003';

// tokenizers
export const CL100K_BASE = 'cl100k_base';
export const R50K_BASE = 'r50k_base';
export const P50K_BASE = 'p50k_base';
export const GPT2_TOKENIZER = 'gpt2';

export const usableModels = [
	GPT_3_5_TURBO,
	GPT_3_5_TURBO_NIGHTLY_0613,
	GPT_3_5_TURBO_INSTRUCT,
	GPT_3_5_TURBO_DOTHISFORME,
	GPT_4,
	GPT_4_VISION_PREVIEW,
	GPT_4_NIGHTLY_0613,
	GPT_3_5_TURBO_16K,
	GPT_4_TURBO,
	GPT_3_5_1106,
	GPT_4_32K,
	GPT_4_32K_NIGHTLY_0613,
	AZURE_3_5_TURBO,
	TEXT_EMBEDDING_ADA_002,
	TEXT_DAVINCI_003,
	GPT_3_5_FINETUNE_CPP,
	GPT_3_5_FINETUNE_RERANKER,
	CODE_LLAMA_RERANKER
] as const;

export const dedcapModels = [
	GPT_4_DEDCAP_FAST_VIRTUAL,
	GPT_4_DEDCAP_SLOW_VIRTUAL,
	GPT_3_5_CPP_DEDCAP,
	GPT_3_5_DEDCAP_VIRTUAL,
] as const;

export const usableLanguageModels = [
	GPT_3_5_TURBO,
	GPT_3_5_TURBO_NIGHTLY_0613,
	GPT_3_5_TURBO_16K,
	GPT_3_5_TURBO_DOTHISFORME,
	GPT_3_5_TURBO_INSTRUCT,
	GPT_4,
	GPT_4_VISION_PREVIEW,
	GPT_4_NIGHTLY_0613,
	GPT_4_TURBO,
	GPT_3_5_1106,
	GPT_4_32K,
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

export function isDedcapModel(model: UsableLanguageModel | DedcapModel): boolean {
	return model.includes('gpt-4-cursor');
}

// (arvid) why do these not correspond to reality?
// (aman) Because we want to make it cheaper lol
export const MODEL_CONTEXTS: {
	[key in UsableLanguageModel]: number;
} = {
	[GPT_3_5_TURBO]: 2_000,
	[GPT_3_5_FINETUNE_CPP]: 2_000,
	[GPT_3_5_TURBO_NIGHTLY_0613]: 2_000,
	[GPT_3_5_TURBO_16K]: 10_000,
	[GPT_3_5_TURBO_DOTHISFORME]: 4_000,
	[GPT_4_TURBO]: 128_000,
	[GPT_3_5_1106]: 16_000,
	[AZURE_3_5_TURBO]: 2_000,
	[GPT_3_5_TURBO_INSTRUCT]: 4_000,
	[GPT_3_5_FINETUNE_RERANKER]: 2_000,
	[GPT_4]: 4_000,
	[GPT_4_VISION_PREVIEW]: 4_000,
	[GPT_4_32K]: 32_000,
	[GPT_4_NIGHTLY_0613]: 4_000,
	[GPT_4_32K_NIGHTLY_0613]: 32_000,
	[CODE_LLAMA_RERANKER]: 4_000,
};

export const MAX_TOKENS: {
	[key in UsableLanguageModel]: number;
} = {
	[GPT_3_5_TURBO]: 4096,
	[GPT_3_5_FINETUNE_CPP]: 4096,
	[GPT_3_5_TURBO_NIGHTLY_0613]: 4096,
	[GPT_3_5_TURBO_16K]: 16_384,
	[GPT_3_5_TURBO_DOTHISFORME]: 4_000,
	[GPT_4_TURBO]: 128_000,
	[GPT_3_5_1106]: 16_000,
	[AZURE_3_5_TURBO]: 4096,
	[GPT_3_5_TURBO_INSTRUCT]: 4096,
	[GPT_4]: 8150,
	[GPT_4_VISION_PREVIEW]: 8150,
	[GPT_3_5_FINETUNE_RERANKER]: 2_048,
	[GPT_4_NIGHTLY_0613]: 8150,
	[GPT_4_32K]: 32000,
	[GPT_4_32K_NIGHTLY_0613]: 32000,
	[CODE_LLAMA_RERANKER]: 4_000,
};


// Specify the UsableModel type, which is one of usableModels
export type UsableModel = typeof usableModels[number];
export type UsableLanguageModel = typeof usableLanguageModels[number];
export type UsableTokenizer = typeof usableTokenizers[number];
export type DedcapModel = typeof dedcapModels[number];
export const dedcapFallbackMap: {
	[key in DedcapModel]: UsableLanguageModel;
} = {
	// So we arent paying an arm and a leg
	[GPT_4_DEDCAP_FAST_VIRTUAL]: GPT_4,
	[GPT_4_DEDCAP_SLOW_VIRTUAL]: GPT_4,
	[GPT_3_5_CPP_DEDCAP]: GPT_3_5_TURBO,
	[GPT_3_5_DEDCAP_VIRTUAL]: GPT_3_5_TURBO,
}

export const modelToDedcapMap = {
	[GPT_4]: GPT_4_DEDCAP_FAST_VIRTUAL,
	[GPT_3_5_TURBO]: GPT_3_5_DEDCAP_VIRTUAL
}

export const modelToDedcapSlowMap = {
	[GPT_4]: GPT_4_DEDCAP_SLOW_VIRTUAL,
	[GPT_3_5_TURBO]: GPT_3_5_DEDCAP_VIRTUAL
}

export const EMBEDDING_MODEL = 'text-embedding-ada-002';

export function isGpt4(model: UsableLanguageModel): boolean {
	return model.includes('gpt-4');
}

export function isGpt35(model: UsableLanguageModel): boolean {
	return model.includes('gpt-3.5') || model.includes('gpt-3_5') || model.includes('gpt-3-5');
}

const encoder = new TextEncoder();
export function approximateTokensUsingBytecount(text: string, tokenizer: UsableTokenizer): number {
	const byteLength = encoder.encode(text).length;
	switch (tokenizer) {
		case 'cl100k_base':
			return byteLength / 4;
		default:
			return byteLength / 3;
	}
}

// docs here: https://platform.openai.com/docs/guides/chat/introduction (out of date!)
// linear factor is <|im_start|>system<|im_sep|>  and <|im_end|>
export const CHATML_PROMPT_EXTRA_TOKEN_COUNT_LINEAR_FACTOR = 4;
// this is <|im_start|>assistant<|im_sep|>
export const CHATML_PROMPT_EXTRA_TOKEN_COUNT_CONSTANT = 3;

export type Content = {
	type: 'text';
	text: string;
} | {
	type: 'image';
	image_url: {
		url: string,
		detail?: 'low' | 'high' | 'auto'
		// Temporary addition by Aman needed for token calculation
		dimensions: {
			width: number;
			height: number;
		}
	},
}


export interface ChatCompletionRequestMessage {
	/**
	 * The role of the messages author. One of `system`, `user`, `assistant`, or `function`.
	 * @type {string}
	 * @memberof ChatCompletionRequestMessage
	 */
	'role': ChatCompletionRequestMessageRoleEnum;
	/**
	 * The contents of the message. `content` is required for all messages except assistant messages with function calls.
	 * @type {string}
	 * @memberof ChatCompletionRequestMessage
	 */
	'content'?: string | Content[];
	/**
	 * The name of the author of this message. `name` is required if role is `function`, and it should be the name of the function whose response is in the `content`. May contain a-z, A-Z, 0-9, and underscores, with a maximum length of 64 characters.
	 * @type {string}
	 * @memberof ChatCompletionRequestMessage
	 */
	'name'?: string;
	/**
	 *
	 * @type {ChatCompletionRequestMessageFunctionCall}
	 * @memberof ChatCompletionRequestMessage
	 */
	'function_call'?: ChatCompletionRequestMessageFunctionCall;
}

export interface CreateChatCompletionRequest {
	/**
	 * ID of the model to use. See the [model endpoint compatibility](/docs/models/model-endpoint-compatibility) table for details on which models work with the Chat API.
	 * @type {string}
	 * @memberof CreateChatCompletionRequest
	 */
	'model': string;
	/**
	 * A list of messages comprising the conversation so far. [Example Python code](https://github.com/openai/openai-cookbook/blob/main/examples/How_to_format_inputs_to_ChatGPT_models.ipynb).
	 * @type {Array<ChatCompletionRequestMessage>}
	 * @memberof CreateChatCompletionRequest
	 */
	'messages': Array<ChatCompletionRequestMessage>;
	/**
	 * A list of functions the model may generate JSON inputs for.
	 * @type {Array<ChatCompletionFunctions>}
	 * @memberof CreateChatCompletionRequest
	 */
	'functions'?: Array<ChatCompletionFunctions>;
	/**
	 *
	 * @type {CreateChatCompletionRequestFunctionCall}
	 * @memberof CreateChatCompletionRequest
	 */
	'function_call'?: CreateChatCompletionRequestFunctionCall;
	/**
	 * What sampling temperature to use, between 0 and 2. Higher values like 0.8 will make the output more random, while lower values like 0.2 will make it more focused and deterministic.  We generally recommend altering this or `top_p` but not both.
	 * @type {number}
	 * @memberof CreateChatCompletionRequest
	 */
	'temperature'?: number | null;
	/**
	 * An alternative to sampling with temperature, called nucleus sampling, where the model considers the results of the tokens with top_p probability mass. So 0.1 means only the tokens comprising the top 10% probability mass are considered.  We generally recommend altering this or `temperature` but not both.
	 * @type {number}
	 * @memberof CreateChatCompletionRequest
	 */
	'top_p'?: number | null;
	/**
	 * How many chat completion choices to generate for each input message.
	 * @type {number}
	 * @memberof CreateChatCompletionRequest
	 */
	'n'?: number | null;
	/**
	 * If set, partial message deltas will be sent, like in ChatGPT. Tokens will be sent as data-only [server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events#Event_stream_format) as they become available, with the stream terminated by a `data: [DONE]` message. [Example Python code](https://github.com/openai/openai-cookbook/blob/main/examples/How_to_stream_completions.ipynb).
	 * @type {boolean}
	 * @memberof CreateChatCompletionRequest
	 */
	'stream'?: boolean | null;
	/**
	 *
	 * @type {CreateChatCompletionRequestStop}
	 * @memberof CreateChatCompletionRequest
	 */
	'stop'?: CreateChatCompletionRequestStop;
	/**
	 * The maximum number of [tokens](/tokenizer) to generate in the chat completion.  The total length of input tokens and generated tokens is limited by the model\'s context length. [Example Python code](https://github.com/openai/openai-cookbook/blob/main/examples/How_to_count_tokens_with_tiktoken.ipynb) for counting tokens.
	 * @type {number}
	 * @memberof CreateChatCompletionRequest
	 */
	'max_tokens'?: number;
	/**
	 * Number between -2.0 and 2.0. Positive values penalize new tokens based on whether they appear in the text so far, increasing the model\'s likelihood to talk about new topics.  [See more information about frequency and presence penalties.](/docs/api-reference/parameter-details)
	 * @type {number}
	 * @memberof CreateChatCompletionRequest
	 */
	'presence_penalty'?: number | null;
	/**
	 * Number between -2.0 and 2.0. Positive values penalize new tokens based on their existing frequency in the text so far, decreasing the model\'s likelihood to repeat the same line verbatim.  [See more information about frequency and presence penalties.](/docs/api-reference/parameter-details)
	 * @type {number}
	 * @memberof CreateChatCompletionRequest
	 */
	'frequency_penalty'?: number | null;
	/**
	 * Modify the likelihood of specified tokens appearing in the completion.  Accepts a json object that maps tokens (specified by their token ID in the tokenizer) to an associated bias value from -100 to 100. Mathematically, the bias is added to the logits generated by the model prior to sampling. The exact effect will vary per model, but values between -1 and 1 should decrease or increase likelihood of selection; values like -100 or 100 should result in a ban or exclusive selection of the relevant token.
	 * @type {object}
	 * @memberof CreateChatCompletionRequest
	 */
	'logit_bias'?: object | null;
	/**
	 * A unique identifier representing your end-user, which can help OpenAI to monitor and detect abuse. [Learn more](/docs/guides/safety-best-practices/end-user-ids).
	 * @type {string}
	 * @memberof CreateChatCompletionRequest
	 */
	'user'?: string;
}

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
