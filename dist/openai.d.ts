import { ChatCompletionResponseMessage, CreateChatCompletionResponse, CreateChatCompletionResponseChoicesInner } from 'openai';
export declare const GPT_3_5_TURBO = "gpt-3.5-turbo";
export declare const GPT_4 = "gpt-4";
export declare const GPT_4_32K = "gpt-4-32k";
export declare const GPT_4_0613 = "gpt-4-0613";
export declare const TEXT_EMBEDDING_ADA_002 = "text-embedding-ada-002";
export declare const TEXT_DAVINCI_003 = "text-davinci-003";
export declare const CL100K_BASE = "cl100k_base";
export declare const R50K_BASE = "r50k_base";
export declare const P50K_BASE = "p50k_base";
export declare const GPT2_TOKENIZER = "gpt2";
export declare const AZURE_3_5_TURBO = "azure-3.5-turbo";
export declare const usableModels: readonly ["gpt-3.5-turbo", "gpt-4", "gpt-4-32k", "text-embedding-ada-002", "text-davinci-003", "azure-3.5-turbo"];
export declare const usableLanguageModels: readonly ["gpt-3.5-turbo", "gpt-4", "gpt-4-32k", "azure-3.5-turbo"];
export declare const usableTokenizers: readonly ["cl100k_base", "r50k_base", "p50k_base", "gpt2"];
export declare const MODEL_CONTEXTS: {
    [key in UsableLanguageModel]: number;
};
export declare const MAX_TOKENS: {
    [key in UsableLanguageModel]: number;
};
export type UsableModel = typeof usableModels[number];
export type UsableLanguageModel = typeof usableLanguageModels[number];
export type UsableTokenizer = typeof usableTokenizers[number];
export declare const CHATML_PROMPT_EXTRA_TOKEN_COUNT_LINEAR_FACTOR = 4;
export declare const CHATML_PROMPT_EXTRA_TOKEN_COUNT_CONSTANT = 2;
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
export { };
