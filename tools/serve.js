// Enkel lokal server som efterliknar Netlify: /meny -> meny.html, 404.html
const http=require('http'),fs=require('fs'),path=require('path');
const root=require('path').join(__dirname,'..','site');
const port=+process.argv[2]||8765;
const types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.json':'application/json','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2','.ico':'image/x-icon','.webmanifest':'application/manifest+json'};
http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split('?')[0].split('#')[0]);if(u.endsWith('/'))u+='index.html';
let f=path.join(root,u); if(!fs.existsSync(f)&&fs.existsSync(f+'.html')) f+='.html';
if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404,{'content-type':types['.html']});return r.end(fs.readFileSync(root+'/404.html'));}
r.writeHead(200,{'content-type':types[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(r);}).listen(port);
