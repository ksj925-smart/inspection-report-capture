// ═══════════════════════════════════════════════════════════════
// Joint Report — 360° Inspection Capture App
// ═══════════════════════════════════════════════════════════════

const { useState, useEffect, useRef, useMemo, useCallback } = React;

// ─── Google API 설정 ──────────────────────────────────────────
const GOOGLE_CLIENT_ID   = window.GOOGLE_CLIENT_ID   || 'YOUR_CLIENT_ID.apps.googleusercontent.com';
const GOOGLE_DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const DRIVE_UPLOAD_URL   = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
const DRIVE_FOLDER_URL   = 'https://www.googleapis.com/drive/v3/files';

// ─── 디자인 토큰 ──────────────────────────────────────────────
const C = {
  bg: '#0B0C0E', surface: '#15171B', surfaceHi: '#1C1F25',
  border: '#26292F', borderHi: '#363A42',
  text: '#F5F5F7', dim: '#9CA0AA', dimmer: '#5C616B',
  accent: '#C8FF3D', accentDim: '#8FB820',
  danger: '#FF5A47', amber: '#FFB547',
  blue: '#1F5C8B',
};
const FONT_SANS = '"Pretendard","Pretendard Variable",-apple-system,system-ui,sans-serif';
const FONT_MONO = '"JetBrains Mono","SF Mono",ui-monospace,monospace';

// ─── 부품 정의 ────────────────────────────────────────────────
const PRODUCTS = [
  { id: 'outer_race', name: 'OUTER RACE', kor: '외륜',   formula: 'x1', desc: '구간 수 만큼 촬영' },
  { id: 'inner_race', name: 'INNER RACE', kor: '내륜',   formula: 'x1', desc: '구간 수 만큼 촬영' },
  { id: 'cage',       name: 'CAGE',       kor: '케이지',  formula: 'x2', desc: '구간 수 × 2' },
  { id: 'ball',       name: 'BALL',       kor: '볼',     formula: 'x1', desc: '단일 1장' },
];
const SIDES = ['outboard', 'inboard'];
const SIDE_LABEL = { outboard: 'Outboard', inboard: 'Inboard' };

const shotCount = (p, segments) => {
  if (p.id === 'ball') return 1;
  if (p.id === 'cage') return segments * 2;
  return segments;
};
const emptyCapture = () => ({ outer_race: [], inner_race: [], cage: [], ball: [] });

// ─── 제품별 촬영 비율 (w:h) ───────────────────────────────────
const CROP_RATIO = {
  outer_race: [3, 4],  // 세로
  inner_race: [3, 4],  // 세로
  cage:       [8, 3],  // 가로 와이드
  ball:       [4, 3],  // 가로
};

// 100×100 viewBox 기준 가이드 프레임 좌표 계산
function getGuideRect(productId) {
  const [rw, rh] = CROP_RATIO[productId] || [4, 3];
  if (rw >= rh) {
    // 가로형 — 폭 기준
    const w = 90, h = w * rh / rw;
    return { x: (100-w)/2, y: (100-h)/2, w, h };
  } else {
    // 세로형 — 높이 기준
    const h = 82, w = h * rw / rh;
    return { x: (100-w)/2, y: (100-h)/2, w, h };
  }
}

// ─── 부품 아이콘 ──────────────────────────────────────────────
function ProductIcon({ id, color = C.text, size = 28 }) {
  const s = 1.6;
  if (id === 'outer_race') return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <circle cx="14" cy="14" r="12" stroke={color} strokeWidth={s}/>
      <circle cx="14" cy="14" r="7"  stroke={color} strokeWidth={s} opacity="0.3"/>
    </svg>
  );
  if (id === 'inner_race') return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <circle cx="14" cy="14" r="12" stroke={color} strokeWidth={s} opacity="0.3"/>
      <circle cx="14" cy="14" r="7"  stroke={color} strokeWidth={s}/>
      <circle cx="14" cy="14" r="3"  stroke={color} strokeWidth={s} opacity="0.3"/>
    </svg>
  );
  if (id === 'cage') return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <circle cx="14" cy="14" r="11" stroke={color} strokeWidth={s}/>
      {[0,1,2,3,4,5].map(i => {
        const a = (i*60)*Math.PI/180;
        return <line key={i} x1={14+Math.cos(a)*8} y1={14+Math.sin(a)*8}
          x2={14+Math.cos(a)*14} y2={14+Math.sin(a)*14} stroke={color} strokeWidth={s}/>;
      })}
    </svg>
  );
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <circle cx="14" cy="14" r="9" stroke={color} strokeWidth={s}/>
      <circle cx="11" cy="11" r="2" fill={color} opacity="0.45"/>
    </svg>
  );
}

// ─── 썸네일 ───────────────────────────────────────────────────
function Thumb({ product, idx, imageUrl, onTap }) {
  return (
    <button onClick={onTap} style={{
      position:'relative', width:'100%', aspectRatio:'1/1',
      border:`1px solid ${C.border}`, borderRadius:8, overflow:'hidden',
      background: imageUrl ? 'transparent' : C.surfaceHi,
      cursor:'pointer', padding:0,
    }}>
      {imageUrl ? (
        <img src={imageUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
      ) : (
        <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',opacity:0.4}}>
          <ProductIcon id={product} color="#fff" size={28}/>
        </div>
      )}
      <div style={{position:'absolute',left:5,bottom:4,fontFamily:FONT_MONO,fontSize:7,color:C.dim}}>
        #{idx}
      </div>
    </button>
  );
}

// ─── 부품 카드 ────────────────────────────────────────────────
function ProductCard({ product, segments, status, count, onTap, disabled }) {
  const total    = shotCount(product, segments);
  const isDone   = status === 'done';
  const isShooting = status === 'shooting';
  return (
    <button onClick={onTap} disabled={disabled} style={{
      textAlign:'left', display:'flex', flexDirection:'column', gap:10,
      padding:'14px 12px', borderRadius:14, minWidth:0,
      background: isShooting ? `${C.accent}10` : C.surface,
      border:`1px solid ${isShooting ? C.accent : isDone ? C.accentDim+'80' : C.border}`,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled && !isShooting ? 0.55 : 1,
      fontFamily:FONT_SANS, color:C.text,
    }}>
      <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:6}}>
        <div style={{display:'flex', alignItems:'center', gap:8, flex:1, minWidth:0}}>
          <div style={{
            width:32, height:32, borderRadius:8, flexShrink:0,
            background: isShooting ? C.accent : C.surfaceHi,
            display:'flex', alignItems:'center', justifyContent:'center',
            border:`1px solid ${isShooting ? C.accent : C.border}`,
          }}>
            <ProductIcon id={product.id} color={isShooting ? C.bg : C.text} size={20}/>
          </div>
          <div style={{minWidth:0,flex:1}}>
            <div style={{fontSize:11,fontWeight:700,letterSpacing:0.4}}>{product.name}</div>
            <div style={{fontSize:10,color:C.dim,marginTop:2}}>{product.kor}</div>
          </div>
        </div>
        <div style={{
          fontFamily:FONT_MONO,fontSize:10,color:isShooting?C.accent:C.dim,
          background:C.bg,border:`1px solid ${C.border}`,
          padding:'2px 6px',borderRadius:5,flexShrink:0,
        }}>{product.formula}</div>
      </div>
      <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:6}}>
        <div style={{display:'flex', alignItems:'center', gap:6}}>
          <div style={{
            width:7, height:7, borderRadius:'50%', flexShrink:0,
            background: isDone ? C.accent : isShooting ? C.accent : C.dimmer,
            boxShadow: isShooting ? `0 0 8px ${C.accent}` : 'none',
            animation: isShooting ? 'pulse 1.2s ease-in-out infinite' : 'none',
          }}/>
          <div style={{fontSize:11,color:C.dim,fontFamily:FONT_MONO}}>
            {isDone ? '완료' : isShooting ? '촬영중' : '대기'}
          </div>
        </div>
        <div style={{display:'flex', alignItems:'baseline', gap:3}}>
          <span style={{fontFamily:FONT_MONO,fontSize:18,fontWeight:600,
            color: isDone||isShooting ? C.accent : C.text}}>{count}</span>
          <span style={{fontFamily:FONT_MONO,fontSize:11,color:C.dim}}>/ {total}</span>
        </div>
      </div>
    </button>
  );
}

