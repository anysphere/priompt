import { StatsD } from 'hot-shots';
import { isIP } from 'net';
import dns from 'dns';

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
	udpSocketOptions: { // workaround for https://github.com/brightcove/hot-shots/issues/198
		type: 'udp4',
		lookup: (host, opts, callback) => {
			if (isIP(host)) {
				callback(null, host, 4);
				return;
			}
			dns.lookup(host, opts, callback);
		}
	}
});