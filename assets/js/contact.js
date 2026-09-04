/* VOID 28 - contact form.
   Submits over fetch so a rejected POST shows a usable message instead of
   dropping the visitor on the host's 404 page. Without JavaScript the form
   still posts natively, which is how Netlify expects it. */
(function(){
  var form = document.getElementById('contact-form');
  if(!form) return;

  var err  = document.getElementById('form-err');
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
      say(err, true);
      var first = form.querySelector(':invalid');
      if(first) first.focus();
      return;
    }
    say(err, false);

    /* no fetch (very old browser): let the native POST happen */
    if(!window.fetch || !window.URLSearchParams) return;

    e.preventDefault();
    say(fail, false);
    busy(true);

    fetch('https://formsubmit.co/ajax/bensteeler82@gmail.com', {
      method: 'POST',
      headers: {'Accept': 'application/json'},
      body: new FormData(form)
    }).then(function(res){
      if(!res.ok) throw new Error(res.status);
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
