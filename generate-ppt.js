// ═══════════════════════════════════════════════════════════════
// generate-ppt.js — Joint Report PPT 자동 생성 (addTable 기반)
// pptxgenjs v3.12 CDN 사용 / window.generateJointReportPPT() 노출
// ═══════════════════════════════════════════════════════════════

// ── 디자인 상수 ─────────────────────────────────────────────────
const T = {
  bgSlide:    'FFFFFF',
  bgCover:    '0D4689',
  hdrCell:    '0D4689',  // 번호 셀 / 제품 헤더 (다크 네이비)
  secHdr:     '1F5C8B',  // Visual 섹션 헤더 (미드 네이비)
  hdrText:    'FFFFFF',
  cellBorder: 'BFBFBF',
  titleText:  '000000',
  accentLine: '00B0F0',
  coverTitle: 'FFFFFF',
  coverSub:   'BDD7EE',
  coverDate:  'D9E2F0',
};

const BORDER = { pt: 0.5, color: 'BFBFBF' };

// ── 유틸리티 ────────────────────────────────────────────────────
async function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);
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

// 이미지 contain-fit 헬퍼
function calcImageFit(maxW, maxH, rw, rh) {
  const scale = Math.min(maxW / rw, maxH / rh);
  const w = rw * scale;
  const h = rh * scale;
  return { w, h, offX: (maxW - w) / 2, offY: (maxH - h) / 2 };
}

// ── 제품 정의 ────────────────────────────────────────────────────
const PRODUCTS_DEF = [
  { id: 'outer_race', name: 'OUTER RACE' },
  { id: 'inner_race', name: 'INNER RACE' },
  { id: 'cage',       name: 'CAGE'       },
  { id: 'ball',       name: 'BALL'       },
];

const CROP_RATIO_PPT = {
  outer_race: [3, 4],
  inner_race: [3, 4],
  cage:       [8, 3],
  ball:       [4, 3],
};

// ── 공통 슬라이드 헤더 ───────────────────────────────────────────
function addSlideHeader(slide, title) {
  slide.addText(title, {
    x: 3.8, y: 0.10, w: 9.33, h: 0.52,
    fontSize: 20, bold: true, color: T.titleText,
    align: 'right', fontFace: 'Arial', valign: 'middle',
  });
  slide.addShape('rect', {
    x: 0, y: 0, w: 0.18, h: 0.72,
    fill: { color: T.hdrCell }, line: { type: 'none' },
  });
  slide.addShape('rect', {
    x: 0.18, y: 0.68, w: 13.15, h: 0.035,
    fill: { color: T.accentLine }, line: { type: 'none' },
  });
}

// ── 헤더 셀 생성 헬퍼 ───────────────────────────────────────────
function makeHdrCell(text, colspan, bgColor) {
  const opts = {
    fill:    { color: bgColor || T.hdrCell },
    color:   T.hdrText,
    bold:    true,
    fontSize: 11,
    fontFace: 'Arial',
    align:   'center',
    valign:  'middle',
    border:  BORDER,
  };
  if (colspan && colspan > 1) opts.colspan = colspan;
  return { text, options: opts };
}

// 빈 사진 셀
function makePhotoCell(colspan) {
  const opts = { fill: { color: 'FFFFFF' }, border: BORDER };
  if (colspan && colspan > 1) opts.colspan = colspan;
  return { text: '', options: opts };
}

