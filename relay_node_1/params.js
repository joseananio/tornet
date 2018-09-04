const req_type = {
	MAX: 'MAX',
	DISCOVER:'DISCOVER',
	REQUEST:'REQUEST',
	RESPONSE:'RESPONSE',
	ACCEPT: 'ACCEPT',
	NO_FURTHER:'NO_FURTHER_NODES',
	REQUEST_ERROR:'REQUEST_ERROR',
}
const relay_timeout = 10000;

const key_file = {
	priv:'private.pem',
	pub:'public.pem',
	algorithm: 'aes256',
	inputEncoding: 'utf8',
	outputEncoding: 'hex',
}

module.exports = {
	RT:req_type,
	relay_timeout,
	key_file,
}