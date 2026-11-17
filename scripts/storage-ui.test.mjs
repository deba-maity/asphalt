import test from 'node:test';
import assert from 'node:assert/strict';
import {storage} from '../src/storage.js';
import {UI} from '../src/ui.js';

test('blocked or full browser storage preserves usable settings in memory',()=>{
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem(){throw Error('Blocked');},setItem(){throw Error('Full');},removeItem(){throw Error('Blocked');}}});
  try{
    storage.setItem('contract-setting',30);assert.equal(storage.getItem('contract-setting'),'30');
    storage.removeItem('contract-setting');assert.equal(storage.getItem('contract-setting'),null);
  }finally{if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else delete globalThis.localStorage;}
});
test('lobby names and vehicle labels escape markup; color cannot inject style attributes',()=>{
  const html=UI.prototype.playerSlots([{name:'<img src=x onerror=alert(1)>',vehicle:'<script>bad()</script>',color:'red;position:fixed" onclick="bad()'}]);
  assert(!html.includes('<img'));assert(!html.includes('<script>'));assert(!html.includes('position:fixed'));
  assert(html.includes('&lt;img'));assert(html.includes('--color:#ffffff'));
});

test('failed replacement and deletion take priority over stale stored values',()=>{
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  const disk=new Map([['quota-setting','old']]);let writable=false;
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{
    getItem(key){return disk.get(key)??null;},
    setItem(key,value){if(!writable)throw Error('Full');disk.set(key,value);},
    removeItem(key){if(!writable)throw Error('Blocked');disk.delete(key);},
  }});
  try{
    assert.equal(storage.getItem('quota-setting'),'old');
    storage.setItem('quota-setting','new');assert.equal(storage.getItem('quota-setting'),'new');
    assert.equal(disk.get('quota-setting'),'old');
    storage.removeItem('quota-setting');assert.equal(storage.getItem('quota-setting'),null);
    writable=true;storage.setItem('quota-setting','recovered');
    assert.equal(storage.getItem('quota-setting'),'recovered');
    disk.set('quota-setting','another-tab');assert.equal(storage.getItem('quota-setting'),'another-tab');
    storage.removeItem('quota-setting');assert.equal(storage.getItem('quota-setting'),null);
  }finally{if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else delete globalThis.localStorage;}
});

test('a guest rematch keeps the result visible while waiting for the host',()=>{
  let requested=false;
  const ui={layer:{innerHTML:'Existing race result'},start(){requested=true;}};
  UI.prototype.action.call(ui,'rematch',{});
  assert(requested);assert.equal(ui.layer.innerHTML,'Existing race result');
});
