const dgram = require('dgram');
const cp = require("child_process");
const ht = require('./http.js');
const transporter = require("./transporter");
const {	RT,	relay_timeout } = require('./params');
const keyman = require("./keyman");

const {
	encode,
	decode,
	getPubKey,
	getPrivKey,
	rsa,
	aes,
	packer,
	genKeys,
} = keyman;


/**
 * Initialize parameters
 */

const MAX_CLIENTS=2;

const node = {
 	name: "Exit Node 1",
 	address: "127.0.20.1",
 	port:4424,
 	pubKey:null,
 	privKey:null,
	nodeType:'EXIT_NODE',
}

//start
genKeys(()=>{
	getPubKey( (data)=>{
		node.pubKey = data;
		getPrivKey((_data) =>{
			node.privKey = _data;
			rsa.test(data,_data);
			init();
		})
	})
})

const clients = [];

const server = dgram.createSocket('udp4');

const init = () => server.bind(node.port,node.address);

const replyReject = (msg,rInfo) =>{
	console.log(`Rejected with ${msg}`);
	let reply=encode({type:msg});
	transporter.sendUntrackedUDPMessage(server,reply,rInfo)
}

const dispatchRequest = (data,nextHop,rInfo) => {
	data = encode(data);
	return transporter.promiseTimeout(
		transporter.sendUntrackedUDPMessage(server,data,nextHop.rInfo)
	)
	// .then(handleResponse)
	.catch(err=>{
		replyReject(RT.NO_FURTHER,rInfo);
	})
}

const handleDiscovery = (msg,rInfo) => {
	let _date = (new Date()).toJSON();
	if (clients.length>MAX_CLIENTS) {
		return replyReject(RT.MAX,rInfo);
	}
	let reply = encode({
		type: RT.ACCEPT,
		pubKey: node.pubKey,
		_date:_date,
		nodeType:node.nodeType,
		rInfo:server.address(),
		path:null,
	});
	transporter.sendUntrackedUDPMessage(server,reply,rInfo)
	.then(() => {
		//overwrites previous client record
		console.log("Registering client");
		clients[rInfo.address] = {
			pubKey:msg.pubKey,
			_date:_date,
			rInfo:rInfo,
		}
	})
}

server.on('error', (err) => {
	console.log(`${node.name} error: \n ${err}`);
	if(err.code == "EADDRINUSE" || err.errno === "EADDRINUSE"){
		cp.exec("fuser -k "+node.port+"/udp");
		server.close();
		server.bind(node.port,node.address); //debug
	} else {
		server.close();
	}
});

server.on('listening', () => {
	let address = server.address();
	console.log(`\n${node.name} is live::Listening on ${address.address}:${address.port}`);
	console.log('-------------------------------------------------');
});

server.on('message', (msg,rInfo) => {
	msg = decode(msg);
	console.log(`Incoming message from ${rInfo.address}:${rInfo.port}`);
	console.log(msg);

	switch(msg.type){
		case RT.DISCOVER:
			handleDiscovery(msg,rInfo);
			break;
		case RT.REQUEST:
			handleRequest(msg,rInfo);
			break;
		default:
			break;
				
	}
	
});

const handleRequest = (msg,rInfo) => {
	console.log('server rec from ' + rInfo.address + ':' + rInfo.port);
	
	let reply;
	packer.unpack(msg.data,node.privKey,(err,req) => {
		if (err) {
			console.log("Decrypt failed",err)
		} else {
			req = decode(req);
			console.log("received request",req)

			ht.sendRequest(req,rInfo,(err,res)=>{
				if (err) {
					replyReject(RT.REQUEST_ERROR);
					return;
				}
				let client = clients[rInfo.address];

				res = encode(res);

				let sent = 0;
				let size = 500;
				let to_send = [];

				while(sent < res.length){
					to_send.push( res.substring(sent,size+sent) );
					sent +=size;
				}
				to_send.forEach((subset,i)=>{
					let seq = to_send.length-1 == i ? null : i;
					let data = packer.pack(subset,client);
					let msg = {type:RT.RESPONSE,data,seq};

					dispatchRequest(msg,client,rInfo).then((status)=>{
						console.log(`reply sent ${subset.length}`);
					});
					
				});
				to_send = [];
				sent=0;
			});
		}
	})
};
