
import { OutputCatcher, NewOutputCatcher } from "./outputCatcher.ai";

// @cursor-agent {"dependsOn": "interface", "hash": "7034e4452cc668449b0b967116683a95303c4509d263ed535851b081164751bb"}
// @cursor-agent:begin-test-plan
// T01: Test that `onOutput` correctly adds an output with no priority to the list of outputs.
// T02: Test that `onOutput` correctly adds an output with a priority to the list of outputs.
// T03: Test that `getOutputs` returns a list of outputs in the correct order, with the highest priority first and then all the ones with no priority assigned, in the order they were added.
// T04: Test that `getOutput` returns the first output in the list.
// T05: Test that `getOutput` returns undefined if there are no outputs in the list.
// T06: Test that `onOutput` correctly handles multiple outputs with the same priority.
// T07: Test that `onOutput` correctly handles multiple outputs with different priorities.
// T08: Test that `onOutput` correctly handles multiple outputs with no priority.
// T09: Test that `getOutputs` correctly handles an empty list of outputs.
// T10: Test that `getOutputs` correctly handles a list of outputs with only one output.
// T11: Test that `getOutputs` correctly handles a list of outputs with multiple outputs with the same priority.
// T12: Test that `getOutputs` correctly handles a list of outputs with multiple outputs with different priorities.
// T13: Test that `getOutputs` correctly handles a list of outputs with multiple outputs with no priority.
// T14: Test that `getOutput` correctly handles a list of outputs with only one output.
// T15: Test that `getOutput` correctly handles a list of outputs with multiple outputs with the same priority.
// T16: Test that `getOutput` correctly handles a list of outputs with multiple outputs with different priorities.
// T17: Test that `getOutput` correctly handles a list of outputs with multiple outputs with no priority.
// @cursor-agent:end-test-plan

import { describe, it, expect } from "vitest";


