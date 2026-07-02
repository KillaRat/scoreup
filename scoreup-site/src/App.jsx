import React, { useState, useEffect, useCallback, useMemo } from 'react';

/* ─── CONSTANTS ─────────────────────────────────────────────── */
const SUPABASE_URL=import.meta.env.VITE_SUPABASE_URL||'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY=import.meta.env.VITE_SUPABASE_ANON_KEY||'YOUR_SUPABASE_ANON_KEY';
const AVATARS=['🦊','🐼','🦋','🐬','🦄','🐉','🦅','🌙','⚡','🎯'];
const AVATAR_COLORS=['#7c9ff5','#4ecdc4','#f06292','#f5a623','#43d98c','#b39dfa'];

const SAT_SUBJS=[
  {id:'rw',name:'Reading & Writing',icon:'📖',color:'#b39dfa',bg:'rgba(179,157,250,.12)',subtopics:['Main Idea','Inference','Vocabulary in Context','Command of Evidence','Grammar','Rhetoric']},
  {id:'math',name:'Math',icon:'🔢',color:'#7c9ff5',bg:'rgba(124,159,245,.12)',subtopics:['Algebra','Advanced Math','Geometry','Trigonometry','Data & Statistics']},
];
const ACT_SUBJS=[
  {id:'eng',name:'English',icon:'✍️',color:'#4ecdc4',bg:'rgba(78,205,196,.12)',subtopics:['Grammar','Punctuation','Sentence Structure','Rhetorical Skills']},
  {id:'math',name:'Math',icon:'🔢',color:'#7c9ff5',bg:'rgba(124,159,245,.12)',subtopics:['Pre-Algebra','Algebra','Geometry','Trigonometry','Statistics']},
  {id:'sci',name:'Science',icon:'🔬',color:'#f5a623',bg:'rgba(245,166,35,.12)',subtopics:['Data Representation','Research Summaries','Conflicting Viewpoints']},
  {id:'writ',name:'Writing',icon:'🖊️',color:'#f06292',bg:'rgba(240,98,146,.12)',subtopics:['Argument','Organization','Style'],frqOnly:true},
];

const FAKE_LEADERBOARD=[
  {name:'Alex K.',emoji:'🦅',color:'#7c9ff5',pts:8420,streak:42,correct:310},
  {name:'Priya M.',emoji:'⚡',color:'#f5a623',pts:7890,streak:35,correct:287},
  {name:'Jordan L.',emoji:'🐉',color:'#4ecdc4',pts:7310,streak:28,correct:265},
  {name:'Sam T.',emoji:'🌙',color:'#b39dfa',pts:6900,streak:21,correct:248},
  {name:'Riley W.',emoji:'🦄',color:'#f06292',pts:6540,streak:18,correct:231},
  {name:'Casey B.',emoji:'🐬',color:'#43d98c',pts:6100,streak:15,correct:214},
  {name:'Morgan A.',emoji:'🦊',color:'#f5a623',pts:5830,streak:12,correct:200},
];

/* ─── HELPERS ───────────────────────────────────────────────── */
const initWeakness=subjs=>{
  const w={};
  subjs.forEach(s=>s.subtopics.forEach(t=>{w[t]=50+Math.floor(Math.random()*35)}));
  return w;
};
const getOrMakeStreak=()=>{
  const raw=localStorage.getItem('su_streak');
  if(raw)return JSON.parse(raw);
  const now=new Date(),days=[];
  for(let i=89;i>=0;i--){
    const d=new Date(now);d.setDate(now.getDate()-i);
    days.push({date:d.toISOString().split('T')[0],on:Math.random()>.5});
  }
  days[days.length-1].on=true;
  localStorage.setItem('su_streak',JSON.stringify(days));
  return days;
};
const countStreak=days=>{let s=0;for(let i=days.length-1;i>=0;i--){if(days[i].on)s++;else break;}return s;};
const weakColor=v=>v>=80?'var(--success)':v>=60?'var(--warning)':'var(--danger)';
const diffColor=d=>d==='easy'?'var(--success)':d==='hard'?'var(--danger)':'var(--warning)';

