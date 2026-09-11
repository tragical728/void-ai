/* VOID 28 - the two settings that change when the site moves house.
   Everything else on the site reads them from here, so this is the only
   file you touch when the counter appears or the form moves to your own
   server. Loaded before every other script. */
window.VOID_CONFIG = {

  /* ---- Яндекс.Метрика -------------------------------------------------
     Поставьте сюда номер счётчика, и он начнёт считать.
     Ноль означает «счётчика нет»: тогда ничего не грузится и сайт
     не отправляет никуда ни байта.
     Где взять: metrika.yandex.ru → Добавить счётчик → номер в списке. */
  metrikaId: 112490000,

  /* ---- Куда уходит форма ----------------------------------------------
     Сейчас: FormSubmit, зарубежный сервис. Это временное решение.

     После переезда на российский хостинг поменяйте обе строки на:
         formEndpoint:     'form.php',
         formEndpointAjax: 'form.php',
     и заявки начнут записываться на вашем сервере, как требует
     статья 18 152-ФЗ о локализации персональных данных. */
  formEndpoint:     'https://formsubmit.co/bensteeler82@gmail.com',
  formEndpointAjax: 'https://formsubmit.co/ajax/bensteeler82@gmail.com'
};