describe("OutputCatcher", () => {

	// @cursor-agent:add-tests-here


	// @cursor-agent:test-begin:T17
	// @cursor-agent {"dependsOn": "interface", "hash": "7034e4452cc668449b0b967116683a95303c4509d263ed535851b081164751bb"}
	// @cursor-agent {"dependsOn": "testPlan", "hash": "2fd5729af0825f1ab89a030c1f9b035ecaafc20906f0a7579240fc4a2ca69eda"}
	// @cursor-agent {"id": "T17"}
	it('should correctly handle a list of outputs with multiple outputs with no priority', async () => {
		const outputCatcher = NewOutputCatcher<string>();

		// Add outputs with no priority
		await outputCatcher.onOutput('output1');
		await outputCatcher.onOutput('output2');
		await outputCatcher.onOutput('output3');

		// Check if the first output is correct
		const firstOutput = outputCatcher.getOutput();
		expect(firstOutput).toBe('output1');

		// Check if the outputs are in the correct order
		const outputs = outputCatcher.getOutputs();
		expect(outputs).toEqual(['output1', 'output2', 'output3']);
	});
	// @cursor-agent:test-end:T17



	// @cursor-agent:test-begin:T16
	// @cursor-agent {"dependsOn": "interface", "hash": "7034e4452cc668449b0b967116683a95303c4509d263ed535851b081164751bb"}
	// @cursor-agent {"dependsOn": "testPlan", "hash": "705d3c64a82e431d967a6202dd705d4d73d542576a464fa50114834100012adb"}
	// @cursor-agent {"id": "T16"}
	it('should correctly handle a list of outputs with multiple outputs with different priorities', async () => {
		const outputCatcher = NewOutputCatcher<string>();

		await outputCatcher.onOutput('output1', { p: 2 });
		await outputCatcher.onOutput('output2', { p: 1 });
		await outputCatcher.onOutput('output3', { p: 3 });

		const firstOutput = outputCatcher.getOutput();

		expect(firstOutput).toBe('output3');
	});
	// @cursor-agent:test-end:T16



	// @cursor-agent:test-begin:T15
	// @cursor-agent {"dependsOn": "interface", "hash": "7034e4452cc668449b0b967116683a95303c4509d263ed535851b081164751bb"}
	// @cursor-agent {"dependsOn": "testPlan", "hash": "52e1cabe3ba083495b0f3585522dcaeef206f46efd571b9eb81455bf949d3551"}
	// @cursor-agent {"id": "T15"}
	it('should correctly handle a list of outputs with multiple outputs with the same priority', async () => {
		const outputCatcher = NewOutputCatcher<string>();

		// Add outputs with the same priority
		await outputCatcher.onOutput('output1', { p: 1 });
		await outputCatcher.onOutput('output2', { p: 1 });
		await outputCatcher.onOutput('output3', { p: 1 });

		// Check if the first output is correct
		const firstOutput = outputCatcher.getOutput();
		expect(firstOutput).toBe('output1');

		// Check if the outputs are sorted correctly
		const outputs = outputCatcher.getOutputs();
		expect(outputs).toEqual(['output1', 'output2', 'output3']);
	});
	// @cursor-agent:test-end:T15



	// @cursor-agent:test-begin:T14
	// @cursor-agent {"dependsOn": "interface", "hash": "7034e4452cc668449b0b967116683a95303c4509d263ed535851b081164751bb"}
	// @cursor-agent {"dependsOn": "testPlan", "hash": "2090cb75b222cb54f3319ec6bd2455703427a3a478979e3b3258aed0a969280f"}
	// @cursor-agent {"id": "T14"}
	it('should correctly handle a list of outputs with only one output', async () => {
		const outputCatcher = NewOutputCatcher<string>();
		const output = 'Test Output';

		await outputCatcher.onOutput(output);

		const firstOutput = outputCatcher.getOutput();

		expect(firstOutput).toBe(output);
	});
	// @cursor-agent:test-end:T14



	// @cursor-agent:test-begin:T13
	// @cursor-agent {"dependsOn": "interface", "hash": "7034e4452cc668449b0b967116683a95303c4509d263ed535851b081164751bb"}
	// @cursor-agent {"dependsOn": "testPlan", "hash": "30937a9d8dcb8df28feecd5c7e3b204b04e93c4f26e3b3a61c51578bbc201231"}
	// @cursor-agent {"id": "T13"}
	it('should handle a list of outputs with multiple outputs with no priority correctly', async () => {
		const outputCatcher = NewOutputCatcher<string>();

		// Add outputs with no priority
		await outputCatcher.onOutput('output1');
		await outputCatcher.onOutput('output2');
		await outputCatcher.onOutput('output3');

		// Add outputs with priority
		await outputCatcher.onOutput('output4', { p: 1 });
		await outputCatcher.onOutput('output5', { p: 2 });

		const outputs = outputCatcher.getOutputs();

		// Check that the outputs with priority are at the beginning of the list
		expect(outputs[0]).toBe('output5');
		expect(outputs[1]).toBe('output4');

		// Check that the outputs with no priority are in the order they were added
		expect(outputs[2]).toBe('output1');
		expect(outputs[3]).toBe('output2');
		expect(outputs[4]).toBe('output3');
	});
	// @cursor-agent:test-end:T13






	// @cursor-agent:test-begin:T12
	// @cursor-agent {"dependsOn": "interface", "hash": "7034e4452cc668449b0b967116683a95303c4509d263ed535851b081164751bb"}
	// @cursor-agent {"dependsOn": "testPlan", "hash": "2da0899bc14155cb0b63a83c0a8648d540232eb11e1d253f97739432a152fbdd"}
	// @cursor-agent {"id": "T12"}
	it('should correctly handle a list of outputs with multiple outputs with different priorities', async () => {
		const outputCatcher = NewOutputCatcher<string>();

		await outputCatcher.onOutput('output1', { p: 2 });
		await outputCatcher.onOutput('output2', { p: 1 });
		await outputCatcher.onOutput('output3', { p: 3 });
		await outputCatcher.onOutput('output4');

		const outputs = outputCatcher.getOutputs();

		expect(outputs).toEqual(['output3', 'output1', 'output2', 'output4']);
	});
	// @cursor-agent:test-end:T12









	// @cursor-agent:test-begin:T11
	// @cursor-agent {"dependsOn": "interface", "hash": "7034e4452cc668449b0b967116683a95303c4509d263ed535851b081164751bb"}
	// @cursor-agent {"dependsOn": "testPlan", "hash": "2ba7dc9f2ce28f32e9ba4a145c6cd71a54b533561b7b422883a75ea0d212b106"}
	// @cursor-agent {"id": "T11"}
	it('should correctly handle a list of outputs with multiple outputs with the same priority', async () => {
		const outputCatcher = NewOutputCatcher<string>();

		await outputCatcher.onOutput('output1', { p: 1 });
		await outputCatcher.onOutput('output2', { p: 2 });
		await outputCatcher.onOutput('output3', { p: 2 });
		await outputCatcher.onOutput('output4', { p: 1 });

		const outputs = outputCatcher.getOutputs();

		expect(outputs).toEqual(['output2', 'output3', 'output1', 'output4']);
	});
	// @cursor-agent:test-end:T11









	// @cursor-agent:test-begin:T10
	// @cursor-agent {"dependsOn": "interface", "hash": "7034e4452cc668449b0b967116683a95303c4509d263ed535851b081164751bb"}
	// @cursor-agent {"dependsOn": "testPlan", "hash": "9647f55c33afc9626a08bb5bc9fc3ad3bff2a12769f2440bda746c0636cbea43"}
	// @cursor-agent {"id": "T10"}
	it('should correctly handle a list of outputs with only one output', async () => {
		const outputCatcher = NewOutputCatcher<string>();
		const output = 'Test Output';
		await outputCatcher.onOutput(output);

		const outputs = outputCatcher.getOutputs();
		expect(outputs).toHaveLength(1);
		expect(outputs[0]).toBe(output);
	});
	// @cursor-agent:test-end:T10









	// @cursor-agent:test-begin:T09
	// @cursor-agent {"dependsOn": "interface", "hash": "7034e4452cc668449b0b967116683a95303c4509d263ed535851b081164751bb"}
	// @cursor-agent {"dependsOn": "testPlan", "hash": "8c28351285c444e37a7251e9722b474d8e3f86290a1bc53c762f8504603c0438"}
	// @cursor-agent {"id": "T09"}
	it('should handle an empty list of outputs correctly', async () => {
		const outputCatcher = NewOutputCatcher<string>();
		const outputs = outputCatcher.getOutputs();
		expect(outputs).toEqual([]);
	});
	// @cursor-agent:test-end:T09






	// @cursor-agent:test-begin:T08
	// @cursor-agent {"dependsOn": "interface", "hash": "7034e4452cc668449b0b967116683a95303c4509d263ed535851b081164751bb"}
	// @cursor-agent {"dependsOn": "testPlan", "hash": "8ed95684475af78a10deba0840d25230f1242f8745c7eb53ed1476ce2c8a1f44"}
	// @cursor-agent {"id": "T08"}
	it('should correctly handle multiple outputs with no priority', async () => {
		const outputCatcher = NewOutputCatcher<string>();

		await outputCatcher.onOutput('output1');
		await outputCatcher.onOutput('output2');
		await outputCatcher.onOutput('output3');

		const outputs = outputCatcher.getOutputs();

		expect(outputs).toEqual(['output1', 'output2', 'output3']);
	});
	// @cursor-agent:test-end:T08






	// @cursor-agent:test-begin:T07
	// @cursor-agent {"dependsOn": "interface", "hash": "7034e4452cc668449b0b967116683a95303c4509d263ed535851b081164751bb"}
	// @cursor-agent {"dependsOn": "testPlan", "hash": "ced51a023776d7532a37bf3d5ea669fe80508a21326c932163dde56fa6ddb5ef"}
	// @cursor-agent {"id": "T07"}
	it('should correctly handle multiple outputs with different priorities', async () => {
		const outputCatcher = NewOutputCatcher<string>();

		await outputCatcher.onOutput('output1', { p: 2 });
		await outputCatcher.onOutput('output2', { p: 1 });
		await outputCatcher.onOutput('output3', { p: 3 });

		const outputs = outputCatcher.getOutputs();

		expect(outputs).toEqual(['output3', 'output1', 'output2']);
	});
	// @cursor-agent:test-end:T07






	// @cursor-agent:test-begin:T06
	// @cursor-agent {"dependsOn": "interface", "hash": "7034e4452cc668449b0b967116683a95303c4509d263ed535851b081164751bb"}
	// @cursor-agent {"dependsOn": "testPlan", "hash": "743746ca04d5b14b5e90f25c21d1adc87b7ea4d7d205c6899ca6143455869567"}
	// @cursor-agent {"id": "T06"}
	it('should correctly handle multiple outputs with the same priority', async () => {
		const outputCatcher = NewOutputCatcher<string>();

		await outputCatcher.onOutput('output1', { p: 1 });
		await outputCatcher.onOutput('output2', { p: 1 });
		await outputCatcher.onOutput('output3', { p: 1 });

		const outputs = outputCatcher.getOutputs();

		expect(outputs).toEqual(['output1', 'output2', 'output3']);
	});
	// @cursor-agent:test-end:T06






	// @cursor-agent:test-begin:T05
	// @cursor-agent {"dependsOn": "interface", "hash": "7034e4452cc668449b0b967116683a95303c4509d263ed535851b081164751bb"}
	// @cursor-agent {"dependsOn": "testPlan", "hash": "1cadfdeb3fd039e28d5ba302889d5f6e82f5504439e9fa7dcfa7bc81d1e42538"}
	// @cursor-agent {"id": "T05"}
	it('should return undefined if there are no outputs in the list', async () => {
		const outputCatcher = NewOutputCatcher<string>();
		const output = outputCatcher.getOutput();
		expect(output).toBeUndefined();
	});
	// @cursor-agent:test-end:T05






	// @cursor-agent:test-begin:T04
	// @cursor-agent {"dependsOn": "interface", "hash": "7034e4452cc668449b0b967116683a95303c4509d263ed535851b081164751bb"}
	// @cursor-agent {"dependsOn": "testPlan", "hash": "a8944d34a7042b9cc995a1f9b4ffe600dd75484c5a5eff540737872a25994be3"}
	// @cursor-agent {"id": "T04"}
	it('should return the first output in the list when getOutput is called', async () => {
		const outputCatcher = NewOutputCatcher<string>();
		await outputCatcher.onOutput('Test1', { p: 1 });
		await outputCatcher.onOutput('Test2', { p: 2 });
		await outputCatcher.onOutput('Test3', { p: 3 });

		const firstOutput = outputCatcher.getOutput();
		const outputs = outputCatcher.getOutputs();
		expect(firstOutput).toBe(outputs[0]);
	});
	// @cursor-agent:test-end:T04






	// @cursor-agent:test-begin:T03
	// @cursor-agent {"dependsOn": "interface", "hash": "7034e4452cc668449b0b967116683a95303c4509d263ed535851b081164751bb"}
	// @cursor-agent {"dependsOn": "testPlan", "hash": "d7a293c66b50c2f6ba6f251d1e49b9ac66d734199f4ea918e1e7305dc3140c54"}
	// @cursor-agent {"id": "T03"}
	it('should return a list of outputs in the correct order', async () => {
		const outputCatcher = NewOutputCatcher<string>();

		await outputCatcher.onOutput('output1', { p: 2 });
		await outputCatcher.onOutput('output2');
		await outputCatcher.onOutput('output3', { p: 3 });
		await outputCatcher.onOutput('output4');

		const outputs = outputCatcher.getOutputs();

		expect(outputs).toEqual(['output3', 'output1', 'output2', 'output4']);
	});
	// @cursor-agent:test-end:T03






	// @cursor-agent:test-begin:T02
	// @cursor-agent {"dependsOn": "interface", "hash": "7034e4452cc668449b0b967116683a95303c4509d263ed535851b081164751bb"}
	// @cursor-agent {"dependsOn": "testPlan", "hash": "73c6b3f085b811b0f52b5651fe76b6e10a8cb3f92000cb916f2873d1932c26b7"}
	// @cursor-agent {"id": "T02"}
	it('should correctly add an output with a priority to the list of outputs', async () => {
		const outputCatcher = NewOutputCatcher<string>();
		const output = 'Test Output';
		const priority = 5;

		await outputCatcher.onOutput(output, { p: priority });

		const outputs = outputCatcher.getOutputs();
		expect(outputs).toContain(output);

		const firstOutput = outputCatcher.getOutput();
		expect(firstOutput).toBe(output);
	});
	// @cursor-agent:test-end:T02






	// @cursor-agent:test-begin:T01
	// @cursor-agent {"dependsOn": "interface", "hash": "7034e4452cc668449b0b967116683a95303c4509d263ed535851b081164751bb"}
	// @cursor-agent {"dependsOn": "testPlan", "hash": "6c19bf21fe639eaa6f3404b1a3087f9e94d29bbd8abe44c027087b0bf88d9ad0"}
	// @cursor-agent {"id": "T01"}
	it('should correctly add an output with no priority to the list of outputs', async () => {
		const outputCatcher = NewOutputCatcher<string>();
		const output = 'Test Output';

		await outputCatcher.onOutput(output);

		const outputs = outputCatcher.getOutputs();
		expect(outputs).toContain(output);
	});
	// @cursor-agent:test-end:T01




})

