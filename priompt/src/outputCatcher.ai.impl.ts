import { OutputCatcher } from './outputCatcher.ai';

export class OutputCatcherImpl<T> implements OutputCatcher<T> {
	private outputs: { output: T, priority: number | null }[] = [];
	private noPriorityOutputs: { output: T, priority: null }[] = [];

	async onOutput(output: T, options?: { p?: number }): Promise<void> {
		if (options?.p !== undefined) {
			this.outputs.push({ output, priority: options.p });
			this.outputs.sort((a, b) => (b.priority as number) - (a.priority as number));
		} else {
			this.noPriorityOutputs.push({ output, priority: null });
		}
	}

	getOutputs(): T[] {
		return [...this.outputs, ...this.noPriorityOutputs].map(o => o.output);
	}

	getOutput(): T | undefined {
		return this.outputs.length > 0 ? this.outputs[0].output : this.noPriorityOutputs.length > 0 ? this.noPriorityOutputs[0].output : undefined;
	}
}
// @cursor-agent {"dependsOn": "interface", "hash": "7034e4452cc668449b0b967116683a95303c4509d263ed535851b081164751bb"}
