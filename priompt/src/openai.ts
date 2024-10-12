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
