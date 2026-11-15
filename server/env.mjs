// Nạp web-ui/.env vào process.env trước mọi module khác (server/index.mjs import file này đầu tiên vì vài module đọc biến
// môi trường ngay lúc import). Đường dẫn tính theo vị trí file nên chạy `npm start` từ thư mục nào cũng được.
// Biến đã có sẵn trong môi trường (đặt từ shell / hosting) được giữ nguyên, không bị .env ghi đè. Không có .env thì bỏ qua.
import {existsSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const file=fileURLToPath(new URL('../.env',import.meta.url));
if(existsSync(file)){
 for(const raw of readFileSync(file,'utf8').replace(/^﻿/,'').split(/\r?\n/)){
  const line=raw.trim();if(!line||line.startsWith('#'))continue;
  const m=/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);if(!m)continue;
  let value=m[2].trim();
  if(/^(['"]).*\1$/.test(value))value=value.slice(1,-1);else value=value.replace(/\s+#.*$/,'');
  if(process.env[m[1]]===undefined)process.env[m[1]]=value;
 }
}
