/* VOID 28 - language switching, the calculator, reveals and the header controls */
(function(){
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function store(k,v){ try{ localStorage.setItem(k,v); }catch(e){} }
  function recall(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }

  /* ================= language ================= */
  var LANG = 'en';
  function fmt(n, lang){
    try{ return new Intl.NumberFormat(lang==='zh'?'zh-CN':lang).format(n); }
    catch(e){ return String(n); }
  }
  function applyLang(code){
    var dict = window.I18N[code] || {};
    LANG = code;
    document.documentElement.setAttribute('lang', code);
    if(code === 'zh' && !document.getElementById('cjk')){
      var l = document.createElement('link');
      l.id='cjk'; l.rel='stylesheet';
      l.href='https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@200;300;400;500&display=swap';
      document.head.appendChild(l);
    }
    var nodes = document.querySelectorAll('[data-i]');
    for(var i=0;i<nodes.length;i++){
      var k = nodes[i].getAttribute('data-i');
      if(dict[k] != null) nodes[i].textContent = dict[k];
    }
    var ph = document.querySelectorAll('[data-ip]');
    for(var n=0;n<ph.length;n++){
      var pk = ph[n].getAttribute('data-ip');
      if(dict[pk] != null) ph[n].setAttribute('placeholder', dict[pk]);
    }
    var html = document.querySelectorAll('[data-ih]');
    for(var j=0;j<html.length;j++){
      var hk = html[j].getAttribute('data-ih');
      if(dict[hk] != null) html[j].innerHTML = dict[hk];
    }
    var sel = document.getElementById('lang');
    if(sel && sel.value !== code) sel.value = code;
    store('void-lang', code);
    if(window.__voidMaths) window.__voidMaths();
  }

  /* ================= the maths ================= */
  (function maths(){
    var el = function(id){ return document.getElementById(id); };
    var people = el('people'), hours = el('hours'), rate = el('rate'), share = el('share');
    if(!people) return;
    function run(){
      var d = window.I18N[LANG] || window.I18N.en;
      var p = +people.value, hr = +hours.value, r = +rate.value, s = +share.value/100;
      var absorbed = p*hr*46*s;
      el('people-out').textContent = p;
      el('hours-out').textContent = hr;
      el('rate-out').textContent = '$'+r;
      el('share-out').textContent = Math.round(s*100)+'%';
      el('hours-year').textContent = fmt(Math.round(absorbed), LANG)+' '+(d.qUnitH||'h');
      el('cost-year').textContent = '$'+fmt(Math.round(absorbed*r), LANG);
      el('per-day').textContent = (absorbed/230).toFixed(1)+' '+(d.qUnitH||'h');
      var weeks = Math.round(absorbed/38);
      var tpl = weeks >= 46 ? (d.qFtwBig||'') : (d.qFtw||'');
      el('ftw').textContent = tpl.replace('{n}', fmt(weeks, LANG));
    }
    window.__voidMaths = run;
    [people,hours,rate,share].forEach(function(i){ i.addEventListener('input', run); });
    run();
  })();

  /* ================= footer reveal ================= */
  (function reveal(){
    var items = document.querySelectorAll('.reveal');
    if(!('IntersectionObserver' in window) || reduce){
      for(var i=0;i<items.length;i++) items[i].classList.add('in');
      return;
    }
    var io = new IntersectionObserver(function(es){
      es.forEach(function(en, n){
        if(en.isIntersecting){
          var d = parseFloat(en.target.getAttribute('data-delay')||0);
          setTimeout(function(){ en.target.classList.add('in'); }, d);
          io.unobserve(en.target);
        }
      });
    }, {threshold:.15});
    for(var j=0;j<items.length;j++){ items[j].setAttribute('data-delay', 100 + j*90); io.observe(items[j]); }
  })();

  /* ================= controls ================= */
  var stored = recall('void-theme');
  VOID.setTheme(stored || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'), true);
  var tb = document.getElementById('theme');
  if(tb) tb.addEventListener('click', function(){ VOID.setTheme(VOID.getTheme()==='dark'?'light':'dark'); });

  var sel = document.getElementById('lang');
  var startLang = recall('void-lang');
  if(!startLang){
    var nav = (navigator.language||'en').slice(0,2).toLowerCase();
    startLang = window.I18N[nav] ? nav : 'en';
  }
  applyLang(startLang);
  if(sel) sel.addEventListener('change', function(){ applyLang(sel.value); });

  /* ================= header ================= */
  (function(){
    var head = document.querySelector('header');
    var btn  = document.getElementById('nav-toggle');
    var menu = document.getElementById('nav-links');

    if(head){
      var onScroll = function(){
        var y = window.pageYOffset || document.documentElement.scrollTop || 0;
        head.classList.toggle('is-scrolled', y > 12);
        /* the particle field is atmosphere for the hero; below it the page is
           read, so drop it back rather than making people read through motion */
        var t = Math.min(1, y / (window.innerHeight * 0.55));
        document.documentElement.style.setProperty('--field', (1 - t * 0.78).toFixed(3));
      };
      window.addEventListener('scroll', onScroll, {passive:true});
      onScroll();
    }

    if(btn && menu){
      var close = function(){
        menu.classList.remove('open');
        btn.setAttribute('aria-expanded','false');
      };
      btn.addEventListener('click', function(){
        var open = menu.classList.toggle('open');
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      menu.addEventListener('click', function(e){
        if(e.target.closest('a')) close();
      });
      document.addEventListener('keydown', function(e){
        if(e.key === 'Escape') close();
      });
      window.addEventListener('resize', function(){
        if(window.innerWidth > 1000) close();
      });
    }
  })();
})();
