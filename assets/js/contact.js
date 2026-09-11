/* VOID 28 - contact form.
   Submits over fetch so a rejected POST shows a usable message instead of
   dropping the visitor on the host's 404 page. Without JavaScript the form
   still posts natively, which is how Netlify expects it. */
(function(){
  var form = document.getElementById('contact-form');
  if(!form) return;

  /* Куда уходит форма, решает assets/js/config.js. Одна строка там
     переводит приём заявок с чужого сервиса на собственный обработчик. */
  var CFG = window.VOID_CONFIG || {};
  if(CFG.formEndpoint) form.setAttribute('action', CFG.formEndpoint);

  var err  = document.getElementById('form-err');
  var cerr = document.getElementById('form-consent-err');
  var box  = document.getElementById('consent');
  var fail = document.getElementById('form-fail');
  var sel  = document.getElementById('service');
  var btn  = form.querySelector('button[type=submit]');
  var label = btn && btn.querySelector('.sbtn-face > span');

  /* the placeholder option stays dim; a real choice reads as body text */
  function tint(){ sel.style.color = sel.value ? 'var(--text)' : 'var(--muted)'; }
  if(sel){ sel.addEventListener('change', tint); tint(); }

  function say(node, on){ if(node) node.classList.toggle('on', !!on); }

  function busy(on){
    if(!btn) return;
    btn.disabled = on;
    btn.style.opacity = on ? '.6' : '';
    btn.style.pointerEvents = on ? 'none' : '';
    if(label){
      var I = window.I18N || {};
      var d = I[document.documentElement.lang] || I.en || {};
      label.textContent = on ? (d.ctSending || 'SENDING…') : (d.ctSend || 'SEND MESSAGE');
    }
  }

  form.addEventListener('submit', function(e){
    if(!form.checkValidity()){
      e.preventDefault();
      /* если единственное незаполненное это галочка согласия, показываем
         про неё, а не общее «заполните обязательные поля» */
      var onlyConsent = !!(box && !box.checked &&
        !form.querySelector('input:invalid:not([type=checkbox]), textarea:invalid, select:invalid'));
      say(cerr, onlyConsent);
      say(err, !onlyConsent);
      var first = form.querySelector(':invalid');
      if(first) first.focus();
      return;
    }
    say(err, false); say(cerr, false);

    /* no fetch (very old browser): let the native POST happen */
    if(!window.fetch || !window.URLSearchParams) return;

    e.preventDefault();
    say(fail, false);
    busy(true);

    fetch(CFG.formEndpointAjax || form.getAttribute('action'), {
      method: 'POST',
      headers: {'Accept': 'application/json'},
      body: new FormData(form)
    }).then(function(res){
      if(!res.ok) throw new Error(res.status);
      if(window.VOID_GOAL) window.VOID_GOAL('form_sent');
      window.location.href = 'thanks.html';
    }).catch(function(){
      busy(false);
      say(fail, true);
    });
  });

  form.addEventListener('input', function(){
    if(err && form.checkValidity()) say(err, false);
  });
})();
