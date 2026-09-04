/* VOID 28 — contact form: inline validation feedback and a filled-state select */
(function(){
  var form = document.getElementById('contact-form');
  if(!form) return;
  var err = document.getElementById('form-err');
  var sel = document.getElementById('service');

  /* the placeholder option stays dim; a real choice reads as body text */
  function tint(){ sel.style.color = sel.value ? 'var(--text)' : 'var(--muted)'; }
  if(sel){ sel.addEventListener('change', tint); tint(); }

  form.addEventListener('submit', function(e){
    if(!form.checkValidity()){
      e.preventDefault();
      if(err) err.classList.add('on');
      var first = form.querySelector(':invalid');
      if(first){ first.focus(); }
      return;
    }
    if(err) err.classList.remove('on');
  });

  form.addEventListener('input', function(){
    if(err && form.checkValidity()) err.classList.remove('on');
  });
})();
