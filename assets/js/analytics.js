/* VOID 28 - Яндекс.Метрика, подключается только если в config.js
   проставлен номер счётчика. Пока там ноль, этот файл не делает ничего
   и не тянет ни одного внешнего запроса. */
(function(){
  var id = (window.VOID_CONFIG || {}).metrikaId;
  if(!id) return;

  (function(m,e,t,r,i,k,a){
    m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
    m[i].l=1*new Date();
    for(var j=0;j<e.scripts.length;j++){ if(e.scripts[j].src===r) return; }
    k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,
    a.parentNode.insertBefore(k,a)
  })(window, document, 'script', 'https://mc.yandex.ru/metrika/tag.js', 'ym');

  ym(id, 'init', {
    ssr: true,
    webvisor: true,
    clickmap: true,
    trackLinks: true,
    accurateTrackBounce: true
  });

  /* Отправка формы как цель. В Метрике цель создаётся один раз:
     Цели → JavaScript-событие → идентификатор form_sent */
  window.VOID_GOAL = function(name){
    try{ ym(id, 'reachGoal', name); }catch(e){}
  };
})();
