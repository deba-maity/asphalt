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
