import { render } from './lib';
import { Prompt, PromptElement, PromptProps, RenderOutput, SynchronousPrompt } from './types';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { StreamChatCompletionResponse, UsableLanguageModel } from './openai';
import { ChatCompletionResponseMessage, CreateChatCompletionResponse } from 'openai';
import { NewOutputCatcher, OutputCatcher } from './outputCatcher.ai';

export type PreviewManagerGetPromptQuery = {
  promptId: string;
  propsId: string;
  tokenLimit: number;
};
export type PreviewManagerGetRemotePromptQuery = {
  promptId: string;
  promptDump: string;
  modelName: UsableLanguageModel;
  tokenLimit?: number;
};

export type PreviewManagerGetRemotePropsQuery = {
  promptId: string;
  promptDump: string
}

export type PreviewManagerGetPromptOutputQuery = {
  promptId: string;
  propsId: string;
  tokenLimit: number;
  completion: ChatCompletionResponseMessage | ChatCompletionResponseMessage[];
  stream: boolean;
};

export type PreviewManagerLiveModeQuery = {
  alreadySeenLiveModeId?: string;
}

export type PreviewManagerLiveModeResultQuery = {
  output: string;
}

export interface IPreviewManager {
  registerConfig<T>(config: PreviewConfig<T>): void;
  dump<T>(config: PreviewConfig<T>, props: T): void;

  // these two methods need to be implemented on the server for priompt to work
  getPreviews(): Record<string, { dumps: string[], saved: string[] }>;
  getPrompt(query: PreviewManagerGetPromptQuery): Promise<RenderOutput>;
  getPromptFromRemote(query: PreviewManagerGetRemotePromptQuery): Promise<RenderOutput>;
}

type LiveModeOutput = {
  liveModeId: string;
};

type LiveModeData = {
  liveModeId: string;
  promptElement: PromptElement;
};

function getProjectRoot(): string {
  // just do cwd / priompt for now
  return process.cwd();
}

export function configFromPrompt<T, ReturnT = never>(prompt: Prompt<T, ReturnT>): PreviewConfig<T> {
  return {
    id: prompt.name,
    prompt,
  };
}
export function configFromSynchronousPrompt<T, ReturnT = never>(prompt: SynchronousPrompt<T, ReturnT>): SynchronousPreviewConfig<T, ReturnT> {
  return {
    id: prompt.name,
    prompt,
  };
}

export function dumpProps<T, ReturnT = never>(config: PreviewConfig<T, ReturnT>, props: Omit<T, "onReturn">): string {
  let hasNoDump = false;
  for (const key in props) {
    if (key.startsWith('DO_NOT_DUMP')) {
      hasNoDump = true;
    }
  }
  let objectToDump = props;
  if (hasNoDump) {
    objectToDump = {} as Omit<T, "onReturn">;
    for (const key in props) {
      if (!key.startsWith('DO_NOT_DUMP')) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        objectToDump[key] = props[key];
      }
    }
  }

  const dump = config.dump
    ? config.dump(objectToDump)
    : yaml.dump(objectToDump, {
      indent: 2,
      lineWidth: -1,
    });
  return dump;
}

export type PreviewConfig<PropsT, ReturnT = never> = {
  id: string;
  prompt: Prompt<PropsT, ReturnT>;
  // defaults to yaml but can be overridden
  dump?: (props: Omit<PropsT, "onReturn">) => string; hydrate?: (dump: string) => PropsT;
}

export type SynchronousPreviewConfig<PropsT, ReturnT = never> = {
  id: string;
  prompt: SynchronousPrompt<PropsT, ReturnT>;
  // defaults to yaml but can be overridden
  dump?: (props: Omit<PropsT, "onReturn">) => string; hydrate?: (dump: string) => PropsT;

}

class PreviewManagerImpl implements IPreviewManager {

  private _shouldDump: boolean = process.env.NODE_ENV === 'development';

  get shouldDump(): boolean {
    return this._shouldDump;
  }

  set shouldDump(value: boolean) {
    this._shouldDump = value;
  }

