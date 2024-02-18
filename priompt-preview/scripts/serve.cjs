#!/usr/bin/env node
/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-var-requires */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url'); // Added this line

const port = process.env.PRIOMPT_PREVIEW_PORT || 6283;
const server_port = process.env.PRIOMPT_PREVIEW_SERVER_PORT;
if (!server_port) {
	console.error('PRIOMPT_PREVIEW_SERVER_PORT is not set. it needs to be set of the port where the priompt server is run');
	process.exit(1);
}
const distPath = path.join(path.dirname(__dirname), 'dist');

const requestListener = (req, res) => {
	const parsedUrl = url.parse(req.url); // Parse the URL
	const filePath = path.join(distPath, parsedUrl.pathname === '/' ? 'index.html' : parsedUrl.pathname); // Use parsedUrl.pathname instead of req.url
	const extname = String(path.extname(filePath)).toLowerCase();
	const mimeTypes = {
		'.html': 'text/html',
		'.js': 'application/javascript',
		'.css': 'text/css',
		'.jpg': 'image/jpeg',
		'.jpeg': 'image/jpeg',
		'.png': 'image/png',
		'.gif': 'image/gif',
		'.svg': 'image/svg+xml',
		// Add more MIME types if needed
	};

	const contentType = mimeTypes[extname] || 'application/octet-stream';

	fs.readFile(filePath, (err, data) => {
		if (err) {
			if (err.code === 'ENOENT') {
				res.writeHead(404);
				res.end('Not found');
			} else {
				res.writeHead(500);
				res.end('Error loading file');
			}
		} else {
			res.writeHead(200, { 'Content-Type': contentType });
			// check if can convert to string
			if (data.toString().includes('localhost:3000')) {
				data = data.toString().replace(/localhost:3000/g, `localhost:${server_port}`);
			}
			if (process.env.PRIOMPT_PREVIEW_MODELS) {
				const models = process.env.PRIOMPT_PREVIEW_MODELS.split(',');
				data = data.toString().replace(/gpt-3.5-turbo,gpt-4,gpt-4-32k/, models);
			}
			if (process.env.PRIOMPT_PREVIEW_COMPLETION_MODELS) {
				const completionModels = process.env.PRIOMPT_PREVIEW_COMPLETION_MODELS.split(',');
				data = data.toString().replace(/text-davinci-003,code-davinci-002/, completionModels);
			}

			if ((extname === '.html' || extname === '.js') && data.toString().includes('PRIOMPT_PREVIEW_OPENAI_KEY')) {
				data = data.toString().replace(/PRIOMPT_PREVIEW_OPENAI_KEY/g, `${process.env.PRIOMPT_PREVIEW_OPENAI_KEY}`);
			}
			if ((extname === '.html' || extname === '.js') && data.toString().includes('PRIOMPT_PREVIEW_OSS_ENDPOINTS_JSON_STRING')) {
				data = data.toString().replace(/PRIOMPT_PREVIEW_OSS_ENDPOINTS_JSON_STRING/g, `${process.env.PRIOMPT_PREVIEW_OSS_ENDPOINTS_JSON_STRING ?? "PRIOMPT_PREVIEW_OSS_ENDPOINTS_JSON_STRING"}`);
			}
			res.end(data);
		}
	});
};

const server = http.createServer(requestListener);
server.listen(port, () => {
	console.log(`Server is running on http://localhost:${port}`);
});
