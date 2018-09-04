const dgram = require('dgram');
const cp = require("child_process");
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
 * Initialization parameters
 * move to params
 */
const MAX_CLIENTS=2;

const node={
	name:"Relay Node 1",
	port:4423,
	address:'127.0.10.1',
	nodeType:'RELAY_NODE',
	pubKey:null,
	privKey:null,
};

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

let relays = [{
	nodeType:'RELAY_NODE',
	address:'127.0.10.3',
	port:4424,
},{
	nodeType:'EXIT_NODE',
	address:'127.0.20.1',
	port:4424,
}]

let channels = [];

const server = dgram.createSocket('udp4');


const init = () => server.bind(node.port,node.address);

const getClientChannel = (address) => {
	return channels.find(c=>c.client.rInfo.address === address);
};

const getServerChannel = (address) => {
	return channels.find(c=>c.server.rInfo.address === address);
};

const replyReject = (msg,rInfo) =>{
	console.log(`Rejected with ${msg}`);
	let reply=encode({type:msg});
	transporter.sendUntrackedUDPMessage(server,reply,rInfo)
}

const replyAcceptDiscovery = (_client,_server) => {
	let _date = (new Date()).toJSON();
	_server.msg  = decode(_server.msg);
	let {type,...path} = _server.msg;

	let reply = encode({
		type: RT.ACCEPT,
		pubKey: node.pubKey,
		_date,
		nodeType:node.nodeType,
		rInfo:server.address(),
		path,
	});

	transporter.sendUntrackedUDPMessage(server,reply,_client.rInfo)
	.then(() => {
		//overwrites previous client record
		console.log("Registering client");
		relays[_client.rInfo.address] = {
			nodeType:"CLIENT_NODE",
			address:_client.rInfo.address,
			port:_client.rInfo.port,
		}
		
		let {type,...cm} = _client.msg;
		channels.push({
			_date,
			id:channels.length+1,
			client:{...cm,rInfo:_client.rInfo},
			server:{...path,rInfo:_server.rInfo}
		})
	})
}

const discoverNextNode = (n,hops) => {
	let msg = encode({
		type:RT.DISCOVER,
		pubKey:node.pubKey,
		hops:hops,
	});
	let htype = hops === 0 ? "EXIT_NODE":"RELAY_NODE";
	let _relays =  relays.filter(r=>r.nodeType===htype);

	console.log(`Searching for ${hops>0?'next '+htype:htype} connection\n`);
	return transporter.promiseTimeout(
		transporter.sendUDPMessage(server,msg,_relays[n]),
		relay_timeout
	)
	.catch(err=>{
		n++;
		if (_relays[n]) {
			discoverNextNode(n,hops,cb)
		} else
			console.log("Request timed out");
			// no reply back to client
			cb("request timed out");
	})
}

const handleDiscovery = (msg,rInfo) => {
	let clients = relays.filter(r=>r.nodeType === "CLIENT_NODE");
	if (clients.length >= MAX_CLIENTS) {
		return replyReject(RT.MAX,rInfo);
	}
	let hops = msg.hops ? parseInt(msg.hops)-1 : 0;
	
	discoverNextNode(0,hops).then(res=>{
		// call with client {msg,rInfo} and server{msg,rInfo}
		let clientparams={msg:msg,rInfo:rInfo};
		replyAcceptDiscovery(clientparams,res);
	}).catch(err=>{
		console.log('No nodes found in time. Dropping request');
		replyReject(RT.NO_FURTHER,rInfo);
	});

}



const dispatchRequest = (data,nextHop,rInfo) => {
	data = encode(data);
	return transporter.promiseTimeout(
		transporter.sendUntrackedUDPMessage(server,data,nextHop.rInfo)
	)
	.then(()=>{console.log("sent")})
	.catch(err=>{
		replyReject(RT.NO_FURTHER,rInfo);
	})
}

const handleResponse = (msg,rInfo) => {
	packer.unpack(msg.data,node.privKey,(err,data) => {
		if (err) {
			console.log("Decrypt failed",err)
		} else {
			console.log("Message decyphered")
			
			channel = getServerChannel(rInfo.address);
			if (!channel) {
				replyReject(RT.NO_FURTHER)
			} else {
				console.log("Replying requester...",channel.client.rInfo.address)
				data = packer.pack(data,channel.client);
				dispatchRequest({
					type:RT.RESPONSE,
					data,
					seq:msg.seq
				},channel.client,rInfo)
			}
		}
		
	});
}

const handleRequest = (msg,rInfo) => {
	packer.unpack(msg.data,node.privKey,(err,msg) => {
		if (err) {
			console.log("Decrypt failed",err)
		} else {
			console.log("Message decyphered")
			console.log("Forwarding to next hop...")
			
			channel = getClientChannel(rInfo.address);
			
			if (!channel) {
				replyReject(RT.NO_FURTHER)
			} else {
				let data = packer.pack(msg,channel.server);
				dispatchRequest({type:RT.REQUEST,data},channel.server,rInfo)
			}
		}
		
	});
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
})

server.on('listening', () => {
	let address = server.address();
	console.log(`\n${node.name} is live::Listening on ${address.address}:${address.port}`);
	console.log('-------------------------------------------------');
})

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
		case RT.RESPONSE:
			handleResponse(msg,rInfo);
			break;
		default:
			break;
				
	}
	
});



