// Isolated asset review in hidden Chromium. Never opens the game/desktop browser.
const {chromium}=require('@playwright/test');
const http=require('http'),fs=require('fs'),path=require('path');
const repo=path.resolve(__dirname,'../..');
const output=path.join(repo,'tools/logs/motion-review');fs.mkdirSync(output,{recursive:true});
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 const base=url.pathname.startsWith('/models/')?path.join(repo,'tools/cache/motion-review'):__dirname;
 const relative=url.pathname.startsWith('/models/')?url.pathname.slice(8):(url.pathname==='/'?'motion-review.html':url.pathname.slice(1));
 const file=path.resolve(base,relative);
 if(!file.startsWith(base+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}
 const ext=path.extname(file);res.setHeader('Content-Type',ext==='.js'?'application/javascript':ext==='.html'?'text/html':'application/octet-stream');
 fs.createReadStream(file).pipe(res);
});
(async()=>{await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{const court=process.argv.includes('--court');const page=await browser.newPage({viewport:court?{width:1280,height:800}:{width:800,height:700}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const character=process.argv.includes('--warden')?'warden':'rayan';
 await page.goto(`http://127.0.0.1:${server.address().port}/${court?'court-review.html':''}?character=${character}`,{timeout:60000});await page.waitForFunction(()=>window.ready,{timeout:90000});
 if(court){for(const angle of [0,1]){await page.evaluate(a=>window.review.sample(a),angle);await page.screenshot({path:path.join(output,'court-'+angle+'.png')});}if(errors.length)throw Error(errors.join('\n'));console.log('Static courtyard reviewed in an independent renderer.');return;}
 const clips=await page.evaluate(()=>window.review.clips);fs.writeFileSync(path.join(output,'clips.json'),JSON.stringify(clips,null,2));
 for(const [name,time] of [['Sword_Idle',.3],['Sword_Regular_A',.267],['Sword_Heavy_A',.49],['Sword_Dash',.33],['Sword_Light_A',.25],['Roll',.65],['Jog_Fwd',.32],['Drink',1.2]]){
  const stats=await page.evaluate(([name,time])=>window.review.sample(name,time),[name,time]);
  await page.screenshot({path:path.join(output,character+'-'+name+'.png')});console.log(character,name,stats);
 }
 if(errors.length)throw Error(errors.join('\n'));
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
