// ═══════════════════════════════════════════════════════════════
// 제품 360° 자동 촬영 앱 — 실제 동작 버전
// Claude Design 프로토타입 → PWA 실제 기능 통합
// ═══════════════════════════════════════════════════════════════

const { useState, useEffect, useRef, useMemo, useCallback } = React;

// ─── Google API 설정 (google-config.js 에서 관리) ────────────
// Claude Code 작업 시 google-config.js 파일에 실제 값 입력
const GOOGLE_CLIENT_ID   = window.GOOGLE_CLIENT_ID   || 'YOUR_CLIENT_ID.apps.googleusercontent.com';
const GOOGLE_DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const DRIVE_UPLOAD_URL   = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
const DRIVE_FOLDER_URL   = 'https://www.googleapis.com/drive/v3/files';

// ─── 디자인 토큰 (Design 원본 유지) ──────────────────────────
const C = {
  bg: '#0B0C0E',
  surface: '#15171B',
  surfaceHi: '#1C1F25',
  border: '#26292F',
  borderHi: '#363A42',
  text: '#F5F5F7',
  dim: '#9CA0AA',
  dimmer: '#5C616B',
  accent: '#C8FF3D',
  accentDim: '#8FB820',
  danger: '#FF5A47',
  amber: '#FFB547',
};
const FONT_SANS = '"Pretendard","Pretendard Variable",-apple-system,system-ui,sans-serif';
const FONT_MONO = '"JetBrains Mono","SF Mono",ui-monospace,monospace';

// ─── 부품 정의 ───────────────────────────────────────────────
const PRODUCTS = [
  { id: 'outer_race', name: 'OUTER RACE', kor: '외륜',  formula: 'x1', desc: '구간 수 만큼 촬영' },
  { id: 'inner_race', name: 'INNER RACE', kor: '내륜',  formula: 'x1', desc: '구간 수 만큼 촬영' },
  { id: 'cage',       name: 'CAGE',       kor: '케이지', formula: 'x2', desc: '구간 수 × 2' },
  { id: 'ball',       name: 'BALL',       kor: '볼',    formula: 'x1', desc: '단일 1장' },
];

const shotCount = (p, segments) => {
  if (p.id === 'ball') return 1;
  if (p.id === 'cage') return segments * 2;
  return segments;
};

// ─── 부품 아이콘 (Design 원본) ───────────────────────────────
function ProductIcon({ id, color = C.text, size = 28 }) {
  const stroke = 1.6;
  if (id === 'outer_race') return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <circle cx="14" cy="14" r="12" stroke={color} strokeWidth={stroke}/>
      <circle cx="14" cy="14" r="7" stroke={color} strokeWidth={stroke} opacity="0.3"/>
    </svg>
  );
  if (id === 'inner_race') return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <circle cx="14" cy="14" r="12" stroke={color} strokeWidth={stroke} opacity="0.3"/>
      <circle cx="14" cy="14" r="7" stroke={color} strokeWidth={stroke}/>
      <circle cx="14" cy="14" r="3" stroke={color} strokeWidth={stroke} opacity="0.3"/>
    </svg>
  );
  if (id === 'cage') return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <circle cx="14" cy="14" r="11" stroke={color} strokeWidth={stroke}/>
      {[0,1,2,3,4,5].map(i => {
        const a = (i * 60) * Math.PI / 180;
        return <line key={i}
          x1={14+Math.cos(a)*8} y1={14+Math.sin(a)*8}
          x2={14+Math.cos(a)*14} y2={14+Math.sin(a)*14}
          stroke={color} strokeWidth={stroke}/>;
      })}
    </svg>
  );
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <circle cx="14" cy="14" r="9" stroke={color} strokeWidth={stroke}/>
      <circle cx="11" cy="11" r="2" fill={color} opacity="0.45"/>
    </svg>
  );
}

// ─── 진행 링 (Design 원본) ────────────────────────────────────
function ProgressRing({ value, total, size = 56, stroke = 4 }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = total > 0 ? value / total : 0;
  return (
    <svg width={size} height={size}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.border} strokeWidth={stroke}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.accent} strokeWidth={stroke}
        strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
        strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition: 'stroke-dashoffset 0.4s ease' }}/>
    </svg>
  );
}

