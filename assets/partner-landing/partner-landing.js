document.addEventListener("DOMContentLoaded", () => {
  initFaq();
  initCountdown();
  initLeadForms();
});

function initLeadForms() {
  var body = document.body;
  var siteId = body.getAttribute("data-pl-site-id") || "";
  var slug = body.getAttribute("data-pl-slug") || "";
  var siteName = body.getAttribute("data-pl-site") || "Partner website";

  document.querySelectorAll("[data-pl-lead-form]").forEach(function (form) {
    if (!window.__lpFormT) window.__lpFormT = Date.now();
    form.addEventListener("focusin", function () {
      window.__lpFormT = window.__lpFormT || Date.now();
    }, { once: true });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var btn = form.querySelector('button[type="submit"]');
      var err = form.querySelector(".pl-form-err");
      var ok = form.querySelector(".pl-form-ok");
      if (err) err.textContent = "";
      if (ok) ok.hidden = true;
      var fd = new FormData(form);
      var name = String(fd.get("name") || "").trim();
      var email = String(fd.get("email") || "").trim();
      var phone = String(fd.get("phone") || "").trim();
      if (!name && !email && !phone) {
        if (err) err.textContent = "Add your name and a phone or email so we can reach you.";
        return;
      }
      if (btn) { btn.disabled = true; btn.dataset.plLabel = btn.textContent; btn.textContent = "Sending…"; }
      var kind = form.getAttribute("data-pl-kind") || "partner-showcase";
      fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          site: siteName,
          siteId: siteId || undefined,
          slug: slug || undefined,
          kind: kind,
          name: name,
          email: email || null,
          phone: phone,
          lp_hp: String(fd.get("lp_hp") || ""),
          _t: window.__lpFormT || Date.now(),
          details: { source: "partner-landing", form: kind }
        })
      }).then(function () {
        form.reset();
        if (ok) ok.hidden = false;
      }).catch(function () {
        if (err) err.textContent = "Something went wrong — please call or email us directly.";
      }).finally(function () {
        if (btn) { btn.disabled = false; btn.textContent = btn.dataset.plLabel || "Submit"; }
      });
    });
  });
}

function initFaq() {
  const items = document.querySelectorAll(".faq-item");

  items.forEach((item) => {
    const header = item.querySelector(".faq-item__header");
    header.addEventListener("click", () => {
      const isOpen = item.classList.contains("faq-item--open");

      items.forEach((other) => {
        other.classList.remove("faq-item--open");
        other.querySelector(".faq-item__toggle").textContent = "+";
      });

      if (!isOpen) {
        item.classList.add("faq-item--open");
        item.querySelector(".faq-item__toggle").textContent = "−";
      }
    });
  });
}

function initCountdown() {
  const end = new Date();
  end.setDate(end.getDate() + 1);
  end.setHours(23, 59, 59, 0);

  const daysEl = document.getElementById("countdown-days");
  const hoursEl = document.getElementById("countdown-hours");
  const minutesEl = document.getElementById("countdown-minutes");
  const secondsEl = document.getElementById("countdown-seconds");

  if (!daysEl) return;

  function tick() {
    const now = Date.now();
    const diff = Math.max(0, end.getTime() - now);

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / (1000 * 60)) % 60);
    const seconds = Math.floor((diff / 1000) % 60);

    daysEl.textContent = String(days).padStart(2, "0") + "d";
    hoursEl.textContent = String(hours).padStart(2, "0") + "h";
    minutesEl.textContent = String(minutes).padStart(2, "0") + "m";
    secondsEl.textContent = String(seconds).padStart(2, "0") + "s";
  }

  tick();
  setInterval(tick, 1000);
}
