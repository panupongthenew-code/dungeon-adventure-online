import { WebSocketServer } from "ws";
import { randomUUID } from "crypto";
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const PORT = Number(process.env.PORT || 3001);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rooms = new Map<string, any>();

const jobs = [
  {name:"Swordsman", hp:35, atk:12},
  {name:"Mage", hp:0, atk:18, crit:.25},
  {name:"Archer", hp:0, atk:15, crit:.18},
  {name:"Acolyte", hp:0, atk:9, heal:18},
  {name:"Merchant", hp:0, atk:8, buy:.8},
  {name:"Thief", hp:0, atk:13, dodge:.22}
];

function cleanPlayer(p:any){ return {id:p.id,name:p.name,job:p.job,cash:p.cash,hp:p.hp,maxhp:p.maxhp,pos:p.pos,level:p.level,exp:p.exp,props:p.props}; }
function send(p:any,obj:any){ if(p.ws.readyState===1)p.ws.send(JSON.stringify(obj)); }
function publicState(room:any){
  return {type:"state",room:room.code,hostId:room.hostId,started:room.started,round:room.round,maxRounds:5,current:room.current,players:[...room.players.values()].map(cleanPlayer)};
}
function broadcast(room:any){ const d=JSON.stringify(publicState(room)); for(const p of room.players.values()) send(p,JSON.parse(d)); }
function createRoom(host:any){
  let code:string; do code=Math.random().toString(36).slice(2,7).toUpperCase(); while(rooms.has(code));
  const room={code,hostId:host.id,started:false,round:1,current:0,players:new Map()};
  rooms.set(code,room);room.players.set(host.id,host);return room;
}
function endRound(room:any){
  if(room.current>=room.players.size){room.current=0;room.round++;}
  if(room.round>5){
    const ranking=[...room.players.values()].sort((a:any,b:any)=>b.cash-a.cash||b.level-a.level);
    const winner=ranking[0];
    for(const p of room.players.values())send(p,{type:"victory",round:5,winnerId:winner.id,winnerName:winner.name,ranking:ranking.map(cleanPlayer)});
    room.started=false;return true;
  }
  return false;
}
function handleRoll(room:any,p:any){
  if(!room.started)return send(p,{type:"error",message:"เกมยังไม่เริ่ม"});
  const list=[...room.players.values()];
  if(list[room.current]?.id!==p.id)return send(p,{type:"error",message:"ยังไม่ใช่เทิร์นของคุณ"});
  const dice=[1,2,3].map(()=>1+Math.floor(Math.random()*6));
  const total=dice.reduce((a,b)=>a+b,0);
  p.pos=(p.pos+total)%28;
  if(p.pos<total)p.cash+=200;
  const j=jobs[p.job];
  if([1,3,5,7,9,11,13,15,17,19,21,23,25,27].includes(p.pos)){
    const monster=20+Math.floor(Math.random()*50);
    const damage=j.atk+Math.floor(Math.random()*12)+(Math.random()<(j.crit||0)?j.atk:0);
    if(damage>=monster){p.cash+=50+monster;p.exp+=35;}else p.hp=Math.max(1,p.hp-(10-Math.min(7,p.level)));
    if(p.exp>=100){p.exp-=100;p.level++;p.maxhp+=10;p.hp=p.maxhp;}
  } else if([2,14,24].includes(p.pos))p.cash+=100;
  else if([4,22].includes(p.pos))p.hp=Math.max(1,p.hp-15);
  else if([8,16,26].includes(p.pos))p.hp=Math.min(p.maxhp,p.hp+25);
  if(p.hp<=1)p.cash=Math.max(0,p.cash-50);
  room.current++;
  if(!endRound(room))broadcast(room);
}

const server=http.createServer((req,res)=>{
  const url=req.url||"/";
  if(url==="/"||url==="/index.html"){
    const file=fs.readFileSync(path.join(__dirname,"index.html"));
    res.writeHead(200,{"content-type":"text/html; charset=utf-8","cache-control":"no-cache"});res.end(file);return;
  }
  if(url==="/health"){res.writeHead(200,{"content-type":"application/json"});res.end(JSON.stringify({ok:true,rooms:rooms.size,maxRounds:5}));return;}
  res.writeHead(404);res.end("Not found");
});
const wss=new WebSocketServer({server});
wss.on("connection",ws=>{
  const p:any={id:randomUUID(),ws,name:"Player",job:0,cash:500,hp:100,maxhp:100,pos:0,level:1,exp:0,props:[]};
  send(p,{type:"hello",id:p.id});
  ws.on("message",raw=>{
    let m:any;try{m=JSON.parse(raw.toString())}catch{return send(p,{type:"error",message:"ข้อมูลไม่ถูกต้อง"})}
    if(m.type==="create"){
      p.name=String(m.name||"Player").slice(0,18);p.job=Math.max(0,Math.min(5,Number(m.job)||0));
      const j=jobs[p.job];p.maxhp+=j.hp;p.hp=p.maxhp;const room=createRoom(p);send(p,{type:"room",code:room.code});broadcast(room);
    }else if(m.type==="join"){
      const room=rooms.get(String(m.code||"").toUpperCase());
      if(!room)return send(p,{type:"error",message:"ไม่พบห้อง"});
      if(room.started)return send(p,{type:"error",message:"เกมเริ่มแล้ว"});
      if(room.players.size>=4)return send(p,{type:"error",message:"ห้องเต็ม"});
      p.name=String(m.name||"Player").slice(0,18);p.job=Math.max(0,Math.min(5,Number(m.job)||0));
      const j=jobs[p.job];p.maxhp+=j.hp;p.hp=p.maxhp;room.players.set(p.id,p);send(p,{type:"room",code:room.code});broadcast(room);
    }else if(m.type==="start"){
      for(const room of rooms.values())if(room.hostId===p.id){
        if(room.players.size<2)return send(p,{type:"error",message:"ต้องมีผู้เล่นอย่างน้อย 2 คน"});
        room.started=true;room.round=1;room.current=0;broadcast(room);
      }
    }else if(m.type==="roll"){
      for(const room of rooms.values())if(room.players.has(p.id))handleRoll(room,p);
    }
  });
  ws.on("close",()=>{
    for(const [code,room] of rooms){
      if(room.players.delete(p.id)){
        if(room.players.size===0)rooms.delete(code);
        else{if(room.hostId===p.id)room.hostId=[...room.players.keys()][0];if(room.current>=room.players.size)room.current=0;broadcast(room);}
      }
    }
  });
});
server.listen(PORT,"0.0.0.0",()=>console.log(`Dungeon Adventure server listening on ${PORT}`));