  private readonly previews: Record<string, PreviewConfig<unknown>> = {};

  getConfig(promptId: string) {
    return this.previews[promptId];
  }

  getPreviews() {
    return Object.keys(this.previews).reduce((acc: Record<string, { dumps: string[], saved: string[] }>, promptId) => {
      const promptPath = path.join(getProjectRoot(), 'priompt', promptId);
      const dumpsPath = path.join(promptPath, 'dumps');
      // if they don't exist, make the dirs
      if (!fs.existsSync(promptPath)) {
        fs.mkdirSync(promptPath, { recursive: true });
      }
      if (!fs.existsSync(dumpsPath)) {
        fs.mkdirSync(dumpsPath, { recursive: true });
      }
      const propsIds = fs.readdirSync(dumpsPath).filter((f) => f.endsWith('.yaml')).map((f) => f.replace('.yaml', ''));
      const savedIds = fs.readdirSync(promptPath).filter((f) => f.endsWith('.yaml')).map((f) => f.replace('.yaml', ''));
      return {
        ...acc,
        [promptId]: {
          dumps: propsIds,
          saved: savedIds,
        }
      };
    }, {});
  }

  async getPrompt(query: PreviewManagerGetPromptQuery): Promise<RenderOutput> {
    let element = PreviewManager.getElement(query.promptId, query.propsId);
    if (element instanceof Promise) {
      element = await element;
    }

    const rendered = await render(element, { model: "gpt-4", tokenLimit: query.tokenLimit });

    return rendered;
  }

  async getPromptOutput(query: PreviewManagerGetPromptOutputQuery): Promise<unknown> {
    const outputCatcher = NewOutputCatcher<unknown>();

    let element = PreviewManager.getElement(query.promptId, query.propsId, outputCatcher);
    if (element instanceof Promise) {
      element = await element;
    }

    const rendered = await render(element, { model: "gpt-4", tokenLimit: query.tokenLimit });

    if (!query.stream) {
      // call all of them and wait all of them in parallel
      await Promise.all(
        rendered.outputHandlers.map((handler) => handler(Array.isArray(query.completion) ? query.completion[0] : query.completion))
      );

      // now return the first output
      const firstOutput = outputCatcher.getOutput();

      return firstOutput;
    } else {
      await Promise.all(
        rendered.streamHandlers.map((handler) => handler((async function* () {
          for (const completion of Array.isArray(query.completion) ? query.completion : [query.completion]) {
            yield completion;
          }
        })())
        ));

      // now return the first output
      const firstOutput = outputCatcher.getOutput();

      // let's just put it in an array
      const a = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for await (const x of (firstOutput as any)) {
        a.push(x);
      }

      return a;
    }

  }

  async getPromptFromRemote(query: PreviewManagerGetRemotePromptQuery) {
    let element = this.getRemoteElement(query.promptId, query.promptDump);
    if (element instanceof Promise) {
      element = await element;
    }
    return this.getPromptFromRemoteElement(query, element);
  }

  async getPropsFromRemote(query: PreviewManagerGetRemotePropsQuery) {
    const promptId = query.promptId;
    const promptDump = query.promptDump;
    const config = this.previews[promptId];
    const baseProps = this.hydrate(config, promptDump);
    return baseProps;
  }

  async getPromptFromRemoteElement(query: Omit<PreviewManagerGetRemotePromptQuery, "promptId" | "promptDump">, element: PromptElement) {
    const rendered = await render(element, { model: query.modelName, tokenLimit: query.tokenLimit });
    return rendered
  }

  getRemoteElement(promptId: string, promptDump: string) {
    const config = this.previews[promptId];
    const baseProps = this.hydrate(config, promptDump);
    const element = config.prompt(baseProps as PromptProps<unknown>);
    return element;
  }