/* ─── API ───────────────────────────────────────────────────── */
async function genQuestion(test,subj,qType,weakness,difficulty){
  const weak=subj.subtopics.filter(t=>(weakness[t]||65)<70);
  const target=weak.length>0?weak[Math.floor(Math.random()*weak.length)]:subj.subtopics[Math.floor(Math.random()*subj.subtopics.length)];
  const isMCQ=qType==='mcq';
  const diffMap={easy:'straightforward, suitable for beginners',medium:'moderately challenging',hard:'very difficult, suitable for top scorers'};
  const prompt=`Generate a realistic ${test} ${subj.name} practice question focused on "${target}". Difficulty: ${diffMap[difficulty]||diffMap.medium}.
${isMCQ?'Multiple choice with exactly 4 options (A,B,C,D).':'Free response — provide a model answer.'}
Respond ONLY with valid JSON (no markdown, no backticks):
{"question":"...","passage":null,"subtopic":"${target}","difficulty":"${difficulty||'medium'}",${isMCQ?'"choices":["A) ...","B) ...","C) ...","D) ..."],"correct":"A",':'"modelAnswer":"...",'}
"explanation":"clear step-by-step explanation"}`;
  try{
    const r=await fetch('/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'claude-sonnet-4-6',max_tokens:1000,messages:[{role:'user',content:prompt}]})});
    const d=await r.json();
    const txt=d.content?.map(c=>c.text||'').join('')||'';
    return JSON.parse(txt.replace(/```json|```/g,'').trim());
  }catch(e){
    return {question:`In the context of ${target}, which of the following best applies?`,passage:null,subtopic:target,difficulty:difficulty||'medium',
      choices:isMCQ?['A) First option — consider carefully','B) Second option — look for context clues','C) Third option — this is the correct answer','D) Fourth option — common misconception']:undefined,
      correct:isMCQ?'C':undefined,modelAnswer:!isMCQ?`A strong response would address the key aspects of ${target} with specific examples and clear reasoning.`:undefined,
      explanation:`This question tests your understanding of ${target}. The correct answer follows from careful analysis of the key concepts. Review your notes on this topic to strengthen your mastery.`};
  }
}

/* ─── COMPONENTS ────────────────────────────────────────────── */
function Toast({msg,show}){return <div className={`toast ${show?'show':''}`}>{msg}</div>}

function Toggle({on,onChange}){
  return <div className={`toggle-switch ${on?'on':''}`} onClick={onChange}><div className="toggle-knob"/></div>;
}

function ScoreRing({score,max,color,size=140}){
  const r=56,circ=2*Math.PI*r,dash=(score/max)*circ;
  return(
    <div className="ring-wrap" style={{width:size,height:size}}>
      <svg width={size} height={size} viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={r} fill="none" stroke="var(--bg-elevated)" strokeWidth="10"/>
        <circle cx="70" cy="70" r={r} fill="none" stroke={color} strokeWidth="10" strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"/>
      </svg>
      <div className="ring-inner">
        <span className="ring-num" style={{color}}>{score}</span>
        <span className="ring-denom">/ {max}</span>
      </div>
    </div>
  );
}

/* ─── ONBOARDING ─────────────────────────────────────────────── */
function Onboarding({onComplete}){
  const[step,setStep]=useState(0);
  const[name,setName]=useState('');
  const[target,setTarget]=useState(null);
  const[goal,setGoal]=useState(null);
  const[avatar,setAvatar]=useState(0);
  const[avatarColor,setAvatarColor]=useState(0);
  const[difficulty,setDifficulty]=useState('medium');
  const total=5;
  const pct=((step)/total)*100;
  const goals=['1400+ SAT','1500+ SAT','1550+ SAT','30+ ACT','33+ ACT','35+ ACT'];
  const canNext=[name.trim().length>1,!!target,!!goal,true,true];
  const next=()=>{if(step<total-1)setStep(s=>s+1);else onComplete({name:name.trim(),target,goal,avatar,avatarColor,difficulty})};
  const back=()=>setStep(s=>s-1);
  const steps=[
    {icon:'👋',title:`Let's get you set up`,sub:'ScoreUp adapts to your strengths and weaknesses so every minute you study counts.',
      content:<><label className="input-label">What should we call you?</label><input className="input-field" placeholder="Your first name" value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&canNext[0]&&next()} autoFocus/></>},
    {icon:'🎯',title:'Which test are you taking?',sub:'We\'ll focus your practice and assessments on the right format.',
      content:<div className="ob-choices">
        {[{v:'SAT',icon:'📝',desc:'Reading/Writing + Math, digital format'},{v:'ACT',icon:'📋',desc:'English, Math, Reading, Science + Writing'}].map(o=>(
          <div key={o.v} className={`ob-choice ${target===o.v?'sel':''}`} onClick={()=>setTarget(o.v)}>
            <div className="ob-choice-icon">{o.icon}</div>
            <div><div className="ob-choice-text">{o.v}</div><div className="ob-choice-sub">{o.desc}</div></div>
            <div className="ob-choice-check">{target===o.v&&'✓'}</div>
          </div>
        ))}
      </div>},
    {icon:'🏆',title:'What\'s your score goal?',sub:'Be ambitious — we\'ll build a path to get you there.',
      content:<div className="ob-grid">{goals.map(g=>(
        <div key={g} className={`ob-choice ${goal===g?'sel':''}`} onClick={()=>setGoal(g)} style={{padding:'12px 14px'}}>
          <div className="ob-choice-text" style={{fontSize:15,fontWeight:700}}>{g}</div>
          <div className="ob-choice-check" style={{marginLeft:'auto'}}>{goal===g&&'✓'}</div>
        </div>
      ))}</div>},
    {icon:'🎨',title:'Pick your avatar',sub:'Choose how you\'ll appear on the leaderboard.',
      content:<>
        <div className="ob-avatar-row">{AVATARS.map((e,i)=>(
          <div key={i} className={`ob-avatar-opt ${avatar===i?'sel':''}`} style={{background:AVATAR_COLORS[avatarColor]+'28'}} onClick={()=>setAvatar(i)}>{e}</div>
        ))}</div>
        <label className="input-label" style={{marginBottom:8}}>Color</label>
        <div className="ob-avatar-row">{AVATAR_COLORS.map((c,i)=>(
          <div key={i} className={`ob-avatar-opt ${avatarColor===i?'sel':''}`} style={{background:c+'22',border:`2px solid ${avatarColor===i?c:'transparent'}`}} onClick={()=>setAvatarColor(i)}>
            <div style={{width:20,height:20,borderRadius:'50%',background:c}}/>
          </div>
        ))}</div>
      </>},
    {icon:'⚙️',title:'Set your difficulty',sub:'You can always change this in your profile settings.',
      content:<div className="difficulty-row">
        {[{v:'easy',icon:'🌱',lbl:'Easy',sub:'Build fundamentals'},{v:'medium',icon:'⚡',lbl:'Medium',sub:'Balanced challenge'},{v:'hard',icon:'🔥',lbl:'Hard',sub:'Push your limits'}].map(d=>(
          <div key={d.v} className={`diff-opt ${difficulty===d.v?'sel':''}`} onClick={()=>setDifficulty(d.v)}>
            <div className="diff-opt-icon">{d.icon}</div>
            <div className="diff-opt-label">{d.lbl}</div>
            <div className="diff-opt-sub">{d.sub}</div>
          </div>
        ))}
      </div>},
  ];
  const s=steps[step];
  return(
    <div className="onboard-wrap">
      <div className="onboard-card">
        <div className="ob-progress-bar"><div className="ob-progress-fill" style={{width:`${pct}%`}}/></div>
        <div className="ob-step-dots">{steps.map((_,i)=><div key={i} className={`ob-dot ${i===step?'active':i<step?'done':''}`} style={{width:i===step?28:i<step?16:8}}/>)}</div>
        <div className="ob-icon">{s.icon}</div>
        <div className="ob-title">{s.title}</div>
        <div className="ob-sub">{s.sub}</div>
        {s.content}
        <div className="ob-actions">
          {step>0&&<button className="btn-ob-back" onClick={back}>← Back</button>}
          <button className="btn-ob-next" disabled={!canNext[step]} onClick={next} style={{flex:step===0?1:2}}>
            {step===total-1?'Start studying 🚀':'Continue →'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── AUTH MODAL ─────────────────────────────────────────────── */
function AuthModal({onClose,onAuth}){
  const[mode,setMode]=useState('login');
  const[email,setEmail]=useState('');
  const[pass,setPass]=useState('');
  const[loading,setLoading]=useState(false);
  const[err,setErr]=useState('');
  const[sent,setSent]=useState(false);
  const demo=SUPABASE_URL==='YOUR_SUPABASE_URL';
  const submit=async()=>{
    if(demo){onAuth({email:email||'demo@scoreup.app',id:'demo-user'});return;}
    setLoading(true);setErr('');
    try{
      const ep=mode==='signup'?'signup':'token?grant_type=password';
      const r=await fetch(`${SUPABASE_URL}/auth/v1/${ep}`,{method:'POST',headers:{'Content-Type':'application/json','apikey':SUPABASE_ANON_KEY},body:JSON.stringify({email,password:pass})});
      const d=await r.json();
      if(d.error)throw new Error(d.error_description||d.error);
      onAuth(d.user||d);
    }catch(e){setErr(e.message);}finally{setLoading(false);}
  };
  const magic=async()=>{
    if(demo){setSent(true);return;}
    setLoading(true);
    try{await fetch(`${SUPABASE_URL}/auth/v1/magiclink`,{method:'POST',headers:{'Content-Type':'application/json','apikey':SUPABASE_ANON_KEY},body:JSON.stringify({email})});setSent(true);}
    catch(e){setErr(e.message);}finally{setLoading(false);}
  };
  if(sent)return(
    <div className="overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{textAlign:'center'}}>
        <div style={{fontSize:44,marginBottom:'1rem'}}>✉️</div>
        <div className="modal-title">Check your inbox</div>
        <div className="modal-sub">A sign-in link was sent to <strong>{email}</strong>. Click it to continue.</div>
        <button className="btn-full" onClick={onClose}>Back to home</button>
      </div>
    </div>
  );
  return(
    <div className="overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="modal-title">{mode==='login'?'Welcome back':'Create account'}</div>
        <div className="modal-sub">{mode==='login'?'Sign in to track your progress and daily streak.':'Join thousands of students improving their scores.'}</div>
        <label className="input-label">Email</label>
        <input className="input-field" type="email" placeholder="you@example.com" value={email} onChange={e=>setEmail(e.target.value)} style={{marginBottom:10}}/>
        <label className="input-label">Password</label>
        <input className="input-field" type="password" placeholder="••••••••" value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submit()} style={{marginBottom:0}}/>
        {err&&<div className="err">{err}</div>}
        <button className="btn-full" onClick={submit} disabled={loading||!email}>{loading?'Loading…':mode==='login'?'Sign in':'Create account'}</button>
        <div className="divider"><span>or</span></div>
        <button className="btn-full ghost" onClick={magic} disabled={loading||!email}>✨ Send magic link</button>
        <div className="toggle-link">{mode==='login'?<>No account? <span onClick={()=>setMode('signup')}>Sign up free</span></>:<>Have an account? <span onClick={()=>setMode('login')}>Sign in</span></>}</div>
        {demo&&<div className="config-box">🔧 <strong>Demo mode</strong> — auth is simulated. Replace <code>YOUR_SUPABASE_URL</code> and <code>YOUR_SUPABASE_ANON_KEY</code> to enable real login.</div>}
      </div>
    </div>
  );
}

/* ─── SESSION ────────────────────────────────────────────────── */
function SessionPage({test,subj,qType,weakness,setWeakness,isAssess,difficulty,onDone,onBack}){
  const[q,setQ]=useState(null);const[loading,setLoading]=useState(true);
  const[sel,setSel]=useState(null);const[revealed,setRevealed]=useState(false);
  const[frq,setFrq]=useState('');const[correct,setCorrect]=useState(0);
  const[total,setTotal]=useState(0);const[results,setResults]=useState([]);
  const isMCQ=qType==='mcq'||subj.frqOnly===undefined&&qType==='mcq';
  const load=useCallback(async()=>{
    setLoading(true);setSel(null);setRevealed(false);setFrq('');
    const d=await genQuestion(test,subj,isMCQ?'mcq':'frq',weakness,difficulty);
    setQ(d);setLoading(false);
  },[test,subj,isMCQ,weakness,difficulty]);
  useEffect(()=>{load();},[]);
  const check=()=>{
    setRevealed(true);
    const ok=isMCQ?sel?.[0]===q.correct:frq.length>30;
    const w={...weakness};const t=q.subtopic;
    w[t]=ok?Math.min(100,(w[t]||65)+5):Math.max(0,(w[t]||65)-10);
    setWeakness(w);
    const nt=total+1,nc=ok?correct+1:correct;
    setTotal(nt);setCorrect(nc);
    const nr=[...results,{subtopic:t,correct:ok}];setResults(nr);
    if(isAssess&&nt>=10)setTimeout(()=>onDone({score:nc,total:nt,results:nr,subj}),1200);
    const prev=parseInt(localStorage.getItem('su_total_q')||'0');
    localStorage.setItem('su_total_q',String(prev+1));
  };
  if(loading)return(
    <div className="page"><button className="back-btn" onClick={onBack}>← Back</button>
      <div className="loading-wrap"><div className="spinner"/><div className="loading-lbl">Generating your question…</div></div>
    </div>
  );
  const pct=isAssess?Math.round((total/10)*100):0;
  return(
    <div className="page">
      <button className="back-btn" onClick={onBack}>← Back</button>
      <div className="sess-hd">
        <div className="sess-meta">
          <div className="sess-badge" style={{background:subj.bg,color:subj.color}}>{subj.name}</div>
          {isAssess&&<span style={{fontSize:12,color:'var(--text-3)'}}>Assessment</span>}
        </div>
        {isAssess&&(
          <div className="sess-prog-wrap">
            <div className="prog-labels"><span>Q {total+1} of 10</span><span>{pct}%</span></div>
            <div className="prog-track"><div className="prog-fill" style={{width:`${pct}%`,background:subj.color}}/></div>
          </div>
        )}
        <div className="score-chips">
          <div className="score-chip"><div className="dot" style={{background:'var(--success)'}}/>{correct} correct</div>
          <div className="score-chip"><div className="dot" style={{background:'var(--text-3)'}}/>{total} total</div>
        </div>
      </div>
      <div className="q-card">
        <div className="q-meta">
          <div className="q-tag" style={{background:subj.bg,color:subj.color}}>{q.subtopic||subj.subtopics[0]}</div>
          <div className={`diff-badge diff-${q.difficulty||'medium'}`}>{(q.difficulty||'medium').charAt(0).toUpperCase()+(q.difficulty||'medium').slice(1)}</div>
          <div className="q-diff">{isMCQ?'Multiple choice':'Free response'}</div>
        </div>
        {q.passage&&<div className="q-passage">{q.passage}</div>}
        <div className="q-text">{q.question}</div>
        {isMCQ?(
          <div className="choices">
            {(q.choices||[]).map((c,i)=>{
              const letter=c[0],isThis=sel===c,isCorr=revealed&&letter===q.correct,isWrong=revealed&&isThis&&letter!==q.correct;
              return(
                <button key={i} className={`choice ${isThis&&!revealed?'selected':''} ${isCorr?'correct':''} ${isWrong?'wrong':''}`} disabled={revealed} onClick={()=>setSel(c)}>
                  <div className="choice-letter">{letter}</div>
                  <div className="choice-text">{c.slice(3)}</div>
                </button>
              );
            })}
          </div>
        ):(
          <textarea className="frq-area" placeholder="Write your response here…" value={frq} onChange={e=>setFrq(e.target.value)} disabled={revealed}/>
        )}
        {revealed&&(
          <div className="expl-box">
            <div className="expl-lbl">Explanation</div>
            <div className="expl-text">
              {!isMCQ&&q.modelAnswer&&<><strong style={{color:'var(--text-1)'}}>Model answer:</strong> {q.modelAnswer}<br/><br/></>}
              {q.explanation}
            </div>
          </div>
        )}
      </div>
      <div className="sess-foot">
        <div className="sess-hint">{!revealed&&isMCQ&&!sel&&'Select an answer to continue'}{!revealed&&isMCQ&&sel&&'Ready to check?'}{!revealed&&!isMCQ&&frq.length<30&&'Write at least a sentence to continue'}{revealed&&!isAssess&&'Nice work! Next question when you\'re ready.'}</div>
        {!revealed?(
          <button className="btn-sess primary" style={{background:subj.color}} disabled={isMCQ?!sel:frq.length<30} onClick={check}>Check answer</button>
        ):(!isAssess&&<button className="btn-sess primary" style={{background:subj.color}} onClick={load}>Next question →</button>)}
      </div>
    </div>
  );
}

/* ─── SUMMARY ─────────────────────────────────────────────────── */
function SummaryPage({result,onBack,onRetake}){
  const{score,total,results,subj}=result;
  const pct=Math.round((score/total)*100);
  const grade=pct>=80?{lbl:'Excellent! 🎉',c:'var(--success)'}:pct>=60?{lbl:'Good work! 💪',c:'var(--sat)'}:{lbl:'Keep at it! 🔄',c:'var(--warning)'};
  const bd={};results.forEach(r=>{if(!bd[r.subtopic])bd[r.subtopic]={c:0,t:0};bd[r.subtopic].t++;if(r.correct)bd[r.subtopic].c++;});
  return(
    <div className="page">
      <button className="back-btn" onClick={onBack}>← Back to hub</button>
      <div className="summary-card">
        <ScoreRing score={score} max={total} color={subj.color}/>
        <div className="sum-title">{grade.lbl}</div>
        <div className="sum-sub">You got <strong>{score} of {total}</strong> correct on the {subj.name} assessment.</div>
        <div className="breakdown-grid">
          {Object.entries(bd).map(([t,d])=>(
            <div className="bd-item" key={t}>
              <div className="bd-topic">{t}</div>
              <div className="bd-score" style={{color:d.c/d.t>=.7?'var(--success)':'var(--danger)'}}>{d.c}/{d.t}</div>
              <div className="bd-pct">{Math.round(d.c/d.t*100)}%</div>
            </div>
          ))}
        </div>
      </div>
      <div className="sum-actions">
        <button className="btn-sum ghost" onClick={onBack}>Back to hub</button>
        <button className="btn-sum primary" style={{background:subj.color}} onClick={onRetake}>Retake assessment</button>
      </div>
    </div>
  );
}

/* ─── HUB ─────────────────────────────────────────────────────── */
function HubPage({test,subjs,accent,weakness,onSubj,onAssess,onBack}){
  return(
    <div className="page">
      <button className="back-btn" onClick={onBack}>← Dashboard</button>
      <div className="hub-hero">
        <div className="hub-badge" style={{background:`${accent}18`,color:accent}}>{test} Study Hub</div>
        <div className="hub-title">What are you working on?</div>
        <div className="hub-sub">Pick a subject to practice, or take a quick 10-question diagnostic.</div>
      </div>
      <div className="subjects-grid">
        {subjs.map(s=>{
          const avg=Math.round(s.subtopics.reduce((a,t)=>a+(weakness[t]||65),0)/s.subtopics.length);
          return(
            <div className="subj-card" key={s.id} onClick={()=>onSubj(s)}>
              <div className="subj-icon" style={{background:s.bg}}>{s.icon}</div>
              <div className="subj-name">{s.name}</div>
              <div className="subj-count">{s.subtopics.length} subtopics</div>
              <div><div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'var(--text-3)',marginBottom:4}}><span>Mastery</span><span style={{fontWeight:700,color:s.color}}>{avg}%</span></div>
                <div className="pbar"><div className="pbar-fill" style={{width:`${avg}%`,background:s.color}}/></div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="assess-banner">
        <div className="assess-text"><h3>📊 10-question diagnostic</h3><p>Find your gaps across all {test} topics in under 10 minutes.</p></div>
        <button className="btn-sess primary" style={{background:accent,flexShrink:0}} onClick={onAssess}>Take assessment</button>
      </div>
    </div>
  );
}

/* ─── DASHBOARD ────────────────────────────────────────────────── */
function Dashboard({user,profile,weakness,streak,streakDays,onTest,totalQ,sessCorrect}){
  const all=Object.entries(weakness).sort((a,b)=>a[1]-b[1]);
  const bottom=all.slice(0,4);
  const avg=all.length?Math.round(all.reduce((a,b)=>a+b[1],0)/all.length):0;
  return(
    <div className="page-wide">
      <div className="dash-greet">
        <div className="dash-greet-title">Welcome back, {profile?.name||user?.email?.split('@')[0]||'Student'} {AVATARS[profile?.avatar||0]}</div>
        <div className="dash-greet-sub">You're on a {streak}-day streak — consistency beats cramming every time.</div>
      </div>
      <div className="stats-row">
        <div className="stat"><div className="stat-lbl">Day streak</div><div className="stat-val" style={{color:'var(--warning)'}}>🔥 {streak}</div><div className="stat-meta">days in a row</div></div>
        <div className="stat"><div className="stat-lbl">Avg mastery</div><div className="stat-val" style={{color:'var(--sat)'}}>{avg}%</div><div className="stat-meta">across all topics</div></div>
        <div className="stat"><div className="stat-lbl">Qs answered</div><div className="stat-val">{totalQ}</div><div className="stat-meta">this session</div></div>
        <div className="stat"><div className="stat-lbl">Focus areas</div><div className="stat-val" style={{color:'var(--warning)'}}>{bottom.filter(t=>t[1]<70).length}</div><div className="stat-meta">topics below 70%</div></div>
      </div>
      <div className="cal-card">
        <div className="section-hd" style={{marginBottom:0}}>Study activity — last 90 days</div>
        <div className="cal-grid">{streakDays.map((d,i)=><div key={i} className={`cal-day ${d.on?'on':''} ${i===streakDays.length-1?'today':''}`} title={d.date}/>)}</div>
        <div className="cal-leg"><div className="cal-leg-box" style={{background:'var(--bg-elevated)'}}/><span>No activity</span><div className="cal-leg-box" style={{background:'var(--sat)'}}/><span>Studied</span><div className="cal-leg-box" style={{background:'var(--act)'}}/><span>Today</span></div>
      </div>
      <div className="section-hd">Focus areas</div>
      <div className="focus-grid" style={{marginBottom:'2rem'}}>
        {bottom.map(([t,v])=>(
          <div className="focus-item" key={t}>
            <div className="focus-row"><span>{t}</span><span className="focus-score" style={{color:weakColor(v)}}>{v}%</span></div>
            <div className="pbar"><div className="pbar-fill" style={{width:`${v}%`,background:weakColor(v)}}/></div>
          </div>
        ))}
      </div>
      <div className="section-hd">Choose your test</div>
      <div className="test-grid">
        <div className="test-card sat" onClick={()=>onTest('SAT')}>
          <div className="tc-icon">SAT</div>
          <div className="tc-title">SAT Prep</div>
          <div className="tc-desc">AI-powered MCQ practice for Reading & Writing and Math, targeted to your weakest subtopics.</div>
          <div className="tc-pills"><div className="pill" style={{background:'rgba(179,157,250,.12)',color:'#b39dfa'}}>📖 Reading & Writing</div><div className="pill" style={{background:'rgba(124,159,245,.12)',color:'#7c9ff5'}}>🔢 Math</div></div>
        </div>
        <div className="test-card act" onClick={()=>onTest('ACT')}>
          <div className="tc-icon" style={{color:'var(--act)'}}>ACT</div>
          <div className="tc-title">ACT Prep</div>
          <div className="tc-desc">Choose MCQ or free response across English, Math, Science, and Writing with adaptive difficulty.</div>
          <div className="tc-pills"><div className="pill" style={{background:'rgba(78,205,196,.12)',color:'#4ecdc4'}}>✍️ English</div><div className="pill" style={{background:'rgba(124,159,245,.12)',color:'#7c9ff5'}}>🔢 Math</div><div className="pill" style={{background:'rgba(245,166,35,.12)',color:'#f5a623'}}>🔬 Science</div><div className="pill" style={{background:'rgba(240,98,146,.12)',color:'#f06292'}}>🖊️ Writing</div></div>
        </div>
      </div>
    </div>
  );
}

/* ─── PROFILE ──────────────────────────────────────────────────── */
function ProfilePage({user,profile,setProfile,weakness,streak,totalQ,history}){
  const[diff,setDiff]=useState(profile?.difficulty||'medium');
  const[notify,setNotify]=useState(true);
  const[sound,setSound]=useState(false);
  const saveDiff=d=>{setDiff(d);setProfile(p=>({...p,difficulty:d}));};
  const all=Object.entries(weakness).sort((a,b)=>a[1]-b[1]);
  const earned=[];
  if(streak>=7)earned.push({l:'🔥 7-day streak',cls:'gold'});
  if(streak>=30)earned.push({l:'⚡ 30-day streak',cls:'gold'});
  if(totalQ>=50)earned.push({l:'📚 50 questions',cls:'blue'});
  if(totalQ>=100)earned.push({l:'💯 100 questions',cls:'green'});
  if(all.some(([,v])=>v>=90))earned.push({l:'⭐ Topic mastered',cls:'gold'});
  return(
    <div className="page-wide">
      <div style={{marginBottom:'1.5rem'}}><div style={{fontFamily:'var(--font-d)',fontSize:'1.5rem',fontWeight:700,letterSpacing:'-.02em'}}>Your profile</div></div>
      <div className="profile-layout">
        <div className="profile-sidebar">
          <div className="profile-card">
            <div className="profile-banner"/>
            <div className="profile-av" style={{background:AVATAR_COLORS[profile?.avatarColor||0]+'33'}}>{AVATARS[profile?.avatar||0]}</div>
            <div className="profile-info">
              <div className="profile-name">{profile?.name||user?.email?.split('@')[0]||'Student'}</div>
              <div className="profile-handle">{user?.email||'demo@scoreup.app'}</div>
              {earned.length>0&&<div className="profile-badges">{earned.map((b,i)=><div key={i} className={`badge ${b.cls}`}>{b.l}</div>)}</div>}
            </div>
            <div className="profile-stats">
              <div className="profile-stat"><div className="profile-stat-val" style={{color:'var(--warning)'}}>🔥{streak}</div><div className="profile-stat-lbl">day streak</div></div>
              <div className="profile-stat"><div className="profile-stat-val">{totalQ}</div><div className="profile-stat-lbl">questions</div></div>
              <div className="profile-stat"><div className="profile-stat-val" style={{color:'var(--sat)'}}>{profile?.goal||'—'}</div><div className="profile-stat-lbl">target</div></div>
              <div className="profile-stat"><div className="profile-stat-val">{all.length?Math.round(all.reduce((a,b)=>a+b[1],0)/all.length):0}%</div><div className="profile-stat-lbl">avg mastery</div></div>
            </div>
          </div>
          <div className="setting-card">
            <div style={{fontFamily:'var(--font-d)',fontSize:'.9rem',fontWeight:600,marginBottom:'1rem'}}>Settings</div>
            <div className="setting-row">
              <div><div className="setting-lbl">Difficulty</div><div className="setting-sub">Default question level</div></div>
              <div className="diff-select">
                {['easy','medium','hard'].map(d=><div key={d} className={`diff-chip ${diff===d?`on-${d}`:''}`} onClick={()=>saveDiff(d)}>{d.charAt(0).toUpperCase()+d.slice(1)}</div>)}
              </div>
            </div>
            <div className="setting-row">
              <div><div className="setting-lbl">Notifications</div><div className="setting-sub">Daily study reminders</div></div>
              <Toggle on={notify} onChange={()=>setNotify(v=>!v)}/>
            </div>
            <div className="setting-row">
              <div><div className="setting-lbl">Sound effects</div><div className="setting-sub">Answer feedback sounds</div></div>
              <Toggle on={sound} onChange={()=>setSound(v=>!v)}/>
            </div>
          </div>
        </div>
        <div className="profile-main">
          <div className="section-card">
            <div className="section-hd" style={{marginBottom:'1.25rem'}}>Topic mastery</div>
            <div className="mastery-list">
              {all.map(([t,v])=>(
                <div className="mastery-row" key={t}>
                  <div className="mastery-lbl">{t}</div>
                  <div className="mastery-bar-wrap"><div className="mastery-bar"><div className="mastery-fill" style={{width:`${v}%`,background:weakColor(v)}}/></div></div>
                  <div className="mastery-pct" style={{color:weakColor(v)}}>{v}%</div>
                </div>
              ))}
            </div>
          </div>
          <div className="section-card">
            <div className="section-hd" style={{marginBottom:'1.1rem'}}>Recent sessions</div>
            {history.length===0&&<div style={{fontSize:13,color:'var(--text-3)',textAlign:'center',padding:'1.5rem 0'}}>No sessions yet — start practicing to see your history here.</div>}
            <div className="history-list">
              {history.slice(-8).reverse().map((h,i)=>(
                <div className="hist-item" key={i}>
                  <div className="hist-icon">{h.subj.icon}</div>
                  <div className="hist-lbl">{h.subj.name} {h.isAssess?'Assessment':'Practice'}</div>
                  <div className="hist-meta">{h.date}</div>
                  <div className="hist-score" style={{color:h.score/h.total>=.7?'var(--success)':'var(--danger)'}}>{h.score}/{h.total}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── LEADERBOARD ──────────────────────────────────────────────── */
function LeaderboardPage({profile,totalQ,streak,weakness}){
  const[tab,setTab]=useState('weekly');
  const myScore=totalQ*12+(streak*50);
  const myName=profile?.name||'You';
  const myEmoji=AVATARS[profile?.avatar||0];
  const myColor=AVATAR_COLORS[profile?.avatarColor||0];
  const leaderboard=useMemo(()=>{
    const lb=[...FAKE_LEADERBOARD.map((p,i)=>({...p,pts:p.pts+(tab==='all'?i*200:tab==='monthly'?i*80:i*30)}))];
    const me={name:myName,emoji:myEmoji,color:myColor,pts:myScore,streak,correct:totalQ,isMe:true};
    lb.push(me);
    return lb.sort((a,b)=>b.pts-a.pts);
  },[tab,myScore,streak,totalQ,myName,myEmoji,myColor]);
  const myRank=leaderboard.findIndex(p=>p.isMe)+1;
  const top3=leaderboard.slice(0,3);
  const podiumOrder=[top3[1],top3[0],top3[2]];
  const podiumH=[72,96,58];
  const podiumColors=['#b3b3b3','#f5a623','#cd7f32'];
  return(
    <div className="page-wide">
      <div style={{marginBottom:'1.5rem'}}><div style={{fontFamily:'var(--font-d)',fontSize:'1.5rem',fontWeight:700,letterSpacing:'-.02em'}}>Leaderboard</div></div>
      <div className="lb-tabs">
        {['weekly','monthly','all'].map(t=><button key={t} className={`lb-tab ${tab===t?'active':''}`} onClick={()=>setTab(t)}>{t.charAt(0).toUpperCase()+t.slice(1)}</button>)}
      </div>
      <div className="lb-layout">
        <div>
          <div className="lb-podium">
            {podiumOrder.map((p,i)=>{
              if(!p)return<div key={i} style={{width:68}}/>;
              const realI=[1,0,2][i];
              return(
                <div className="podium-slot" key={i}>
                  <div className="podium-av" style={{background:p.color+'22',border:`2px solid ${podiumColors[realI]}`}}>
                    {realI===0&&<span className="crown">👑</span>}
                    {p.emoji}
                  </div>
                  <div className="podium-name">{p.isMe?'You':p.name}</div>
                  <div className="podium-score">{p.pts.toLocaleString()} pts</div>
                  <div className="podium-block" style={{height:podiumH[i],background:podiumColors[realI]+'cc'}}>{realI+1}</div>
                </div>
              );
            })}
          </div>
          <div className="lb-list">
            {leaderboard.map((p,i)=>(
              <div className={`lb-row ${p.isMe?'me':''}`} key={i}>
                <div className="lb-rank">{i+1}</div>
                <div className="lb-av" style={{background:p.color+'22'}}>{p.emoji}</div>
                <div className="lb-name">{p.isMe?'You':p.name}{p.isMe&&<span className="lb-you">YOU</span>}</div>
                <div style={{textAlign:'right'}}><div className="lb-pts" style={{color:i===0?'var(--warning)':i<3?'var(--text-1)':'var(--text-2)'}}>{p.pts.toLocaleString()}</div><div className="lb-pts-lbl">points</div></div>
              </div>
            ))}
          </div>
        </div>
        <div className="lb-sidebar">
          <div className="lb-your-card">
            <div className="lb-your-title">Your rank</div>
            <div className="lb-your-rank" style={{color:'var(--sat)'}}>#{myRank}</div>
            <div className="lb-your-sub">of {leaderboard.length} students this {tab==='all'?'season':tab.replace('ly','')}</div>
            <div className="lb-your-stats">
              <div className="lb-your-stat"><div className="lb-your-stat-val" style={{color:'var(--warning)'}}>🔥{streak}</div><div className="lb-your-stat-lbl">day streak</div></div>
              <div className="lb-your-stat"><div className="lb-your-stat-val">{myScore.toLocaleString()}</div><div className="lb-your-stat-lbl">total pts</div></div>
              <div className="lb-your-stat"><div className="lb-your-stat-val">{totalQ}</div><div className="lb-your-stat-lbl">answered</div></div>
              <div className="lb-your-stat"><div className="lb-your-stat-val">{weakness&&Object.keys(weakness).length?Math.round(Object.values(weakness).reduce((a,b)=>a+b,0)/Object.values(weakness).length):0}%</div><div className="lb-your-stat-lbl">mastery</div></div>
            </div>
          </div>
          <div className="lb-reward-card">
            <div className="lb-reward-title">🏆 Weekly rewards</div>
            <div className="lb-reward-list">
              {[{r:'🥇',t:'Top 1',d:'Gold badge + 500 pts bonus'},{r:'🥈',t:'Top 3',d:'Silver badge + 200 pts'},{r:'🥉',t:'Top 10',d:'Bronze badge + 100 pts'},{r:'✨',t:'Most improved',d:'Special "Grind" badge'}].map((rw,i)=>(
                <div className="lb-reward-item" key={i}><div className="lb-reward-badge">{rw.r}</div><div><div style={{fontSize:13,fontWeight:500,color:'var(--text-1)'}}>{rw.t}</div><div style={{fontSize:11}}>{rw.d}</div></div></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── LANDING ──────────────────────────────────────────────────── */
function Landing({onStart}){
  return(
    <div>
      <div className="land-wrap">
        <div className="land-eyebrow">AI-powered test prep</div>
        <h1 className="land-title">Study smarter.<br/><span>Score higher.</span></h1>
        <p className="land-sub">Adaptive practice questions that learn your weaknesses and turn them into strengths — for the SAT and ACT.</p>
        <div className="land-actions">
          <button className="btn-land-p" onClick={onStart}>Get started free</button>
          <button className="btn-land-s" onClick={onStart}>Sign in</button>
        </div>
      </div>
      <div style={{maxWidth:860,margin:'0 auto',padding:'0 2rem 4rem'}}>
        <div className="land-features">
          {[{i:'🧠',t:'Adaptive questions',d:'Claude generates fresh questions every time, targeting exactly the subtopics you struggle with most.'},{i:'📈',t:'Weakness engine',d:'Answer tracking updates your mastery score in real-time so harder topics get more practice time.'},{i:'🔥',t:'Daily streaks',d:'Build a study habit with streak tracking, a 90-day calendar, and leaderboard rankings.'}].map((f,i)=>(
            <div className="land-feat" key={i}><div className="land-feat-icon">{f.i}</div><div className="land-feat-title">{f.t}</div><div className="land-feat-desc">{f.d}</div></div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── APP ──────────────────────────────────────────────────────── */
export default function App(){
  const[theme,setTheme]=useState('dark');
  const[page,setPage]=useState('landing');
  const[showAuth,setShowAuth]=useState(false);
  const[user,setUser]=useState(null);
  const[profile,setProfile]=useState(null);
  const[onboarded,setOnboarded]=useState(false);
  const[activeTest,setActiveTest]=useState(null);
  const[activeSubj,setActiveSubj]=useState(null);
  const[qType,setQType]=useState(null);
  const[showQType,setShowQType]=useState(false);
  const[isAssess,setIsAssess]=useState(false);
  const[summaryResult,setSummaryResult]=useState(null);
  const[weakness,setWeakness]=useState({});
  const[history,setHistory]=useState([]);
  const[toast,setToast]=useState({msg:'',show:false});
  const streakDays=useState(()=>getOrMakeStreak())[0];
  const streak=countStreak(streakDays);
  const totalQ=parseInt(localStorage.getItem('su_total_q')||'0');

  useEffect(()=>{document.documentElement.setAttribute('data-theme',theme);},[theme]);

  const showToast=msg=>{setToast({msg,show:true});setTimeout(()=>setToast(t=>({...t,show:false})),2800);};

  const handleAuth=u=>{setUser(u);setShowAuth(false);if(!onboarded)setPage('onboard');else setPage('dashboard');};
  const handleOnboard=data=>{setProfile(data);setOnboarded(true);setWeakness({...initWeakness(SAT_SUBJS),...initWeakness(ACT_SUBJS)});setPage('dashboard');showToast('Welcome to ScoreUp! 🎉');};
  const handleLogout=()=>{setUser(null);setProfile(null);setOnboarded(false);setPage('landing');};

  const handleTest=t=>{setActiveTest(t);setPage('hub');};
  const handleSubj=s=>{
    setActiveSubj(s);setIsAssess(false);
    if(activeTest==='ACT'&&!s.frqOnly){setShowQType(true);}
    else if(s.frqOnly){setQType('frq');setPage('session');}
    else{setQType('mcq');setPage('session');}
  };
  const handleAssess=()=>{
    const subjs=activeTest==='SAT'?SAT_SUBJS:ACT_SUBJS;
    const s=subjs[Math.floor(Math.random()*subjs.length)];
    setActiveSubj(s);setIsAssess(true);
    if(activeTest==='ACT'&&!s.frqOnly)setShowQType(true);
    else{setQType(s.frqOnly?'frq':'mcq');setPage('session');}
  };
  const handleQType=t=>{setQType(t);setShowQType(false);setPage('session');};
  const handleDone=result=>{
    setSummaryResult(result);setPage('summary');
    const prev=parseInt(localStorage.getItem('su_total_q')||'0');
    localStorage.setItem('su_total_q',String(prev+result.total));
    const now=new Date();
    setHistory(h=>[...h,{subj:result.subj,score:result.score,total:result.total,isAssess:true,date:now.toLocaleDateString('en-US',{month:'short',day:'numeric'})}]);
    showToast(`Assessment complete — ${result.score}/${result.total} correct!`);
  };

  const subjs=activeTest==='SAT'?SAT_SUBJS:ACT_SUBJS;
  const accent=activeTest==='SAT'?'#7c9ff5':'#4ecdc4';
  const navTabs=user?[{id:'dashboard',lbl:'Dashboard'},{id:'leaderboard',lbl:'Leaderboard'},{id:'profile',lbl:'Profile'}]:[];

  return(
    <div className="app">
      <nav className="nav">
        <div className="nav-logo" onClick={()=>setPage(user?'dashboard':'landing')}>
          <div className="logo-mark">S</div>
          <span className="logo-text">ScoreUp</span>
        </div>
        {user&&(
          <div className="nav-center">
            {navTabs.map(t=><button key={t.id} className={`nav-tab ${page===t.id?'active':''}`} onClick={()=>setPage(t.id)}>{t.lbl}</button>)}
          </div>
        )}
        <div className="nav-right">
          {user&&<div className="streak-pill"><span>🔥</span><span>{streak}</span></div>}
          <button className="icon-btn" onClick={()=>setTheme(t=>t==='dark'?'light':'dark')} title="Toggle theme">{theme==='dark'?'☀️':'🌙'}</button>
          {!user?(
            <button className="btn-nav" onClick={()=>setShowAuth(true)}>Sign in</button>
          ):(
            <>
              <div className="avatar" onClick={()=>setPage('profile')} title={user.email} style={{background:AVATAR_COLORS[profile?.avatarColor||0]+'33'}}>{AVATARS[profile?.avatar||0]}</div>
              <button className="icon-btn" onClick={handleLogout} title="Sign out" style={{fontSize:13}}>↩</button>
            </>
          )}
        </div>
      </nav>

      {showAuth&&<AuthModal onClose={()=>setShowAuth(false)} onAuth={handleAuth}/>}
      {showQType&&activeSubj&&(
        <div className="overlay">
          <div className="qtype-modal">
            <div style={{fontSize:32,marginBottom:12}}>📝</div>
            <div className="modal-title" style={{marginBottom:5}}>Question type</div>
            <div style={{fontSize:13,color:'var(--text-2)',marginBottom:4}}>How do you want to practice {activeSubj.name}?</div>
            <div className="qtype-opts">
              {[{v:'mcq',i:'🔘',l:'Multiple choice',s:'4 options, pick one'},{v:'frq',i:'✏️',l:'Free response',s:'Write your answer'}].map(o=>(
                <div key={o.v} className={`qtype-opt ${qType===o.v?'sel':''}`} onClick={()=>setQType(o.v)}>
                  <div className="qtype-opt-icon">{o.i}</div><div className="qtype-opt-lbl">{o.l}</div><div className="qtype-opt-sub">{o.s}</div>
                </div>
              ))}
            </div>
            <button className="btn-full" style={{background:activeSubj.color}} disabled={!qType} onClick={()=>handleQType(qType)}>Start →</button>
            <button className="btn-full ghost" style={{marginTop:8}} onClick={()=>{setShowQType(false);setActiveSubj(null);}}>Cancel</button>
          </div>
        </div>
      )}

      {page==='landing'&&<Landing onStart={()=>setShowAuth(true)}/>}
      {page==='onboard'&&<Onboarding onComplete={handleOnboard}/>}
      {page==='dashboard'&&user&&<Dashboard user={user} profile={profile} weakness={weakness} streak={streak} streakDays={streakDays} onTest={handleTest} totalQ={totalQ} sessCorrect={0}/>}
      {page==='hub'&&<HubPage test={activeTest} subjs={subjs} accent={accent} weakness={weakness} onSubj={handleSubj} onAssess={handleAssess} onBack={()=>setPage('dashboard')}/>}
      {page==='session'&&activeSubj&&<SessionPage test={activeTest} subj={activeSubj} qType={qType} weakness={weakness} setWeakness={setWeakness} isAssess={isAssess} difficulty={profile?.difficulty||'medium'} onDone={handleDone} onBack={()=>{setPage('hub');setActiveSubj(null);}}/>}
      {page==='summary'&&summaryResult&&<SummaryPage result={summaryResult} onBack={()=>{setSummaryResult(null);setPage('hub');}} onRetake={()=>{setSummaryResult(null);if(activeTest==='ACT'&&!activeSubj?.frqOnly)setShowQType(true);else{setQType(activeSubj?.frqOnly?'frq':'mcq');setPage('session');}}}/>}
      {page==='leaderboard'&&<LeaderboardPage profile={profile} totalQ={totalQ} streak={streak} weakness={weakness}/>}
      {page==='profile'&&user&&<ProfilePage user={user} profile={profile} setProfile={setProfile} weakness={weakness} streak={streak} totalQ={totalQ} history={history}/>}

      <Toast msg={toast.msg} show={toast.show}/>
    </div>
  );
}