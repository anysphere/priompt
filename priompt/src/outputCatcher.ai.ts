import { OutputCatcherImpl } from './outputCatcher.ai.impl';
export interface OutputCatcher<T> {
	// p is a priority
	onOutput(output: T, options?: { p?: number }): Promise<void>;

	// get a sorted list of the outputs, with the highest priority first
	// then come all the ones with no priority assigned, in the order they were added
	getOutputs(): T[];

	// get the first output
	getOutput(): T | undefined;
}

// @cursor-agent {"dependsOn": "interface", "hash": "7034e4452cc668449b0b967116683a95303c4509d263ed535851b081164751bb"}
// @cursor-agent {"dependsOn": "implementation", "hash": "083f9244af4f56b541391df75e2a6bfe7e352f5ee6ed3ffe2eabd36dc06cdcf8"}
export function NewOutputCatcher<T>(): OutputCatcher<T> {
	return new OutputCatcherImpl<T>();
}

// @cursor-agent {"dependsOn": "interface", "hash": "7034e4452cc668449b0b967116683a95303c4509d263ed535851b081164751bb"}
// @cursor-agent {"passedInitialVerification": true}
