export default {
	test: {
		include: [
			'src/**/*.{test,spec}.{js,ts,jsx,tsx}',
			// Also include top level files
			'src/*.{test,spec}.{js,ts,jsx,tsx}'
		],
		exclude: ['build/**/*'],
		// setupFiles: ['dotenv/config']
	},
};