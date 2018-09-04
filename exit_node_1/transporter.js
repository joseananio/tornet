const sendUDPMessage = (client,message,host) => {
	return new Promise(resolve => {
		client.send(message,0,message.length,host.port,host.address);
		client.on('message',(inMsg,rInfo)=>{
			resolve({msg:inMsg,rInfo:rInfo});
		});
	})
}

const sendUntrackedUDPMessage = (client,message,host) => {
	return new Promise(resolve => {
		client.send(message,0,message.length,host.port,host.address,(err,byte)=>{
			resolve(true)
		});
	})
}

const promiseTimeout = (promise, ms=5000) => {
	const timeoutPromise = new Promise(resolve => {
		const timeout = setTimeout(() => {
			clearTimeout(timeout);
			resolve(false);
		},ms)
	});
	return Promise.race([
		promise,
		timeoutPromise
		]);
}

module.exports={
	promiseTimeout,
	sendUDPMessage,
	sendUntrackedUDPMessage,
};