// ─── 카메라 화면 ──────────────────────────────────────────────
function CameraScreen({ product, segments, shotIndex, totalShots, paused, onCapture, onStop, onResume, capturedImages }) {
  const videoRef  = useRef(null);
  const streamRef = useRef(null);
  const [camReady, setCamReady] = useState(false);
  const [flash,    setFlash]    = useState(false);
  const [camError, setCamError] = useState(null);

  const isCage = product.id === 'cage';
  const side   = isCage && shotIndex >= segments ? 'BACK' : 'FRONT';

  useEffect(() => {
    let cancelled = false;
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          setCamReady(true);
        }
      } catch (err) { if (!cancelled) setCamError(err.message); }
    }
    startCamera();
    return () => { cancelled = true; streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, []);

  const handleShutter = useCallback(async () => {
    if (!videoRef.current || !camReady) return;
    setFlash(true); setTimeout(() => setFlash(false), 120);
    const video = videoRef.current;
    const vw    = video.videoWidth  || 1280;
    const vh    = video.videoHeight || 720;
    const [rw, rh] = CROP_RATIO[product.id] || [4, 3];

    // 중앙 크롭: 목표 비율에 맞게 소스 영역 계산
    let srcX, srcY, srcW, srcH;
    if (vw / vh > rw / rh) {
      // 비디오가 더 가로로 넓음 → 좌우 크롭
      srcH = vh; srcW = vh * rw / rh;
      srcX = (vw - srcW) / 2; srcY = 0;
    } else {
      // 비디오가 더 세로로 긺 → 상하 크롭
      srcW = vw; srcH = vw * rh / rw;
      srcX = 0; srcY = (vh - srcH) / 2;
    }

    const canvas = document.createElement('canvas');
    canvas.width  = Math.round(srcW);
    canvas.height = Math.round(srcH);
    canvas.getContext('2d').drawImage(video, srcX, srcY, srcW, srcH, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      onCapture(blob, url);
    }, 'image/jpeg', 0.92);
  }, [camReady, onCapture, product.id]);

  if (camError) return (
    <div style={{position:'absolute',inset:0,zIndex:100,background:C.bg,
      display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:24,gap:16}}>
      <div style={{fontSize:40}}>📷</div>
      <div style={{fontSize:16,fontWeight:700,color:C.text}}>카메라 접근 필요</div>
      <div style={{fontSize:13,color:C.dim,textAlign:'center',lineHeight:1.6}}>
        브라우저에서 카메라 권한을 허용해 주세요.
      </div>
      <div style={{fontFamily:FONT_MONO,fontSize:11,color:C.danger,padding:'8px 12px',background:`${C.danger}15`,borderRadius:8}}>
        {camError}
      </div>
      <button onClick={onStop} style={{height:48,padding:'0 24px',borderRadius:12,
        background:C.surface,border:`1px solid ${C.border}`,color:C.text,fontSize:14,fontWeight:600,cursor:'pointer'}}>
        돌아가기
      </button>
    </div>
  );

  return (
    <div style={{position:'absolute',inset:0,zIndex:100,background:'#000',display:'flex',flexDirection:'column'}}>
      <div style={{position:'relative',flex:1,overflow:'hidden'}}>
        <video ref={videoRef} id="camera-stream" playsInline muted autoPlay
          style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}/>
        {flash && <div style={{position:'absolute',inset:0,background:'white',opacity:0.7,pointerEvents:'none'}}/>}
        <div style={{position:'absolute',inset:0,pointerEvents:'none'}}>
          {(() => {
            const g = getGuideRect(product.id);
            const cx = g.x + g.w / 2, cy = g.y + g.h / 2;
            const hl = Math.min(g.w, g.h) * 0.12; // 코너 마커 길이
            return (
              <svg style={{position:'absolute',inset:0,width:'100%',height:'100%'}} viewBox="0 0 100 100" preserveAspectRatio="none">
                {/* 어두운 마스크 (가이드 바깥) */}
                <rect x="0" y="0" width="100" height="100" fill="rgba(0,0,0,0.35)"/>
                <rect x={g.x} y={g.y} width={g.w} height={g.h} fill="rgba(0,0,0,0)" style={{mixBlendMode:'destination-out'}}/>
                {/* 가이드 프레임 테두리 */}
                <rect x={g.x} y={g.y} width={g.w} height={g.h} rx="0.8"
                  fill="none" stroke={`${C.accent}60`} strokeWidth="0.4" strokeDasharray="2 1.5"/>
                {/* 코너 마커 */}
                {[
                  [g.x, g.y, 1, 1], [g.x+g.w, g.y, -1, 1],
                  [g.x, g.y+g.h, 1, -1], [g.x+g.w, g.y+g.h, -1, -1],
                ].map(([px, py, dx, dy], i) => (
                  <g key={i} stroke={C.accent} strokeWidth="0.8" strokeLinecap="round">
                    <line x1={px} y1={py} x2={px + dx*hl} y2={py}/>
                    <line x1={px} y1={py} x2={px} y2={py + dy*hl}/>
                  </g>
                ))}
                {/* 중앙 크로스헤어 */}
                <line x1={cx} y1={cy-3} x2={cx} y2={cy+3} stroke={`${C.accent}80`} strokeWidth="0.3"/>
                <line x1={cx-3} y1={cy} x2={cx+3} y2={cy} stroke={`${C.accent}80`} strokeWidth="0.3"/>
              </svg>
            );
          })()}
          <div style={{position:'absolute',top:16,left:0,right:0,display:'flex',justifyContent:'center'}}>
            <div style={{background:'rgba(0,0,0,0.6)',backdropFilter:'blur(8px)',
              border:`1px solid ${C.border}`,borderRadius:20,padding:'6px 16px',
              display:'flex',alignItems:'center',gap:10}}>
              <div style={{fontFamily:FONT_MONO,fontSize:10,color:C.dim}}>
                {Math.round(shotIndex*360/totalShots)}°
              </div>
              <div style={{width:1,height:12,background:C.border}}/>
              <div style={{fontFamily:FONT_MONO,fontSize:10,color:C.accent}}>
                {product.name}{isCage && ` · ${side}`}
              </div>
              <div style={{width:1,height:12,background:C.border}}/>
              <div style={{fontFamily:FONT_MONO,fontSize:10,color:C.dim}}>
                {shotIndex+1}/{totalShots}
              </div>
            </div>
          </div>
          {!camReady && (
            <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
              <div style={{background:'rgba(0,0,0,0.7)',borderRadius:12,padding:'16px 24px',
                display:'flex',alignItems:'center',gap:10}}>
                <div style={{width:16,height:16,border:`2px solid ${C.accent}`,borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>
                <span style={{fontSize:13,color:C.text}}>카메라 준비 중...</span>
              </div>
            </div>
          )}
        </div>
        <div style={{position:'absolute',left:10,bottom:10,display:'flex',flexDirection:'column',gap:4}}>
          {capturedImages.slice(-4).map((url,i) => (
            <div key={i} style={{width:44,height:44,borderRadius:6,overflow:'hidden',border:`1px solid ${C.border}`,opacity:0.85}}>
              <img src={url} style={{width:'100%',height:'100%',objectFit:'cover'}}/>
            </div>
          ))}
        </div>
        <button onClick={onStop} style={{position:'absolute',top:16,right:16,
          background:'rgba(0,0,0,0.6)',backdropFilter:'blur(8px)',
          border:`1px solid ${C.danger}`,color:C.danger,
          padding:'6px 14px',borderRadius:18,fontSize:12,fontWeight:600,
          fontFamily:FONT_SANS,cursor:'pointer'}}>중단</button>
      </div>

      <div style={{background:'rgba(0,0,0,0.85)',backdropFilter:'blur(20px)',
        padding:'20px 24px',paddingBottom:'max(20px, env(safe-area-inset-bottom))',
        display:'flex',alignItems:'center',justifyContent:'space-between',gap:16}}>
        <div style={{flex:1}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
            <span style={{fontFamily:FONT_MONO,fontSize:10,color:C.dim}}>진행</span>
            <span style={{fontFamily:FONT_MONO,fontSize:10,color:C.accent}}>{shotIndex}/{totalShots}</span>
          </div>
          <div style={{height:3,background:C.surface,borderRadius:2}}>
            <div style={{height:'100%',width:`${(shotIndex/totalShots)*100}%`,
              background:C.accent,borderRadius:2,transition:'width 0.3s ease'}}/>
          </div>
        </div>
        <button onClick={handleShutter} disabled={!camReady} style={{
          width:72,height:72,borderRadius:36,flexShrink:0,
          background: camReady ? C.accent : C.dimmer,
          border:'4px solid rgba(255,255,255,0.3)',
          cursor: camReady ? 'pointer' : 'not-allowed',
          display:'flex',alignItems:'center',justifyContent:'center',
          boxShadow: camReady ? `0 0 24px ${C.accent}60` : 'none',
        }}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <circle cx="14" cy="14" r="10" fill={C.bg}/>
            <circle cx="14" cy="14" r="6"  fill={C.bg} stroke={C.accent} strokeWidth="1.5"/>
          </svg>
        </button>
        <div style={{flex:1,textAlign:'right'}}>
          <div style={{fontFamily:FONT_MONO,fontSize:10,color:C.dim,marginBottom:4}}>다음 각도</div>
          <div style={{fontFamily:FONT_MONO,fontSize:14,color:C.text,fontWeight:600}}>
            {Math.round((shotIndex+1)*360/totalShots)}°
          </div>
        </div>
      </div>

      {paused && (
        <div style={{position:'absolute',inset:0,zIndex:110,
          background:'rgba(11,12,14,0.94)',backdropFilter:'blur(10px)',
          display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'0 28px'}}>
          <div style={{width:110,height:110,borderRadius:55,background:C.surfaceHi,
            border:`1px solid ${C.accent}`,display:'flex',alignItems:'center',justifyContent:'center',
            marginBottom:22,boxShadow:`0 0 60px ${C.accent}30`}}>
            <svg width="52" height="52" viewBox="0 0 56 56" fill="none">
              <ellipse cx="28" cy="36" rx="18" ry="6" stroke={C.accent} strokeWidth="2"/>
              <path d="M11 18 Q28 6 45 18" stroke={C.accent} strokeWidth="2" fill="none" strokeLinecap="round"/>
              <path d="M45 18 L45 11 M45 18 L38 18" stroke={C.accent} strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div style={{fontSize:10,color:C.accent,fontFamily:FONT_MONO,letterSpacing:1.5,marginBottom:8,textAlign:'center'}}>
            FLIP REQUIRED · 앞면 {segments}장 완료
          </div>
          <div style={{fontSize:22,fontWeight:700,color:C.text,letterSpacing:-0.3,marginBottom:10,textAlign:'center'}}>
            제품을 뒤집어주세요
          </div>
          <div style={{fontSize:12,color:C.dim,lineHeight:1.55,textAlign:'center',marginBottom:28}}>
            CAGE를 분리해 뒤집은 후 다시 올려주세요
          </div>
          <div style={{display:'flex',gap:8,width:'100%'}}>
            <button onClick={onStop} style={{flex:1,height:48,borderRadius:12,
              background:'none',border:`1px solid ${C.border}`,color:C.text,
              fontSize:13,fontWeight:500,fontFamily:FONT_SANS,cursor:'pointer'}}>중단</button>
            <button onClick={onResume} style={{flex:2,height:48,borderRadius:12,
              background:C.accent,color:C.bg,fontSize:13,fontWeight:700,
              fontFamily:FONT_SANS,cursor:'pointer',border:'none',
              display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
              뒤집었어요
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M5 3l5 5-5 5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Google OAuth 로그인 화면 ─────────────────────────────────
function LoginScreen({ onLogin }) {
  const [error, setError] = useState(null);
  const handleGoogleLogin = () => {
    if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID.includes('YOUR_CLIENT_ID')) {
      setError('Google Client ID가 설정되지 않았습니다.');
      return;
    }
    const redirectUri = window.location.origin + window.location.pathname;
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'token',
      scope: GOOGLE_DRIVE_SCOPE,
      prompt: 'select_account',
    });
    window.location.href = 'https://accounts.google.com/o/oauth2/v2/auth?' + params.toString();
  };

  return (
    <div style={{height:'100%',display:'flex',flexDirection:'column',
      alignItems:'center',justifyContent:'center',background:C.bg,padding:32}}>
      <div style={{width:88,height:88,borderRadius:24,marginBottom:28,
        background:C.surface,border:`1px solid ${C.border}`,
        display:'flex',alignItems:'center',justifyContent:'center',
        boxShadow:`0 0 60px ${C.accent}20`}}>
        <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
          <circle cx="22" cy="22" r="18" stroke={C.accent} strokeWidth="2"/>
          <circle cx="22" cy="22" r="10" stroke={C.accent} strokeWidth="1.5" opacity="0.5"/>
          <circle cx="22" cy="22" r="3"  fill={C.accent}/>
          {[0,1,2,3,4,5].map(i => {
            const a=(i*60-90)*Math.PI/180;
            return <circle key={i} cx={22+Math.cos(a)*18} cy={22+Math.sin(a)*18} r="2.5" fill={C.accent}/>;
          })}
        </svg>
      </div>
      <div style={{fontSize:10,color:C.dim,fontFamily:FONT_MONO,letterSpacing:1.8,marginBottom:8}}>
        JOINT REPORT
      </div>
      <div style={{fontSize:26,fontWeight:700,color:C.text,letterSpacing:-0.5,marginBottom:8,textAlign:'center'}}>
        Joint 360° Inspection
      </div>
      <div style={{fontSize:13,color:C.dim,textAlign:'center',lineHeight:1.6,marginBottom:48,maxWidth:280}}>
        Google 계정으로 로그인하면<br/>촬영 후 Drive에 자동 업로드됩니다
      </div>
      {error && (
        <div style={{width:'100%',maxWidth:320,padding:'12px 16px',borderRadius:10,marginBottom:16,
          background:`${C.danger}15`,border:`1px solid ${C.danger}40`,
          fontSize:12,color:C.danger,lineHeight:1.5,textAlign:'center'}}>{error}</div>
      )}
      <button onClick={handleGoogleLogin} style={{
        width:'100%',maxWidth:320,height:52,borderRadius:14,
        background:'#fff',border:'1px solid #ddd',color:'#1a1a1a',
        fontSize:15,fontWeight:600,fontFamily:FONT_SANS,cursor:'pointer',
        display:'flex',alignItems:'center',justifyContent:'center',gap:10,
      }}>
        <svg width="20" height="20" viewBox="0 0 48 48">
          <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
          <path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
          <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
          <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
        </svg>
        Google로 로그인
      </button>
      <div style={{marginTop:24,fontSize:11,color:C.dimmer,textAlign:'center',lineHeight:1.6,maxWidth:280}}>
        Drive 파일 접근 권한만 요청합니다.
      </div>
    </div>
  );
}

// ─── Drive 업로드 모달 ────────────────────────────────────────
function UploadModal({ capturedData, selectedSides, segments, accessToken, onClose, onDone }) {
  const [phase,    setPhase]    = useState('idle');
  const [progress, setProgress] = useState({ current: 0, total: 0, product: '' });
  const [errorMsg, setErrorMsg] = useState('');

  const createFolder = async (name, parentId = null) => {
    const meta = { name, mimeType: 'application/vnd.google-apps.folder',
      ...(parentId ? { parents: [parentId] } : {}) };
    const res  = await fetch(DRIVE_FOLDER_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(meta),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Drive 폴더 생성 실패');
    return data.id;
  };

  const uploadFile = async (blob, filename, parentId) => {
    const meta      = JSON.stringify({ name: filename, parents: [parentId] });
    const boundary  = '----FormBoundary' + Math.random().toString(36).slice(2);
    const metaBytes = new TextEncoder().encode(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: image/jpeg\r\n\r\n`
    );
    const endBytes  = new TextEncoder().encode(`\r\n--${boundary}--`);
    const blobData  = await blob.arrayBuffer();
    const body      = new Uint8Array(metaBytes.byteLength + blobData.byteLength + endBytes.byteLength);
    body.set(metaBytes, 0);
    body.set(new Uint8Array(blobData), metaBytes.byteLength);
    body.set(endBytes, metaBytes.byteLength + blobData.byteLength);
    const res = await fetch(DRIVE_UPLOAD_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error?.message || '파일 업로드 실패'); }
  };

  // HANSAE 폴더 찾기 또는 생성
  const findOrCreateHansae = async () => {
    const q = encodeURIComponent(`name='HANSAE' and mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false`);
    const res  = await fetch(`${DRIVE_FOLDER_URL}?q=${q}&fields=files(id,name)`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json();
    if (data.files && data.files.length > 0) return data.files[0].id;
    return await createFolder('HANSAE'); // 없으면 생성
  };

  const startUpload = async () => {
    setPhase('uploading');
    try {
      const now      = new Date();
      const dateStr  = now.toISOString().slice(0,10).replace(/-/g,'');
      const timeStr  = now.toTimeString().slice(0,8).replace(/:/g,'');
      const hansaeId = await findOrCreateHansae();
      const rootId   = await createFolder(`JointReport_${dateStr}_${timeStr}`, hansaeId);

      let total = 0;
      for (const side of SIDES) {
        if (!selectedSides[side]) continue;
        for (const arr of Object.values(capturedData[side])) total += arr.length;
      }
      let current = 0;

      for (const side of SIDES) {
        if (!selectedSides[side]) continue;
        const sideId = await createFolder(SIDE_LABEL[side], rootId);
        for (const prod of PRODUCTS) {
          const blobList = capturedData[side][prod.id] || [];
          if (blobList.length === 0) continue;
          const subId = await createFolder(prod.name, sideId);
          for (let i = 0; i < blobList.length; i++) {
            const filename = `${prod.id}_${String(i+1).padStart(2,'0')}.jpg`;
            setProgress({ current: ++current, total, product: `${SIDE_LABEL[side]} · ${prod.name}` });
            await uploadFile(blobList[i].blob, filename, subId);
          }
        }
      }
      setPhase('done');
    } catch (err) {
      setErrorMsg(err.message);
      setPhase('error');
    }
  };

  // 요약
  const summaryRows = [];
  for (const side of SIDES) {
    if (!selectedSides[side]) continue;
    for (const prod of PRODUCTS) {
      const n = (capturedData[side][prod.id] || []).length;
      if (n > 0) summaryRows.push({ side: SIDE_LABEL[side], prod, n });
    }
  }
  const totalCount = summaryRows.reduce((s, r) => s + r.n, 0);

  return (
    <div style={{position:'absolute',inset:0,zIndex:200,
      background:'rgba(0,0,0,0.75)',backdropFilter:'blur(8px)',
      display:'flex',alignItems:'flex-end',justifyContent:'center'}}
      onClick={phase === 'idle' ? onClose : undefined}>
      <div onClick={e => e.stopPropagation()} style={{
        background:C.surface,border:`1px solid ${C.borderHi}`,
        borderRadius:'20px 20px 0 0',width:'100%',maxWidth:480,
        padding:24,paddingBottom:'max(24px, env(safe-area-inset-bottom))',
      }}>
        {phase === 'idle' && (
          <>
            <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:20}}>
              <div style={{width:44,height:44,borderRadius:22,
                background:`${C.accent}15`,border:`1px solid ${C.accent}40`,
                display:'flex',alignItems:'center',justifyContent:'center'}}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path d="M7 18a4.5 4.5 0 01-.5-8.97A6 6 0 0118 9.5a4.5 4.5 0 01-.5 8.5H7z" stroke={C.accent} strokeWidth="1.7" fill="none"/>
                  <path d="M12 11v6M9.5 13.5L12 11l2.5 2.5" stroke={C.accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div>
                <div style={{fontSize:16,fontWeight:700,color:C.text}}>Google Drive 업로드</div>
                <div style={{fontSize:12,color:C.dim,marginTop:2}}>총 {totalCount}장 · JointReport 폴더</div>
              </div>
            </div>
            <div style={{background:C.bg,borderRadius:12,padding:12,marginBottom:20,display:'flex',flexDirection:'column',gap:7}}>
              {summaryRows.map((r, i) => (
                <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <ProductIcon id={r.prod.id} size={14}/>
                    <span style={{fontSize:11,color:C.text,fontWeight:600}}>{r.prod.name}</span>
                    <span style={{fontSize:10,color:C.dim}}>({r.side})</span>
                  </div>
                  <span style={{fontFamily:FONT_MONO,fontSize:11,color:C.accent}}>{r.n}장</span>
                </div>
              ))}
            </div>
            <div style={{display:'flex',gap:8}}>
              <button onClick={onClose} style={{flex:1,height:48,borderRadius:12,
                background:'none',border:`1px solid ${C.border}`,color:C.text,
                fontSize:14,fontWeight:500,cursor:'pointer'}}>취소</button>
              <button onClick={startUpload} style={{flex:2,height:48,borderRadius:12,
                background:C.accent,color:C.bg,fontSize:14,fontWeight:700,cursor:'pointer',
                display:'flex',alignItems:'center',justifyContent:'center',gap:8,border:'none'}}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M7 18a4.5 4.5 0 01-.5-8.97A6 6 0 0118 9.5a4.5 4.5 0 01-.5 8.5H7z" stroke="currentColor" strokeWidth="1.7" fill="none"/>
                  <path d="M12 11v6M9.5 13.5L12 11l2.5 2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                업로드 시작
              </button>
            </div>
          </>
        )}
        {phase === 'uploading' && (
          <div style={{textAlign:'center',padding:'8px 0'}}>
            <div style={{width:64,height:64,borderRadius:32,margin:'0 auto 20px',
              background:`${C.accent}15`,border:`1px solid ${C.accent}40`,
              display:'flex',alignItems:'center',justifyContent:'center'}}>
              <div style={{width:28,height:28,border:`3px solid ${C.accent}`,borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>
            </div>
            <div style={{fontSize:16,fontWeight:700,color:C.text,marginBottom:6}}>업로드 중...</div>
            <div style={{fontSize:13,color:C.dim,marginBottom:20}}>{progress.product} · {progress.current}/{progress.total}장</div>
            <div style={{height:4,background:C.bg,borderRadius:2,overflow:'hidden'}}>
              <div style={{height:'100%',background:C.accent,borderRadius:2,
                width:`${progress.total > 0 ? (progress.current/progress.total)*100 : 0}%`,
                transition:'width 0.3s ease'}}/>
            </div>
          </div>
        )}
        {phase === 'done' && (
          <div style={{textAlign:'center',padding:'8px 0'}}>
            <div style={{width:64,height:64,borderRadius:32,margin:'0 auto 20px',
              background:`${C.accent}15`,border:`1px solid ${C.accent}`,
              display:'flex',alignItems:'center',justifyContent:'center'}}>
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <path d="M6 14l6 6L22 8" stroke={C.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div style={{fontSize:18,fontWeight:700,color:C.text,marginBottom:6}}>업로드 완료!</div>
            <div style={{fontSize:13,color:C.dim,marginBottom:24}}>
              총 {totalCount}장이 Google Drive에 저장되었습니다
            </div>
            <button onClick={onDone} style={{width:'100%',height:48,borderRadius:12,
              background:C.accent,color:C.bg,border:'none',fontSize:14,fontWeight:700,cursor:'pointer'}}>
              확인
            </button>
          </div>
        )}
        {phase === 'error' && (
          <div style={{textAlign:'center',padding:'8px 0'}}>
            <div style={{fontSize:40,marginBottom:16}}>⚠️</div>
            <div style={{fontSize:16,fontWeight:700,color:C.danger,marginBottom:8}}>업로드 실패</div>
            <div style={{fontSize:12,color:C.dim,marginBottom:20,lineHeight:1.6}}>{errorMsg}</div>
            <div style={{display:'flex',gap:8}}>
              <button onClick={onClose} style={{flex:1,height:44,borderRadius:10,
                background:'none',border:`1px solid ${C.border}`,color:C.text,cursor:'pointer'}}>닫기</button>
              <button onClick={startUpload} style={{flex:1,height:44,borderRadius:10,
                background:C.accent,color:C.bg,border:'none',cursor:'pointer',fontWeight:700}}>재시도</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 토스트 ──────────────────────────────────────────────────
function Toast({ message, visible }) {
  return (
    <div style={{
      position:'absolute',bottom: visible ? 90 : 40,left:'50%',transform:'translateX(-50%)',
      background:C.surfaceHi,border:`1px solid ${C.border}`,
      padding:'10px 16px',borderRadius:24,color:C.text,fontSize:13,fontFamily:FONT_SANS,
      opacity: visible ? 1 : 0,transition:'all 0.3s',pointerEvents:'none',
      zIndex:300,boxShadow:'0 10px 30px rgba(0,0,0,0.4)',whiteSpace:'nowrap',
    }}>{message}</div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ─── 메인 앱 ─────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
function CaptureApp() {
  const [accessToken, setAccessToken] = useState(null);

  // STEP 1: side 선택
  const [selectedSides, setSelectedSides] = useState({ outboard: true, inboard: false });
  // STEP 2: side별 구간
  const [segments, setSegments] = useState({ outboard: 6, inboard: 6 });
  // 현재 보이는 탭
  const [currentSide, setCurrentSide] = useState('outboard');
  // STEP 3: side별 촬영 데이터
  const [capturedData, setCapturedData] = useState({
    outboard: emptyCapture(),
    inboard:  emptyCapture(),
  });

  // 촬영 상태
  const [activeId,   setActiveId]   = useState(null);
  const [activeSide, setActiveSide] = useState(null); // 촬영 중 고정
  const [shotIndex,  setShotIndex]  = useState(0);
  const [paused,     setPaused]     = useState(false);
  const [flipped,    setFlipped]    = useState(false);

  // UI 상태
  const [view,         setView]         = useState('capture');
  const [showUpload,   setShowUpload]   = useState(false);
  const [uploadDone,   setUploadDone]   = useState(false);
  const [pptLoading,   setPptLoading]   = useState(false);
  const [confirmRetake, setConfirmRetake] = useState(null); // { side, productId }
  const [toast,        setToast]        = useState(null);

  // OAuth redirect 처리
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;
    const params = new URLSearchParams(hash.slice(1));
    const token  = params.get('access_token');
    if (token) {
      setAccessToken(token);
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }, []);

  // ── 진행 계산 ──────────────────────────────────────────────
  const progressBySide = useMemo(() => {
    const res = {};
    for (const side of SIDES) {
      const p = {};
      for (const [k, arr] of Object.entries(capturedData[side])) p[k] = arr.length;
      res[side] = p;
    }
    return res;
  }, [capturedData]);

  const totalShotsFor = (side) =>
    Object.values(progressBySide[side]).reduce((a, b) => a + b, 0);
  const totalExpectedFor = (side) =>
    PRODUCTS.reduce((s, p) => s + shotCount(p, segments[side]), 0);
  const allDoneFor = (side) =>
    selectedSides[side] && totalShotsFor(side) === totalExpectedFor(side);

  const curSegs        = segments[currentSide];
  const curProgress    = progressBySide[currentSide];
  const curTotalShots  = totalShotsFor(currentSide);
  const curExpected    = totalExpectedFor(currentSide);
  const curAllDone     = allDoneFor(currentSide);

  const isShooting      = !!activeId;
  const segmentsLocked  = isShooting || curTotalShots > 0;
  const activeProd      = PRODUCTS.find(p => p.id === activeId);

  const anyShotsTotal   = SIDES.some(s => totalShotsFor(s) > 0);
  const allSidesDone    = SIDES.filter(s => selectedSides[s]).every(s => allDoneFor(s));

  // ── 셔터 콜백 ──────────────────────────────────────────────
  const handleCapture = useCallback((blob, url) => {
    const prod  = PRODUCTS.find(p => p.id === activeId);
    const total = shotCount(prod, segments[activeSide]);
    const next  = shotIndex + 1;

    setCapturedData(prev => ({
      ...prev,
      [activeSide]: {
        ...prev[activeSide],
        [activeId]: [...prev[activeSide][activeId], { blob, url }],
      },
    }));

    if (activeId === 'cage' && next === segments[activeSide] && !flipped) {
      setShotIndex(next);
      setPaused(true);
      return;
    }
    if (next >= total) {
      setShotIndex(0);
      setActiveId(null);
      setActiveSide(null);
      setFlipped(false);
      showToast(`${prod.name} 촬영 완료 · ${total}장 저장됨`);
      return;
    }
    setShotIndex(next);
  }, [activeId, activeSide, shotIndex, segments, flipped, showToast]);

  const startCapture = (productId) => {
    if (activeId) return;
    setCapturedData(prev => ({
      ...prev,
      [currentSide]: { ...prev[currentSide], [productId]: [] },
    }));
    setShotIndex(0);
    setPaused(false);
    setFlipped(false);
    setActiveSide(currentSide);
    setActiveId(productId);
  };

  const stopCapture = () => {
    setActiveId(null);
    setActiveSide(null);
    setShotIndex(0);
    setPaused(false);
    setFlipped(false);
    showToast('촬영 중단됨');
  };

  const retakeProduct = ({ side, productId }) => {
    setCapturedData(prev => ({
      ...prev,
      [side]: { ...prev[side], [productId]: [] },
    }));
    setConfirmRetake(null);
    setView('capture');
    setCurrentSide(side);
    setTimeout(() => startCapture(productId), 50);
  };

  const resetAll = () => {
    if (activeId) return;
    setCapturedData({ outboard: emptyCapture(), inboard: emptyCapture() });
    setUploadDone(false);
    showToast('모든 촬영 데이터 초기화됨');
  };

  // ── PPT 생성 ───────────────────────────────────────────────
  const handleGeneratePPT = async () => {
    if (!window.generateJointReportPPT) {
      showToast('PPT 라이브러리 로딩 중... 잠시 후 재시도해주세요');
      return;
    }
    setPptLoading(true);
    try {
      await window.generateJointReportPPT({ capturedData, selectedSides, segments });
      showToast('PPT 생성 완료! 다운로드되었습니다');
    } catch (err) {
      showToast('PPT 생성 실패: ' + err.message);
    } finally {
      setPptLoading(false);
    }
  };

  // ── 로그인 전 ──────────────────────────────────────────────
  if (!accessToken) return <LoginScreen onLogin={setAccessToken}/>;

  // ── 카메라 화면 ────────────────────────────────────────────
  if (activeId) return (
    <div style={{height:'100%',position:'relative',background:'#000'}}>
      <CameraScreen
        product={activeProd}
        segments={segments[activeSide]}
        shotIndex={shotIndex}
        totalShots={shotCount(activeProd, segments[activeSide])}
        paused={paused}
        capturedImages={capturedData[activeSide][activeId].map(x => x.url)}
        onCapture={handleCapture}
        onStop={stopCapture}
        onResume={() => { setFlipped(true); setPaused(false); }}
      />
    </div>
  );

  // ── 갤러리 화면 ────────────────────────────────────────────
  if (view === 'gallery') {
    const allShots = [];
    for (const side of SIDES) {
      if (!selectedSides[side]) continue;
      for (const prod of PRODUCTS) {
        const shots = capturedData[side][prod.id];
        shots.forEach((s, i) => allShots.push({ side, prod, s, i }));
      }
    }
    return (
      <div style={{height:'100%',display:'flex',flexDirection:'column',
        background:C.bg,fontFamily:FONT_SANS,color:C.text,position:'relative'}}>
        <div style={{padding:'16px 20px 8px',paddingTop:'max(16px, env(safe-area-inset-top))',
          display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
          <button onClick={() => setView('capture')} style={{background:'none',border:'none',
            color:C.text,fontSize:14,cursor:'pointer',display:'flex',alignItems:'center',gap:4,padding:0}}>
            <svg width="16" height="16" viewBox="0 0 16 16">
              <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            촬영
          </button>
          <div style={{fontSize:12,fontWeight:700,letterSpacing:1,fontFamily:FONT_MONO}}>GALLERY</div>
          <div style={{fontFamily:FONT_MONO,fontSize:11,color:C.dim}}>{allShots.length}장</div>
        </div>

        <div style={{flex:1,overflowY:'auto',padding:'8px 16px 16px'}}>
          {SIDES.map(side => {
            if (!selectedSides[side]) return null;
            return (
              <div key={side}>
                <div style={{fontSize:10,color:C.blue,fontFamily:FONT_MONO,letterSpacing:1.5,
                  padding:'8px 4px 6px',fontWeight:700}}>
                  — {SIDE_LABEL[side].toUpperCase()}
                </div>
                {PRODUCTS.map(p => {
                  const shots = capturedData[side][p.id];
                  if (shots.length === 0) return null;
                  return (
                    <div key={p.id} style={{marginBottom:20}}>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <ProductIcon id={p.id} size={16}/>
                          <span style={{fontSize:12,fontWeight:700,letterSpacing:0.4}}>{p.name}</span>
                        </div>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <span style={{fontFamily:FONT_MONO,fontSize:11,color:C.accent}}>{shots.length}장</span>
                          <button onClick={() => setConfirmRetake({ side, productId: p.id })} style={{
                            background:'none',border:`1px solid ${C.border}`,color:C.text,
                            padding:'4px 10px',borderRadius:14,fontSize:11,cursor:'pointer'}}>재촬영</button>
                        </div>
                      </div>
                      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:6}}>
                        {shots.map((s, i) => (
                          <Thumb key={i} product={p.id} idx={i+1} imageUrl={s.url}
                            onTap={() => showToast(`${SIDE_LABEL[side]} · ${p.id}_${String(i+1).padStart(2,'0')}.jpg`)}/>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
          {allShots.length === 0 && (
            <div style={{textAlign:'center',padding:'80px 20px',color:C.dim,fontSize:13}}>
              아직 촬영된 사진이 없습니다
            </div>
          )}
        </div>

        {confirmRetake && (() => {
          const p = PRODUCTS.find(x => x.id === confirmRetake.productId);
          return (
            <div style={{position:'absolute',inset:0,zIndex:120,background:'rgba(0,0,0,0.7)',
              backdropFilter:'blur(6px)',display:'flex',alignItems:'center',justifyContent:'center',
              padding:'0 28px'}} onClick={() => setConfirmRetake(null)}>
              <div onClick={e => e.stopPropagation()} style={{background:C.surface,
                border:`1px solid ${C.borderHi}`,borderRadius:16,padding:'22px 22px 18px',
                width:'100%',maxWidth:320}}>
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
                  <ProductIcon id={p.id} size={32}/>
                  <div>
                    <div style={{fontSize:15,fontWeight:700}}>{p.name} 재촬영</div>
                    <div style={{fontSize:11,color:C.dim,marginTop:2}}>
                      {SIDE_LABEL[confirmRetake.side]} · {capturedData[confirmRetake.side][p.id].length}장이 삭제됩니다
                    </div>
                  </div>
                </div>
                <div style={{display:'flex',gap:8}}>
                  <button onClick={() => setConfirmRetake(null)} style={{flex:1,height:44,borderRadius:10,
                    background:'none',border:`1px solid ${C.border}`,color:C.text,cursor:'pointer'}}>취소</button>
                  <button onClick={() => retakeProduct(confirmRetake)} style={{flex:1.4,height:44,borderRadius:10,
                    background:C.accent,color:C.bg,border:'none',fontWeight:700,cursor:'pointer'}}>삭제 후 재촬영</button>
                </div>
              </div>
            </div>
          );
        })()}
        <Toast message={toast||''} visible={!!toast}/>
      </div>
    );
  }

  // ── 메인 캡처 화면 ─────────────────────────────────────────
  const bothSelected = selectedSides.outboard && selectedSides.inboard;

  return (
    <div style={{height:'100%',display:'flex',flexDirection:'column',
      background:C.bg,fontFamily:FONT_SANS,color:C.text,position:'relative'}}>

      {/* 헤더 */}
      <div style={{padding:'14px 20px 12px',paddingTop:'max(14px, env(safe-area-inset-top))',
        display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
        <div>
          <div style={{fontSize:9,color:C.dim,letterSpacing:2,fontFamily:FONT_MONO}}>JOINT REPORT</div>
          <div style={{fontSize:18,fontWeight:700,marginTop:2,letterSpacing:-0.3}}>
            Joint 360° Inspection
          </div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={() => { setAccessToken(null); resetAll(); }} style={{
            width:36,height:36,borderRadius:18,background:C.surface,
            border:`1px solid ${C.border}`,display:'flex',alignItems:'center',
            justifyContent:'center',cursor:'pointer'}} title="로그아웃">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 2h3a1 1 0 011 1v10a1 1 0 01-1 1h-3" stroke={C.dim} strokeWidth="1.4" strokeLinecap="round"/>
              <path d="M7 11l3-3-3-3M10 8H3" stroke={C.text} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button onClick={resetAll} disabled={isShooting} style={{
            width:36,height:36,borderRadius:18,background:C.surface,
            border:`1px solid ${C.border}`,display:'flex',alignItems:'center',
            justifyContent:'center',cursor: isShooting ? 'not-allowed' : 'pointer',
            opacity: isShooting ? 0.4 : 1}}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8a5 5 0 109-3" stroke={C.text} strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M12 2v3h-3" stroke={C.text} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

      <div style={{flex:1,overflowY:'auto',padding:'0 16px 16px'}}>

        {/* STEP 1: Side 선택 */}
        <div style={{marginBottom:14}}>
          <div style={{fontSize:10,color:C.dim,fontFamily:FONT_MONO,letterSpacing:1,
            padding:'0 4px 8px'}}>STEP 1 · SIDE SELECTION</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
            {SIDES.map(side => {
              const selected = selectedSides[side];
              const locked   = isShooting;
              const done     = allDoneFor(side);
              return (
                <button key={side} onClick={() => {
                  if (locked) { showToast('촬영 중에는 변경 불가'); return; }
                  const next = { ...selectedSides, [side]: !selected };
                  if (!next.outboard && !next.inboard) { showToast('최소 한 면을 선택해야 합니다'); return; }
                  setSelectedSides(next);
                  if (!next[currentSide]) setCurrentSide(side === 'outboard' ? 'inboard' : 'outboard');
                }} style={{
                  padding:'14px 12px',borderRadius:12,fontFamily:FONT_SANS,
                  background: selected ? `${C.blue}25` : C.surface,
                  border:`1px solid ${selected ? C.blue : C.border}`,
                  color: selected ? C.text : C.dim,
                  cursor: locked ? 'not-allowed' : 'pointer',
                  display:'flex',alignItems:'center',justifyContent:'space-between',
                }}>
                  <div>
                    <div style={{fontSize:14,fontWeight:700,letterSpacing:0.3,textAlign:'left'}}>
                      {SIDE_LABEL[side]}
                    </div>
                    {selected && (
                      <div style={{fontSize:9,fontFamily:FONT_MONO,color: done ? C.accent : C.dim,
                        marginTop:3,letterSpacing:0.5}}>
                        {done ? '완료' : `${totalShotsFor(side)}/${totalExpectedFor(side)}`}
                      </div>
                    )}
                  </div>
                  <div style={{
                    width:20,height:20,borderRadius:10,flexShrink:0,
                    background: selected ? C.blue : 'transparent',
                    border:`1.5px solid ${selected ? C.blue : C.border}`,
                    display:'flex',alignItems:'center',justifyContent:'center',
                  }}>
                    {selected && (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M2 5l2.5 2.5L8 2.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* STEP 2: 구간 선택 (side별) */}
        <div style={{marginBottom:14}}>
          <div style={{fontSize:10,color:C.dim,fontFamily:FONT_MONO,letterSpacing:1,
            padding:'0 4px 8px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <span>STEP 2 · SEGMENTS</span>
            <span style={{fontSize:9,color:C.dimmer}}>각 면 독립 설정 가능</span>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {SIDES.map(side => {
              if (!selectedSides[side]) return null;
              const segs   = segments[side];
              const locked = isShooting && activeSide === side ||
                             progressBySide[side] && Object.values(progressBySide[side]).some(n => n > 0);
              return (
                <div key={side} style={{background:C.surface,border:`1px solid ${C.border}`,
                  borderRadius:12,padding:'10px 12px'}}>
                  <div style={{fontSize:10,color:C.dim,fontFamily:FONT_MONO,letterSpacing:1,marginBottom:8,
                    display:'flex',alignItems:'center',gap:6}}>
                    <div style={{width:6,height:6,borderRadius:3,background:C.blue}}/>
                    {SIDE_LABEL[side].toUpperCase()}
                    {locked && (
                      <span style={{fontSize:8,color:C.amber,background:`${C.amber}20`,
                        border:`1px solid ${C.amber}40`,padding:'1px 5px',borderRadius:3,letterSpacing:1}}>
                        LOCKED
                      </span>
                    )}
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                    {[6, 8].map(n => {
                      const active = segs === n;
                      return (
                        <button key={n} onClick={() => {
                          if (locked) { showToast('촬영 시작 후에는 구간 변경 불가'); return; }
                          setSegments(prev => ({ ...prev, [side]: n }));
                        }} style={{
                          padding:'10px 12px',borderRadius:10,fontFamily:FONT_SANS,
                          background: active ? C.accent : C.bg,
                          border:`1px solid ${active ? C.accent : C.border}`,
                          color: active ? C.bg : C.text,
                          cursor: locked ? 'not-allowed' : 'pointer',
                          opacity: locked && !active ? 0.35 : 1,
                          display:'flex',alignItems:'center',justifyContent:'space-between',
                        }}>
                          <div>
                            <div style={{fontSize:18,fontWeight:700,letterSpacing:-0.5}}>{n}구간</div>
                            <div style={{fontSize:9,opacity:0.7,fontFamily:FONT_MONO}}>{360/n}° STEP</div>
                          </div>
                          <svg width="24" height="24" viewBox="0 0 24 24">
                            <circle cx="12" cy="12" r="9" fill="none"
                              stroke={active ? C.bg : C.dim} strokeWidth="1" opacity="0.4"/>
                            {Array.from({length:n}).map((_,i) => {
                              const a=(i*360/n-90)*Math.PI/180;
                              return <circle key={i} cx={12+Math.cos(a)*9} cy={12+Math.sin(a)*9}
                                r="1.5" fill={active ? C.bg : C.text}/>;
                            })}
                          </svg>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Side 탭 (STEP 3 헤더) */}
        {bothSelected && (
          <div style={{display:'flex',gap:6,marginBottom:8,padding:'0 4px'}}>
            {SIDES.map(side => {
              const active = currentSide === side;
              const done   = allDoneFor(side);
              return (
                <button key={side} onClick={() => {
                  if (isShooting) { showToast('촬영 중에는 전환 불가'); return; }
                  setCurrentSide(side);
                }} style={{
                  flex:1,height:36,borderRadius:10,fontFamily:FONT_SANS,fontSize:12,fontWeight:600,
                  background: active ? C.blue : C.surface,
                  border:`1px solid ${active ? C.blue : C.border}`,
                  color: active ? '#fff' : C.dim,
                  cursor: isShooting ? 'not-allowed' : 'pointer',
                  display:'flex',alignItems:'center',justifyContent:'center',gap:6,
                }}>
                  {SIDE_LABEL[side]}
                  {done && <span style={{width:6,height:6,borderRadius:3,background: active ? C.accent : C.accent,display:'inline-block'}}/>}
                </button>
              );
            })}
          </div>
        )}

        {/* STEP 3: 제품 선택 */}
        <div style={{marginBottom:16}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',
            padding:'0 4px 8px',fontSize:10,color:C.dim,fontFamily:FONT_MONO,letterSpacing:1}}>
            <span>STEP 3 · PRODUCTS — {SIDE_LABEL[currentSide]}</span>
            <span style={{color: curAllDone ? C.accent : C.dim}}>
              {curTotalShots} / {curExpected}
            </span>
          </div>
          {selectedSides[currentSide] ? (
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              {PRODUCTS.map(p => {
                const total  = shotCount(p, curSegs);
                const cnt    = curProgress[p.id];
                const status = (activeSide === currentSide && activeId === p.id) ? 'shooting'
                             : cnt === total ? 'done' : 'idle';
                const dis    = isShooting || status === 'done';
                return (
                  <ProductCard key={p.id} product={p} segments={curSegs}
                    status={status} count={cnt}
                    onTap={() => startCapture(p.id)}
                    disabled={dis}/>
                );
              })}
            </div>
          ) : (
            <div style={{padding:'24px',textAlign:'center',color:C.dimmer,fontSize:12,
              background:C.surface,borderRadius:12,border:`1px solid ${C.border}`}}>
              STEP 1에서 {SIDE_LABEL[currentSide]}를 선택해 주세요
            </div>
          )}
        </div>

        {/* 최근 촬영 미리보기 */}
        <div style={{marginBottom:8}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',
            padding:'0 4px 8px',fontSize:10,color:C.dim,fontFamily:FONT_MONO,letterSpacing:1}}>
            <span>최근 촬영 ({SIDE_LABEL[currentSide]})</span>
            <button onClick={() => setView('gallery')} style={{
              background:'none',border:'none',color:C.accent,fontSize:11,
              fontFamily:FONT_MONO,letterSpacing:1.2,cursor:'pointer',padding:0}}>
              전체보기 →
            </button>
          </div>
          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:10,minHeight:70}}>
            {curTotalShots === 0 ? (
              <div style={{padding:'16px',textAlign:'center',color:C.dimmer,fontSize:12,
                fontFamily:FONT_MONO,letterSpacing:0.5}}>
                {'// 촬영을 시작하면 여기에 표시됩니다'}
              </div>
            ) : (
              <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:5}}>
                {PRODUCTS.flatMap(p =>
                  capturedData[currentSide][p.id].slice(-2).map((s, i) => ({ pid: p.id, url: s.url, i }))
                ).slice(-10).map((x, k) => (
                  <Thumb key={k} product={x.pid} idx={x.i+1} imageUrl={x.url}
                    onTap={() => showToast(`${x.pid}_${String(x.i+1).padStart(2,'0')}.jpg`)}/>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 하단 액션 버튼 */}
      <div style={{padding:'10px 16px',paddingBottom:'max(14px, env(safe-area-inset-bottom))',
        borderTop:`1px solid ${C.border}`,background:C.bg}}>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>

          {/* 갤러리 */}
          <button onClick={() => setView('gallery')} style={{
            width:48,height:48,borderRadius:12,background:C.surface,
            border:`1px solid ${C.border}`,display:'flex',alignItems:'center',
            justifyContent:'center',cursor:'pointer',flexShrink:0}}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="5" width="18" height="14" rx="2" stroke={C.text} strokeWidth="1.6"/>
              <circle cx="9" cy="11" r="1.5" fill={C.text}/>
              <path d="M3 17l5-4 4 3 4-3 5 4" stroke={C.text} strokeWidth="1.6" fill="none" strokeLinejoin="round"/>
            </svg>
          </button>

          {/* Drive 업로드 */}
          <button disabled={!anyShotsTotal}
            onClick={() => setShowUpload(true)} style={{
            flex:1,height:48,borderRadius:12,
            background: anyShotsTotal ? (allSidesDone ? C.accent : C.surfaceHi) : C.surface,
            border:`1px solid ${anyShotsTotal ? (allSidesDone ? C.accent : C.borderHi) : C.border}`,
            color: allSidesDone ? C.bg : anyShotsTotal ? C.text : C.dimmer,
            fontSize:13,fontWeight:600,fontFamily:FONT_SANS,
            cursor: anyShotsTotal ? 'pointer' : 'not-allowed',
            display:'flex',alignItems:'center',justifyContent:'center',gap:8,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M7 18a4.5 4.5 0 01-.5-8.97A6 6 0 0118 9.5a4.5 4.5 0 01-.5 8.5H7z" stroke="currentColor" strokeWidth="1.7" fill="none"/>
              <path d="M12 11v6M9.5 13.5L12 11l2.5 2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Drive 업로드
          </button>

          {/* PPT 생성 */}
          <button disabled={!anyShotsTotal || pptLoading}
            onClick={handleGeneratePPT} style={{
            width:48,height:48,borderRadius:12,flexShrink:0,
            background: anyShotsTotal ? `${C.blue}30` : C.surface,
            border:`1px solid ${anyShotsTotal ? C.blue : C.border}`,
            display:'flex',alignItems:'center',justifyContent:'center',
            cursor: anyShotsTotal ? 'pointer' : 'not-allowed',
            opacity: anyShotsTotal ? 1 : 0.4,
          }} title="PPT 생성">
            {pptLoading ? (
              <div style={{width:18,height:18,border:`2px solid ${C.blue}`,
                borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="3" width="18" height="18" rx="2" stroke={anyShotsTotal ? '#5B9BD5' : C.dimmer} strokeWidth="1.6"/>
                <path d="M7 8h5a2 2 0 010 4H7V8z" stroke={anyShotsTotal ? '#5B9BD5' : C.dimmer} strokeWidth="1.4" fill="none"/>
                <path d="M7 15h6M7 12h4" stroke={anyShotsTotal ? '#5B9BD5' : C.dimmer} strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
            )}
          </button>
        </div>

        {anyShotsTotal && (
          <div style={{fontSize:10,color:C.dimmer,fontFamily:FONT_MONO,
            textAlign:'center',marginTop:6,letterSpacing:0.3}}>
            PPT 버튼: 촬영 데이터로 즉시 생성 · Drive 버튼: 사진 업로드
          </div>
        )}
      </div>

      {/* Drive 업로드 모달 */}
      {showUpload && (
        <UploadModal
          capturedData={capturedData}
          selectedSides={selectedSides}
          segments={segments}
          accessToken={accessToken}
          onClose={() => setShowUpload(false)}
          onDone={() => {
            setShowUpload(false);
            setUploadDone(true);
            showToast('Google Drive 업로드 완료!');
          }}
        />
      )}

      <Toast message={toast||''} visible={!!toast}/>
    </div>
  );
}

Object.assign(window, { CaptureApp });
