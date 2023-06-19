
/**
 *
 * @export
 * @interface ChatCompletionRequestMessage
 */
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
	'content'?: string;
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
export declare const ChatCompletionRequestMessageRoleEnum: {
	readonly System: "system";
	readonly User: "user";
	readonly Assistant: "assistant";
	readonly Function: "function";
};
export interface ChatCompletionFunctions {
	/**
	 * The name of the function to be called. Must be a-z, A-Z, 0-9, or contain underscores and dashes, with a maximum length of 64.
	 * @type {string}
	 * @memberof ChatCompletionFunctions
	 */
	'name': string;
	/**
	 * The description of what the function does.
	 * @type {string}
	 * @memberof ChatCompletionFunctions
	 */
	'description'?: string;
	/**
	 * The parameters the functions accepts, described as a JSON Schema object. See the [guide](/docs/guides/gpt/function-calling) for examples, and the [JSON Schema reference](https://json-schema.org/understanding-json-schema/) for documentation about the format.
	 * @type {{ [key: string]: any; }}
	 * @memberof ChatCompletionFunctions
	 */
	'parameters'?: {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		[key: string]: any;
	};
}
export declare type CreateChatCompletionRequestFunctionCall = CreateChatCompletionRequestFunctionCallOneOf | string;
/**
 *
 * @export
 * @interface CreateChatCompletionRequestFunctionCallOneOf
 */
export interface CreateChatCompletionRequestFunctionCallOneOf {
	/**
	 * The name of the function to call.
	 * @type {string}
	 * @memberof CreateChatCompletionRequestFunctionCallOneOf
	 */
	'name': string;
}
export declare type ChatCompletionRequestMessageRoleEnum = typeof ChatCompletionRequestMessageRoleEnum[keyof typeof ChatCompletionRequestMessageRoleEnum];
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
/**
 * @type CreateChatCompletionRequestStop
 * Up to 4 sequences where the API will stop generating further tokens.
 * @export
 */
export declare type CreateChatCompletionRequestStop = Array<string> | string;


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
/**
 *
 * @export
 * @interface CreateChatCompletionResponse
 */
export interface CreateChatCompletionResponse {
	/**
	 *
	 * @type {string}
	 * @memberof CreateChatCompletionResponse
	 */
	'id': string;
	/**
	 *
	 * @type {string}
	 * @memberof CreateChatCompletionResponse
	 */
	'object': string;
	/**
	 *
	 * @type {number}
	 * @memberof CreateChatCompletionResponse
	 */
	'created': number;
	/**
	 *
	 * @type {string}
	 * @memberof CreateChatCompletionResponse
	 */
	'model': string;
	/**
	 *
	 * @type {Array<CreateChatCompletionResponseChoicesInner>}
	 * @memberof CreateChatCompletionResponse
	 */
	'choices': Array<CreateChatCompletionResponseChoicesInner>;
	/**
	 *
	 * @type {CreateCompletionResponseUsage}
	 * @memberof CreateChatCompletionResponse
	 */
	'usage'?: CreateCompletionResponseUsage;
}
/**
*
* @export
* @interface CreateChatCompletionResponseChoicesInner
*/
export interface CreateChatCompletionResponseChoicesInner {
	/**
	 *
	 * @type {number}
	 * @memberof CreateChatCompletionResponseChoicesInner
	 */
	'index'?: number;
	/**
	 *
	 * @type {ChatCompletionResponseMessage}
	 * @memberof CreateChatCompletionResponseChoicesInner
	 */
	'message'?: ChatCompletionResponseMessage;
	/**
	 *
	 * @type {string}
	 * @memberof CreateChatCompletionResponseChoicesInner
	 */
	'finish_reason'?: string;
}
/**
 *
 * @export
 * @interface CreateCompletionResponseUsage
 */
export interface CreateCompletionResponseUsage {
	/**
	 *
	 * @type {number}
	 * @memberof CreateCompletionResponseUsage
	 */
	'prompt_tokens': number;
	/**
	 *
	 * @type {number}
	 * @memberof CreateCompletionResponseUsage
	 */
	'completion_tokens': number;
	/**
	 *
	 * @type {number}
	 * @memberof CreateCompletionResponseUsage
	 */
	'total_tokens': number;
}
/**
 *
 * @export
 * @interface ChatCompletionResponseMessage
 */
export interface ChatCompletionResponseMessage {
	/**
	 * The role of the author of this message.
	 * @type {string}
	 * @memberof ChatCompletionResponseMessage
	 */
	'role': ChatCompletionResponseMessageRoleEnum;
	/**
	 * The contents of the message
	 * @type {string}
	 * @memberof ChatCompletionResponseMessage
	 */
	'content'?: string;
	/**
	 *
	 * @type {ChatCompletionRequestMessageFunctionCall}
	 * @memberof ChatCompletionResponseMessage
	 */
	'function_call'?: ChatCompletionRequestMessageFunctionCall;
}
export interface ChatCompletionRequestMessageFunctionCall {
	/**
	 * The name of the function to call.
	 * @type {string}
	 * @memberof ChatCompletionRequestMessageFunctionCall
	 */
	'name'?: string;
	/**
	 * The arguments to call the function with, as generated by the model in JSON format. Note that the model does not always generate valid JSON, and may hallucinate parameters not defined by your function schema. Validate the arguments in your code before calling your function.
	 * @type {string}
	 * @memberof ChatCompletionRequestMessageFunctionCall
	 */
	'arguments'?: string;
}
export declare const ChatCompletionResponseMessageRoleEnum: {
	readonly System: "system";
	readonly User: "user";
	readonly Assistant: "assistant";
	readonly Function: "function";
};
export declare type ChatCompletionResponseMessageRoleEnum = typeof ChatCompletionResponseMessageRoleEnum[keyof typeof ChatCompletionResponseMessageRoleEnum];