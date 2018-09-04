const http = require('follow-redirects').http;
const request = require('http').request;
var querystring = require('querystring');
Stream = require('stream').Transform;

const address = '127.0.0.1';
const port = 8080;
const agents=[];

function storeAgent(agent,key) {
  agents[key]=agent;
}
function getAgent(info,req) {
  let key = info.ip+'_'+req.ip;
  if (!agents[key]) {
    storeAgent(new http.Agent({keepAlive:true}),key);
  }
  return agents[key];
}

function sendRequest(req,info,callback) {
  

 
  http.get(req.url,(res,d)=>{
  	// console.log(res.statusCode);

  	// res.setEncoding('utf8');
	  let rawData = '';
	  res.on('data', (chunk) => { rawData += chunk; });
	  res.on('end', () => {
	    // console.log(rawData)
      let ret = {statusCode:res.statusCode,data:rawData};
      callback(null,ret);
	  });

  }).on('error',(err)=>{
    callback(err);
  	// throw err;
  }).on('socket',(socket)=>{
    // console.log(socket)
  })

}

module.exports = {
	sendRequest,
}