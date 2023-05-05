import { build } from "esbuild";
import glob from "tiny-glob";
import fs from "node:fs";

(async function () {
	const entryPoints = await glob("src/**/*.{ts,tsx}");

	await build({
		entryPoints,
		logLevel: "info",
		outdir: "build",
		bundle: false,
		minify: false,
		platform: "node",
		format: "cjs",
		sourcemap: true,
		plugins: [],
	});

	await renameOutputFiles();
})();

async function renameOutputFiles() {
	const outputFiles = await glob("build/**/*.{tsx.js,tsx.js.map}");

	outputFiles.forEach((file) => {
		const newFileName = file.replace(/\.tsx(\.js(\.map)?)$/, "$1");
		fs.renameSync(file, newFileName);
	});
}