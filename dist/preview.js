"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PreviewManager = exports.dumpProps = void 0;
const lib_1 = require("./lib");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const yaml = __importStar(require("js-yaml"));
function getProjectRoot() {
    // just do cwd / priompt for now
    return process.cwd();
}
function dumpProps(config, props) {
    const dump = config.dump
        ? config.dump(props)
        : yaml.dump(props, {
            indent: 2,
            lineWidth: -1,
        });
    return dump;
}
exports.dumpProps = dumpProps;
class PreviewManagerImpl {
    getPreviews() {
        return Object.keys(this.previews).reduce((acc, promptId) => {
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
    getPrompt(query) {
        const element = exports.PreviewManager.getElement(query.promptId, query.propsId);
        const rendered = (0, lib_1.render)(element, { model: "gpt-4", tokenLimit: query.tokenLimit });
        return rendered;
    }
    getElement(promptId, propsId) {
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
    register(config) {
        if (Object.keys(this.previews).includes(config.id)) {
            throw new Error(`preview id ${config.id} already registered`);
        }
        this.previews[config.id] = config;
    }
    hydrate(config, dump) {
        if (config.hydrate) {
            return config.hydrate(dump);
        }
        const yamlData = yaml.load(dump);
        const props = yamlData;
        return props;
    }
    dump(config, props) {
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
    constructor() {
        this.previews = {};
        this.lastLiveModeData = null;
        this.resolveLastLiveModeOutputPromise = () => { };
        this.resolveLiveModeResult = () => { };
        this.lastLiveModeOutputPromise = new Promise((resolve) => {
            this.resolveLastLiveModeOutputPromise = resolve;
        });
        this.liveModeResultPromise = new Promise((resolve) => {
            this.resolveLiveModeResult = resolve;
        });
    }
    async getLiveModePromptCompletion(promptElement, options) {
        const liveModeData = {
            liveModeId: randomString(),
            promptElement,
        };
        this.lastLiveModeData = liveModeData;
        this.resolveLastLiveModeOutputPromise();
        this.lastLiveModeOutputPromise = new Promise((resolve) => {
            this.resolveLastLiveModeOutputPromise = resolve;
        });
        const result = await this.liveModeResultPromise;
        const output = {
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
    async *streamLiveModePromptCompletion(promptElement, options) {
        const output = await this.getLiveModePromptCompletion(promptElement, options);
        output.choices[0].delta = output.choices[0].message;
        yield output;
    }
    async liveMode(query, abortSignal) {
        while (true) {
            console.log("while true");
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
    liveModeResult(query) {
        this.resolveLiveModeResult(query.output);
        this.liveModeResultPromise = new Promise((resolve) => {
            this.resolveLiveModeResult = resolve;
        });
    }
    getDump(promptId, propsId) {
        const priomptPath = path.join(getProjectRoot(), 'priompt', promptId);
        const dumpsPath = path.join(priomptPath, 'dumps');
        const filePathInPromptId = path.join(priomptPath, `${propsId}.yaml`);
        const filePathInDumps = path.join(dumpsPath, `${propsId}.yaml`);
        if (fs.existsSync(filePathInPromptId)) {
            return fs.readFileSync(filePathInPromptId, 'utf-8');
        }
        else if (fs.existsSync(filePathInDumps)) {
            return fs.readFileSync(filePathInDumps, 'utf-8');
        }
        else {
            throw new Error(`No dump found for promptId ${promptId} and propsId ${propsId}`);
        }
    }
}
// GLOBALS FTW. i love globals.
exports.PreviewManager = new PreviewManagerImpl();
function randomString() {
    let s = '';
    for (let i = 0; i < 10; i++) {
        s += Math.floor(Math.random() * 10);
    }
    return s;
}
//# sourceMappingURL=preview.js.map