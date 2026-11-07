import {Store} from './store.mjs';
import {createApp} from './app.mjs';
const uri=process.env.MONGODB_URI,dbName=process.env.MONGODB_DB||'haitacphucsinh_local';
if(!uri){console.error('Thiếu MONGODB_URI. Xem .env.example và README.md.');process.exit(1)}
const store=new Store(uri,dbName);let server;
try{
 await store.connect();const app=createApp(store);const port=Number(process.env.PORT||4173),host=process.env.HOST||'127.0.0.1';
 server=app.listen(port,host,()=>console.log(`Hải Tặc Phục Sinh đang chạy: http://${host}:${port}\nMongoDB: connected (${dbName})`));
 server.on('error',async e=>{console.error(e.code==='EADDRINUSE'?'Cổng đang được sử dụng. Đổi PORT trong .env.':`Không khởi động được HTTP server: ${e.code||e.name}`);await store.close();process.exit(1)});
}catch(e){console.error(`Không kết nối được MongoDB: ${e.codeName||e.code||e.name}. Kiểm tra URI, quyền database và Atlas Network Access.`);await store.close();process.exit(1)}
let stopping=false;async function stop(){if(stopping)return;stopping=true;server?.close();await store.close();process.exit(0)}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
