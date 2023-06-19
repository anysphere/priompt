import { RenderOutput } from './lib';
import { PromptElement } from './types';
import { StreamChatCompletionResponse } from './openai';
import { CreateChatCompletionResponse } from 'openai';
export type PreviewManagerGetPromptQuery = {
    promptId: string;
    propsId: string;
    tokenLimit: number;
};
export type PreviewManagerLiveModeQuery = {
    alreadySeenLiveModeId?: string;
};
export type PreviewManagerLiveModeResultQuery = {
    output: string;
};
export interface IPreviewManager {
    register<T>(config: PreviewConfig<T>): void;
    dump<T>(config: PreviewConfig<T>, props: T): void;
    getPreviews(): Record<string, {
        dumps: string[];
        saved: string[];
    }>;
    getPrompt(query: PreviewManagerGetPromptQuery): RenderOutput;
}
type LiveModeOutput = {
    liveModeId: string;
};
export declare function dumpProps<T>(config: PreviewConfig<T>, props: T): string;
export type PreviewConfig<PropsT> = {
    id: string;
    prompt: (props: PropsT) => PromptElement;
    dump?: (props: PropsT) => string;
    hydrate?: (dump: string) => PropsT;
};
declare class PreviewManagerImpl implements IPreviewManager {
    private readonly previews;
    getPreviews(): {
        [x: string]: {
            dumps: string[];
            saved: string[];
        } | {
            dumps: string[];
            saved: string[];
        };
    };
    getPrompt(query: PreviewManagerGetPromptQuery): RenderOutput;
    private getElement;
    register<T>(config: PreviewConfig<T>): void;
    private hydrate;
    dump<T>(config: PreviewConfig<T>, props: T): void;
    private lastLiveModeData;
    private lastLiveModeOutputPromise;
    private resolveLastLiveModeOutputPromise;
    private liveModeResultPromise;
    private resolveLiveModeResult;
    constructor();
    getLiveModePromptCompletion(promptElement: PromptElement, options: {
        model: string;
        abortSignal?: AbortSignal;
    }): Promise<CreateChatCompletionResponse>;
    streamLiveModePromptCompletion(promptElement: PromptElement, options: {
        model: string;
        abortSignal?: AbortSignal;
    }): AsyncGenerator<StreamChatCompletionResponse>;
    liveMode(query: PreviewManagerLiveModeQuery, abortSignal?: AbortSignal): Promise<LiveModeOutput>;
    liveModeResult(query: PreviewManagerLiveModeResultQuery): void;
    private getDump;
}
export declare const PreviewManager: PreviewManagerImpl;
export {};
