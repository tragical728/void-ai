/* VOID 28 - the background: a drifting particle field and the object it falls into.
   Dark theme renders a lensed black hole, light theme renders a quasar.
   Exposes window.VOID.setTheme() for the UI layer. */
window.VOID = window.VOID || {};
(function(){
  var TAU = Math.PI*2;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var HOLE  = {x:-9999,y:-9999,R:0,on:false,ej:0,op:0};
  var mouse = {x:-2000,y:-2000};
  var THEME = 'dark';

  /* Fill rate, not draw calls, is what stalls weak hardware: both canvases are
     full-screen and repainted every frame. Cap the backing-store ratio and keep
     a tier the render loop can lower on its own if frames start running long. */
  var CORES = navigator.hardwareConcurrency || 4;
  var SMALL = Math.min(screen.width, screen.height) < 820;
  var DPR_CAP = (CORES <= 4 || SMALL) ? 1.25 : 1.5;
  var PERF = { tier: 1 };
  function ratio(){ return Math.min(window.devicePixelRatio || 1, DPR_CAP); }

  function store(k,v){ try{ localStorage.setItem(k,v); }catch(e){} }
  function recall(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
  /* ================= theme ================= */
  var PAL = {
    dark:{
      wipe:'rgba(5,5,6,.19)',
      dust:['70,74,86','245,199,126'],
      spark:'245,199,126',
      hot:'255,243,222', warm:'233,209,170', cool:'146,157,176',
      core:'1,1,2', jets:false, add:true, gain:1
    },
    light:{
      wipe:'rgba(238,235,229,.20)',
      dust:['150,144,132','38,34,28'],
      spark:'70,62,48',
      hot:'18,14,8', warm:'66,55,38', cool:'110,112,120',
      core:'238,235,229', jets:true, add:false, gain:3.0
    }
  };
  function pal(){ return PAL[THEME]; }

  function applyTheme(t, first){
    THEME = (t === 'light') ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', THEME);
    store('void-theme', THEME);
    if(!first && window.__voidRepaint) window.__voidRepaint();
  }

  /* ================= dust field ================= */
  (function dust(){
    var c = document.getElementById('dust');
    var ctx = c.getContext('2d');
    if(!ctx) return;
    var w=0,h=0,dpr=1,parts=[],raf=0;
    var held=[], MAXHELD=0, ej=0, slow=0, lastT=performance.now();
    var COUNT=760, RADIUS=260, VORTEX=.07, PULL=.12;

    function P(){ this.reset(); }
    P.prototype.reset = function(){
      this.x = Math.random()*w; this.y = Math.random()*h;
      this.hx = this.x; this.hy = this.y;          /* where it drifts back to */
      this.held = false;
      this.size = Math.random()*1.5 + .5;
      this.vx = (Math.random()-.5)*.2; this.vy = (Math.random()-.5)*.2;
      this.bright = Math.random() > .72;
      this.color = pal().dust[this.bright?1:0];
      this.alpha = Math.random()*.36 + .1;
      this.rot = Math.random()*TAU;
      this.spin = (Math.random()-.5)*.05;
      this.glow = 0;
    };
    P.prototype.recolor = function(){ this.color = pal().dust[this.bright?1:0]; };

    P.prototype.step = function(){
      if(this.held) return;
      var dx = mouse.x-this.x, dy = mouse.y-this.y;
      var d = Math.sqrt(dx*dx+dy*dy) || 1;
      if(d < RADIUS){
        var f = (RADIUS-d)/RADIUS;
        this.vx += (dx/d)*f*PULL;  this.vy += (dy/d)*f*PULL;
        this.vx += (dy/d)*f*VORTEX*10; this.vy -= (dx/d)*f*VORTEX*10;
        this.glow = f*.7;
      } else { this.glow *= .92; }

      if(HOLE.on){
        var gx = HOLE.x-this.x, gy = HOLE.y-this.y;
        var gd = Math.sqrt(gx*gx+gy*gy) || 1;
        var GR = HOLE.R*3.5;
        if(gd < GR){
          var pull = HOLE.R*0.14/(gd + HOLE.R*0.65);
          var dir  = 1 - 2*ej;                       /* +1 pulls in, -1 pushes back out */
          this.vx += (gx/gd)*pull*dir;  this.vy += (gy/gd)*pull*dir;
          var sw = pull*.6*(1-ej*.7);
          this.vx += (-gy/gd)*sw;       this.vy += (gx/gd)*sw;
          this.glow = Math.max(this.glow, Math.min(.6, (GR-gd)/GR*(.42+ej*.5)));
          if(gd < HOLE.R*1.04 && ej < .3){ this.swallow(); return; }
        }
      }

      /* a weak tether home, so the field never thins out or clumps */
      this.vx += (this.hx-this.x)*.0005;
      this.vy += (this.hy-this.y)*.0005;

      this.x += this.vx; this.y += this.vy;
      this.vx *= .95; this.vy *= .95;
      this.vx += (Math.random()-.5)*.04; this.vy += (Math.random()-.5)*.04;
      this.rot += this.spin + (Math.abs(this.vx)+Math.abs(this.vy))*.05;
      if(this.x < -20) this.x = w+20;
      if(this.x > w+20) this.x = -20;
      if(this.y < -20) this.y = h+20;
      if(this.y > h+20) this.y = -20;
    };

    P.prototype.swallow = function(){
      if(held.length < MAXHELD){
        this.held = true; this.heldAt = performance.now();
        this.x = -9999; this.y = -9999; this.glow = 0;
        held.push(this); return;
      }
      this.edge();
    };
    /* released at the horizon: a hard burst on hover, a quiet drift otherwise */
    P.prototype.eject = function(force){
      this.held = false;
      var ang = Math.random()*TAU;
      var rr  = HOLE.R*(0.96 + Math.random()*0.20);
      var sp  = 0.7 + force*(2.6 + Math.random()*4.4);
      this.x  = HOLE.x + Math.cos(ang)*rr;
      this.y  = HOLE.y + Math.sin(ang)*rr;
      this.vx = Math.cos(ang)*sp; this.vy = Math.sin(ang)*sp;
      this.bright = true; this.recolor();
      this.alpha = .34; this.glow = .55 + force*.45;
    };
    P.prototype.edge = function(){
      var side = Math.random()*4|0, m = 24;
      if(side===0){ this.x=-m; this.y=Math.random()*h; }
      else if(side===1){ this.x=w+m; this.y=Math.random()*h; }
      else if(side===2){ this.x=Math.random()*w; this.y=-m; }
      else { this.x=Math.random()*w; this.y=h+m; }
      this.vx=(Math.random()-.5)*.3; this.vy=(Math.random()-.5)*.3; this.glow=0;
    };
    /* no per-particle shadowBlur: it is the single most expensive canvas op and
       hovering lit up hundreds of them at once. Shards are batched into a handful
       of fills instead, bucketed by alpha. */
    var BUCKETS = 8, bins = [];
    for(var bi=0; bi<BUCKETS*2; bi++) bins.push([]);

    function paint(){
      var i, j, b, arr, sz, c0, s0, px, py, hx, hy;
      for(i=0;i<bins.length;i++) bins[i].length = 0;
      for(i=0;i<parts.length;i++){
        var p = parts[i];
        if(p.held) continue;
        var a = p.alpha + p.glow;
        if(a > .9) a = .9;
        if(a < .02) continue;
        b = (a*BUCKETS)|0; if(b > BUCKETS-1) b = BUCKETS-1;
        bins[(p.bright?BUCKETS:0) + b].push(p);
      }
      for(i=0;i<bins.length;i++){
        arr = bins[i];
        if(!arr.length) continue;
        ctx.fillStyle = 'rgba('+pal().dust[i<BUCKETS?0:1]+','+
                        (((i%BUCKETS)+0.6)/BUCKETS).toFixed(3)+')';
        ctx.beginPath();
        for(j=0;j<arr.length;j++){
          var q = arr[j];
          sz = q.size*(1 + q.glow*0.9);
          c0 = Math.cos(q.rot); s0 = Math.sin(q.rot);
          px = q.x; py = q.y;
          hx = sz*2.5*s0; hy = sz*2.5*c0;
          ctx.moveTo(px + hx, py - hy);
          ctx.lineTo(px + sz*c0, py + sz*s0);
          ctx.lineTo(px - hx, py + hy);
          ctx.lineTo(px - sz*c0, py - sz*s0);
        }
        ctx.fill();
      }
    }

    function ground(){
      var css = getComputedStyle(document.body).backgroundColor;
      ctx.fillStyle = css || (THEME==='light' ? '#EEEBE5' : '#050506');
      ctx.fillRect(0,0,w,h);
    }
    function init(){
      dpr = ratio();
      w = window.innerWidth; h = window.innerHeight;
      c.width = w*dpr; c.height = h*dpr;
      ctx.setTransform(dpr,0,0,dpr,0,0);
      ground();
      var n = Math.round(COUNT * (w < 700 ? .40 : w < 1100 ? .70 : 1) * PERF.tier);
      parts = []; held = []; ej = 0;
      MAXHELD = Math.round(n*0.3);
      for(var i=0;i<n;i++) parts.push(new P());
      if(reduce){ ground(); paint(); }
    }
    window.__voidRepaint = function(){
      ground();
      for(var i=0;i<parts.length;i++) parts[i].recolor();
    };

    function frame(){
      ctx.fillStyle = pal().wipe;
      ctx.fillRect(0,0,w,h);

      var over = false;
      if(HOLE.on && HOLE.R){
        var mx = mouse.x-HOLE.x, my = mouse.y-HOLE.y, rr = HOLE.R*1.9;
        over = (mx*mx + my*my) < rr*rr;
      }
      var now = performance.now();
      var dt  = Math.min((now-lastT)/1000, .1);
      lastT = now;
      ej += ((over?1:0) - ej) * Math.min(1, dt*5);
      if(ej < .002) ej = 0;
      HOLE.ej = ej;

      if(ej > .15 && held.length){
        var out = Math.ceil(ej * dt * 900);
        while(out-- > 0 && held.length) held.pop().eject(1);
      } else if(held.length){
        for(var q=held.length-1;q>=0;q--){
          if(now - held[q].heldAt > 1500) held.splice(q,1)[0].eject(.25);
        }
      }
      for(var i=0;i<parts.length;i++) parts[i].step();
      paint();

      /* if a machine cannot hold the frame, quietly thin the field instead of stuttering */
      slow = dt > 0.028 ? slow+1 : 0;
      if(slow > 45 && PERF.tier > 0.45){
        PERF.tier = PERF.tier > 0.75 ? 0.7 : 0.45;   /* the hole thins out too */
        if(parts.length > 240){
          parts.splice(0, Math.round(parts.length*0.22));
          MAXHELD = Math.round(parts.length*0.3);
        }
        slow = 0;
      }
      raf = requestAnimationFrame(frame);
    }

    window.addEventListener('resize', init);
    window.addEventListener('mousemove', function(e){ mouse.x=e.clientX; mouse.y=e.clientY; });
    window.addEventListener('mouseout', function(){ mouse.x=-2000; mouse.y=-2000; });
    function touch(e){ if(e.touches[0]){ mouse.x=e.touches[0].clientX; mouse.y=e.touches[0].clientY; } }
    window.addEventListener('touchmove', touch, {passive:true});
    window.addEventListener('touchstart', touch, {passive:true});
    window.addEventListener('touchend', function(){ mouse.x=-2000; mouse.y=-2000; }, {passive:true});
    init();
    if(!reduce) frame();
  })();

  /* ================= the hole (dark) / the quasar (light) ================= */
  (function hole(){
    var c = document.getElementById('hole');
    if(!c) return;
    var ctx = c.getContext('2d');
    var w=0,h=0,dpr=1,R=0,t=0;
    var NR=28, NS=6, ND=22, NU=14, NK=18;
    var cache=null, built='';
    /* what is drawn now eases toward what the scroll asks for - no snapping */
    var cur = {x:0,y:0,rot:-0.1,sx:1,sy:1,op:1,R:1}, tgt = null, warm=false;

    function ink(a){ var p=pal(); return 'rgba('+p.hot+','+a+')'; }
    function mid(a){ var p=pal(); return 'rgba('+p.warm+','+a+')'; }
    function far(a){ var p=pal(); return 'rgba('+p.cool+','+a+')'; }

    function gRing(rx){
      var g = ctx.createLinearGradient(-rx,0,rx,0);
      g.addColorStop(0.00, ink(0));
      g.addColorStop(0.10, ink(1));
      g.addColorStop(0.30, mid(.74));
      g.addColorStop(0.50, far(.42));
      g.addColorStop(0.70, mid(.74));
      g.addColorStop(0.90, ink(1));
      g.addColorStop(1.00, ink(0));
      return g;
    }
    function gDome(r){
      var g = ctx.createLinearGradient(0,-r,0,r*0.1);
      g.addColorStop(0, mid(.62));
      g.addColorStop(.55, ink(.92));
      g.addColorStop(1, ink(1));
      return g;
    }
    function build(){
      cache = {ring:[],spine:[],dome:[],under:[]};
      built = THEME;
      var i,k,rx,r;
      for(i=0;i<NR;i++){ k=i/(NR-1); rx=R*(1.06+k*2.85);
        cache.ring.push({rx:rx, ry:R*(0.46+k*0.17), g:gRing(rx),
          a:Math.pow(1-k,0.9)*0.27+0.055, lw:k<0.16?2.0:1.05, k:k}); }
      for(i=0;i<NS;i++){ k=i/(NS-1); rx=R*(1.10+k*2.80);
        cache.spine.push({rx:rx, ry:R*(0.02+k*0.075), g:gRing(rx),
          a:(1-k*0.66)*0.22, lw:1.1, k:k}); }
      for(i=0;i<ND;i++){ k=i/(ND-1); r=R*(1.004+k*0.44);
        cache.dome.push({r:r, g:gDome(r), a:Math.pow(1-k,1.55)*0.56+0.022,
          lw:k<0.12?2.4:1.2, k:k}); }
      for(i=0;i<NU;i++){ k=i/(NU-1); r=R*(1.00+k*0.30);
        cache.under.push({r:r, g:gRing(r), a:Math.pow(1-k,1.6)*0.34+0.010,
          lw:k<0.15?1.8:1.2, k:k}); }
    }
    function size(){
      dpr = ratio();
      w = window.innerWidth; h = window.innerHeight;
      c.width = w*dpr; c.height = h*dpr;
      ctx.setTransform(dpr,0,0,dpr,0,0);
      R = Math.min(w*0.160, h*0.215);
      build();
      cur.x = w*0.5; cur.y = h*0.5; cur.R = R;
    }

    function bands(list, time, front){
      var step = PERF.tier < 0.8 ? 2 : 1;
      for(var i=0;i<list.length;i+=step){
        var b = list[i];
        ctx.globalAlpha = Math.min(1, cur.op * b.a * pal().gain * (0.88 + 0.12*Math.sin(time*0.5 + i*0.55)));
        ctx.strokeStyle = b.g; ctx.lineWidth = b.lw;
        if(b.k < 0.05 && warm){ ctx.shadowBlur = 12; ctx.shadowColor = ink(.4); }
        ctx.beginPath();
        if(front) ctx.ellipse(0,0,b.rx,b.ry,0,0,Math.PI);
        else      ctx.ellipse(0,0,b.rx,b.ry,0,0,TAU);
        ctx.stroke(); ctx.shadowBlur = 0;
      }
      ctx.globalAlpha = cur.op;
    }
    /* short arcs sliding along each ring - inner ones orbit faster */
    function streaks(time, front){
      if(PERF.tier < 0.6) return;      /* the sliding filaments are the first thing to go */
      var base = front ? 0 : Math.PI;
      var kstep = PERF.tier < 0.8 ? 2 : 1;
      for(var i=0;i<NK;i+=kstep){
        var k=i/(NK-1), rx=R*(1.12+k*2.66), ry=R*(0.465+k*0.165);
        var sp = 1.15/Math.pow(1.12+k*2.66, 0.85);
        var a0 = base + ((time*sp + i*1.7) % Math.PI);
        var len = Math.min(0.34+k*0.7, base+Math.PI-a0);
        if(len <= 0.02) continue;
        var a = Math.min(1, ((1-k)*0.42+0.05) * (0.5+0.5*Math.sin(a0*2)) * cur.op * pal().gain);
        ctx.strokeStyle = ink(a.toFixed(3));
        ctx.lineWidth = k < 0.3 ? 1.6 : 1.1;
        ctx.beginPath(); ctx.ellipse(0,0,rx,ry,0,a0,a0+len); ctx.stroke();
      }
      ctx.globalAlpha = cur.op;
    }
    /* the quasar throws two jets out of the poles */
    function jets(time){
      for(var s=-1;s<=1;s+=2){
        var L = R*3.2, W0 = R*0.055, W1 = R*0.17;
        var g = ctx.createLinearGradient(0,0,0,s*L);
        g.addColorStop(0, ink(.55));
        g.addColorStop(.18, mid(.34));
        g.addColorStop(.55, far(.12));
        g.addColorStop(1, far(0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(-W0, 0);
        ctx.lineTo(W0, 0);
        ctx.lineTo(W1, s*L);
        ctx.lineTo(-W1, s*L);
        ctx.closePath();
        ctx.globalAlpha = cur.op * (0.62 + 0.08*Math.sin(time*0.6 + s));
        ctx.fill();
      }
      ctx.globalAlpha = cur.op;
    }

    /* ---- the quasar: an inclined spiral disc with a dense core and two jets ---- */
    function quasar(time){
      var p = pal(), o = cur.op, ph = time*0.055;
      ctx.globalCompositeOperation = 'source-over';

      /* outer haze */
      var halo = ctx.createRadialGradient(0,0,R*0.3,0,0,R*4.0);
      halo.addColorStop(0,'rgba('+p.warm+','+(0.13*o).toFixed(3)+')');
      halo.addColorStop(.45,'rgba('+p.cool+','+(0.05*o).toFixed(3)+')');
      halo.addColorStop(1,'rgba('+p.cool+',0)');
      ctx.fillStyle = halo;
      ctx.save(); ctx.scale(1,0.52);
      ctx.beginPath(); ctx.arc(0,0,R*4.0,0,TAU); ctx.fill();
      ctx.restore();

      /* the jets, thrown out of the poles */
      for(var s=-1;s<=1;s+=2){
        var L = R*2.6, W0 = R*0.03, W1 = R*0.10;
        var g = ctx.createLinearGradient(0,0,0,s*L);
        g.addColorStop(0,'rgba('+p.hot+','+(0.34*o).toFixed(3)+')');
        g.addColorStop(.14,'rgba('+p.hot+','+(0.24*o).toFixed(3)+')');
        g.addColorStop(.45,'rgba('+p.warm+','+(0.09*o).toFixed(3)+')');
        g.addColorStop(1,'rgba('+p.cool+',0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(-W0, 0);
        ctx.quadraticCurveTo(-W0*2.4, s*L*0.5, -W1, s*L);
        ctx.lineTo(W1, s*L);
        ctx.quadraticCurveTo(W0*2.4, s*L*0.5, W0, 0);
        ctx.closePath(); ctx.fill();
        /* the hot thread down the middle of the beam */
        ctx.strokeStyle = 'rgba('+p.hot+','+(0.30*o).toFixed(3)+')';
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(0,0);
        ctx.quadraticCurveTo(W0*0.6, s*L*0.5, 0, s*L*0.92);
        ctx.stroke();
      }

      /* the disc, seen at an angle */
      ctx.save();
      ctx.scale(1, 0.40);

      var lanes = PERF.tier < 0.8 ? 9 : 14;        /* dust lanes */
      for(var i=0;i<lanes;i++){
        var k = i/(lanes-1), r = R*(0.6 + k*3.3);
        ctx.strokeStyle = 'rgba('+p.warm+','+(((1-k)*0.17+0.028)*o).toFixed(3)+')';
        ctx.lineWidth = 0.9 + (1-k)*1.6;
        ctx.beginPath(); ctx.arc(0,0,r,0,TAU); ctx.stroke();
      }

      var ARMS = 5;
      for(var a=0;a<ARMS;a++){
        var fil = PERF.tier < 0.8 ? 2 : 3;         /* filaments inside each arm */
        for(var f=0;f<fil;f++){
          var off = (f-(fil-1)/2)*0.10;
          var base = a*TAU/ARMS + off + ph;
          ctx.beginPath();
          var started = false;
          for(var th=0.15; th<5.4; th+=(PERF.tier < 0.8 ? 0.16 : 0.10)){
            var rr = R*0.52*Math.exp(0.295*th);
            if(rr > R*3.75) break;
            var x = Math.cos(th+base)*rr, y = Math.sin(th+base)*rr;
            if(!started){ ctx.moveTo(x,y); started = true; } else ctx.lineTo(x,y);
          }
          ctx.strokeStyle = 'rgba('+p.hot+','+((0.34 - f*0.05)*o).toFixed(3)+')';
          ctx.lineWidth = 1.9 - f*0.3;
          ctx.stroke();
        }
      }
      ctx.restore();

      /* the core, and the black hole sitting in it */
      var cg = ctx.createRadialGradient(0,0,0,0,0,R*0.92);
      cg.addColorStop(0,'rgba('+p.hot+','+(0.88*o).toFixed(3)+')');
      cg.addColorStop(.30,'rgba('+p.hot+','+(0.50*o).toFixed(3)+')');
      cg.addColorStop(.62,'rgba('+p.warm+','+(0.20*o).toFixed(3)+')');
      cg.addColorStop(1,'rgba('+p.cool+',0)');
      ctx.fillStyle = cg;
      ctx.beginPath(); ctx.ellipse(0,0,R*0.92,R*0.46,0,0,TAU); ctx.fill();

      /* the horizon: a clean circle so the object still reads as a ring from any
         angle, including when only its upper half clears the footer */
      var pin = ctx.createRadialGradient(0,0,0,0,0,R*0.80);
      pin.addColorStop(0,'rgba('+p.core+','+o.toFixed(3)+')');
      pin.addColorStop(.72,'rgba('+p.core+','+(0.92*o).toFixed(3)+')');
      pin.addColorStop(1,'rgba('+p.core+',0)');
      ctx.fillStyle = pin;
      ctx.beginPath(); ctx.arc(0,0,R*0.80,0,TAU); ctx.fill();

      ctx.strokeStyle = 'rgba('+p.hot+','+(0.85*o).toFixed(3)+')';
      ctx.lineWidth = Math.max(1.4, R*0.018);
      ctx.beginPath(); ctx.arc(0,0,R*0.86,0,TAU); ctx.stroke();

      ctx.strokeStyle = 'rgba('+p.warm+','+(0.34*o).toFixed(3)+')';
      ctx.lineWidth = Math.max(1, R*0.010);
      ctx.beginPath(); ctx.arc(0,0,R*1.06,0,TAU); ctx.stroke();
      ctx.globalAlpha = 1;
    }

    var blank = false;
    function draw(time){
      if(cur.op < 0.02){                 /* nothing to show: clear once, then idle */
        if(!blank){ ctx.clearRect(0,0,w,h); blank = true; }
        return;
      }
      blank = false;
      ctx.clearRect(0,0,w,h);
      if(built !== THEME) build();
      warm = (THEME === 'dark');
      var p = pal(), ej = HOLE.ej || 0;

      ctx.save();
      ctx.translate(cur.x, cur.y);
      ctx.rotate(cur.rot);
      ctx.scale(cur.sx, cur.sy);
      if(!warm){
        quasar(time);
        ctx.restore();
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        return;
      }
      ctx.globalCompositeOperation = p.add ? 'lighter' : 'source-over';
      ctx.globalAlpha = cur.op;

      var g1 = ctx.createRadialGradient(0,0,R*0.9,0,0,R*2.9);
      g1.addColorStop(0, warm ? 'rgba(214,196,166,'+(0.085+ej*0.16).toFixed(3)+')'
                              : 'rgba(96,88,72,'+(0.055+ej*0.09).toFixed(3)+')');
      g1.addColorStop(.40, warm ? 'rgba(120,132,152,.04)' : 'rgba(110,112,120,.03)');
      g1.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g1;
      ctx.beginPath(); ctx.arc(0,0,R*2.9,0,TAU); ctx.fill();

      ctx.save(); ctx.scale(1,0.26);
      var g2 = ctx.createRadialGradient(0,0,R*0.4,0,0,R*4.0);
      g2.addColorStop(0, warm ? 'rgba(238,220,188,.20)' : 'rgba(80,72,58,.14)');
      g2.addColorStop(.34, warm ? 'rgba(150,160,180,.075)' : 'rgba(120,122,130,.05)');
      g2.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle = g2;
      ctx.beginPath(); ctx.arc(0,0,R*4.0,0,TAU); ctx.fill();
      ctx.restore();

      if(p.jets) jets(time);

      bands(cache.ring, time, false);
      bands(cache.spine, time, false);
      streaks(time, false);
      var dstep = PERF.tier < 0.8 ? 2 : 1;
      for(var i=0;i<ND;i+=dstep){
        var d = cache.dome[i];
        ctx.globalAlpha = Math.min(1, cur.op * d.a * pal().gain);
        ctx.strokeStyle = d.g; ctx.lineWidth = d.lw;
        if(d.k < 0.09 && warm){ ctx.shadowBlur = 16; ctx.shadowColor = ink(.5); }
        ctx.beginPath(); ctx.arc(0,0,d.r,Math.PI-0.30,TAU+0.30); ctx.stroke();
        ctx.shadowBlur = 0;
      }
      ctx.globalAlpha = cur.op;

      /* the horizon itself: a void in dark, the paper showing through in light */
      ctx.globalCompositeOperation = 'source-over';
      var sg = ctx.createRadialGradient(0,0,R*0.94,0,0,R*1.008);
      sg.addColorStop(0,'rgba('+p.core+',1)');
      sg.addColorStop(.90,'rgba('+p.core+',1)');
      sg.addColorStop(1,'rgba('+p.core+',0)');
      ctx.fillStyle = sg;
      ctx.beginPath(); ctx.arc(0,0,R*1.008,0,TAU); ctx.fill();

      ctx.globalCompositeOperation = p.add ? 'lighter' : 'source-over';
      var rim = ctx.createLinearGradient(0,-R,0,R);
      rim.addColorStop(0, ink(.20));
      rim.addColorStop(.5, ink(Math.min(1,0.80+ej*0.20).toFixed(3)));
      rim.addColorStop(1, ink((0.16+ej*0.5).toFixed(3)));
      ctx.strokeStyle = rim;
      ctx.lineWidth = 1.3 + ej*2.4;
      if(warm){ ctx.shadowBlur = 14 + ej*30; ctx.shadowColor = 'rgba(255,238,208,.45)'; }
      ctx.globalAlpha = cur.op;
      ctx.beginPath(); ctx.arc(0,0,R*1.002,0,TAU); ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.save(); ctx.scale(1,0.86);
      var ustep = PERF.tier < 0.8 ? 2 : 1;
      for(var j=0;j<NU;j+=ustep){
        var u = cache.under[j];
        ctx.globalAlpha = Math.min(1, cur.op * u.a * pal().gain);
        ctx.strokeStyle = u.g; ctx.lineWidth = u.lw;
        if(u.k < 0.10 && warm){ ctx.shadowBlur = 14; ctx.shadowColor = ink(.42); }
        ctx.beginPath(); ctx.arc(0,0,u.r,0.06,Math.PI-0.06); ctx.stroke();
        ctx.shadowBlur = 0;
      }
      ctx.restore();
      ctx.globalAlpha = cur.op;

      bands(cache.ring, time, true);
      bands(cache.spine, time, true);
      streaks(time, true);

      ctx.restore();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    /* where the scroll wants it - the hero holds it dead centre, then it is
       stretched, tilted and carried to the side, and it stays for every block */
    function aim(time){
      var vh = window.innerHeight || 1;
      var doc = document.documentElement;
      var y  = window.pageYOffset || doc.scrollTop || 0;
      var q  = y/vh;
      var p  = q<0?0:(q>1?1:q);
      var e  = p*p*(3-2*p);
      var sc = 1 - 0.18*e;
      var drift = Math.sin(q*0.55 + time*0.05);

      /* the last screen: the object rises from behind the footer, centre just
         past the bottom edge, so the crown of the lensed arc clears the horizon */
      var maxY = Math.max(1, doc.scrollHeight - vh);
      var zone = vh*0.85;
      var t = (y - (maxY - zone))/zone;
      t = t<0?0:(t>1?1:t);
      var te = t*t*(3-2*t);

      /* sections below the hero carry their own ground now, so the object stays
         centred instead of sliding out of the way */
      var baseY  = h*(0.5 + 0.05*e + 0.012*drift*e);
      var baseOp = q < 1 ? 1 - 0.72*e : 0.28;
      var baseRt = -0.10 - 0.10*e + 0.04*drift*e;

      /* grown so the crown of the arc clears the footer's empty band while the
         shadow itself sits behind the text, which keeps the copy on flat ground */
      var grow = sc*(1 + 1.10*te);
      tgt = {
        x  : w*0.5,
        y  : baseY + (h - baseY)*te,
        rot: baseRt*(1-te) + (-0.04)*te,
        sx : grow,
        sy : grow,
        op : baseOp + (0.9 - baseOp)*te,
        R  : grow*R
      };
    }

    function loop(ts){
      t = ts/1000;
      aim(t);
      var k = 0.075;                                    /* inertia - this is what kills the jump */
      cur.x  += (tgt.x  - cur.x )*k;
      cur.y  += (tgt.y  - cur.y )*k;
      cur.rot+= (tgt.rot- cur.rot)*k;
      cur.sx += (tgt.sx - cur.sx)*k;
      cur.sy += (tgt.sy - cur.sy)*k;
      cur.op += (tgt.op - cur.op)*k;
      cur.R  += (tgt.R  - cur.R )*k;
      HOLE.x = cur.x; HOLE.y = cur.y; HOLE.R = cur.R;
      HOLE.op = cur.op; HOLE.on = cur.op > 0.15;
      draw(t);
      requestAnimationFrame(loop);
    }

    window.addEventListener('resize', function(){ size(); aim(t); if(tgt){ cur.x=tgt.x; cur.y=tgt.y; } draw(t); });
    size(); aim(0);
    cur.x=tgt.x; cur.y=tgt.y; cur.rot=tgt.rot; cur.sx=tgt.sx; cur.sy=tgt.sy; cur.op=tgt.op; cur.R=tgt.R;
    HOLE.x=cur.x; HOLE.y=cur.y; HOLE.R=cur.R; HOLE.op=cur.op; HOLE.on=true;
    draw(0);
    if(!reduce) requestAnimationFrame(loop);
  })();

  VOID.setTheme = applyTheme;
  VOID.getTheme = function(){ return THEME; };
})();
