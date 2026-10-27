(function () {
  var ENDPOINT = '/api/capi';

  function cookie(name) {
    var m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : undefined;
  }

  var fbclid = new URLSearchParams(window.location.search).get('fbclid');
  var fbcFromUrl = fbclid ? 'fb.1.' + Date.now() + '.' + fbclid : undefined;

  function newEventId() {
    try {
      if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    } catch (e) {}
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 12);
  }

  function send(payload) {
    var body = JSON.stringify(payload);
    try {
      if (navigator.sendBeacon && navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }))) return;
    } catch (e) {}
    try {
      fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true }).catch(function () {});
    } catch (e) {}
  }

  window.track = function (name, customData, eventId) {
    var id = eventId || newEventId();
    var data = customData || {};
    if (window.fbq) window.fbq('track', name, data, { eventID: id });
    send({
      event_name: name,
      event_id: id,
      event_source_url: window.location.href,
      custom_data: data,
      fbp: cookie('_fbp'),
      fbc: cookie('_fbc') || fbcFromUrl
    });
    return id;
  };

  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    var href = a.getAttribute('href');
    if (href.indexOf('viber://') === 0) window.track('Contact', { method: 'viber' });
    else if (href.indexOf('https://wa.me/359885980148') === 0) window.track('Contact', { method: 'whatsapp' });
    else if (href.indexOf('https://m.me/') === 0) window.track('Contact', { method: 'messenger' });
    else if (href.indexOf('https://book.stripe.com/') === 0) window.track('InitiateCheckout', { value: 35, currency: 'EUR' });
  }, true);
})();
