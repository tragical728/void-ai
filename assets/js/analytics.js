/* VOID 28 - Яндекс.Метрика, подключается только если в config.js проставлен
   номер счётчика. Пока там ноль, этот файл не делает ничего и не тянет ни
   одного внешнего запроса.

   Пиксель <noscript> сознательно не ставится: он требует вписать номер
   счётчика прямо в разметку каждой страницы, то есть держать его в пяти
   местах вместо одного. Без JavaScript Метрика всё равно засчитывает только
   факт открытия страницы, без источника, глубины и вебвизора. */
(function(){
  var id = (window.VOID_CONFIG || {}).metrikaId;
  if(!id) return;

  var src = 'https://mc.yandex.ru/metrika/tag.js?id=' + id;

  (function(m,e,t,r,i,k,a){
    m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
    m[i].l=1*new Date();
    for(var j=0;j<e.scripts.length;j++){ if(e.scripts[j].src===r) return; }
    k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,
    a.parentNode.insertBefore(k,a)
  })(window, document, 'script', src, 'ym');

  ym(id, 'init', {
    ssr: true,
    webvisor: true,
    clickmap: true,
    trackLinks: true,
    accurateTrackBounce: true,
    referrer: document.referrer,
    url: location.href
  });

  /* Цель отправки формы. В Метрике она создаётся один раз:
     Настройка → Цели → JavaScript-событие → идентификатор form_sent */
  window.VOID_GOAL = function(name){
    try{ ym(id, 'reachGoal', name); }catch(e){}
  };
})();
