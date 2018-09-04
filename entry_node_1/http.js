const http = require('http');
const url = require('url');
const client = require('./index.js');

const soc = {
	name:'Entry Node 1 HTTPServer',
	address: '0.0.0.0',
	port: 8080,
}
let dests = [];

function parseUrl(req) {

	let ret={uri:'',port:80};
	let url = req.url.substring(1);
	if(url.indexOf('?') === 0 ) {
		url = url.substring(1)
	} else {
		let buf_ret = dests[req.connection.remoteAddress];
		if (buf_ret) {
			ret = buf_ret;
			ret.uri=url
			console.log('static resource:',buf_ret)
			ret.headers=req.headers;
			delete ret.headers.referrer;
			delete ret.headers.host;
			return ret;
		}
		return null;
	}
	/*t = url.split('://',2);
	ret.scheme=t.length == 2 ? t[0]:'http';
	console.log(ret.scheme)*/
	url.split('&').forEach((val) => {
		let a = val.split('=');
		if (a.length == 2) {
			if (a[0] == 'url') {
				if (a[1].indexOf(':') !== -1) {
					let b = a[1].split(':')
					ret.ip=b[0];
					if (b.length == 2) {
						let c=b[1].split('/',2);
						ret.port = c[0];
						if (c.length==2) {
							ret.uri = '/'+c[1];
						}
					}
				} else {
					ret.port='80';
					let b = a[1].split('/',2);
					ret.ip = b[0];
					if (b.length==2) {
						ret.uri = '/'+b[1]
					}
				}
			} else {
				ret[a[0]] = a[1];
				
			}
		}
	});
	return ret;
}

const prepRequest = (_req) => {
	let path = url.parse(_req.url)
	if (!path) {
		return false;
	}
	path = path.query.split('&').find(p=>p.indexOf('url=')==0).substring(4)
	if (path.indexOf('http') !==0) {
		path = 'http://'+path;
	}
	return {url:path}
	/*let req = parseUrl(_req);

	if(req) {
		dests[_req.connection.remoteAddress] = req;
	}
	if (!req) {
		cb(`${node.name} cannot process url: "${_req.url}"`);
		return;
	}
	req.method='GET';
	req.type="REQUEST";
	return req;*/
}
const server = http.createServer((req,res)=>{
	let _req = prepRequest(req);
	if (_req) {
		client.sendUDP(_req,(err,msg)=>{
			console.log('http mes',msg)
			if (err) {
				res.write(`${soc.name}: ${err}`);
				console.log(`${soc.name} failed response`, err);
			} else {
				// res.writeHeader(msg.statusCode,msg.headers)
				res.write(msg.data);
				console.log(`${soc.name} response returned`);
			}
			// client.closeUDP();
			res.end();
		});

	} else console.log('req'+req.url+'not fetched')
});

server.listen(soc.port,soc.address,()=>{
	let a = server.address();
	console.log(`${soc.name}: listening on: ${a.address}:${a.port}`);
});
server.on('error',err=>{
	console.log(`${soc.name} error`,err);
	throw err;
});
