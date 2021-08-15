---
title: "🍝 🏴‍☠️ 🙏 Pastafarian Holy Days 🙏 🏴‍☠️ 🍝"
draft: false
---

Pastafarian perpetual calendar.

[Download or subscribe - iCalendar feed](webcal://www.pastafariancalendar.com/feed.ics)


Or, copy the entire iCalendar URL here:


<div class="input-group input-group-sm mb-3">
<input type="text" class="form-control" id="grabLink"
value="https://www.pastafariancalendar.com/feed.ics">
<button id="grabBtn" class="btn btn-secondary" data-clipboard-target="#grabLink">
<svg class="icon align-top"><use xlink:href="/sprite.svg#clippy"></use></svg>
Copy
</button>
</div>

<script src="https://cdn.jsdelivr.net/npm/clipboard@2.0.6/dist/clipboard.min.js"></script>
<script>
var clipboard = new ClipboardJS('#grabBtn', {});
var grabBtn = document.querySelector('#grabBtn');
var tooltipBtn=new bootstrap.Tooltip(grabBtn);
clipboard.on('success', function(e) {
  e.trigger.setAttribute('data-bs-original-title','Copied!');
  tooltipBtn.show();
  e.clearSelection();
});
clipboard.on('error', function(e) {
  var modifierKey=/mac/i.test(navigator.userAgent)?'\u2318':'Ctrl-';
  var fallbackMsg='Press '+modifierKey+'C to copy';
  e.trigger.setAttribute('data-bs-original-title',fallbackMsg);
  tooltipBtn.show();
});
</script>
