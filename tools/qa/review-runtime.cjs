// Hidden isolated viewer of recorded runtime joints; never starts a game window.
const {chromium}=require('@playwright/test');
const http=require('http'),fs=require('fs'),path=require('path');
const character=process.argv.includes('--warden')?'warden':'rayan';
const repo=path.resolve(__dirname,'../..'),output=path.join(repo,'tools/logs/runtime-review-'+character);
fs.mkdirSync(output,{recursive:true});
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 const base=url.pathname.startsWith('/models/')?path.join(repo,'tools/cache/motion-review'):url.pathname.startsWith('/surfaces/')?path.join(repo,'game/assets/surfaces'):__dirname;
 const relative=url.pathname.startsWith('/surfaces/')?url.pathname.slice(10):url.pathname.startsWith('/models/')?url.pathname.slice(8):(url.pathname==='/'?'runtime-review.html':url.pathname.slice(1));
 const file=path.resolve(base,relative);
 if(!file.startsWith(base+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}
 const ext=path.extname(file);res.setHeader('Content-Type',ext==='.js'?'application/javascript':ext==='.html'?'text/html':'application/octet-stream');fs.createReadStream(file).pipe(res);
});
(async()=>{await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{const page=await browser.newPage({viewport:{width:960,height:720}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}?character=${character}`,{timeout:60000});await page.waitForFunction(()=>window.ready,{timeout:90000});
 const labels=await page.evaluate(()=>[...new Set(window.review.data.frames.map(f=>f.label))]);
 for(const label of labels){
  const index=await page.evaluate(label=>{const frames=window.review.data.frames;const first=frames.findIndex(f=>f.label===label);return first+Math.floor(frames.filter(f=>f.label===label).length*.45);},label);
  await page.evaluate(i=>window.review.sample(i,.65),index);await page.screenshot({path:path.join(output,label.replaceAll(' ','-')+'.png')});
 }
 if(process.argv.includes('--video')){const bytes=await page.evaluate(()=>window.review.video());fs.writeFileSync(path.join(output,'runtime-motion.webm'),Buffer.from(bytes));}
 if(errors.length)throw Error(errors.join('\n'));console.log('Reviewed',labels.length,'runtime action segments; independent renderer.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
