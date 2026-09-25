import assert from 'node:assert/strict';
import {classify,flatten} from '../extension/classifier.mjs';
import {organize,restore} from '../extension/engine.mjs';
assert.equal(classify({title:'SLAM robotics',url:'https://github.com/a'}).category,'Research / Robotics');
assert.equal(classify({title:'x',url:'https://github.com.evil.example'}).category,'Development');
assert.equal(classify({title:'Unknown',url:'https://example.com'}).category,'Misc');
assert.equal(flatten([{children:[{unmodifiable:'managed',children:[{id:'x',url:'https://a'}]}]}]).length,0);
function mock(fail=false) {
 const nodes=new Map([['root',{id:'root',children:[]}],['src',{id:'src',title:'Source',parentId:'root',children:[]}]]); let next=0;
 for(let i=0;i<3;i++){ const n={id:String(i),title:'Bookmark '+i,url:'https://example.com/'+i,parentId:'src'}; nodes.set(n.id,n); nodes.get('src').children.push(n.id); }
 const read=id=>{const n=nodes.get(id);if(!n)throw Error('missing');return {...n,index:n.parentId?nodes.get(n.parentId).children.indexOf(id):0};};
 const api={getTree:async()=>[],get:async id=>[read(id)],getChildren:async id=>nodes.get(id).children.map(read),create:async({parentId,title})=>{const n={id:'f'+next++,parentId,title,children:[]};nodes.set(n.id,n);nodes.get(parentId).children.push(n.id);return n;},move:async(id,{parentId,index})=>{if(fail&&id==='1'){fail=false;throw Error('interrupted');}const n=nodes.get(id);const prev=nodes.get(n.parentId).children;prev.splice(prev.indexOf(id),1);const dest=nodes.get(parentId).children;dest.splice(index??dest.length,0,id);n.parentId=parentId;return read(id);}};
 let data={};const storage={get:async key=>({[key]:structuredClone(data[key])}),set:async value=>Object.assign(data,structuredClone(value))};
 return {api,storage,nodes,rows:[0,1,2].map(i=>({...read(String(i)),category:'Development'}))};
}
for(const fail of [false,true]) {const m=mock(fail);try{await organize(m.api,m.storage,m.rows,'root');assert.equal(fail,false);}catch(e){assert.equal(e.message,'interrupted');} const result=await restore(m.api,m.storage);assert.equal(result.conflicts,0);assert.deepEqual(m.nodes.get('src').children,['0','1','2']);assert.equal((await restore(m.api,m.storage)).restored,0);}
{const m=mock(); await organize(m.api,m.storage,m.rows,'root');await assert.rejects(()=>organize(m.api,m.storage,m.rows,'root'));m.nodes.get('0').url='https://changed.example';assert.equal((await restore(m.api,m.storage)).conflicts,1);}
console.log('Passed: classification, managed exclusion, successful move/undo, interrupted recovery, repeated undo, journal protection, changed-URL conflict.');
