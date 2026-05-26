// ═══════════════════════════════════════════════════════════════
// generate-ppt.js — Joint Report PPT 자동 생성
// pptxgenjs (CDN) 사용 / window.generateJointReportPPT() 노출
// 반환값: { blob: Blob, fileName: string }  (Drive에 직접 업로드)
// 디자인: ppt양식.pptx 템플릿 기반
// ═══════════════════════════════════════════════════════════════

// ── 템플릿 디자인 상수 (ppt양식.pptx 추출) ─────────────────────
const T = {
  bgSlide:    'FFFFFF',  // 콘텐츠 슬라이드 배경 (흰색)
  bgCover:    '0D4689',  // 표지 배경 (다크 네이비)
  hdrCell:    '0D4689',  // 번호 셀 배경 (네이비)
  hdrText:    'FFFFFF',  // 번호 셀 텍스트 (흰색)
  cellBorder: 'BFBFBF',  // 셀 테두리 (연회색)
  titleText:  '000000',  // 슬라이드 제목 (검정)
  accentLine: '00B0F0',  // 강조 선 (시안)
  coverTitle: 'FFFFFF',  // 표지 제목
  coverSub:   'BDD7EE',  // 표지 부제목
  coverDate:  'D9E2F0',  // 표지 날짜
  dimText:    '5A6A7A',  // 보조 텍스트
};

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
  ball:       [4, 3],
};

// ── 이미지 비율 유지 피팅 헬퍼 ──────────────────────────────────
function calcImageFit(maxW, maxH, rw, rh) {
  const scale = Math.min(maxW / rw, maxH / rh);
  const w = rw * scale;
  const h = rh * scale;
  return { w, h, offX: (maxW - w) / 2, offY: (maxH - h) / 2 };
}

// ── 콘텐츠 슬라이드 공통 헤더 렌더링 ───────────────────────────
function addSlideHeader(slide, title) {
  // 제목: 우측 정렬, Arial 22pt bold 검정
  slide.addText(title, {
    x: 3.8, y: 0.10, w: 9.33, h: 0.52,
    fontSize: 20, bold: true, color: T.titleText,
    align: 'right', fontFace: 'Arial', valign: 'middle',
  });
  // 네이비 좌측 액센트 바 (좌상단 세로 바)
  slide.addShape('rect', {
    x: 0, y: 0, w: 0.18, h: 0.72,
    fill: { color: T.hdrCell }, line: { type: 'none' },
  });
  // 시안 하단 구분선
  slide.addShape('rect', {
    x: 0.18, y: 0.68, w: 13.15, h: 0.035,
    fill: { color: T.accentLine }, line: { type: 'none' },
  });
}

// ── 제품 슬라이드 (N cols × auto rows) ─────────────────────────
// labels: 셀 번호 문자열 배열 (null이면 #1~#N 자동 생성)
async function addProductSlide(pptx, title, shots, cols, ratioWH, labels = null) {
  const [rw, rh] = ratioWH;
  const rows = Math.ceil(shots.length / cols);

  const slide = pptx.addSlide();
  slide.background = { color: T.bgSlide };

  addSlideHeader(slide, title);

  const marginX = 0.22;
  const startY  = 0.82;
  const gapX    = 0.06;
  const gapY    = 0.06;
  const availW  = 13.33 - marginX * 2;
  const availH  = 7.5 - startY - 0.1;
  const cellW   = (availW - gapX * (cols - 1)) / cols;
  const cellH   = (availH - gapY * (rows - 1)) / rows;
  const lblH    = 0.30;  // 번호 헤더 셀 높이
  const imgPad  = 0.06;

  for (let i = 0; i < shots.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x   = marginX + col * (cellW + gapX);
    const y   = startY  + row * (cellH + gapY);

    // 셀 전체 테두리 (연회색)
    slide.addShape('rect', {
      x, y, w: cellW, h: cellH,
      fill: { type: 'none' },
      line: { color: T.cellBorder, width: 0.5 },
    });

    // 번호 헤더 셀 (네이비 배경)
    slide.addShape('rect', {
      x, y, w: cellW, h: lblH,
      fill: { color: T.hdrCell },
      line: { type: 'none' },
    });

    // 번호 텍스트 (흰색, Arial bold)
    const labelText = labels ? labels[i] : `#${i + 1}`;
    slide.addText(labelText, {
      x, y, w: cellW, h: lblH,
      fontSize: 11, bold: true, color: T.hdrText,
      fontFace: 'Arial', align: 'center', valign: 'middle',
    });

    // 이미지
    if (shots[i] && shots[i].blob) {
      const dataUrl = await blobToDataUrl(shots[i].blob);
      const imgAreaW = cellW - imgPad * 2;
      const imgAreaH = cellH - lblH - imgPad * 2;
      const fit = calcImageFit(imgAreaW, imgAreaH, rw, rh);
      slide.addImage({
        data: dataUrl,
        x: x + imgPad + fit.offX,
        y: y + lblH + imgPad + fit.offY,
        w: fit.w,
        h: fit.h,
      });
    }
  }
}