// ─── 썸네일 (실제 촬영 이미지 or 플레이스홀더) ────────────────
function Thumb({ product, idx, imageUrl, onTap }) {
  const tints = {
    outer_race: ['#2A2D32','#1E2024'],
    inner_race: ['#2D2A26','#211E1A'],
    cage:       ['#262A2D','#1A1E21'],
    ball:       ['#2D2628','#211A1C'],
  };
  const [a, b] = tints[product] || ['#222','#181818'];
  const label = `${product}_${String(idx).padStart(2,'0')}`;
  return (
    <button onClick={onTap} style={{
      position:'relative', width:'100%', aspectRatio:'1/1',
      border:`1px solid ${C.border}`, borderRadius:8, overflow:'hidden',
      background: imageUrl ? 'transparent' : `linear-gradient(135deg, ${a}, ${b})`,
      cursor:'pointer', padding:0,
    }}>
      {imageUrl ? (
        <img src={imageUrl} alt={label} style={{width:'100%',height:'100%',objectFit:'cover'}}/>
      ) : (
        <>
          <div style={{position:'absolute', inset:0, backgroundImage:`repeating-linear-gradient(45deg,transparent 0 6px,rgba(255,255,255,0.015) 6px 12px)`}}/>
          <div style={{position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', opacity:0.55}}>
            <ProductIcon id={product} color="#fff" size={36}/>
          </div>
        </>
      )}
      <div style={{
        position:'absolute', left:6, bottom:5,
        fontFamily:FONT_MONO, fontSize:8, color:C.dim, letterSpacing:0.2,
      }}>{label}.jpg</div>
    </button>
  );
}

// ─── 부품 카드 (Design 원본) ──────────────────────────────────
function ProductCard({ product, segments, status, count, onTap, disabled }) {
  const total = shotCount(product, segments);
  const isDone = status === 'done';
  const isShooting = status === 'shooting';
  return (
    <button onClick={onTap} disabled={disabled} style={{
      textAlign:'left', display:'flex', flexDirection:'column', gap:10,
      padding:'14px 12px', borderRadius:14, minWidth:0,
      background: isShooting ? `${C.accent}10` : C.surface,
      border:`1px solid ${isShooting ? C.accent : isDone ? C.accentDim+'80' : C.border}`,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled && !isShooting ? 0.55 : 1,
      transition:'all 0.2s', fontFamily:FONT_SANS, color:C.text,
    }}>
      <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:6}}>
        <div style={{display:'flex', alignItems:'center', gap:8, minWidth:0, flex:1}}>
          <div style={{
            width:32, height:32, borderRadius:8, flexShrink:0,
            background: isShooting ? C.accent : C.surfaceHi,
            display:'flex', alignItems:'center', justifyContent:'center',
            border:`1px solid ${isShooting ? C.accent : C.border}`,
          }}>
            <ProductIcon id={product.id} color={isShooting ? C.bg : C.text} size={20}/>
          </div>
          <div style={{minWidth:0, flex:1}}>
            <div style={{fontSize:11, fontWeight:700, letterSpacing:0.4}}>{product.name}</div>
            <div style={{fontSize:10, color:C.dim, marginTop:2}}>{product.kor}</div>
          </div>
        </div>
        <div style={{
          fontFamily:FONT_MONO, fontSize:10, color:isShooting ? C.accent : C.dim,
          background:C.bg, border:`1px solid ${C.border}`,
          padding:'2px 6px', borderRadius:5, flexShrink:0,
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
          <div style={{fontSize:11, color:C.dim, fontFamily:FONT_MONO}}>
            {isDone ? '완료' : isShooting ? '촬영중' : '대기'}
          </div>
        </div>
        <div style={{display:'flex', alignItems:'baseline', gap:3}}>
          <span style={{fontFamily:FONT_MONO, fontSize:18, fontWeight:600,
            color: isDone || isShooting ? C.accent : C.text}}>{count}</span>
          <span style={{fontFamily:FONT_MONO, fontSize:11, color:C.dim}}>/ {total}</span>
        </div>
      </div>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════
// ─── 실제 카메라 촬영 화면 (NEW - 실제 카메라 스트림) ──────────
// ═══════════════════════════════════════════════════════════════
function CameraScreen({ product, segments, shotIndex, totalShots, paused, onCapture, onStop, onResume, capturedImages }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [camReady, setCamReady] = useState(false);
  const [flash, setFlash] = useState(false);
  const [camError, setCamError] = useState(null);

  const isCage = product.id === 'cage';
  const side = isCage && shotIndex >= segments ? 'BACK' : 'FRONT';

  // 카메라 스트림 시작
  useEffect(() => {
    let cancelled = false;
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' }, // 후면 카메라
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          setCamReady(true);
        }
      } catch (err) {
        if (!cancelled) setCamError(err.message);
      }
    }
    startCamera();
    return () => {
      cancelled = true;
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, []);

  // 셔터: 비디오 프레임을 canvas로 캡처 → Blob 반환
  const handleShutter = useCallback(async () => {
    if (!videoRef.current || !camReady) return;
    setFlash(true);
    setTimeout(() => setFlash(false), 120);

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width  = video.videoWidth  || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      onCapture(blob, url); // blob(업로드용) + url(미리보기용)
    }, 'image/jpeg', 0.92);
  }, [camReady, onCapture]);

  // 카메라 에러 화면
  if (camError) return (
    <div style={{
      position:'absolute', inset:0, zIndex:100, background:C.bg,
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      padding:24, gap:16,
    }}>
      <div style={{fontSize:40}}>📷</div>
      <div style={{fontSize:16, fontWeight:700, color:C.text, textAlign:'center'}}>카메라 접근 필요</div>
      <div style={{fontSize:13, color:C.dim, textAlign:'center', lineHeight:1.6}}>
        브라우저에서 카메라 권한을 허용해 주세요.<br/>
        설정 → 사이트 설정 → 카메라
      </div>
      <div style={{fontFamily:FONT_MONO, fontSize:11, color:C.danger, padding:'8px 12px', background:`${C.danger}15`, borderRadius:8}}>
        {camError}
      </div>
      <button onClick={onStop} style={{
        height:48, padding:'0 24px', borderRadius:12,
        background:C.surface, border:`1px solid ${C.border}`,
        color:C.text, fontSize:14, fontWeight:600, cursor:'pointer',
      }}>돌아가기</button>
    </div>
  );

  return (
    <div style={{position:'absolute', inset:0, zIndex:100, background:'#000', display:'flex', flexDirection:'column'}}>
      {/* 카메라 뷰파인더 */}
      <div style={{position:'relative', flex:1, overflow:'hidden'}}>
        <video ref={videoRef} id="camera-stream" playsInline muted autoPlay
          style={{width:'100%', height:'100%', objectFit:'cover', display:'block'}}/>

        {/* 플래시 효과 */}
        {flash && <div style={{position:'absolute', inset:0, background:'white', opacity:0.7, pointerEvents:'none'}}/>}

        {/* 구도 가이드 오버레이 */}
        <div style={{position:'absolute', inset:0, pointerEvents:'none'}}>
          {/* 중앙 크로스헤어 */}
          <svg style={{position:'absolute', inset:0, width:'100%', height:'100%'}} viewBox="0 0 100 100" preserveAspectRatio="none">
            <line x1="50" y1="40" x2="50" y2="60" stroke={`${C.accent}80`} strokeWidth="0.3"/>
            <line x1="40" y1="50" x2="60" y2="50" stroke={`${C.accent}80`} strokeWidth="0.3"/>
            <rect x="30" y="25" width="40" height="50" rx="1" fill="none" stroke={`${C.accent}40`} strokeWidth="0.5" strokeDasharray="2 2"/>
          </svg>
          {/* 각도 표시 */}
          <div style={{
            position:'absolute', top:16, left:0, right:0,
            display:'flex', justifyContent:'center',
          }}>
            <div style={{
              background:'rgba(0,0,0,0.6)', backdropFilter:'blur(8px)',
              border:`1px solid ${C.border}`, borderRadius:20,
              padding:'6px 16px', display:'flex', alignItems:'center', gap:10,
            }}>
              <div style={{fontFamily:FONT_MONO, fontSize:10, color:C.dim}}>
                {Math.round(shotIndex * 360 / totalShots)}°
              </div>
              <div style={{width:1, height:12, background:C.border}}/>
              <div style={{fontFamily:FONT_MONO, fontSize:10, color:C.accent}}>
                {product.name}{isCage && ` · ${side}`}
              </div>
              <div style={{width:1, height:12, background:C.border}}/>
              <div style={{fontFamily:FONT_MONO, fontSize:10, color:C.dim}}>
                {shotIndex + 1}/{totalShots}
              </div>
            </div>
          </div>
          {/* 카메라 준비 중 */}
          {!camReady && (
            <div style={{position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center'}}>
              <div style={{
                background:'rgba(0,0,0,0.7)', borderRadius:12, padding:'16px 24px',
                display:'flex', alignItems:'center', gap:10,
              }}>
                <div style={{width:16, height:16, border:`2px solid ${C.accent}`, borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite'}}/>
                <span style={{fontSize:13, color:C.text}}>카메라 준비 중...</span>
              </div>
            </div>
          )}
        </div>

        {/* 좌측 촬영 진행 미리보기 */}
        <div style={{
          position:'absolute', left:10, bottom:10,
          display:'flex', flexDirection:'column', gap:4,
        }}>
          {capturedImages.slice(-4).map((url, i) => (
            <div key={i} style={{
              width:44, height:44, borderRadius:6, overflow:'hidden',
              border:`1px solid ${C.border}`, opacity:0.85,
            }}>
              <img src={url} style={{width:'100%', height:'100%', objectFit:'cover'}}/>
            </div>
          ))}
        </div>

        {/* 상단 중단 버튼 */}
        <button onClick={onStop} style={{
          position:'absolute', top:16, right:16,
          background:'rgba(0,0,0,0.6)', backdropFilter:'blur(8px)',
          border:`1px solid ${C.danger}`, color:C.danger,
          padding:'6px 14px', borderRadius:18, fontSize:12, fontWeight:600,
          fontFamily:FONT_SANS, cursor:'pointer',
        }}>중단</button>
      </div>

      {/* 하단 셔터 영역 */}
      <div style={{
        background:'rgba(0,0,0,0.85)', backdropFilter:'blur(20px)',
        padding:'20px 24px',
        paddingBottom:'max(20px, env(safe-area-inset-bottom))',
        display:'flex', alignItems:'center', justifyContent:'space-between', gap:16,
      }}>
        {/* 진행 바 */}
        <div style={{flex:1}}>
          <div style={{display:'flex', justifyContent:'space-between', marginBottom:6}}>
            <span style={{fontFamily:FONT_MONO, fontSize:10, color:C.dim}}>진행</span>
            <span style={{fontFamily:FONT_MONO, fontSize:10, color:C.accent}}>{shotIndex}/{totalShots}</span>
          </div>
          <div style={{height:3, background:C.surface, borderRadius:2}}>
            <div style={{
              height:'100%', width:`${(shotIndex/totalShots)*100}%`,
              background:C.accent, borderRadius:2,
              transition:'width 0.3s ease',
            }}/>
          </div>
        </div>

        {/* 셔터 버튼 */}
        <button onClick={handleShutter} disabled={!camReady} style={{
          width:72, height:72, borderRadius:36, flexShrink:0,
          background: camReady ? C.accent : C.dimmer,
          border:`4px solid rgba(255,255,255,0.3)`,
          cursor: camReady ? 'pointer' : 'not-allowed',
          display:'flex', alignItems:'center', justifyContent:'center',
          boxShadow: camReady ? `0 0 24px ${C.accent}60` : 'none',
          transition:'all 0.2s',
        }}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <circle cx="14" cy="14" r="10" fill={C.bg}/>
            <circle cx="14" cy="14" r="6" fill={C.bg} stroke={C.accent} strokeWidth="1.5"/>
          </svg>
        </button>

        {/* 다음 각도 힌트 */}
        <div style={{flex:1, textAlign:'right'}}>
          <div style={{fontFamily:FONT_MONO, fontSize:10, color:C.dim, marginBottom:4}}>다음 각도</div>
          <div style={{fontFamily:FONT_MONO, fontSize:14, color:C.text, fontWeight:600}}>
            {Math.round((shotIndex + 1) * 360 / totalShots)}°
          </div>
        </div>
      </div>

      {/* CAGE 뒤집기 프롬프트 (Design 원본 유지) */}
      {paused && (
        <div style={{
          position:'absolute', inset:0, zIndex:110,
          background:'rgba(11,12,14,0.94)', backdropFilter:'blur(10px)',
          display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
          padding:'0 28px',
        }}>
          <div style={{
            width:110, height:110, borderRadius:55,
            background:C.surfaceHi, border:`1px solid ${C.accent}`,
            display:'flex', alignItems:'center', justifyContent:'center',
            marginBottom:22, boxShadow:`0 0 60px ${C.accent}30`,
          }}>
            <svg width="52" height="52" viewBox="0 0 56 56" fill="none">
              <ellipse cx="28" cy="36" rx="18" ry="6" stroke={C.accent} strokeWidth="2"/>
              <path d="M11 18 Q28 6 45 18" stroke={C.accent} strokeWidth="2" fill="none" strokeLinecap="round"/>
              <path d="M45 18 L45 11 M45 18 L38 18" stroke={C.accent} strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div style={{fontSize:10, color:C.accent, fontFamily:FONT_MONO, letterSpacing:1.5, marginBottom:8, textAlign:'center'}}>
            FLIP REQUIRED · 앞면 {segments}장 완료
          </div>
          <div style={{fontSize:22, fontWeight:700, color:C.text, fontFamily:FONT_SANS, letterSpacing:-0.3, marginBottom:10, textAlign:'center'}}>
            제품을 뒤집어주세요
          </div>
          <div style={{fontSize:12, color:C.dim, lineHeight:1.55, textAlign:'center', marginBottom:28}}>
            CAGE를 분리해 뒤집은 후 다시 올려주세요
          </div>
          <div style={{display:'flex', gap:8, width:'100%'}}>
            <button onClick={onStop} style={{
              flex:1, height:48, borderRadius:12,
              background:'none', border:`1px solid ${C.border}`, color:C.text,
              fontSize:13, fontWeight:500, fontFamily:FONT_SANS, cursor:'pointer',
            }}>중단</button>
            <button onClick={onResume} style={{
              flex:2, height:48, borderRadius:12,
              background:C.accent, color:C.bg,
              fontSize:13, fontWeight:700, fontFamily:FONT_SANS, cursor:'pointer',
              display:'flex', alignItems:'center', justifyContent:'center', gap:6,
              border:'none',
            }}>
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

// ═══════════════════════════════════════════════════════════════
// ─── Google 인증 & Drive 업로드 (NEW) ──────────────────────────
// ═══════════════════════════════════════════════════════════════

// Google OAuth 로그인 화면
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
    <div style={{
      height:'100%', display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center',
      background:C.bg, padding:32, gap:0,
    }}>
      {/* 로고 */}
      <div style={{
        width:88, height:88, borderRadius:24, marginBottom:28,
        background:C.surface, border:`1px solid ${C.border}`,
        display:'flex', alignItems:'center', justifyContent:'center',
        boxShadow:`0 0 60px ${C.accent}20`,
      }}>
        <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
          <circle cx="22" cy="22" r="18" stroke={C.accent} strokeWidth="2"/>
          <circle cx="22" cy="22" r="10" stroke={C.accent} strokeWidth="1.5" opacity="0.5"/>
          <circle cx="22" cy="22" r="3" fill={C.accent}/>
          {[0,1,2,3,4,5].map(i => {
            const a = (i * 60 - 90) * Math.PI / 180;
            return <circle key={i} cx={22+Math.cos(a)*18} cy={22+Math.sin(a)*18} r="2.5" fill={C.accent}/>;
          })}
        </svg>
      </div>

      <div style={{fontSize:10, color:C.dim, fontFamily:FONT_MONO, letterSpacing:1.8, marginBottom:8}}>
        BEARING CAPTURE
      </div>
      <div style={{fontSize:26, fontWeight:700, color:C.text, letterSpacing:-0.5, marginBottom:8, textAlign:'center'}}>
        360° 자동 촬영
      </div>
      <div style={{fontSize:13, color:C.dim, textAlign:'center', lineHeight:1.6, marginBottom:48, maxWidth:280}}>
        Google 계정으로 로그인하면<br/>촬영 후 Drive에 자동 업로드됩니다
      </div>

      {error && (
        <div style={{
          width:'100%', maxWidth:320, padding:'12px 16px', borderRadius:10, marginBottom:16,
          background:`${C.danger}15`, border:`1px solid ${C.danger}40`,
          fontSize:12, color:C.danger, lineHeight:1.5, textAlign:'center',
        }}>{error}</div>
      )}

      <button onClick={handleGoogleLogin} style={{
        width:'100%', maxWidth:320, height:52, borderRadius:14,
        background:'#fff', border:'1px solid #ddd',
        color:'#1a1a1a', fontSize:15, fontWeight:600, fontFamily:FONT_SANS,
        cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:10,
      }}>
        <svg width="20" height="20" viewBox="0 0 48 48">
          <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
          <path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
          <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
          <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
        </svg>
        Google로 로그인
      </button>

      <div style={{marginTop:24, fontSize:11, color:C.dimmer, textAlign:'center', lineHeight:1.6, maxWidth:280}}>
        Drive 파일 접근 권한만 요청합니다.<br/>앱이 생성한 파일만 접근할 수 있습니다.
      </div>
    </div>
  );
}

// Drive 업로드 모달
function UploadModal({ images, accessToken, onClose, onDone }) {
  const [phase, setPhase] = useState('idle'); // idle | uploading | done | error
  const [progress, setProgress] = useState({ current: 0, total: 0, product: '' });
  const [folderId, setFolderId] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Drive에 폴더 생성 (날짜/제품별)
  const createFolder = async (name, parentId = null) => {
    const meta = {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      ...(parentId ? { parents: [parentId] } : {}),
    };
    const res = await fetch(DRIVE_FOLDER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(meta),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Drive 폴더 생성 실패');
    return data.id;
  };

  // 단일 이미지 업로드
  const uploadFile = async (blob, filename, parentId) => {
    const meta = JSON.stringify({ name: filename, parents: [parentId] });
    const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);
    const metaBytes = new TextEncoder().encode(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: image/jpeg\r\n\r\n`
    );
    const endBytes = new TextEncoder().encode(`\r\n--${boundary}--`);
    const blobData = await blob.arrayBuffer();
    const body = new Uint8Array(metaBytes.byteLength + blobData.byteLength + endBytes.byteLength);
    body.set(metaBytes, 0);
    body.set(new Uint8Array(blobData), metaBytes.byteLength);
    body.set(endBytes, metaBytes.byteLength + blobData.byteLength);

    const res = await fetch(DRIVE_UPLOAD_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || '파일 업로드 실패');
    }
    return await res.json();
  };

  const startUpload = async () => {
    setPhase('uploading');
    try {
      // 루트 폴더: BearingCapture/YYYYMMDD_HHMMSS
      const now = new Date();
      const dateStr = now.toISOString().slice(0,10).replace(/-/g,'');
      const timeStr = now.toTimeString().slice(0,8).replace(/:/g,'');
      const rootName = `BearingCapture_${dateStr}_${timeStr}`;
      const rootId = await createFolder(rootName);

      // 제품별 폴더 & 업로드
      const total = Object.values(images).reduce((s, arr) => s + arr.length, 0);
      let current = 0;

      for (const [productId, blobList] of Object.entries(images)) {
        if (blobList.length === 0) continue;
        const prod = PRODUCTS.find(p => p.id === productId);
        const subId = await createFolder(prod.name, rootId);

        for (let i = 0; i < blobList.length; i++) {
          const filename = `${productId}_${String(i+1).padStart(2,'0')}.jpg`;
          setProgress({ current: ++current, total, product: prod.name });
          await uploadFile(blobList[i].blob, filename, subId);
        }
      }

      setFolderId(rootId);
      setPhase('done');
    } catch (err) {
      setErrorMsg(err.message);
      setPhase('error');
    }
  };

  const totalCount = Object.values(images).reduce((s, arr) => s + arr.length, 0);

  return (
    <div style={{
      position:'absolute', inset:0, zIndex:200,
      background:'rgba(0,0,0,0.75)', backdropFilter:'blur(8px)',
      display:'flex', alignItems:'flex-end', justifyContent:'center',
    }} onClick={phase === 'idle' ? onClose : undefined}>
      <div onClick={e => e.stopPropagation()} style={{
        background:C.surface, border:`1px solid ${C.borderHi}`,
        borderRadius:'20px 20px 0 0', width:'100%', maxWidth:480,
        padding:24, paddingBottom:'max(24px, env(safe-area-inset-bottom))',
      }}>
        {/* idle: 업로드 확인 */}
        {phase === 'idle' && (
          <>
            <div style={{display:'flex', alignItems:'center', gap:12, marginBottom:20}}>
              <div style={{
                width:44, height:44, borderRadius:22,
                background:`${C.accent}15`, border:`1px solid ${C.accent}40`,
                display:'flex', alignItems:'center', justifyContent:'center',
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path d="M7 18a4.5 4.5 0 01-.5-8.97A6 6 0 0118 9.5a4.5 4.5 0 01-.5 8.5H7z" stroke={C.accent} strokeWidth="1.7" fill="none"/>
                  <path d="M12 11v6M9.5 13.5L12 11l2.5 2.5" stroke={C.accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div>
                <div style={{fontSize:16, fontWeight:700, color:C.text}}>Google Drive 업로드</div>
                <div style={{fontSize:12, color:C.dim, marginTop:2}}>총 {totalCount}장 · BearingCapture 폴더</div>
              </div>
            </div>

            {/* 제품별 요약 */}
            <div style={{background:C.bg, borderRadius:12, padding:12, marginBottom:20, display:'flex', flexDirection:'column', gap:8}}>
              {PRODUCTS.map(p => {
                const n = images[p.id]?.length || 0;
                if (n === 0) return null;
                return (
                  <div key={p.id} style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                    <div style={{display:'flex', alignItems:'center', gap:8}}>
                      <ProductIcon id={p.id} size={16}/>
                      <span style={{fontSize:12, color:C.text, fontWeight:600}}>{p.name}</span>
                    </div>
                    <span style={{fontFamily:FONT_MONO, fontSize:12, color:C.accent}}>{n}장</span>
                  </div>
                );
              })}
            </div>

            <div style={{display:'flex', gap:8}}>
              <button onClick={onClose} style={{
                flex:1, height:48, borderRadius:12,
                background:'none', border:`1px solid ${C.border}`, color:C.text,
                fontSize:14, fontWeight:500, cursor:'pointer',
              }}>취소</button>
              <button onClick={startUpload} style={{
                flex:2, height:48, borderRadius:12,
                background:C.accent, color:C.bg,
                fontSize:14, fontWeight:700, cursor:'pointer',
                display:'flex', alignItems:'center', justifyContent:'center', gap:8, border:'none',
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M7 18a4.5 4.5 0 01-.5-8.97A6 6 0 0118 9.5a4.5 4.5 0 01-.5 8.5H7z" stroke="currentColor" strokeWidth="1.7" fill="none"/>
                  <path d="M12 11v6M9.5 13.5L12 11l2.5 2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                업로드 시작
              </button>
            </div>
          </>
        )}

        {/* uploading: 진행 중 */}
        {phase === 'uploading' && (
          <div style={{textAlign:'center', padding:'8px 0'}}>
            <div style={{
              width:64, height:64, borderRadius:32, margin:'0 auto 20px',
              background:`${C.accent}15`, border:`1px solid ${C.accent}40`,
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              <div style={{width:28, height:28, border:`3px solid ${C.accent}`, borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite'}}/>
            </div>
            <div style={{fontSize:16, fontWeight:700, color:C.text, marginBottom:6}}>업로드 중...</div>
            <div style={{fontSize:13, color:C.dim, marginBottom:20}}>
              {progress.product} · {progress.current}/{progress.total}장
            </div>
            <div style={{height:4, background:C.bg, borderRadius:2, overflow:'hidden'}}>
              <div style={{
                height:'100%', background:C.accent, borderRadius:2,
                width:`${progress.total > 0 ? (progress.current/progress.total)*100 : 0}%`,
                transition:'width 0.3s ease',
              }}/>
            </div>
          </div>
        )}

        {/* done: 완료 */}
        {phase === 'done' && (
          <div style={{textAlign:'center', padding:'8px 0'}}>
            <div style={{
              width:64, height:64, borderRadius:32, margin:'0 auto 20px',
              background:`${C.accent}15`, border:`1px solid ${C.accent}`,
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <path d="M6 14l6 6L22 8" stroke={C.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div style={{fontSize:18, fontWeight:700, color:C.text, marginBottom:6}}>업로드 완료!</div>
            <div style={{fontSize:13, color:C.dim, marginBottom:24}}>
              총 {totalCount}장이 Google Drive에 저장되었습니다
            </div>
            <button onClick={onDone} style={{
              width:'100%', height:48, borderRadius:12,
              background:C.accent, color:C.bg, border:'none',
              fontSize:14, fontWeight:700, cursor:'pointer',
            }}>확인</button>
          </div>
        )}

        {/* error */}
        {phase === 'error' && (
          <div style={{textAlign:'center', padding:'8px 0'}}>
            <div style={{fontSize:40, marginBottom:16}}>⚠️</div>
            <div style={{fontSize:16, fontWeight:700, color:C.danger, marginBottom:8}}>업로드 실패</div>
            <div style={{fontSize:12, color:C.dim, marginBottom:20, lineHeight:1.6}}>{errorMsg}</div>
            <div style={{display:'flex', gap:8}}>
              <button onClick={onClose} style={{
                flex:1, height:44, borderRadius:10,
                background:'none', border:`1px solid ${C.border}`, color:C.text, cursor:'pointer',
              }}>닫기</button>
              <button onClick={startUpload} style={{
                flex:1, height:44, borderRadius:10,
                background:C.accent, color:C.bg, border:'none', cursor:'pointer', fontWeight:700,
              }}>재시도</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 토스트 (Design 원본) ─────────────────────────────────────
function Toast({ message, visible }) {
  return (
    <div style={{
      position:'absolute', bottom: visible ? 90 : 40, left:'50%', transform:'translateX(-50%)',
      background:C.surfaceHi, border:`1px solid ${C.border}`,
      padding:'10px 16px', borderRadius:24, color:C.text, fontSize:13, fontFamily:FONT_SANS,
      opacity: visible ? 1 : 0, transition:'all 0.3s', pointerEvents:'none',
      zIndex:300, boxShadow:'0 10px 30px rgba(0,0,0,0.4)', whiteSpace:'nowrap',
    }}>{message}</div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ─── 메인 앱 ───────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
function CaptureApp() {
  const [accessToken, setAccessToken] = useState(null);
  const [segments, setSegments] = useState(6);

  // OAuth2 redirect 후 URL 해시에서 access_token 추출
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;
    const params = new URLSearchParams(hash.slice(1));
    const token = params.get('access_token');
    if (token) {
      setAccessToken(token);
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  // 촬영 데이터: { productId: [{blob, url}] }
  const [capturedData, setCapturedData] = useState({
    outer_race: [], inner_race: [], cage: [], ball: [],
  });

  const [activeId, setActiveId] = useState(null);   // 현재 촬영 중인 제품
  const [shotIndex, setShotIndex] = useState(0);     // 현재 몇 번째 촬영
  const [paused, setPaused] = useState(false);       // CAGE 뒤집기 대기
  const [flipped, setFlipped] = useState(false);

  const [view, setView] = useState('capture');       // capture | gallery
  const [showUpload, setShowUpload] = useState(false);
  const [confirmRetake, setConfirmRetake] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }, []);

  const progress = useMemo(() => {
    const p = {};
    for (const [k, arr] of Object.entries(capturedData)) p[k] = arr.length;
    return p;
  }, [capturedData]);

  const totalShots    = useMemo(() => Object.values(progress).reduce((a,b)=>a+b,0), [progress]);
  const totalExpected = useMemo(() => PRODUCTS.reduce((s,p) => s + shotCount(p, segments), 0), [segments]);
  const allDone       = totalShots === totalExpected;
  const segmentsLocked = !!activeId || (totalShots > 0 && !allDone);
  const activeProd    = PRODUCTS.find(p => p.id === activeId);

  // 셔터 콜백: 이미지 저장 & 다음 스텝
  const handleCapture = useCallback((blob, url) => {
    const prod = PRODUCTS.find(p => p.id === activeId);
    const total = shotCount(prod, segments);
    const nextIndex = shotIndex + 1;

    setCapturedData(prev => ({
      ...prev,
      [activeId]: [...prev[activeId], { blob, url }],
    }));

    // CAGE 앞면 완료 → 뒤집기 대기
    if (activeId === 'cage' && nextIndex === segments && !flipped) {
      setShotIndex(nextIndex);
      setPaused(true);
      return;
    }

    // 전체 완료
    if (nextIndex >= total) {
      setShotIndex(0);
      setActiveId(null);
      setFlipped(false);
      showToast(`${prod.name} 촬영 완료 · ${total}장 저장됨`);
      return;
    }

    setShotIndex(nextIndex);
  }, [activeId, shotIndex, segments, flipped, showToast]);

  const startCapture = (productId) => {
    if (activeId) return;
    setCapturedData(prev => ({ ...prev, [productId]: [] }));
    setShotIndex(0);
    setPaused(false);
    setFlipped(false);
    setActiveId(productId);
  };

  const stopCapture = () => {
    setActiveId(null);
    setShotIndex(0);
    setPaused(false);
    setFlipped(false);
    showToast('촬영 중단됨');
  };

  const retakeProduct = (productId) => {
    setCapturedData(prev => ({ ...prev, [productId]: [] }));
    setConfirmRetake(null);
    setView('capture');
    setTimeout(() => startCapture(productId), 50);
  };

  const resetAll = () => {
    if (activeId) return;
    setCapturedData({ outer_race:[], inner_race:[], cage:[], ball:[] });
    showToast('모든 촬영 데이터 초기화됨');
  };

  // ── 로그인 전 화면
  if (!accessToken) {
    return <LoginScreen onLogin={setAccessToken}/>;
  }

  // ── 카메라 화면 (촬영 중)
  if (activeId) {
    return (
      <div style={{height:'100%', position:'relative', background:'#000'}}>
        <CameraScreen
          product={activeProd}
          segments={segments}
          shotIndex={shotIndex}
          totalShots={shotCount(activeProd, segments)}
          paused={paused}
          capturedImages={capturedData[activeId].map(x => x.url)}
          onCapture={handleCapture}
          onStop={stopCapture}
          onResume={() => { setFlipped(true); setPaused(false); }}
        />
      </div>
    );
  }

  // ── 갤러리 화면
  if (view === 'gallery') {
    return (
      <div style={{
        height:'100%', display:'flex', flexDirection:'column',
        background:C.bg, fontFamily:FONT_SANS, color:C.text, position:'relative',
      }}>
        <div style={{
          padding:'16px 20px 8px',
          paddingTop:'max(16px, env(safe-area-inset-top))',
          display:'flex', alignItems:'center', justifyContent:'space-between', gap:8,
        }}>
          <button onClick={()=>setView('capture')} style={{
            background:'none', border:'none', color:C.text, fontSize:14, cursor:'pointer',
            display:'flex', alignItems:'center', gap:4, padding:0,
          }}>
            <svg width="16" height="16" viewBox="0 0 16 16"><path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
            촬영
          </button>
          <div style={{fontSize:12, fontWeight:700, letterSpacing:1, fontFamily:FONT_MONO}}>GALLERY</div>
          <div style={{fontFamily:FONT_MONO, fontSize:11, color:C.dim}}>{totalShots}장</div>
        </div>

        <div style={{flex:1, overflowY:'auto', padding:'8px 16px 16px'}}>
          {PRODUCTS.map(p => {
            const shots = capturedData[p.id];
            if (shots.length === 0) return null;
            return (
              <div key={p.id} style={{marginBottom:24}}>
                <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10}}>
                  <div style={{display:'flex', alignItems:'center', gap:8}}>
                    <ProductIcon id={p.id} size={18}/>
                    <span style={{fontSize:12, fontWeight:700, letterSpacing:0.4}}>{p.name}</span>
                    <span style={{fontSize:11, color:C.dim}}>{p.kor}</span>
                  </div>
                  <div style={{display:'flex', alignItems:'center', gap:8}}>
                    <span style={{fontFamily:FONT_MONO, fontSize:11, color:C.accent}}>{shots.length}장</span>
                    <button onClick={() => setConfirmRetake(p.id)} style={{
                      display:'flex', alignItems:'center', gap:4,
                      background:'none', border:`1px solid ${C.border}`, color:C.text,
                      padding:'4px 10px', borderRadius:14, fontSize:11, cursor:'pointer',
                    }}>재촬영</button>
                  </div>
                </div>
                <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:6}}>
                  {shots.map((s, i) => (
                    <Thumb key={i} product={p.id} idx={i+1} imageUrl={s.url}
                      onTap={() => showToast(`${p.id}_${String(i+1).padStart(2,'0')}.jpg`)}/>
                  ))}
                </div>
              </div>
            );
          })}
          {totalShots === 0 && (
            <div style={{textAlign:'center', padding:'80px 20px', color:C.dim, fontSize:13}}>
              아직 촬영된 사진이 없습니다
            </div>
          )}
        </div>

        {/* 재촬영 확인 모달 */}
        {confirmRetake && (() => {
          const p = PRODUCTS.find(x => x.id === confirmRetake);
          return (
            <div style={{
              position:'absolute', inset:0, zIndex:120,
              background:'rgba(0,0,0,0.7)', backdropFilter:'blur(6px)',
              display:'flex', alignItems:'center', justifyContent:'center', padding:'0 28px',
            }} onClick={() => setConfirmRetake(null)}>
              <div onClick={e=>e.stopPropagation()} style={{
                background:C.surface, border:`1px solid ${C.borderHi}`,
                borderRadius:16, padding:'22px 22px 18px', width:'100%', maxWidth:320,
              }}>
                <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:14}}>
                  <ProductIcon id={p.id} size={32}/>
                  <div>
                    <div style={{fontSize:15, fontWeight:700}}>{p.name} 재촬영</div>
                    <div style={{fontSize:11, color:C.dim, marginTop:2}}>{capturedData[p.id].length}장이 삭제됩니다</div>
                  </div>
                </div>
                <div style={{display:'flex', gap:8}}>
                  <button onClick={() => setConfirmRetake(null)} style={{
                    flex:1, height:44, borderRadius:10,
                    background:'none', border:`1px solid ${C.border}`, color:C.text, cursor:'pointer',
                  }}>취소</button>
                  <button onClick={() => retakeProduct(confirmRetake)} style={{
                    flex:1.4, height:44, borderRadius:10,
                    background:C.accent, color:C.bg, border:'none', fontWeight:700, cursor:'pointer',
                  }}>삭제 후 재촬영</button>
                </div>
              </div>
            </div>
          );
        })()}

        <Toast message={toast||''} visible={!!toast}/>
      </div>
    );
  }

  // ── 메인 캡처 화면 (Design 원본 레이아웃 유지)
  return (
    <div style={{
      height:'100%', display:'flex', flexDirection:'column',
      background:C.bg, fontFamily:FONT_SANS, color:C.text, position:'relative',
    }}>
      {/* 헤더 */}
      <div style={{
        padding:'16px 20px 14px',
        paddingTop:'max(16px, env(safe-area-inset-top))',
        display:'flex', alignItems:'center', justifyContent:'space-between', gap:12,
      }}>
        <div>
          <div style={{fontSize:10, color:C.dim, letterSpacing:1.6, fontFamily:FONT_MONO}}>BEARING CAPTURE</div>
          <div style={{fontSize:20, fontWeight:700, marginTop:2, letterSpacing:-0.3}}>360° 자동 촬영</div>
        </div>
        <div style={{display:'flex', gap:8}}>
          {/* 로그아웃 */}
          <button onClick={() => { setAccessToken(null); resetAll(); }} style={{
            width:36, height:36, borderRadius:18,
            background:C.surface, border:`1px solid ${C.border}`,
            display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer',
          }} title="로그아웃">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 2h3a1 1 0 011 1v10a1 1 0 01-1 1h-3" stroke={C.dim} strokeWidth="1.4" strokeLinecap="round"/>
              <path d="M7 11l3-3-3-3M10 8H3" stroke={C.text} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          {/* 리셋 */}
          <button onClick={resetAll} style={{
            width:36, height:36, borderRadius:18,
            background:C.surface, border:`1px solid ${C.border}`,
            display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer',
          }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8a5 5 0 109-3" stroke={C.text} strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M12 2v3h-3" stroke={C.text} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

      <div style={{flex:1, overflowY:'auto', padding:'0 16px 16px'}}>
        {/* STEP 1: 구간 선택 */}
        <div style={{marginBottom:18}}>
          <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 4px 8px', fontSize:10, color:C.dim, fontFamily:FONT_MONO, letterSpacing:1}}>
            <span style={{display:'inline-flex', alignItems:'center', gap:6}}>
              STEP 1 · 구간
              {segmentsLocked && (
                <span style={{
                  display:'inline-flex', alignItems:'center', gap:3,
                  color:C.amber, fontSize:9, letterSpacing:1.2,
                  background:`${C.amber}15`, border:`1px solid ${C.amber}40`,
                  padding:'1px 5px', borderRadius:3,
                }}>
                  <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                    <rect x="2" y="4.5" width="6" height="4.5" rx="0.5" stroke="currentColor" strokeWidth="1" fill="none"/>
                    <path d="M3.5 4.5V3a1.5 1.5 0 013 0v1.5" stroke="currentColor" strokeWidth="1" fill="none"/>
                  </svg>
                  LOCKED
                </span>
              )}
            </span>
            <span>{360/segments}° STEP</span>
          </div>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
            {[6, 8].map(n => {
              const active = segments === n;
              const isDisabled = segmentsLocked && !active;
              return (
                <button key={n} onClick={() => {
                  if (segmentsLocked) {
                    showToast(activeId ? '촬영 중에는 구간 변경 불가' : '리셋 후 구간 변경 가능');
                    return;
                  }
                  setSegments(n);
                  setCapturedData({outer_race:[],inner_race:[],cage:[],ball:[]});
                }} style={{
                  padding:'16px 14px', borderRadius:12,
                  background: active ? C.accent : C.surface,
                  border:`1px solid ${active ? C.accent : C.border}`,
                  color: active ? C.bg : C.text,
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                  opacity: isDisabled ? 0.35 : 1,
                  display:'flex', alignItems:'center', justifyContent:'space-between', gap:8,
                  fontFamily:FONT_SANS,
                }}>
                  <div>
                    <div style={{fontSize:22, fontWeight:700, letterSpacing:-0.5}}>{n}구간</div>
                    <div style={{fontSize:10, opacity:0.7, fontFamily:FONT_MONO}}>{360/n}° STEP</div>
                  </div>
                  {segmentsLocked && active ? (
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <rect x="4" y="9" width="12" height="9" rx="1.2" stroke={C.bg} strokeWidth="1.6" fill="none"/>
                      <path d="M7 9V6a3 3 0 016 0v3" stroke={C.bg} strokeWidth="1.6" fill="none"/>
                    </svg>
                  ) : (
                    <svg width="28" height="28" viewBox="0 0 28 28">
                      <circle cx="14" cy="14" r="10" fill="none" stroke={active ? C.bg : C.dim} strokeWidth="1" opacity="0.35"/>
                      {Array.from({length:n}).map((_,i) => {
                        const a = (i*360/n - 90)*Math.PI/180;
                        return <circle key={i} cx={14+Math.cos(a)*10} cy={14+Math.sin(a)*10} r="1.8" fill={active ? C.bg : C.text}/>;
                      })}
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* STEP 2: 부품 선택 */}
        <div style={{marginBottom:18}}>
          <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 4px 8px', fontSize:10, color:C.dim, fontFamily:FONT_MONO, letterSpacing:1}}>
            <span>STEP 2 · 제품 선택</span>
            <span style={{color: allDone ? C.accent : C.dim}}>{totalShots} / {totalExpected}</span>
          </div>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
            {PRODUCTS.map(p => {
              const total = shotCount(p, segments);
              const cnt = progress[p.id];
              const status = activeId === p.id ? 'shooting' : cnt === total ? 'done' : 'idle';
              return (
                <ProductCard key={p.id} product={p} segments={segments}
                  status={status} count={cnt}
                  onTap={() => startCapture(p.id)}
                  disabled={!!activeId || status === 'done'}/>
              );
            })}
          </div>
        </div>

        {/* 최근 촬영 미리보기 */}
        <div style={{marginBottom:16}}>
          <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 4px 8px', fontSize:10, color:C.dim, fontFamily:FONT_MONO, letterSpacing:1}}>
            <span>최근 촬영</span>
            <button onClick={()=>setView('gallery')} style={{
              background:'none', border:'none', color:C.accent, fontSize:11,
              fontFamily:FONT_MONO, letterSpacing:1.2, cursor:'pointer', padding:0,
            }}>전체보기 →</button>
          </div>
          <div style={{background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:10, minHeight:80}}>
            {totalShots === 0 ? (
              <div style={{padding:'24px', textAlign:'center', color:C.dimmer, fontSize:12, fontFamily:FONT_MONO, letterSpacing:0.5}}>
                {'// 촬영을 시작하면 여기에 표시됩니다'}
              </div>
            ) : (
              <div style={{display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:5}}>
                {PRODUCTS.flatMap(p =>
                  capturedData[p.id].slice(-2).map((s, i) => ({pid:p.id, url:s.url, i}))
                ).slice(-10).map((x, k) => (
                  <Thumb key={k} product={x.pid} idx={x.i+1} imageUrl={x.url}
                    onTap={()=>showToast(`${x.pid}_${String(x.i+1).padStart(2,'0')}.jpg`)}/>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 하단 액션 버튼 */}
      <div style={{
        padding:'12px 16px',
        paddingBottom:'max(16px, env(safe-area-inset-bottom))',
        borderTop:`1px solid ${C.border}`,
        background:`linear-gradient(to top, ${C.bg} 70%, transparent)`,
      }}>
        <div style={{display:'flex', gap:8, alignItems:'center'}}>
          <button onClick={()=>setView('gallery')} style={{
            width:52, height:52, borderRadius:12,
            background:C.surface, border:`1px solid ${C.border}`,
            display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0,
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="5" width="18" height="14" rx="2" stroke={C.text} strokeWidth="1.6"/>
              <circle cx="9" cy="11" r="1.5" fill={C.text}/>
              <path d="M3 17l5-4 4 3 4-3 5 4" stroke={C.text} strokeWidth="1.6" fill="none" strokeLinejoin="round"/>
            </svg>
          </button>
          <button
            disabled={totalShots === 0}
            onClick={() => setShowUpload(true)}
            style={{
              flex:1, height:52, borderRadius:12,
              background: totalShots === 0 ? C.surface : allDone ? C.accent : C.surfaceHi,
              border:`1px solid ${totalShots === 0 ? C.border : allDone ? C.accent : C.borderHi}`,
              color: allDone ? C.bg : totalShots === 0 ? C.dimmer : C.text,
              fontSize:14, fontWeight:600, letterSpacing:0.3,
              fontFamily:FONT_SANS, cursor: totalShots === 0 ? 'not-allowed' : 'pointer',
              display:'flex', alignItems:'center', justifyContent:'center', gap:10,
            }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M7 18a4.5 4.5 0 01-.5-8.97A6 6 0 0118 9.5a4.5 4.5 0 01-.5 8.5H7z" stroke="currentColor" strokeWidth="1.7" fill="none"/>
              <path d="M12 11v6M9.5 13.5L12 11l2.5 2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {allDone ? `클라우드 업로드 (${totalShots}장)` : totalShots === 0 ? '클라우드 업로드 (촬영 필요)' : `클라우드 업로드 (${totalShots}장)`}
          </button>
        </div>
      </div>

      {/* Drive 업로드 모달 */}
      {showUpload && (
        <UploadModal
          images={{
            outer_race: capturedData.outer_race,
            inner_race: capturedData.inner_race,
            cage: capturedData.cage,
            ball: capturedData.ball,
          }}
          accessToken={accessToken}
          onClose={() => setShowUpload(false)}
          onDone={() => {
            setShowUpload(false);
            showToast('Google Drive 업로드 완료!');
          }}
        />
      )}

      <Toast message={toast||''} visible={!!toast}/>
    </div>
  );
}

Object.assign(window, { CaptureApp });