  private getElement(promptId: string, propsId: string, outputCatcher?: OutputCatcher<unknown>): PromptElement | Promise<PromptElement> {
    if (promptId === 'liveModePromptId') {
      if (this.lastLiveModeData === null) {
        throw new Error('live mode prompt not found');
      }
      return this.lastLiveModeData.promptElement;
    }
    if (!Object.keys(this.previews).includes(promptId)) {
      throw new Error(`preview promptId ${promptId} not registered`);
    }
    const config = this.previews[promptId];

    const baseProps = this.hydrate(config, this.getDump(promptId, propsId));

    let realProps: unknown = baseProps;
    if (outputCatcher !== undefined) {
      const captureProps: unknown = {
        onReturn: (x: unknown) => outputCatcher.onOutput(x),
      };
      realProps = {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(baseProps as any),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(captureProps as any),
      };
    }

    return config.prompt(realProps as PromptProps<unknown>);
  }

  registerConfig<T, ReturnT = never>(config: PreviewConfig<T, ReturnT>) {
    if (Object.keys(this.previews).includes(config.id)) {
      // sort of sketchy, but may be fine if we're in esm hmr land...
      // we just overwrite
      if (process.env.ALLOW_PROMPT_REREGISTRATION === "true") {
        console.warn(`preview id ${config.id} already registered`);
      } else {
        throw new Error(`preview id ${config.id} already registered`);
      }
    }
    this.previews[config.id] = config;
  }
  register<T, ReturnT = never>(prompt: Prompt<T, ReturnT>) {
    const config = configFromPrompt(prompt);
    this.registerConfig(config);
  }

  configFromSynchronousPrompt<T, ReturnT = never>(prompt: SynchronousPrompt<T, ReturnT>): SynchronousPreviewConfig<T, ReturnT> {
    return configFromSynchronousPrompt(prompt);
  }

  hydrate<T>(config: PreviewConfig<T>, dump: string): T {
    if (config.hydrate) {
      return config.hydrate(dump);
    }
    const yamlData = yaml.load(dump);
    const props: T = yamlData as T;
    return props;
  }

  maybeDump<T, ReturnT = never>(prompt: (props: PromptProps<T, ReturnT>) => PromptElement, props: Omit<T, "onReturn">) {
    if (!this.shouldDump) {
      return;
    }
    const config = configFromPrompt(prompt);
    this.dump(config, props);
  }

  dump<T>(config: PreviewConfig<T>, props: T) {
    const dump = dumpProps(config, props);
    const priomptPath = path.join(getProjectRoot(), 'priompt', config.id);
    console.debug("PRIOMPT PATH: ", priomptPath);
    const dumpsPath = path.join(priomptPath, 'dumps');

    if (!fs.existsSync(priomptPath)) {
      fs.mkdirSync(priomptPath, { recursive: true });

      // in this case, we want to write the file to the promptId path as well, as example01.yaml
      // this makes it easier for other users to see what the prompt is supposed to look like
      const filePath = path.join(priomptPath, `example01.yaml`);
      fs.writeFileSync(filePath, dump);
    }

    if (!fs.existsSync(dumpsPath)) {
      fs.mkdirSync(dumpsPath, { recursive: true });
    }

    // if there are more than 2000 files, delete the oldest 1000 of them
    try {
      const files = fs.readdirSync(dumpsPath);
      if (files.length > 2000) {
        const sortedFiles = files.sort((a, b) => a.localeCompare(b));
        for (let i = 0; i < 1000; i++) {
          fs.unlinkSync(path.join(dumpsPath, sortedFiles[i]));
        }
      }
    } catch (e) {
      console.warn({ error: e }, "failed to remove old priompt dumps")
    }

    const propsId = new Date().toISOString().replace(/[:.]/g, '-'); // Human-readable propsId with date and time
    const filePath = path.join(dumpsPath, `${propsId}.yaml`); // Changed file extension to .yaml
    fs.writeFileSync(filePath, dump);
  }

  private lastLiveModeData: LiveModeData | null = null;
  private lastLiveModeOutputPromise: Promise<void>;
  private resolveLastLiveModeOutputPromise: () => void = () => { };

  private liveModeResultPromise: Promise<string>;
  private resolveLiveModeResult: (s: string) => void = () => { };

