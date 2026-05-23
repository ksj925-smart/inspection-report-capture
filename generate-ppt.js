// ═══════════════════════════════════════════════════════════════
// generate-ppt.js — Joint Report PPT 자동 생성
// pptxgenjs (CDN) 사용 / window.generateJointReportPPT() 노출
// 반환값: { blob: Blob, fileName: string }  (Drive에 직접 업로드)
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

// 촬영 비율과 동일하게 PPT 이미지 비율 유지 [가로, 세로]
const CROP_RATIO_PPT = {
  outer_race: [3, 4],
  inner_race: [3, 4],
  cage:       [8, 3],
  ball:       [1, 1],
};

const HDR_COLOR   = '1F5C8B';
const BG_COLOR    = '0B0C0E';
const SURFACE_PPT = '15171B';
const ACCENT_PPT  = 'C8FF3D';
const TEXT_COLOR  = 'F5F5F7';
const DIM_COLOR   = '9CA0AA';

// ── 이미지 비율 유지 피팅 헬퍼 ──────────────────────────────────
function calcImageFit(maxW, maxH, rw, rh) {
  const scale = Math.min(maxW / rw, maxH / rh);
  const w = rw * scale;
  const h = rh * scale;
  return { w, h, offX: (maxW - w) / 2, offY: (maxH - h) / 2 };
}

// ── 제품 슬라이드 (N cols × auto rows) ─────────────────────────
async function addProductSlide(pptx, title, shots, cols, ratioWH) {
  const [rw, rh] = ratioWH;
  const rows = Math.ceil(shots.length / cols);

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

  const marginX = 0.2;
  const marginY = 0.12;
  const startY  = 0.75;
  const availW  = 13.33 - marginX * 2;
  const availH  = 7.5  - startY - marginY;
  const cellW   = availW / cols;
  const cellH   = availH / rows;
  const imgPad  = 0.12;
  const lblH    = 0.22;

  for (let i = 0; i < shots.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x   = marginX + col * cellW;
    const y   = startY  + row * cellH;

    slide.addText(`#${i + 1}`, {
      x: x + imgPad, y: y + 0.02,
      w: cellW - imgPad * 2, h: lblH,
      fontSize: 8, color: DIM_COLOR, fontFace: 'Courier New',
    });

    if (shots[i] && shots[i].blob) {
      const dataUrl = await blobToDataUrl(shots[i].blob);
      const imgAreaW = cellW - imgPad * 2;
      const imgAreaH = cellH - lblH - 0.1;
      const fit = calcImageFit(imgAreaW, imgAreaH, rw, rh);
      slide.addImage({
        data: dataUrl,
        x: x + imgPad + fit.offX,
        y: y + lblH + 0.04 + fit.offY,
        w: fit.w,
        h: fit.h,
      });
    }

    slide.addShape(pptx.ShapeType.rect, {
      x: x + imgPad * 0.5, y: y + 0.01,
      w: cellW - imgPad, h: cellH - 0.06,
      fill: { type: 'none' },
      line: { color: '26292F', width: 0.5 },
    });
  }
}

// ── BALL 슬라이드 (중앙 1:1) ────────────────────────────────────
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

  const size = 5.5;
  const cx = (13.33 - size) / 2;
  const bodyH = 7.5 - 0.75;
  const cy = 0.75 + (bodyH - size) / 2;

  slide.addText('#1', {
    x: cx, y: cy - 0.28, w: size, h: 0.22,
    fontSize: 9, color: DIM_COLOR, fontFace: 'Courier New', align: 'center',
  });

  if (shot && shot.blob) {
    const dataUrl = await blobToDataUrl(shot.blob);
    slide.addImage({ data: dataUrl, x: cx, y: cy, w: size, h: size });
  }
}

// ── 표지 슬라이드 ───────────────────────────────────────────────
function addCoverSlide(pptx, selectedSides, date) {
  const slide = pptx.addSlide();
  slide.background = { color: BG_COLOR };

  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: '100%', h: 0.08,
    fill: { color: ACCENT_PPT }, line: { type: 'none' },
  });

  slide.addShape(pptx.ShapeType.ellipse, {
    x: 5.67, y: 1.2, w: 2, h: 2,
    fill: { color: SURFACE_PPT },
    line: { color: ACCENT_PPT, width: 1.5 },
  });
  slide.addShape(pptx.ShapeType.ellipse, {
    x: 6.12, y: 1.65, w: 1.1, h: 1.1,
    fill: { type: 'none' },
    line: { color: ACCENT_PPT, width: 0.8, dashType: 'dash' },
  });

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

  slide.addText(formatDateStr(date), {
    x: 0.5, y: 5.0, w: 12.33, h: 0.4,
    fontSize: 14, color: DIM_COLOR, align: 'center', fontFace: 'Arial',
  });

  const sides = [];
  if (selectedSides.outboard) sides.push('Outboard');
  if (selectedSides.inboard)  sides.push('Inboard');
  slide.addText(sides.join('  ·  '), {
    x: 0.5, y: 5.5, w: 12.33, h: 0.35,
    fontSize: 13, color: ACCENT_PPT, align: 'center', fontFace: 'Arial',
  });

  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 7.42, w: '100%', h: 0.08,
    fill: { color: '26292F' }, line: { type: 'none' },
  });
}

// ── 메인 생성 함수 ──────────────────────────────────────────────
// 반환값: { blob: Blob, fileName: string }
window.generateJointReportPPT = async function({ capturedData, selectedSides, segments }) {
  if (typeof PptxGenJS === 'undefined') {
    throw new Error('pptxgenjs 라이브러리가 로드되지 않았습니다. 인터넷 연결을 확인해 주세요.');
  }

  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE'; // 13.33" × 7.5"

  const now = new Date();

  // 1. 표지
  addCoverSlide(pptx, selectedSides, now);

  // 2. 사이드별 슬라이드
  for (const side of ['outboard', 'inboard']) {
    if (!selectedSides[side]) continue;
    const sideLabel = side === 'outboard' ? 'Outboard' : 'Inboard';
    const segs = segments[side] || 6;
    const cols = segs <= 6 ? 3 : 4;
    const sideData = capturedData[side];

    for (const prod of PRODUCTS_DEF) {
      const shots = sideData[prod.id] || [];
      if (shots.length === 0) continue;

      const ratio = CROP_RATIO_PPT[prod.id];

      if (prod.id === 'ball') {
        await addBallSlide(pptx, `BALL — ${sideLabel}`, shots[0]);
      } else if (prod.id === 'cage') {
        // 앞·뒤 전체를 한 슬라이드에 (4 cols, 8:3 비율)
        await addProductSlide(pptx, `CAGE — ${sideLabel}`, shots, 4, ratio);
      } else {
        await addProductSlide(pptx, `${prod.name} — ${sideLabel}`, shots, cols, ratio);
      }
    }
  }

  // Blob으로 반환 (로컬 다운로드 없음)
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
  const fileName = `JointReport_${dateStr}_${timeStr}.pptx`;
  const blob = await pptx.write({ outputType: 'blob' });
  return { blob, fileName };
};
