import { realpathSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { installLobby } from './server/lobby.js';

// Node's Windows file watcher expects the long path even when launched from an 8.3 alias.
if (process.platform === 'win32') process.chdir(realpathSync.native(process.cwd()));
// Load the client and file watcher from the same canonical package directory.
const viteEntry = realpathSync.native(fileURLToPath(import.meta.resolve('vite')));
const { createServer: createViteServer } = await import(pathToFileURL(viteEntry));

const port=Number(process.env.PORT||5173);
const hmrPort=Number(process.env.HMR_PORT||24678);
const host=process.argv.includes('--lan')?'0.0.0.0':'127.0.0.1';
// Watch exclusions alone do not prevent HTTP reads. Keep local browser profiles
// and test artifacts private even when the development server is shared on LAN.
const projectRoot=process.cwd().replaceAll('\\','/');
const vite=await createViteServer({
  cacheDir:process.env.VITE_CACHE_DIR||'node_modules/.vite',
  optimizeDeps:{entries:['index.html']},
  server:{middlewareMode:true,hmr:{port:hmrPort,host},
    fs:{deny:['.env','.env.*','*.{crt,pem}','**/.git/**',
      ...['artifacts','chrome-*','edge-*'].map(dir=>`${projectRoot}/${dir}/**`)]},
    watch:{ignored:['**/chrome-*/**','**/edge-*/**','**/artifacts/**']}},
  appType:'spa',
});
const http=createServer((req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','same-origin');
  vite.middlewares(req,res);
});
const {wss}=installLobby(http);
http.listen(port,host,()=>console.log(`NIGHTSHIFT: http://localhost:${port}${host==='0.0.0.0'?' (LAN enabled)':' (local only; use npm run dev:lan for a crew)'}`));
let stopping=false;
async function stop(){
  if(stopping)return;stopping=true;
  for(const ws of wss.clients)ws.terminate();wss.close();
  await vite.close();http.close();
}
process.on('SIGTERM',stop);process.on('SIGINT',stop);