  constructor() {
    this.lastLiveModeOutputPromise = new Promise((resolve) => {
      this.resolveLastLiveModeOutputPromise = resolve;
    });
    this.liveModeResultPromise = new Promise((resolve) => {
      this.resolveLiveModeResult = resolve;
    });
  }

  async getLiveModePromptCompletion(promptElement: PromptElement, options: { model: string, abortSignal?: AbortSignal }): Promise<CreateChatCompletionResponse> {
    const liveModeData: LiveModeData = {
      liveModeId: randomString(),
      promptElement,
    };
    this.lastLiveModeData = liveModeData;
    this.resolveLastLiveModeOutputPromise();
    this.lastLiveModeOutputPromise = new Promise((resolve) => {
      this.resolveLastLiveModeOutputPromise = resolve;
    });
    const result = await this.liveModeResultPromise;
    const output: CreateChatCompletionResponse = {
      'id': liveModeData.liveModeId,
      'object': 'text_completion',
      'created': Date.now(),
      'model': options.model,
      'choices': [
        {
          'message': {
            'role': 'assistant',
            'content': result,
          }
        }
      ]
    };

    return output;
  }

  async *streamLiveModePromptCompletion(promptElement: PromptElement, options: { model: string, abortSignal?: AbortSignal }): AsyncGenerator<StreamChatCompletionResponse> {
    const output: StreamChatCompletionResponse = await this.getLiveModePromptCompletion(promptElement, options);

    output.choices[0].delta = output.choices[0].message;

    yield output;
  }

  async liveMode(query: PreviewManagerLiveModeQuery, abortSignal?: AbortSignal): Promise<LiveModeOutput> {
    while (true) {
      const result = await Promise.race([
        this.lastLiveModeOutputPromise,
        new Promise((_, reject) => {
          if (abortSignal) {
            abortSignal.addEventListener('abort', () => reject(new Error('Aborted')));
          }
        }),
      ]);

      if (result instanceof Error) {
        throw result;
      }

      if (this.lastLiveModeData === null) {
        continue;
      }
      if (this.lastLiveModeData.liveModeId === query.alreadySeenLiveModeId) {
        continue;
      }
      return this.lastLiveModeData;
    }
  }

  liveModeResult(query: PreviewManagerLiveModeResultQuery) {
    this.resolveLiveModeResult(query.output);
    this.liveModeResultPromise = new Promise((resolve) => {
      this.resolveLiveModeResult = resolve;
    });
  }


  private getDump(promptId: string, propsId: string): string {
    const priomptPath = path.join(getProjectRoot(), 'priompt', promptId);
    const dumpsPath = path.join(priomptPath, 'dumps');

    const filePathInPromptId = path.join(priomptPath, `${propsId}.yaml`);
    const filePathInDumps = path.join(dumpsPath, `${propsId}.yaml`);

    if (fs.existsSync(filePathInPromptId)) {
      return fs.readFileSync(filePathInPromptId, 'utf-8');
    } else if (fs.existsSync(filePathInDumps)) {
      return fs.readFileSync(filePathInDumps, 'utf-8');
    } else {
      throw new Error(`No dump found for promptId ${promptId} and propsId ${propsId}`);
    }
  }
}

// GLOBALS FTW. i love globals.
export const PreviewManager = new PreviewManagerImpl();

// Decorator
export function register() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function registerPrompt<T, ReturnT = never>(target: any, propertyKey: string, descriptor: TypedPropertyDescriptor<Prompt<T, ReturnT>>) {
    if (descriptor.value === undefined) {
      throw new Error(`@registerPrompt can only be used on methods, not ${target.constructor.name}.${propertyKey}`);
    } else {
      PreviewManager.register(descriptor.value);
    }
  }
  return registerPrompt;
}

// export function register<T, ReturnT = never>(prompt: Prompt<T, ReturnT>) {
//   PreviewManager.register(prompt);
// }





function randomString() {
  let s = '';
  for (let i = 0; i < 10; i++) {
    s += Math.floor(Math.random() * 10);
  }
  return s;
}