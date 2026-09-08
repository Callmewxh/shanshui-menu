import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {deflateSync} from 'node:zlib';
await mkdir('public/fonts',{recursive:true});
const hash='a3041811a78c361b1de50f953c805e0244951c21c5bd412f7232ef0d899af0da';
let font=await readFile('public/fonts/NotoSansSC.ttf').catch(()=>null);
if(!font){
  const res=await fetch('https://raw.githubusercontent.com/google/fonts/main/ofl/notosanssc/NotoSansSC%5Bwght%5D.ttf',{signal:AbortSignal.timeout(120000)});
  if(!res.ok)throw new Error(`Font download ${res.status}`);font=Buffer.from(await res.arrayBuffer());
}
if(createHash('sha256').update(font).digest('hex')!==hash)throw new Error('Font checksum changed: review before updating pin');
const license=await readFile('public/fonts/OFL.txt');
if(createHash('sha256').update(license).digest('hex')!=='1c05c68c34f9708415aada51f17e1b0092d2cea709bf4a94cd38114f9e73d7d9')throw new Error('Font license checksum mismatch');
await writeFile('public/fonts/NotoSansSC.ttf',font);
// Deterministic synthetic RGB picture: no production photographs or network images.
function crc32(bytes){let crc=0xffffffff;for(const b of bytes){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return(crc^0xffffffff)>>>0;}
function chunk(type,data){const t=Buffer.from(type),length=Buffer.alloc(4),crc=Buffer.alloc(4);length.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([t,data])));return Buffer.concat([length,t,data,crc]);}
const width=320,height=240,raw=Buffer.alloc(height*(width*3+1));
for(let y=0;y<height;y++)for(let x=0;x<width;x++){const inside=((x-160)/120)**2+((y-120)/90)**2<1;const k=y*(width*3+1)+1+x*3;raw[k]=inside?180:246;raw[k+1]=inside?90+Math.floor(x/4):243;raw[k+2]=inside?70:237;}
const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=2;
await writeFile('public/fixture.png',Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]));
console.log('Verified bundled Chinese font + OFL; generated synthetic PNG');
