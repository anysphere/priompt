import {
	ChatCompletionFunctions,
	ChatCompletionRequestMessageFunctionCall,
	ChatCompletionRequestMessageRoleEnum,
	ChatCompletionResponseMessage,
	CreateChatCompletionRequestFunctionCall,
	CreateChatCompletionRequestStop,
	CreateChatCompletionResponse,
	CreateChatCompletionResponseChoicesInner,
	CreateCompletionRequestPrompt,
	CreateCompletionRequestStop,
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
	CreateCompletionResponse,
	CreateCompletionRequestPrompt,
	ChatCompletionRequestMessageRoleEnum,
	// Function
	CreateChatCompletionRequestFunctionCall,
	ChatCompletionRequestMessageFunctionCall,
	// Misc
	CreateCompletionResponseChoicesInnerLogprobs
} from 'openai';

import { UsableTokenizer } from './tokenizer';

// tokenizers
const encoder = new TextEncoder();
export function approximateTokensUsingBytecount(text: string, tokenizer: UsableTokenizer): number {
	const byteLength = encoder.encode(text).length;
	switch (tokenizer) {
		case 'cl100k_base':
		case 'o200k_base':
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
	type: 'image_url';
	image_url: {
		url: string,
		detail?: 'low' | 'high' | 'auto'
		// Temporary addition by Aman needed for token calculation
		dimensions: {
			width: number;
			height: number;
		}
	}
}

export function hasImages(message: ChatCompletionRequestMessage) {
	return typeof message.content !== 'string';
}

export function hasNoImages(message: ChatCompletionRequestMessage): message is ChatCompletionRequestMessageWithoutImages {
	return typeof message.content === 'string';
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

export interface ChatCompletionRequestMessageWithoutImages {
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
	/**
	 * A speculation string to use for the completion, which is used to perform server side speculative edits. This is only supported by Fireworks.
	 * @type {string}
	 * @memberof CreateChatCompletionRequest
	 */
	'speculation'?: string | number[];
}

export interface CreateCompletionRequest {
	/**
	 * ID of the model to use. You can use the [List models](/docs/api-reference/models/list) API to see all of your available models, or see our [Model overview](/docs/models/overview) for descriptions of them.
	 * @type {string}
	 * @memberof CreateCompletionRequest
	 */
	'model': string;
	/**
	 *
	 * @type {CreateCompletionRequestPrompt}
	 * @memberof CreateCompletionRequest
	 */
	'prompt'?: CreateCompletionRequestPrompt | null;
	/**
	 * The suffix that comes after a completion of inserted text.
	 * @type {string}
	 * @memberof CreateCompletionRequest
	 */
	'suffix'?: string | null;
	/**
	 * The maximum number of [tokens](/tokenizer) to generate in the completion.  The token count of your prompt plus `max_tokens` cannot exceed the model\'s context length. [Example Python code](https://github.com/openai/openai-cookbook/blob/main/examples/How_to_count_tokens_with_tiktoken.ipynb) for counting tokens.
	 * @type {number}
	 * @memberof CreateCompletionRequest
	 */
	'max_tokens'?: number | null;
	/**
	 * What sampling temperature to use, between 0 and 2. Higher values like 0.8 will make the output more random, while lower values like 0.2 will make it more focused and deterministic.  We generally recommend altering this or `top_p` but not both.
	 * @type {number}
	 * @memberof CreateCompletionRequest
	 */
	'temperature'?: number | null;
	/**
	 * An alternative to sampling with temperature, called nucleus sampling, where the model considers the results of the tokens with top_p probability mass. So 0.1 means only the tokens comprising the top 10% probability mass are considered.  We generally recommend altering this or `temperature` but not both.
	 * @type {number}
	 * @memberof CreateCompletionRequest
	 */
	'top_p'?: number | null;
	/**
	 * How many completions to generate for each prompt.  **Note:** Because this parameter generates many completions, it can quickly consume your token quota. Use carefully and ensure that you have reasonable settings for `max_tokens` and `stop`.
	 * @type {number}
	 * @memberof CreateCompletionRequest
	 */
	'n'?: number | null;
	/**
	 * Whether to stream back partial progress. If set, tokens will be sent as data-only [server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events#Event_stream_format) as they become available, with the stream terminated by a `data: [DONE]` message. [Example Python code](https://github.com/openai/openai-cookbook/blob/main/examples/How_to_stream_completions.ipynb).
	 * @type {boolean}
	 * @memberof CreateCompletionRequest
	 */
	'stream'?: boolean | null;
	/**
	 * Include the log probabilities on the `logprobs` most likely tokens, as well the chosen tokens. For example, if `logprobs` is 5, the API will return a list of the 5 most likely tokens. The API will always return the `logprob` of the sampled token, so there may be up to `logprobs+1` elements in the response.  The maximum value for `logprobs` is 5.
	 * @type {number}
	 * @memberof CreateCompletionRequest
	 */
	'logprobs'?: number | null;
	/**
	 * Echo back the prompt in addition to the completion
	 * @type {boolean}
	 * @memberof CreateCompletionRequest
	 */
	'echo'?: boolean | null;
	/**
	 *
	 * @type {CreateCompletionRequestStop}
	 * @memberof CreateCompletionRequest
	 */
	'stop'?: CreateCompletionRequestStop | null;
	/**
	 * Number between -2.0 and 2.0. Positive values penalize new tokens based on whether they appear in the text so far, increasing the model\'s likelihood to talk about new topics.  [See more information about frequency and presence penalties.](/docs/api-reference/parameter-details)
	 * @type {number}
	 * @memberof CreateCompletionRequest
	 */
	'presence_penalty'?: number | null;
	/**
	 * Number between -2.0 and 2.0. Positive values penalize new tokens based on their existing frequency in the text so far, decreasing the model\'s likelihood to repeat the same line verbatim.  [See more information about frequency and presence penalties.](/docs/api-reference/parameter-details)
	 * @type {number}
	 * @memberof CreateCompletionRequest
	 */
	'frequency_penalty'?: number | null;
	/**
	 * Generates `best_of` completions server-side and returns the \"best\" (the one with the highest log probability per token). Results cannot be streamed.  When used with `n`, `best_of` controls the number of candidate completions and `n` specifies how many to return – `best_of` must be greater than `n`.  **Note:** Because this parameter generates many completions, it can quickly consume your token quota. Use carefully and ensure that you have reasonable settings for `max_tokens` and `stop`.
	 * @type {number}
	 * @memberof CreateCompletionRequest
	 */
	'best_of'?: number | null;
	/**
	 * Modify the likelihood of specified tokens appearing in the completion.  Accepts a json object that maps tokens (specified by their token ID in the GPT tokenizer) to an associated bias value from -100 to 100. You can use this [tokenizer tool](/tokenizer?view=bpe) (which works for both GPT-2 and GPT-3) to convert text to token IDs. Mathematically, the bias is added to the logits generated by the model prior to sampling. The exact effect will vary per model, but values between -1 and 1 should decrease or increase likelihood of selection; values like -100 or 100 should result in a ban or exclusive selection of the relevant token.  As an example, you can pass `{\"50256\": -100}` to prevent the <|endoftext|> token from being generated.
	 * @type {object}
	 * @memberof CreateCompletionRequest
	 */
	'logit_bias'?: object | null;
	/**
	 * A unique identifier representing your end-user, which can help OpenAI to monitor and detect abuse. [Learn more](/docs/guides/safety-best-practices/end-user-ids).
	 * @type {string}
	 * @memberof CreateCompletionRequest
	 */
	'user'?: string;
	/**
	 * A speculation string to use for the completion, which is used to perform server side speculative edits. This is only supported by Fireworks.
	 * @type {string}
	 * @memberof CreateCompletionRequest
	 */
	speculation?: string | number[];
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
