// ═══════════════════════════════════════════════════════════════
// generate-ppt.js — Joint Report PPT 자동 생성
// pptxgenjs (CDN) 사용 / window.generateJointReportPPT() 노출
// ═══════════════════════════════════════════════════════════════

async function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function formatDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const PRODUCTS_DEF = [
  { id: 'outer_race', name: 'OUTER RACE' },
  { id: 'inner_race', name: 'INNER RACE' },
  { id: 'cage',       name: 'CAGE' },
  { id: 'ball',       name: 'BALL' },
];

const HDR_COLOR   = '1F5C8B';
const BG_COLOR    = '0B0C0E';
const SURFACE     = '15171B';
const ACCENT      = 'C8FF3D';
const TEXT_COLOR  = 'F5F5F7';
const DIM_COLOR   = '9CA0AA';

// ── 제품 슬라이드 (2×N 그리드) ─────────────────────────────────
async function addProductSlide(pptx, title, shots, cols) {
  const slide = pptx.addSlide();
  slide.background = { color: BG_COLOR };

  // 헤더 바
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: '100%', h: 0.65,
    fill: { color: HDR_COLOR }, line: { type: 'none' },
  });
  slide.addText(title, {
    x: 0.25, y: 0, w: 13.08, h: 0.65,
    fontSize: 17, bold: true, color: 'FFFFFF', valign: 'middle',
    fontFace: 'Arial',
  });

  const rows = 2;
  const marginX = 0.2;
  const marginY = 0.12;
  const startY  = 0.75;
  const availW  = 13.33 - marginX * 2;
  const availH  = 7.5  - startY - marginY;
  const cellW   = availW / cols;
  const cellH   = availH / rows;
  const imgPad  = 0.12;
  const lblH    = 0.22;

  for (let i = 0; i < Math.min(shots.length, cols * rows); i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x   = marginX + col * cellW;
    const y   = startY  + row * cellH;

    // 번호
    slide.addText(`#${i + 1}`, {
      x: x + imgPad, y: y + 0.02,
      w: cellW - imgPad * 2, h: lblH,
      fontSize: 8, color: DIM_COLOR, fontFace: 'Courier New',
    });

    // 이미지
    if (shots[i] && shots[i].blob) {
      const dataUrl = await blobToDataUrl(shots[i].blob);
      slide.addImage({
        data: dataUrl,
        x: x + imgPad, y: y + lblH + 0.04,
        w: cellW - imgPad * 2,
        h: cellH - lblH - 0.1,
      });
    }

    // 셀 테두리
    slide.addShape(pptx.ShapeType.rect, {
      x: x + imgPad * 0.5, y: y + 0.01,
      w: cellW - imgPad, h: cellH - 0.06,
      fill: { type: 'none' },
      line: { color: '26292F', width: 0.5 },
    });
  }
}

// ── BALL 슬라이드 (중앙 1장) ────────────────────────────────────
async function addBallSlide(pptx, title, shot) {
  const slide = pptx.addSlide();
  slide.background = { color: BG_COLOR };

  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: '100%', h: 0.65,
    fill: { color: HDR_COLOR }, line: { type: 'none' },
  });
  slide.addText(title, {
    x: 0.25, y: 0, w: 13.08, h: 0.65,
    fontSize: 17, bold: true, color: 'FFFFFF', valign: 'middle',
    fontFace: 'Arial',
  });

  slide.addText('#1', {
    x: 4.67, y: 0.85, w: 4, h: 0.22,
    fontSize: 9, color: DIM_COLOR, fontFace: 'Courier New', align: 'center',
  });

  if (shot && shot.blob) {
    const dataUrl = await blobToDataUrl(shot.blob);
    slide.addImage({
      data: dataUrl,
      x: 3.17, y: 1.1, w: 7, h: 5.9,
    });
  }
}