// ═══════════════════════════════════════════════════════════════
// 제품 슬라이드 — OUTER RACE / INNER RACE / CAGE  (addTable)
// 구조: 헤더 행 1줄 + (레이블 행 + 사진 행) × nPhotoRows
// ═══════════════════════════════════════════════════════════════
async function addProductSlide(pptx, title, shots, cols, ratioWH, labels = null) {
  const [rw, rh]   = ratioWH;
  const nPhotoRows = Math.ceil(shots.length / cols);

  const slide = pptx.addSlide();
  slide.background = { color: T.bgSlide };
  addSlideHeader(slide, title);

  const mx      = 0.22;
  const startY  = 0.82;
  const availW  = 13.33 - mx * 2;          // 12.89"
  const availH  = 7.5  - startY - 0.10;   // 6.58"
  const hdrH    = 0.30;
  const lblH    = 0.26;
  const pad     = 0.05;

  const photoH = +((availH - hdrH - nPhotoRows * lblH) / nPhotoRows).toFixed(4);
  const cellW  = +(availW / cols).toFixed(4);

  const colWArr = Array(cols).fill(cellW);
  const rowHArr = [hdrH];
  for (let r = 0; r < nPhotoRows; r++) {
    rowHArr.push(lblH);
    rowHArr.push(photoH);
  }

  // ── 표 행 빌드 ──────────────────────────────────────────────
  const tableRows = [];

  // 헤더 행 (colspan=전체 cols)
  tableRows.push([ makeHdrCell(title, cols) ]);

  for (let r = 0; r < nPhotoRows; r++) {
    const si = r * cols;

    // 레이블 행
    const lblRow = [];
    for (let c = 0; c < cols; c++) {
      const i   = si + c;
      const lbl = labels ? (labels[i] || '') : (i < shots.length ? `#${i + 1}` : '');
      lblRow.push(makeHdrCell(lbl, 1));
    }
    tableRows.push(lblRow);

    // 사진 행 (빈 셀 — 이미지는 오버레이)
    tableRows.push(Array(cols).fill(null).map(() => makePhotoCell(1)));
  }

  slide.addTable(tableRows, {
    x:    mx,
    y:    startY,
    colW: colWArr,
    rowH: rowHArr,
  });

  // ── 이미지 오버레이 ─────────────────────────────────────────
  for (let i = 0; i < shots.length; i++) {
    if (!shots[i] || !shots[i].blob) continue;
    const col  = i % cols;
    const row  = Math.floor(i / cols);
    const cellX = mx + col * cellW;
    const cellY = startY + hdrH + row * (lblH + photoH) + lblH;
    const dataUrl = await blobToDataUrl(shots[i].blob);
    const fit = calcImageFit(cellW - pad * 2, photoH - pad * 2, rw, rh);
    slide.addImage({
      data: dataUrl,
      x: cellX + pad + fit.offX,
      y: cellY + pad + fit.offY,
      w: fit.w,
      h: fit.h,
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// BALL 슬라이드 — 중앙 4:3 단일 이미지  (addTable)
// ═══════════════════════════════════════════════════════════════
async function addBallSlide(pptx, title, shot) {
  const slide = pptx.addSlide();
  slide.background = { color: T.bgSlide };
  addSlideHeader(slide, title);

  const startY = 0.82;
  const availH = 7.5 - startY - 0.10;
  const lblH   = 0.30;
  const photoH = 5.3;
  const imgW   = +(photoH * 4 / 3).toFixed(4);           // ≈ 7.07"
  const cx     = +((13.33 - imgW) / 2).toFixed(4);
  const cy     = +(startY + (availH - lblH - photoH) / 2).toFixed(4);

  slide.addTable(
    [
      [ makeHdrCell('#1', 1) ],
      [ makePhotoCell(1)     ],
    ],
    { x: cx, y: cy, colW: [imgW], rowH: [lblH, photoH] }
  );

  if (shot && shot.blob) {
    const dataUrl = await blobToDataUrl(shot.blob);
    slide.addImage({ data: dataUrl, x: cx, y: cy + lblH, w: imgW, h: photoH });
  }
}

// ═══════════════════════════════════════════════════════════════
// 표지 슬라이드 (360°)
// ═══════════════════════════════════════════════════════════════
function addCoverSlide(pptx, selectedSides, date) {
  const slide = pptx.addSlide();
  slide.background = { color: T.bgCover };
  slide.addShape('rect', { x:0, y:0, w:'100%', h:0.06, fill:{color:T.accentLine}, line:{type:'none'} });
  slide.addShape('rect', { x:0, y:0.06, w:0.35, h:7.44, fill:{color:'0A3A73'}, line:{type:'none'} });
  slide.addText('JOINT REPORT',                     { x:0.65, y:1.5,  w:11, h:0.42, fontSize:11, color:T.coverSub,   fontFace:'Calibri', charSpacing:5 });
  slide.addText('Joint 360° Inspection Report',     { x:0.65, y:1.95, w:11, h:1.1,  fontSize:34, bold:true, color:T.coverTitle, fontFace:'Calibri' });
  slide.addShape('rect', { x:0.65, y:3.2, w:5.5, h:0.04, fill:{color:T.accentLine}, line:{type:'none'} });
  const sideList = [];
  if (selectedSides.outboard) sideList.push('Outboard');
  if (selectedSides.inboard)  sideList.push('Inboard');
  slide.addText(sideList.join('  ·  '),             { x:0.65, y:3.35, w:11, h:0.42, fontSize:15, color:T.coverSub,   fontFace:'Calibri' });
  slide.addText(formatDateStr(date),                { x:0.65, y:3.88, w:8,  h:0.38, fontSize:13, italic:true, color:T.coverDate, fontFace:'Calibri' });
  slide.addShape('rect', { x:0, y:7.42, w:'100%', h:0.08, fill:{color:'0A3A73'}, line:{type:'none'} });
}

// ═══════════════════════════════════════════════════════════════
// Visual 표지 슬라이드
// ═══════════════════════════════════════════════════════════════
function addVisualCoverSlide(pptx, date) {
  const slide = pptx.addSlide();
  slide.background = { color: T.bgCover };
  slide.addShape('rect', { x:0, y:0, w:'100%', h:0.06, fill:{color:T.accentLine}, line:{type:'none'} });
  slide.addShape('rect', { x:0, y:0.06, w:0.35, h:7.44, fill:{color:'0A3A73'}, line:{type:'none'} });
  slide.addText('JOINT REPORT',                     { x:0.65, y:1.5,  w:11, h:0.42, fontSize:11, color:T.coverSub,   fontFace:'Calibri', charSpacing:5 });
  slide.addText('Joint Visual Inspection Report',   { x:0.65, y:1.95, w:11, h:1.0,  fontSize:32, bold:true, color:T.coverTitle, fontFace:'Calibri' });
  slide.addShape('rect', { x:0.65, y:3.1,  w:5.5, h:0.04, fill:{color:T.accentLine}, line:{type:'none'} });
  slide.addText('Outboard  ·  Inboard',             { x:0.65, y:3.25, w:11, h:0.42, fontSize:14, color:T.coverSub,   fontFace:'Calibri' });
  slide.addText(formatDateStr(date),                { x:0.65, y:3.78, w:8,  h:0.38, fontSize:13, italic:true, color:T.coverDate, fontFace:'Calibri' });
  slide.addShape('rect', { x:0, y:7.42, w:'100%', h:0.08, fill:{color:'0A3A73'}, line:{type:'none'} });
}

// ═══════════════════════════════════════════════════════════════
// Visual Inspection 슬라이드  (addTable + rowspan/colspan)
//
// 슬라이드 절반씩 OBJ(좌) / IBJ(우), 각 섹션 표 구조:
//   7 cols: [jW, u, u, u, u, u, u]   (jW=25% of sW, u=rW/6)
//
//   R0  h=secHdrH : [colspan=7  "OBJ — OUTBOARD"   ] 네이비 헤더
//   R1  h=lblH    : [jLabel | #1(colspan=3) | #2(colspan=3)] 서브헤더
//   R2  h=photoH1 : [JOINT(rowspan=3) | #1사진(colspan=3) | #2사진(colspan=3)]
//   R3  h=lblH    : [C0 rowspan계속   | #3(cs=2) | #4(cs=2) | #5(cs=2)]
//   R4  h=photoH2 : [C0 rowspan계속   | #3사진(cs=2) | #4사진(cs=2) | #5사진(cs=2)]
// ═══════════════════════════════════════════════════════════════
async function addVisualSlide(pptx, visualData) {
  const slide = pptx.addSlide();
  slide.background = { color: T.bgSlide };
  addSlideHeader(slide, 'Joint Visual Inspection');

  const margin   = 0.12;
  const secGap   = 0.21;
  const sW       = +((13.33 - margin * 2 - secGap) / 2).toFixed(4);  // ≈ 6.44"
  const startY   = 0.82;
  const availH   = 7.5 - startY - 0.10;                               // 6.58"
  const secHdrH  = 0.30;
  const lblH     = 0.26;
  const cntH     = +(availH - secHdrH).toFixed(4);                    // 6.28"
  const jW       = +(sW * 0.25).toFixed(4);    // JOINT 열 폭 ≈ 1.61"
  const rW       = +(sW - jW).toFixed(4);      // 우측 사진 영역 폭 ≈ 4.83"
  const u        = +(rW / 6).toFixed(4);       // LCM(2,3)=6 단위 폭 ≈ 0.805"
  const pad      = 0.05;

  // Row 높이: 45% / 45% / 나머지(10%)
  const row1CellH  = +(cntH * 0.45).toFixed(4);   // ≈ 2.826"
  const row2CellH  = row1CellH;
  const row1PhotoH = +(row1CellH - lblH).toFixed(4);
  const row2PhotoH = +(row2CellH - lblH).toFixed(4);

  const colWArr = [jW, u, u, u, u, u, u];
  const rowHArr = [secHdrH, lblH, row1PhotoH, lblH, row2PhotoH];

  // 섹션 구분선
  const divX = margin + sW + secGap / 2 - 0.008;
  slide.addShape('rect', {
    x: divX, y: startY, w: 0.016, h: availH,
    fill: { color: T.cellBorder }, line: { type: 'none' },
  });

  const sides = ['outboard', 'inboard'];

  for (let idx = 0; idx < sides.length; idx++) {
    const side   = sides[idx];
    const sX     = margin + idx * (sW + secGap);
    const sLabel = side === 'outboard' ? 'OBJ  —  OUTBOARD' : 'IBJ  —  INBOARD';
    const jLabel = side === 'outboard' ? 'OBJ' : 'IBJ';
    const sd     = visualData[side] || {};

    // ── addTable 행 구성 ─────────────────────────────────────
    const tableRows = [
      // R0 — 섹션 헤더
      [{ text: sLabel, options: {
        colspan: 7, fill: { color: T.secHdr }, color: T.hdrText,
        bold: true, fontSize: 12, fontFace: 'Arial',
        align: 'center', valign: 'middle', border: BORDER,
      }}],

      // R1 — 서브 헤더 (7 cols = 1+3+3)
      [
        { text: jLabel, options: { fill:{color:T.hdrCell}, color:T.hdrText, bold:true, fontSize:11, fontFace:'Arial', align:'center', valign:'middle', border:BORDER } },
        { text: '#1',   options: { colspan:3, fill:{color:T.hdrCell}, color:T.hdrText, bold:true, fontSize:11, fontFace:'Arial', align:'center', valign:'middle', border:BORDER } },
        { text: '#2',   options: { colspan:3, fill:{color:T.hdrCell}, color:T.hdrText, bold:true, fontSize:11, fontFace:'Arial', align:'center', valign:'middle', border:BORDER } },
      ],

      // R2 — 사진 행1 (JOINT rowspan=3, colspan 생략=1 / 나머지 cs=3씩)
      [
        { text: '', options: { rowspan:3, fill:{color:'FFFFFF'}, border:BORDER } },
        { text: '', options: { colspan:3, fill:{color:'FFFFFF'}, border:BORDER } },
        { text: '', options: { colspan:3, fill:{color:'FFFFFF'}, border:BORDER } },
      ],

      // R3 — 서브 헤더 행2 (C0 rowspan 계속 → 셀 3개만: 2+2+2)
      [
        { text: '#3', options: { colspan:2, fill:{color:T.hdrCell}, color:T.hdrText, bold:true, fontSize:11, fontFace:'Arial', align:'center', valign:'middle', border:BORDER } },
        { text: '#4', options: { colspan:2, fill:{color:T.hdrCell}, color:T.hdrText, bold:true, fontSize:11, fontFace:'Arial', align:'center', valign:'middle', border:BORDER } },
        { text: '#5', options: { colspan:2, fill:{color:T.hdrCell}, color:T.hdrText, bold:true, fontSize:11, fontFace:'Arial', align:'center', valign:'middle', border:BORDER } },
      ],

      // R4 — 사진 행2 (C0 rowspan 계속 → 셀 3개: cs=2씩)
      [
        { text: '', options: { colspan:2, fill:{color:'FFFFFF'}, border:BORDER } },
        { text: '', options: { colspan:2, fill:{color:'FFFFFF'}, border:BORDER } },
        { text: '', options: { colspan:2, fill:{color:'FFFFFF'}, border:BORDER } },
      ],
    ];

    slide.addTable(tableRows, {
      x:    sX,
      y:    startY,
      colW: colWArr,
      rowH: rowHArr,
    });

    // ── 이미지 오버레이: 셀 좌표 누적 계산 ──────────────────
    // colWArr = [jW, u, u, u, u, u, u]
    // rowHArr = [secHdrH, lblH, row1PhotoH, lblH, row2PhotoH]
    const tx = sX;
    const ty = startY;

    // JOINT 사진 : R2~R4, C0
    {
      const cx = tx;
      const cy = ty + rowHArr[0] + rowHArr[1];                                // after R0+R1
      const cw = colWArr[0];                                                   // jW
      const ch = rowHArr[2] + rowHArr[3] + rowHArr[4];                        // R2+R3+R4
      const d  = sd['joint'];
      if (d && d.blob) {
        const url = await blobToDataUrl(d.blob);
        const fit = calcImageFit(cw - pad*2, ch - pad*2, 9, 16);
        slide.addImage({ data:url, x:cx+pad+fit.offX, y:cy+pad+fit.offY, w:fit.w, h:fit.h });
      }
    }

    // #1 INTERFACE : R2, C1-C3
    {
      const cx = tx + colWArr[0];
      const cy = ty + rowHArr[0] + rowHArr[1];
      const cw = u * 3;
      const ch = rowHArr[2];
      const d  = sd['interface'];
      if (d && d.blob) {
        const url = await blobToDataUrl(d.blob);
        const fit = calcImageFit(cw - pad*2, ch - pad*2, 4, 3);
        slide.addImage({ data:url, x:cx+pad+fit.offX, y:cy+pad+fit.offY, w:fit.w, h:fit.h });
      }
    }

    // #2 BEARING FACE : R2, C4-C6
    {
      const cx = tx + colWArr[0] + u * 3;
      const cy = ty + rowHArr[0] + rowHArr[1];
      const cw = u * 3;
      const ch = rowHArr[2];
      const d  = sd['bearing_face'];
      if (d && d.blob) {
        const url = await blobToDataUrl(d.blob);
        const fit = calcImageFit(cw - pad*2, ch - pad*2, 4, 3);
        slide.addImage({ data:url, x:cx+pad+fit.offX, y:cy+pad+fit.offY, w:fit.w, h:fit.h });
      }
    }

    // Row2 기준 Y: R0+R1+R2+R3 누적
    const row2BaseY = ty + rowHArr[0] + rowHArr[1] + rowHArr[2] + rowHArr[3];

    // #3 CLAMP-JOINT : R4, C1-C2
    {
      const cx = tx + colWArr[0];
      const cw = u * 2;
      const ch = rowHArr[4];
      const d  = sd['clamp_joint'];
      if (d && d.blob) {
        const url = await blobToDataUrl(d.blob);
        const fit = calcImageFit(cw - pad*2, ch - pad*2, 9, 16);
        slide.addImage({ data:url, x:cx+pad+fit.offX, y:row2BaseY+pad+fit.offY, w:fit.w, h:fit.h });
      }
    }

    // #4 BOOT : R4, C3-C4
    {
      const cx = tx + colWArr[0] + u * 2;
      const cw = u * 2;
      const ch = rowHArr[4];
      const d  = sd['boot'];
      if (d && d.blob) {
        const url = await blobToDataUrl(d.blob);
        const fit = calcImageFit(cw - pad*2, ch - pad*2, 4, 3);
        slide.addImage({ data:url, x:cx+pad+fit.offX, y:row2BaseY+pad+fit.offY, w:fit.w, h:fit.h });
      }
    }

    // #5 CLAMP-SHAFT : R4, C5-C6
    {
      const cx = tx + colWArr[0] + u * 4;
      const cw = u * 2;
      const ch = rowHArr[4];
      const d  = sd['clamp_shaft'];
      if (d && d.blob) {
        const url = await blobToDataUrl(d.blob);
        const fit = calcImageFit(cw - pad*2, ch - pad*2, 9, 16);
        slide.addImage({ data:url, x:cx+pad+fit.offX, y:row2BaseY+pad+fit.offY, w:fit.w, h:fit.h });
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// Visual PPT 메인 생성 함수
// ═══════════════════════════════════════════════════════════════
window.generateVisualPPT = async function({ visualData }) {
  if (typeof PptxGenJS === 'undefined') {
    throw new Error('pptxgenjs 라이브러리가 로드되지 않았습니다.');
  }
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  const now = new Date();

  addVisualCoverSlide(pptx, now);
  await addVisualSlide(pptx, visualData);

  const dateStr = now.toISOString().slice(0,10).replace(/-/g,'');
  const timeStr = now.toTimeString().slice(0,8).replace(/:/g,'');
  const fileName = `VisualReport_${dateStr}_${timeStr}.pptx`;
  const blob = await pptx.write({ outputType: 'blob' });
  return { blob, fileName };
};

// ═══════════════════════════════════════════════════════════════
// 360° PPT 메인 생성 함수
// ═══════════════════════════════════════════════════════════════
window.generateJointReportPPT = async function({ capturedData, selectedSides, segments }) {
  if (typeof PptxGenJS === 'undefined') {
    throw new Error('pptxgenjs 라이브러리가 로드되지 않았습니다. 인터넷 연결을 확인해 주세요.');
  }
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  const now = new Date();

  // 1. 표지
  addCoverSlide(pptx, selectedSides, now);

  // 2. 사이드별 슬라이드
  for (const side of ['outboard', 'inboard']) {
    if (!selectedSides[side]) continue;
    const sideLabel = side === 'outboard' ? 'Outboard' : 'Inboard';
    const segs      = segments[side] || 6;
    const raceCols  = segs <= 6 ? 3 : 4;
    const sideData  = capturedData[side];

    for (const prod of PRODUCTS_DEF) {
      const shots = sideData[prod.id] || [];
      if (shots.length === 0) continue;
      const ratio = CROP_RATIO_PPT[prod.id];

      if (prod.id === 'ball') {
        await addBallSlide(pptx, `BALL  —  ${sideLabel}`, shots[0]);

      } else if (prod.id === 'cage') {
        const cageCols   = segs <= 6 ? 3 : 4;
        const cageLabels = [
          ...Array.from({ length: segs }, (_, i) => `F${i + 1}`),
          ...Array.from({ length: segs }, (_, i) => `B${i + 1}`),
        ];
        await addProductSlide(pptx, `CAGE  —  ${sideLabel}`, shots, cageCols, ratio, cageLabels);

      } else {
        await addProductSlide(pptx, `${prod.name}  —  ${sideLabel}`, shots, raceCols, ratio);
      }
    }
  }

  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
  const fileName = `JointReport_${dateStr}_${timeStr}.pptx`;
  const blob = await pptx.write({ outputType: 'blob' });
  return { blob, fileName };
};