// ── BALL 슬라이드 (중앙 4:3 가로) ─────────────────────────────
async function addBallSlide(pptx, title, shot) {
  const slide = pptx.addSlide();
  slide.background = { color: T.bgSlide };

  addSlideHeader(slide, title);

  // 4:3 이미지를 슬라이드 바디 중앙에 배치
  const startY = 0.82;
  const imgH   = 5.3;
  const imgW   = imgH * (4 / 3);  // ≈ 7.07"
  const cx     = (13.33 - imgW) / 2;
  const bodyH  = 7.5 - startY - 0.1;
  const lblH   = 0.30;
  const totalH = lblH + imgH;
  const cy     = startY + (bodyH - totalH) / 2;

  // 셀 전체 테두리
  slide.addShape('rect', {
    x: cx, y: cy, w: imgW, h: totalH,
    fill: { type: 'none' },
    line: { color: T.cellBorder, width: 0.5 },
  });

  // 번호 헤더 셀 (네이비)
  slide.addShape('rect', {
    x: cx, y: cy, w: imgW, h: lblH,
    fill: { color: T.hdrCell },
    line: { type: 'none' },
  });

  // 번호 텍스트
  slide.addText('#1', {
    x: cx, y: cy, w: imgW, h: lblH,
    fontSize: 12, bold: true, color: T.hdrText,
    fontFace: 'Arial', align: 'center', valign: 'middle',
  });

  if (shot && shot.blob) {
    const dataUrl = await blobToDataUrl(shot.blob);
    slide.addImage({ data: dataUrl, x: cx, y: cy + lblH, w: imgW, h: imgH });
  }
}

// ── 표지 슬라이드 (ppt양식.pptx 템플릿 기반) ───────────────────
function addCoverSlide(pptx, selectedSides, date) {
  const slide = pptx.addSlide();
  slide.background = { color: T.bgCover };  // 다크 네이비

  // 상단 시안 라인
  slide.addShape('rect', {
    x: 0, y: 0, w: '100%', h: 0.06,
    fill: { color: T.accentLine }, line: { type: 'none' },
  });

  // 좌측 장식 세로 바
  slide.addShape('rect', {
    x: 0, y: 0.06, w: 0.35, h: 7.44,
    fill: { color: '0A3A73' }, line: { type: 'none' },
  });

  // JOINT REPORT 레이블 (소문자 스타일)
  slide.addText('JOINT REPORT', {
    x: 0.65, y: 1.5, w: 11, h: 0.42,
    fontSize: 11, color: T.coverSub, fontFace: 'Calibri',
    charSpacing: 5,
  });

  // 메인 제목
  slide.addText('Joint 360° Inspection Report', {
    x: 0.65, y: 1.95, w: 11, h: 1.1,
    fontSize: 34, bold: true, color: T.coverTitle,
    fontFace: 'Calibri',
  });

  // 시안 구분선
  slide.addShape('rect', {
    x: 0.65, y: 3.2, w: 5.5, h: 0.04,
    fill: { color: T.accentLine }, line: { type: 'none' },
  });

  // 측면 레이블 (Outboard · Inboard)
  const sides = [];
  if (selectedSides.outboard) sides.push('Outboard');
  if (selectedSides.inboard)  sides.push('Inboard');
  slide.addText(sides.join('  ·  '), {
    x: 0.65, y: 3.35, w: 11, h: 0.42,
    fontSize: 15, color: T.coverSub, fontFace: 'Calibri',
  });

  // 날짜
  slide.addText(formatDateStr(date), {
    x: 0.65, y: 3.88, w: 8, h: 0.38,
    fontSize: 13, italic: true, color: T.coverDate, fontFace: 'Calibri',
  });

  // 하단 바
  slide.addShape('rect', {
    x: 0, y: 7.42, w: '100%', h: 0.08,
    fill: { color: '0A3A73' }, line: { type: 'none' },
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
    const segs      = segments[side] || 6;
    const raceCols  = segs <= 6 ? 3 : 4;  // OUTER/INNER RACE 기본 cols
    const sideData  = capturedData[side];

    for (const prod of PRODUCTS_DEF) {
      const shots = sideData[prod.id] || [];
      if (shots.length === 0) continue;

      const ratio = CROP_RATIO_PPT[prod.id];

      if (prod.id === 'ball') {
        // BALL: 중앙 4:3 단일 슬라이드
        await addBallSlide(pptx, `BALL  —  ${sideLabel}`, shots[0]);

      } else if (prod.id === 'cage') {
        // CAGE: 앞·뒤 전체를 1장에
        //   6구간 → 3cols × 4rows (F1~F6, B1~B6)
        //   8구간 → 4cols × 4rows (F1~F8, B1~B8)
        const cageCols = segs <= 6 ? 3 : 4;
        const cageLabels = [
          ...Array.from({ length: segs }, (_, i) => `F${i + 1}`),  // 앞면
          ...Array.from({ length: segs }, (_, i) => `B${i + 1}`),  // 뒷면
        ];
        await addProductSlide(
          pptx, `CAGE  —  ${sideLabel}`, shots, cageCols, ratio, cageLabels
        );

      } else {
        // OUTER RACE / INNER RACE (3:4)
        await addProductSlide(pptx, `${prod.name}  —  ${sideLabel}`, shots, raceCols, ratio);
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
