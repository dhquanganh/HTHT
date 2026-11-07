import {writeFileSync,existsSync} from 'node:fs';
if(existsSync('.env')){console.log('Local environment already exists; retained.');process.exit(0)}
const raw=await new Promise((resolve,reject)=>{let value='';const terminal=process.stdin.isTTY;const receive=chunk=>{value+=chunk;if(value.includes('\u0003'))process.exit(130);if(value.includes('\n')||value.includes('\r')){process.stdin.removeListener('data',receive);if(terminal)process.stdin.setRawMode(false);process.stdin.pause();resolve(value.trim())}};if(terminal)process.stdin.setRawMode(true);process.stderr.write('Ready for local configuration JSON (input hidden).\n');process.stdin.setEncoding('utf8');process.stdin.on('data',receive);process.stdin.resume()});
let config;try{config=JSON.parse(raw)}catch{throw Error('Invalid local configuration')}
if(typeof config.mongoUri!=='string'||!config.mongoUri.startsWith('mongodb+srv://')||/[\r\n]/.test(config.mongoUri))throw Error('Invalid MongoDB configuration');
writeFileSync('.env',`MONGODB_URI=${config.mongoUri}\nMONGODB_DB=haitacphucsinh_local\nHOST=127.0.0.1\nPORT=4173\nNODE_ENV=development\n`,{mode:0o600,flag:'wx'});
console.log('Local MongoDB configuration saved to ignored .env; credentials were not printed.');
