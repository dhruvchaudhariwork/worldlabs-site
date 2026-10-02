(() => {
  const canvas=document.querySelector('#survival-scene'),ctx=canvas.getContext('2d');
  const container=document.querySelector('#workflow-demo');
  let stage=0,t=0,last=0,paused=document.body.dataset.motionPaused==='true',visible=true,autoplay=true,revision=true;
  const lengths=[7.8,7.8,10],titles=['Working mechanics. A broken escape route.','World Labs reviews the encounter.','Compare the original and revised encounter.'];
  const routeA=[[1,7],[2,6],[2.8,5.7],[3.6,5.3],[4.05,5.1]];
  const routeB=[[1,7],[2,6],[2.8,5.7],[3.6,5.3],[4.05,4.95],[5.25,4.95],[6.3,4.8],[7.2,3],[7.2,1.8]];
  const walls=[[2,2,2.8,.7],[4.2,2.7,.6,2.6],[2.4,4.2,1.8,.6],[.6,3.2,.7,1.6],[6,1.4,.6,1.3]];
  function setStage(n,auto=false){stage=n;t=0;last=0;if(!auto)autoplay=false;revision=true;
    document.querySelectorAll('[data-stage]').forEach((b,i)=>{b.classList.toggle('active',i===n);b.setAttribute('aria-pressed',String(i===n));});
    document.querySelector('#demo-heading').textContent=titles[n];
    document.querySelector('.revision-switch').hidden=n!==2;
    document.querySelectorAll('[data-revision]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.revision==='b')));
    status();draw();
  }
  function status(){
    document.querySelector('#mechanics-result').textContent='Resources · dash · pursuit';
    document.querySelector('#judgment-result').textContent=stage===0?'Escape route blocked':stage===1?'Revise route, supplies, and warning cues':revision?'Escape route restored':'Escape route blocked';
    canvas.setAttribute('aria-label',stage===0?'Illustrative survival arena: the player collects supplies but is cornered by pursuing monsters.':stage===1?'A World Labs expert marks a blocked escape route and revises the opening, resource placement, and enemy warning cues.':revision?'Revised arena with a clear escape route, repositioned supplies, and enemy spawn warnings.':'Original arena showing the blocked route.');
  }
  document.querySelectorAll('[data-stage]').forEach(b=>b.addEventListener('click',()=>setStage(Number(b.dataset.stage))));
  document.querySelectorAll('[data-revision]').forEach(b=>b.addEventListener('click',()=>{revision=b.dataset.revision==='b';autoplay=false;t=0;document.querySelectorAll('[data-revision]').forEach(e=>e.setAttribute('aria-pressed',String(e===b)));status();draw();}));
  document.addEventListener('study:motion',e=>{paused=e.detail.paused;last=0;draw();});
  document.addEventListener('visibilitychange',()=>last=0);
  new IntersectionObserver(([e])=>{visible=e.isIntersecting;last=0;},{threshold:.08}).observe(container);
  function resize(){const box=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(box.width*dpr);canvas.height=Math.round(box.height*dpr);draw();}
  new ResizeObserver(resize).observe(canvas);
  function P(x,y,z=0){return[330+(x-y)*29,97+(x+y)*15-z];}
  function polygon(points,fill,stroke='#ffffff22',width=1){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}}
  function path(points,color,width=1,dash=[]){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.strokeStyle=color;ctx.lineWidth=width;ctx.setLineDash(dash);ctx.stroke();ctx.setLineDash([]);}
  function box(x,y,w,h,z=24,alpha=1){ctx.save();ctx.globalAlpha=alpha;const a=P(x,y,z),b=P(x+w,y,z),c=P(x+w,y+h,z),d=P(x,y+h,z);polygon([d,c,P(x+w,y+h),P(x,y+h)],'#1b1b1b','#666');polygon([b,c,P(x+w,y+h),P(x+w,y)],'#272727','#666');polygon([a,b,c,d],'#343434','#777');ctx.restore();}
  function circle(x,y,r,fill,stroke){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}}
  function text(value,x,y,size=12,color='#999',align='left'){ctx.font=`${size}px Inter,Arial,sans-serif`;ctx.fillStyle=color;ctx.textAlign=align;ctx.fillText(value,x,y);}
  function actor(pos,enemy=false){const [x,y]=P(...pos);ctx.save();ctx.shadowColor=enemy?'#fff2':'#fff8';ctx.shadowBlur=enemy?0:12;circle(x,y-10,enemy?5:6,enemy?'#171717':'#eee',enemy?'#aaa':'#fff');path([[x,y-4],[x,y+3]],enemy?'#999':'#fff',2);ctx.restore();}
  function pointAt(route,f){const scaled=Math.max(0,Math.min(f,.9999))*(route.length-1),i=Math.floor(scaled),a=route[i],b=route[i+1];return[a[0]+(b[0]-a[0])*(scaled-i),a[1]+(b[1]-a[1])*(scaled-i)];}
  function label(value,pos,dx,dy){const [x,y]=P(...pos,12);path([[x,y],[x+dx,y+dy]],'#888');ctx.font='15px Inter,Arial,sans-serif';const w=ctx.measureText(value).width;ctx.fillStyle='#111e';ctx.fillRect(x+dx-(dx<0?w:0)-6,y+dy-18,w+12,25);text(value,x+dx,y+dy,15,'#ddd',dx<0?'right':'left');}
  function supply(x,y,type){const [sx,sy]=P(x,y,4);polygon([[sx,sy-7],[sx+7,sy],[sx,sy+7],[sx-7,sy]],'#aaa','#ddd');text(type,sx,sy-14,14,'#aaa','center');}
  function draw(){if(!canvas.width)return;ctx.setTransform(canvas.width/660,0,0,canvas.height/440,0,0);ctx.clearRect(0,0,660,440);
    const now=paused?5:t,editing=stage===1,fixed=stage===2?revision:editing&&now>2.8;
    const route=fixed?routeB:routeA;
    const dash=fixed&&stage===2&&now>2.4;
    const f=stage===1?.45:Math.min(now/6.8+(dash?.13:0),1);
    const player=pointAt(route,f);
    const glow=ctx.createRadialGradient(330,260,0,330,260,280);glow.addColorStop(0,'#ffffff07');glow.addColorStop(1,'#ffffff00');ctx.fillStyle=glow;ctx.fillRect(0,0,660,440);
    // The HUD depicts features in the task brief, not measured model performance.
    ['Food','Water','Stamina'].forEach((v,i)=>{const x=26+i*88;text(v,x,39,14,'#999');ctx.fillStyle='#393939';ctx.fillRect(x,50,60,3);ctx.fillStyle='#bbb';const fill=i===0?(f>.23?57:30):i===1?(fixed&&f>.69?57:29):(dash?Math.min(52,20+now*2):48);ctx.fillRect(x,50,fill,3);});
    text(dash?'Dash cooldown':'Dash / Q',634,39,14,'#aaa','right');
    polygon([P(0,0),P(9,0),P(9,9),P(0,9)],'#171717','#656565');
    for(let i=0;i<=9;i++){path([P(i,0),P(i,9)],'#ffffff12');path([P(0,i),P(9,i)],'#ffffff12');}
    const foot=route.map(p=>P(...p,2));path(foot,fixed?'#eee':'#888',1.7,[4,5]);
    walls.forEach((w,i)=>{if(i===1&&fixed){box(4.2,2.7,.6,1.35,28);if(editing){ctx.save();ctx.globalAlpha=.23;box(...w,28);ctx.restore();}}else box(...w,28);});
    if(f<.23||editing)supply(2.4,6.2,'Food');if(!fixed||f<.69||editing)supply(fixed?6.3:3.6,fixed?4.8:3.7,'Water');
    const spawns=[[.8,2.5],[7.7,6.8],[6.8,.4]];
    spawns.forEach((s,i)=>{const delay=fixed?1.8:0,ef=Math.max(0,Math.min((now-delay-i*.45)/8,.7));const target=fixed?pointAt(routeB,Math.max(0,f-.26)):player;const enemy=[s[0]+(target[0]-s[0])*ef,s[1]+(target[1]-s[1])*ef];
      if(fixed){const [x,y]=P(...s);ctx.save();ctx.globalAlpha=.35+.3*Math.sin(now*2+i);circle(x,y-3,13,null,'#aaa');ctx.restore();}actor(enemy,true);
      const trail=[s,[(s[0]+enemy[0])/2,(s[1]+enemy[1])/2],enemy].map(p=>P(...p));path(trail,'#ffffff27',1,[2,5]);});
    if(dash&&now<3.2){const prior=pointAt(route,Math.max(0,f-.14));path([P(...prior),P(...player)],'#ddd',3);}
    actor(player);
    if(!fixed&&now>3){const [x,y]=P(4.05,5.1);circle(x,y-9,19,null,'#ddd');path([[x-5,y-14],[x+5,y-4]],'#eee',1.4);path([[x+5,y-14],[x-5,y-4]],'#eee',1.4);}
    if(editing){label('World Labs review',[4.3,4.2],106,-64);if(now>1.5)label(fixed?'Open the escape route':'Player gets cornered',[4.2,4.9],-97,30);if(now>3.5)label('Move supplies into reach',[6.3,4.8],89,24);}
    if(stage===2&&fixed){const [x,y]=P(...routeB[routeB.length-1]);circle(x,y,17,null,'#aaa');if(now>4.7)path([[x-5,y],[x-1,y+4],[x+7,y-5]],'#fff',2);}
  }
  function tick(now){if(!paused&&visible&&!document.hidden){if(last)t+=Math.min((now-last)/1000,.1);if(autoplay&&t>lengths[stage]){if(stage<2)setStage(stage+1,true);else autoplay=false;}draw();}last=now;requestAnimationFrame(tick);}
  setStage(0,true);resize();requestAnimationFrame(tick);
})();
