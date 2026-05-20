// generate-icons.js — Node.js로 PWA 아이콘 생성
// 사용법: node generate-icons.js
// 필요: npm install canvas

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'icons');
if (!fs.existsSync(dir)) fs.mkdirSync(dir);

function drawIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const cx = size / 2, cy = size / 2, r = size * 0.42;

  // 배경
  ctx.fillStyle = '#0B0C0E';
  ctx.roundRect(0, 0, size, size, size * 0.22);
  ctx.fill();

  // 외곽 링
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = '#C8FF3D';
  ctx.lineWidth = size * 0.045;
  ctx.stroke();

  // 내부 링
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
  ctx.strokeStyle = '#C8FF3D';
  ctx.lineWidth = size * 0.03;
  ctx.globalAlpha = 0.5;
  ctx.stroke();
  ctx.globalAlpha = 1;

  // 구간 점 (6개)
  for (let i = 0; i < 6; i++) {
    const a = (i * 60 - 90) * Math.PI / 180;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, size * 0.04, 0, Math.PI * 2);
    ctx.fillStyle = '#C8FF3D';
    ctx.fill();
  }

  return canvas.toBuffer('image/png');
}

[192, 512].forEach(size => {
  fs.writeFileSync(path.join(dir, `icon-${size}.png`), drawIcon(size));
  console.log(`✅ icons/icon-${size}.png 생성됨`);
});

console.log('\n📱 아이콘 생성 완료!');
