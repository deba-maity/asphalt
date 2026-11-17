import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,writeFile,unlink} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';

test('LAN development server denies local profiles and artifacts without blocking the game', {timeout:30000}, async()=>{
  const root=process.cwd(), created=[];
  const marker='NIGHTSHIFT_OWNED_PRIVATE_TEST';
  const files=['artifacts/http-contract.txt','chrome-contract-profile/http-contract.txt',
    'edge-contract-profile/http-contract.txt','.env.nightshift-http-contract'];
  let server;
  try {
    for(const file of files){
      const path=resolve(root,file);await mkdir(dirname(path),{recursive:true});
      await writeFile(path,marker,{flag:'wx'});created.push(path);
    }
    server=spawn(process.execPath,['server.js'],{
      env:{...process.env,PORT:'5199',HMR_PORT:'24704',VITE_CACHE_DIR:'node_modules/.vite-http-contract'},
      stdio:'ignore',windowsHide:true,
    });
    const origin='http://127.0.0.1:5199';let ready=false;
    for(let i=0;i<100;i++){
      try{if((await fetch(origin)).ok){ready=true;break;}}catch{}
      await delay(100);
    }
    assert(ready,'Server starts');
    for(const file of files){
      const absolute=resolve(root,file).replaceAll('\\','/');
      for(const path of [`/${file}`,`/@fs/${absolute}`]){
        const response=await fetch(origin+path);
        assert([403,404].includes(response.status),`${path} is private`);
        assert(!(await response.text()).includes(marker),'No private marker in response');
      }
    }
    for(const path of ['/','/src/main.js','/assets/touring/rig.json'])
      assert.equal((await fetch(origin+path)).status,200,`${path} remains available`);
  } finally {
    if(server && server.exitCode===null){
      const closed=new Promise(resolve=>server.once('exit',resolve));server.kill();await closed;
    }
    for(const file of created)await unlink(file);
  }
});
