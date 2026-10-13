/* Curated provider campaigns. Booking and approval happen through Contact Us. */
(function () {
  'use strict';
  var campaigns = [];
  var root = document.querySelector('script[src*="script.js"]');
  var base = root ? new URL('.', root.src).href : new URL('.', location.href).href;
  function escape(value) { return String(value || '').replace(/[&<>"']/g, function(c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function safeLink(path) { try { var url = new URL(path, base); return url.origin === new URL(base).origin && url.protocol === new URL(base).protocol && !url.username && !url.password ? url.href : null; } catch (_) { return null; } }
  function eligible(c, context, now) {
    return c.approved === true && c.name && c.headline && safeLink(c.href) && Date.parse(c.startsAt) <= now && Date.parse(c.endsAt) > now && (context.home ? c.homepage === true : context.city && Array.isArray(c.cityIds) && c.cityIds.indexOf(context.city) >= 0) && (!c.types || !c.types.length || !context.type || c.types.indexOf(context.type) >= 0);
  }
  function invitation(home) {
    return '<div class="provider-spotlight__copy"><span class="provider-spotlight__eyebrow">Provider sponsorship · campaign availability</span><h2>' + (home ? 'A bigger stage for your portfolio.' : 'Put your portfolio in this market’s spotlight.') + '</h2><p>For multi-unit landlords, property companies and co-living providers. One clearly labeled company showcase, separate from individual listing boosts.</p></div><div class="provider-spotlight__offer"><span class="provider-spotlight__price">' + (home ? '$599' : '$299') + '<small>/month · USD</small></span><p>' + (home ? 'Homepage rotation + up to 3 market search areas' : 'One market’s search spotlight') + '</p><a class="btn btn--primary" href="'+base+'contact.html?topic=sponsorship&package='+(home?'portfolio':'market')+'">Request availability <span aria-hidden="true">↗</span></a><a class="provider-spotlight__details" href="'+base+'professionals.html#provider-sponsorship">Compare sponsorship packages</a></div>';
  }
  function paint(host, context) {
    var now = Date.now(); var active = campaigns.filter(function(c){return eligible(c,context,now);}); var offset = active.length ? Math.floor(now / 86400000) % active.length : 0; active = active.slice(offset).concat(active.slice(0,offset)).slice(0,3);
    host.className = 'provider-spotlight' + (context.home ? ' provider-spotlight--home' : ' provider-spotlight--search');
    host.setAttribute('aria-label', active.length ? 'Sponsored providers' : 'Provider advertising availability');
    host.innerHTML = active.length ? '<div class="provider-spotlight__copy"><span class="provider-spotlight__eyebrow">Sponsored providers · paid placement</span><h2>Discover a provider’s portfolio</h2><p>Advertising does not confer verification. Check each home’s details and availability.</p></div><div class="provider-spotlight__campaigns">'+active.map(function(c){return '<a class="provider-campaign" href="'+escape(safeLink(c.href))+'"><span class="provider-campaign__initial" aria-hidden="true">'+escape(c.name.slice(0,1))+'</span><span><small>Sponsored</small><strong>'+escape(c.name)+'</strong><span>'+escape(c.headline)+'</span></span><span aria-hidden="true">↗</span></a>';}).join('')+'</div>' : invitation(context.home);
  }
  var lastContext;
  function render(context) {
    lastContext = context;
    var host;
    if (context.home) {
      host=document.getElementById('provider-home-spotlight');
      if(!host){var hero=document.querySelector('main .hero, main .rl-media-hero');if(!hero)return;host=document.createElement('section');host.id='provider-home-spotlight';hero.insertAdjacentElement('afterend',host);}
    } else {
      var results=document.getElementById('rl-results') || document.getElementById('listings-grid') || document.querySelector('[data-b-results]') || document.getElementById('rl-match-results');if(!results)return;
      host=document.getElementById('provider-search-spotlight');if(!host){host=document.createElement('section');host.id='provider-search-spotlight';if(results.id==='rl-results')results.prepend(host);else results.insertAdjacentElement('beforebegin',host);}
    }
    paint(host,context);
  }
  window.RLProviderSponsors={render:render};
  var params=new URLSearchParams(location.search);
  render({home:document.body.dataset.page==='home',city:params.get('city')||document.body.dataset.city||'',type:params.get('type')||document.body.dataset.type||''});
  fetch(base+'provider-sponsorships.json',{credentials:'omit'}).then(function(r){if(!r.ok)throw Error('Unavailable');return r.json();}).then(function(data){campaigns=Array.isArray(data.campaigns)?data.campaigns:[];render(lastContext);}).catch(function(){/* Unbooked inventory remains an advertising invitation. */});
})();