// ── 표지 슬라이드 ───────────────────────────────────────────────
function addCoverSlide(pptx, selectedSides, date) {
  const slide = pptx.addSlide();
  slide.background = { color: BG_COLOR };

  // 상단 장식 바
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: '100%', h: 0.08,
    fill: { color: ACCENT }, line: { type: 'none' },
  });

  // 로고 원
  slide.addShape(pptx.ShapeType.ellipse, {
    x: 5.67, y: 1.2, w: 2, h: 2,
    fill: { color: SURFACE },
    line: { color: ACCENT, width: 1.5 },
  });
  slide.addShape(pptx.ShapeType.ellipse, {
    x: 6.12, y: 1.65, w: 1.1, h: 1.1,
    fill: { type: 'none' },
    line: { color: ACCENT, width: 0.8, dashType: 'dash' },
  });

  // 제목
  slide.addText('JOINT REPORT', {
    x: 0.5, y: 3.4, w: 12.33, h: 0.45,
    fontSize: 11, color: DIM_COLOR, fontFace: 'Courier New',
    align: 'center', charSpacing: 6,
  });
  slide.addText('Joint 360° Inspection Report', {
    x: 0.5, y: 3.9, w: 12.33, h: 1.0,
    fontSize: 36, bold: true, color: TEXT_COLOR,
    align: 'center', fontFace: 'Arial',
  });

  // 날짜
  slide.addText(formatDateStr(date), {
    x: 0.5, y: 5.0, w: 12.33, h: 0.4,
    fontSize: 14, color: DIM_COLOR, align: 'center', fontFace: 'Arial',
  });

  // 사이드 뱃지
  const sides = [];
  if (selectedSides.outboard) sides.push('Outboard');
  if (selectedSides.inboard)  sides.push('Inboard');
  slide.addText(sides.join('  ·  '), {
    x: 0.5, y: 5.5, w: 12.33, h: 0.35,
    fontSize: 13, color: ACCENT, align: 'center', fontFace: 'Arial',
  });

  // 하단 선
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 7.42, w: '100%', h: 0.08,
    fill: { color: '26292F' }, line: { type: 'none' },
  });
}

// ── 메인 생성 함수 ──────────────────────────────────────────────
window.generateJointReportPPT = async function({ capturedData, selectedSides, segments }) {
  if (typeof PptxGenJS === 'undefined') {
    throw new Error('pptxgenjs 라이브러리가 로드되지 않았습니다. 인터넷 연결을 확인해 주세요.');
  }

  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE'; // 13.33" × 7.5"

  const now = new Date();

  // 1. 표지
  addCoverSlide(pptx, selectedSides, now);

  // 2. 각 사이드별 슬라이드
  for (const side of ['outboard', 'inboard']) {
    if (!selectedSides[side]) continue;
    const sideLabel = side === 'outboard' ? 'Outboard' : 'Inboard';
    const segs = segments[side] || 6;
    const cols = segs <= 6 ? 3 : 4;
    const sideData = capturedData[side];

    for (const prod of PRODUCTS_DEF) {
      const shots = sideData[prod.id] || [];
      if (shots.length === 0) continue;

      if (prod.id === 'cage') {
        const front = shots.slice(0, segs);
        const back  = shots.slice(segs);
        if (front.length > 0)
          await addProductSlide(pptx, `CAGE  (Front) — ${sideLabel}`, front, cols);
        if (back.length > 0)
          await addProductSlide(pptx, `CAGE  (Back) — ${sideLabel}`, back, cols);
      } else if (prod.id === 'ball') {
        await addBallSlide(pptx, `BALL — ${sideLabel}`, shots[0]);
      } else {
        await addProductSlide(pptx, `${prod.name} — ${sideLabel}`, shots, cols);
      }
    }
  }

  // 파일명
  const dateStr = now.toISOString().slice(0,10).replace(/-/g,'');
  const timeStr = now.toTimeString().slice(0,8).replace(/:/g,'');
  await pptx.writeFile({ fileName: `JointReport_${dateStr}_${timeStr}.pptx` });
};
