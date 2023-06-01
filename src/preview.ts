import { render, RenderOutput } from './lib';
import { PromptElement } from './types';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

export type PreviewManagerGetPromptQuery = {
  promptId: string;
  propsId: string;
  tokenLimit: number;
};

export interface IPreviewManager {
  register<T>(config: PreviewConfig<T>): void;
  dump<T>(config: PreviewConfig<T>, props: T): void;

  // these two methods need to be implemented on the server for priompt to work
  getPreviews(): Record<string, { dumps: string[], saved: string[] }>;
  getPrompt(query: PreviewManagerGetPromptQuery): RenderOutput;
}

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