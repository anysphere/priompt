import { ChatCompletionRequestMessage } from 'openai';
import { UsableLanguageModel, UsableTokenizer } from './openai';
import { BaseProps, Prompt, PromptElement } from './types';
export declare function createElement(tag: ((props: BaseProps & Record<string, unknown>) => PromptElement) | string, props: Record<string, unknown> | null, ...children: PromptElement[]): PromptElement;
export declare function Fragment({ children }: {
    children: PromptElement[];
}): PromptElement;
export type RenderOptions = {
    model?: UsableLanguageModel;
    tokenLimit?: number;
    tokenizer?: UsableTokenizer;
};
export type RenderOutput = {
    prompt: Prompt;
    tokenCount: number;
    tokensReserved: number;
    priorityCutoff: number;
    durationMs?: number;
};
export declare function render(elem: PromptElement, options: RenderOptions): RenderOutput;
export declare function renderBinarySearch(elem: PromptElement, { model, tokenLimit, tokenizer }: RenderOptions): RenderOutput;
export declare function renderBackwardsLinearSearch(elem: PromptElement, { model, tokenLimit, tokenizer }: RenderOptions): RenderOutput;
export declare function promptToOpenAIChat(prompt: Prompt): Array<ChatCompletionRequestMessage>;
