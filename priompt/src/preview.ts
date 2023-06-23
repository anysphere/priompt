import { render, RenderOutput } from './lib';
import { Prompt, PromptElement } from './types';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { StreamChatCompletionResponse } from './openai';
import { CreateChatCompletionResponse } from 'openai';

export type PreviewManagerGetPromptQuery = {
  promptId: string;
  propsId: string;
  tokenLimit: number;
};

export type PreviewManagerLiveModeQuery = {
  alreadySeenLiveModeId?: string;
}

export type PreviewManagerLiveModeResultQuery = {
  output: string;
}

export interface IPreviewManager {
  register<T>(config: PreviewConfig<T>): void;
  dump<T>(config: PreviewConfig<T>, props: T): void;

  // these two methods need to be implemented on the server for priompt to work
  getPreviews(): Record<string, { dumps: string[], saved: string[] }>;
  getPrompt(query: PreviewManagerGetPromptQuery): RenderOutput;
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

export function dumpProps<T>(config: PreviewConfig<T>, props: T) {
  const dump = config.dump
    ? config.dump(props)
    : yaml.dump(props, {
      indent: 2,
      lineWidth: -1,
    });
  return dump;
}

export type PreviewConfig<PropsT> = {
  id: string;
  prompt: (props: PropsT) => PromptElement;
  // defaults to yaml but can be overridden
  dump?: (props: PropsT) => string;
  hydrate?: (dump: string) => PropsT;
}

class PreviewManagerImpl implements IPreviewManager {

  private readonly previews: Record<string, PreviewConfig<unknown>> = {};

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

  getPrompt(query: PreviewManagerGetPromptQuery): RenderOutput {
    const element = PreviewManager.getElement(query.promptId, query.propsId);

    const rendered = render(element, { model: "gpt-4", tokenLimit: query.tokenLimit });

    return rendered;
  }

  private getElement(promptId: string, propsId: string): PromptElement {
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
    return config.prompt(this.hydrate(config, this.getDump(promptId, propsId)));
  }

  register<T>(config: PreviewConfig<T>) {
    if (Object.keys(this.previews).includes(config.id)) {
      throw new Error(`preview id ${config.id} already registered`);
    }
    this.previews[config.id] = config;
  }


  private hydrate<T>(config: PreviewConfig<T>, dump: string): T {
    if (config.hydrate) {
      return config.hydrate(dump);
    }
    const yamlData = yaml.load(dump);
    const props: T = yamlData as T;
    return props;
  }

  dump<T>(config: PreviewConfig<T>, props: T) {
    const dump = dumpProps(config, props);
    const priomptPath = path.join(getProjectRoot(), 'priompt', config.id);
    console.log("PRIOMPT PATH: ", priomptPath);
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

function randomString() {
  let s = '';
  for (let i = 0; i < 10; i++) {
    s += Math.floor(Math.random() * 10);
  }
  return s;
}