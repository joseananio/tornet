const path = require("path");
const NodeRSA = require("node-rsa");
const flatted = require('flatted');
const fs = require('fs');
var assert = require('assert');
var crypto = require('crypto');
const constants = require('constants')
const {key_file} = require('./params');

const {algorithm,inputEncoding,outputEncoding} = key_file;

const keyPath = (type) => path.resolve(__dirname,"keys",type+'.pem');

const getPubKey = (cb) =>{
	fs.readFile(keyPath("public"),(err,fd) => {
		if (err) {
			console.log("FILE Error",err)
		} else
			cb(fd.toString())

	})
}

const getPrivKey = (cb) =>{
	fs.readFile(keyPath("private"),inputEncoding,(err,fd) => {
		if (err) {
			console.log("FILE Error",err)
		} else
			cb(fd.toString())

	})
}


const encode = msg => flatted.stringify(msg);
const decode = msg => flatted.parse(msg.toString());

const getRandomKey = () => Math.random().toString(36).substr(2, 22);

const aes = {
	encrypt: (data,encoding=inputEncoding) => {
		let key = getRandomKey();
		var cipher = crypto.createCipher(algorithm, key);
		var ciphered = cipher.update(data, encoding, outputEncoding);
		ciphered += cipher.final(outputEncoding);
		return {cypher:ciphered,key}
	},
	decrypt: (ciphered, key, encoding=inputEncoding) => {
		var decipher = crypto.createDecipher(algorithm, key);
		var deciphered = decipher.update(ciphered, outputEncoding, inputEncoding);
		deciphered += decipher.final(inputEncoding);
		return deciphered;
	},
	
}
const rsa = {
	// encrypting RSA, using padding OAEP, with nodejs crypto:
	encrypt: (data, pubKey) => {
		let enc = crypto.publicEncrypt({
			key: pubKey,
			padding: crypto.RSA_PKCS1_OAEP_PADDING,
			// padding:constants.RSA_NO_PADDING,
		}, Buffer.from(data));
		return enc.toString("base64");
	},
	// descrypting RSA, using padding OAEP, with nodejs crypto:
	decrypt: (privKey,cypher) => {
		let enc = crypto.privateDecrypt({
			key: privKey,
			padding: crypto.RSA_PKCS1_OAEP_PADDING
		}, Buffer.from(cypher, "base64"));
		return enc.toString();
	},
	test: (pub,priv) =>{
		let msg = "hello";
		let enc = rsa.encrypt(msg,pub);
		let dec = rsa.decrypt(priv,enc);
		assert.equal(dec,msg,"Keys Cannot be used. Clear and regenerate")
	}
}

const packer = {
	pack: (data,route) => {
		let {cypher,key} = aes.encrypt(data);
		let key_code = rsa.encrypt(key,route.pubKey);
		// let cypher_code = rsa.encrypt(cypher,route.pubKey);
		return key_code+'_____'+cypher;
	},
	unpack: (pack,privKey,cb) => {
		try{
			let k = pack.split('_____');
			let key_code = k[0];
			let cypher = k[1];
			// let cypher = rsa.decrypt(privKey,cypher_code);
			let key = rsa.decrypt(privKey,key_code);
			let data = aes.decrypt(cypher,key);
			cb(null,data);
		} catch(err) {
			cb(err);
		}
	}
}


const genKeys = (cb) => {
	fs.access(keyPath("private"),(err)=>{
		if (!err) {
			cb(null);
		} else {
			console.log('Generating new keys...')
			let key = new NodeRSA();
			// 2048 — key length, 65537 open exponent
			key.generateKeyPair(2048, 65537);
			//save keys as pem line in pkcs8
			fs.writeFile(keyPath("private"), key.exportKey("pkcs8-private-pem"),()=>{
				fs.writeFile(keyPath("public"), key.exportKey("pkcs8-public-pem"),()=>{
					cb(null)
				});
			});
		}
	})
}

const verify = (deciphered,data) => assert.equal(deciphered,data,'NOT EQUAL');

module.exports = {
	getPubKey,
	getPrivKey,
	encode,
	decode,
	rsa,
	aes,
	verify,
	genKeys,
	packer,
}