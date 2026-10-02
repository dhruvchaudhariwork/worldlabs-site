(() => {
  const preference=matchMedia('(prefers-reduced-motion: reduce)');
  const motion=window.anime, running=new Set();
  let paused=preference.matches;
  const toggle=document.querySelector('#motion-toggle');
  function sync(){
    document.body.dataset.motionPaused=String(paused);
    document.body.classList.toggle('motion-paused',paused);
    toggle.setAttribute('aria-pressed',String(paused));
    toggle.textContent=paused?'Enable motion':'Pause motion';
    if(paused)[...running].forEach(a=>a.complete());
    document.dispatchEvent(new CustomEvent('study:motion',{detail:{paused}}));
  }
  toggle.addEventListener('click',()=>{paused=!paused;sync();});
  preference.addEventListener('change',()=>{paused=preference.matches;sync();});
  function reveal(target,options){
    if(!motion||paused)return;
    let a=motion.animate(target,{...options,onComplete:()=>running.delete(a)});running.add(a);
  }
  sync();
  if(motion){
    reveal('.title-line',{opacity:[0,1],translateY:[28,0],duration:1100,delay:motion.stagger(110),ease:'out(4)'});
    reveal('.hero-enter',{opacity:[0,1],translateY:[15,0],duration:900,delay:motion.stagger(95,{start:280}),ease:'out(4)'});
    const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{
      if(!entry.isIntersecting)return;
      reveal(entry.target,{opacity:[0,1],translateY:[24,0],duration:850,ease:'out(4)'});
      observer.unobserve(entry.target);
    }),{threshold:.12});
    document.querySelectorAll('.wl-statement,.stack-product,.focus-criteria article').forEach(e=>observer.observe(e));
  }
  document.querySelectorAll('.stack-product').forEach(card=>card.addEventListener('pointermove',e=>{
    if(paused)return;const r=card.getBoundingClientRect();card.style.setProperty('--mx',`${e.clientX-r.left}px`);card.style.setProperty('--my',`${e.clientY-r.top}px`);
  }));
})();
