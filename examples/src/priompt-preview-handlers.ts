import { FastifyInstance } from 'fastify';
import { PreviewManager, PreviewManagerGetPromptQuery } from 'priompt';
import { PreviewManagerLiveModeQuery, PreviewManagerLiveModeResultQuery } from 'priompt/dist/preview';


export async function handlePriomptPreview(S: FastifyInstance) {
	S.get("/priompt/getPreviews", async (_, reply) => {
		return reply.type("text/json").send(JSON.stringify(PreviewManager.getPreviews()));
	});

	S.get('/priompt/getPrompt', (request, reply) => {
		const query = request.query as PreviewManagerGetPromptQuery;
		return reply.type("text/json").send(JSON.stringify(PreviewManager.getPrompt(query)));
	});

	S.get('/priompt/liveMode', async (request, reply) => {
		const query = request.query as PreviewManagerLiveModeQuery;

		try {
			const output = await PreviewManager.liveMode(query)
			await reply.type("text/json").send(JSON.stringify(output));
		} catch (error) {
			if (error.name === 'AbortError') {
				return reply.status(500).send({ error: 'Request aborted' });
			} else {
				throw error;
			}
		}
	});
	S.get("/priompt/liveModeResult", (request, reply) => {
		const query = request.query as PreviewManagerLiveModeResultQuery;
		PreviewManager.liveModeResult(query);
		return reply.type("text/json").send(JSON.stringify({}));
	});

}