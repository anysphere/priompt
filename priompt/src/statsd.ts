import { StatsD } from 'hot-shots';

const statsdHost = (
	process.env.DD_AGENT_HOST !== undefined
		? process.env.DD_AGENT_HOST
		: '127.0.0.1'
);


export const statsd = new StatsD({
	host: statsdHost,
	port: 8125,
	prefix: 'cursor.',
	globalTags: { env: 'prod' },
});