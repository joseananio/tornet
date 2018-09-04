const dgram = require('dgram');
const url = require('url');
const flatted = require('flatted');
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


const HOPS=1;
const discovery_timeout = HOPS * relay_timeout;

const node={
	name: 'Entry Node 1',
	address: '127.0.1.1',
	port:5525,
	pubKey:'',
	privKey:'',
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
});
let buffer = {};

let relays = [{
	address: '127.0.10.1',
	port: 4423,
	requestKey:1,
	pubKey:'',
	active:false,
},{
	address: '127.0.10.2',
	port: 4423,
	requestKey:1,
	pubKey:'',
	active:false,
}];

let route={
	data:{},
	nextHop:()=>{let {path,...others} = route.data; return others}
}

const client = dgram.createSocket('udp4');;

const init = () => client.bind(node.port);

const bufferData = (data,rInfo) => {
	packer.unpack(data,node.privKey,(err,res) => {
		if (err) {
			console.log("cannot decypher message");
			return
		}
		if (buffer[rInfo.address]) {
			buffer[rInfo.address] += res;
		} else {
			buffer[rInfo.address] = res;
		}
	})
}

const retrieveBuffer = (rInfo) => {
	let buff = buffer[rInfo.address];
	return buff ;
}

const clearBuffer = (rInfo) => {
	buffer[rInfo.address] = undefined;
	delete buffer[rInfo.address];
}

const handleRelayAccepted = (msg,rInfo) =>{
	relays = relays.map(r=>{
		if (r.address == rInfo.address && msg.pubKey) {
			r.active = true;
			r.pubKey = msg.pubKey;
			console.log(`New Relay Connection: ${rInfo.address}`);
			route.data = msg;
			/*
			console.log(msg)
			let d = packer.pack(encode({url:'http://localhost'}),route.nextHop())
			setTimeout(()=>{
				console.log('send')
				sendUDP({type:RT.REQUEST,data:d},(err)=>{
					if (err) {
						console.log(err)
					}
				});
				setTimeout(()=>{
					sendUDP({type:RT.REQUEST,data:d},(err)=>{
					if (err) {
						console.log(err)
					}
				});
				},3000)
				
			},2000)*/
		} else {
			r.active = false;
		}
		return r;
	});
}

const getActiveRelay = () => {
	return relays.find(r=>r.active);
}

const sendUDP = (data,cb)=>{
	let req = packer.pack(encode(data),route.nextHop())
	req = {type:RT.REQUEST,data:req}
	console.log('sending',req)
	let message= encode( req );
	if (!getActiveRelay()) {
		cb("no relay");
		return;
	}
	transporter.promiseTimeout(
		transporter.sendUntrackedUDPMessage(client,message,getActiveRelay())
	)
	.then((res)=>{
		console.log('pre',retrieveBuffer(getActiveRelay()))
		let timeout = 0;
		let intv = setInterval(()=>{
			if (timeout === 2) {
				clearInterval(intv);
				cb("timeout");
			} else {
				let buff = retrieveBuffer(getActiveRelay());
				try {
					data = decode(buff);
					clearBuffer(getActiveRelay);
					// console.log('i have',buff)
					cb(null,data);
				} catch(er) {
					//still buffering
				}
				timeout++;
			}
		},10);
	})
	.catch(err=>{
		console.log(err)
		cb("request timed out");
	})
	
};

const connectRelay = (n,cb) => {
	let msg = flatted.stringify({
		type:RT.DISCOVER,
		pubKey:node.pubKey,
		hops:HOPS,
	});
	console.log("Searching for relay connection\n");
		transporter.promiseTimeout(
			transporter.sendUntrackedUDPMessage(client,msg,relays[n]),
			discovery_timeout
		)
		.then((res)=>{
			// msgHandler(res);
			cb(null);
		})
		.catch(err=>{
			console.log(n)
			n++;
			if (relays[n] && !getActiveRelay()) {
				connectRelay(n,cb)
			} else
				cb(err);
		})
		

}

const msgHandler = (res) => {
	let msg=decode(res.msg);
	let rInfo=res.rInfo;
	console.log(`${node.name}: received message from relay ${rInfo.address}:${rInfo.port}`);
	
	switch(msg.type){
		case RT.ACCEPT:
			handleRelayAccepted(msg,rInfo);
			break;
		case RT.MAX:
			console.log(`Relay says: ${msg.type}`);
			throw RT.MAX;
			break;
		case RT.NO_FURTHER:
			console.log(`Relay says: ${msg.type}`);
			throw msg.type;
		case RT.RESPONSE:
			bufferData(msg.data,rInfo)
			if (msg.seq === null) {
				data = retrieveBuffer(rInfo)
				// console.log('full',data)
			}
			break;
		default:
			console.log('ukn response',msg)

	}
	/*
		data += msg.toString();
		try{
			cb(null,flatted.parse(data));
			// console.log('parsed',flatted.parse(data))
			data='';
		} catch(e){
			console.log('on:',_req.url)
			console.log('UDP incomplete',typeof(data))
		}*/
		
}

const closeUDP = () => {
	console.log(`${node.name}: connection closed`);
	client.close();
}

client.on('listening',()=>{
	let address = client.address();
	console.log(`\n${node.name} is live::Listening on ${address.address}:${address.port}`);
	console.log('------------------------------------------------')
	if (!getActiveRelay()) 
	connectRelay(0,(err)=>{
		if (err) {
			console.log("Relay connection failed:",err);
			closeUDP();
		}
	})
});

client.on('error', (err) => {
	console.log(`${node.name}: error: \n${err.stack}`)
});


client.on('message',(msg,rInfo)=>{
	msgHandler({msg:msg,rInfo})
})
	

/*
 * test
let m = Buffer.from('hello relay');
sendUDP(m);
setTimeout(()=>{
	closeUDP();
},3000)
*/


module.exports = {
	sendUDP,
	closeUDP,
}