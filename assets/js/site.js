/* The Food (Kim)ist — cart, blog filters and small interactions.
   Pages are pre-built by build/build.py; this only adds behavior. */
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = (n) => "$" + Number(n).toFixed(2);
  const ROOT = document.body.dataset.root || "./";
  const P = window.PRODUCTS || [];
  const SITE = window.SITE || {};
  const abs = (u) => (/^https?:/.test(u) ? u : ROOT + u);

  /* ---------- cart (kept in this browser only) ---------- */
  const KEY = "fk_cart_v2";
  const cart = {
    read() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } },
    write(items) { try { localStorage.setItem(KEY, JSON.stringify(items)); } catch {} count(); },
    add(id, qty) {
      const items = cart.read();
      const hit = items.find((i) => i.id === id);
      if (hit) hit.qty += qty; else items.push({ id, qty });
      cart.write(items);
    },
  };
  function count() {
    const n = cart.read().reduce((s, i) => s + i.qty, 0);
    $$("[data-cart-count]").forEach((el) => (el.textContent = n));
  }

  function toast(html) {
    let t = $(".toast");
    if (!t) { t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    t.innerHTML = html; t.classList.add("show");
    clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 3200);
  }

  /* ---------- sign-ups (Google Sheet via Apps Script, see build/google-sheet-signup.gs) ---------- */
  async function subscribe(fields) {
    // Apps Script doesn't send CORS headers, so the reply can't be read;
    // a network failure still throws and is reported by the caller.
    await fetch(SITE.signup_url, { method: "POST", mode: "no-cors", body: new URLSearchParams(fields) });
  }

  // Any button with data-interest opens the email pop-up and records which button it was.
  function initInterestButtons() {
    const buttons = $$("[data-interest]");
    if (!buttons.length) return;
    const dlg = document.createElement("dialog");
    dlg.className = "inquire";
    dlg.innerHTML = `
      <form method="dialog" class="inquire-close-form"><button class="inquire-x" aria-label="Close">&times;</button></form>
      <h2>Let’s formulate.</h2>
      <p class="inquire-topic">You’re asking about: <strong></strong></p>
      <p class="inquire-copy">Leave your email and Kim will reach out.</p>
      <form class="inquire-form">
        <input type="email" name="email" required placeholder="Email Address" aria-label="Email Address" autocomplete="email">
        <input type="text" name="website" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
        <button class="btn" type="submit">Submit</button>
      </form>
      <div class="form-note" role="status"></div>`;
    document.body.appendChild(dlg);
    const form = $(".inquire-form", dlg), note = $(".form-note", dlg), submit = $(".inquire-form .btn", dlg);
    let interest = "";
    buttons.forEach((b) => b.addEventListener("click", () => {
      interest = b.dataset.interest;
      $(".inquire-topic strong", dlg).textContent = interest;
      form.hidden = false; form.reset(); note.textContent = "";
      dlg.showModal();
      form.email.focus();
    }));
    dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });   // click outside closes
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (form.website.value) return;
      if (!SITE.signup_url) { note.textContent = "Sign-ups aren't connected yet."; return; }
      submit.disabled = true; note.textContent = "Sending…";
      try {
        await subscribe({ email: form.email.value.trim(), source: location.pathname, interest });
        form.hidden = true;
        note.textContent = "Thanks! Kim will be in touch soon.";
      } catch {
        note.textContent = "Something went wrong. Please try again.";
      } finally { submit.disabled = false; }
    });
  }

  const pages = {
    home() {
      const f = $("#newsletter"), note = $(".form-note"), btn = $("button", f);
      f.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (f.website.value) return;              // hidden field only bots fill in
        const email = f.email.value.trim();
        if (!SITE.signup_url) { note.textContent = "Sign-ups aren't connected yet."; return; }
        btn.disabled = true; note.textContent = "Signing you up…";
        try {
          await subscribe({ email, source: location.pathname, interest: "Newsletter" });
          note.textContent = "Thanks! You're on the list.";
          f.reset();
        } catch {
          note.textContent = "Something went wrong. Please try again.";
        } finally { btn.disabled = false; }
      });
    },

    product() {
      $$(".thumb-btn").forEach((b) => b.addEventListener("click", () => {
        $("#main-photo").src = b.dataset.full;
        $$(".thumb-btn").forEach((x) => x.classList.toggle("active", x === b));
      }));
      const form = $(".add-form");
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const qty = Math.max(1, Math.min(50, parseInt($("#qty").value, 10) || 1));
        cart.add(form.dataset.product, qty);
        toast(`Added to cart <a href="${ROOT}cart/">View cart</a>`);
      });
    },

    cart() {
      const root = $("#cart");
      let notes = "";
      function draw() {
        const items = cart.read().map((i) => ({ ...i, p: P.find((x) => x.id === i.id) })).filter((i) => i.p);
        if (!items.length) {
          root.innerHTML = `<div class="empty"><p>You have nothing in your shopping cart.</p><a class="btn" href="${ROOT}macaron-store/">Continue Shopping</a></div>`;
          return;
        }
        const subtotal = items.reduce((s, i) => s + i.p.price * i.qty, 0);
        root.innerHTML = `
          <table class="cart-table">
            <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th></th></tr></thead>
            <tbody>${items.map((i, n) => `
              <tr>
                <td><div class="cart-item"><div class="mini"><img src="${esc(abs(i.p.image))}" alt=""></div><a href="${ROOT}${i.p.url}">${esc(i.p.name)}</a></div></td>
                <td><input type="number" min="1" max="50" value="${i.qty}" data-qty="${n}" aria-label="Quantity" class="qty-input"></td>
                <td>${money(i.p.price * i.qty)}</td>
                <td><button class="remove" data-remove="${n}">Remove</button></td>
              </tr>`).join("")}</tbody>
          </table>
          <div class="cart-bottom">
            <div class="field"><label for="notes">Flavors, gift note, or delivery date</label><textarea id="notes" rows="4">${esc(notes)}</textarea></div>
            <div class="cart-summary">
              <div class="row total"><span>Subtotal</span><span>${money(subtotal)}</span></div>
              <p class="small">10% off 2 or more boxes with code TWOPLUS. Free shipping within Georgia.</p>
              <div class="notice">Online checkout is coming soon. Checkout opens an email with your order so Kim can confirm it.</div>
              <button class="btn" style="width:100%" id="checkout">Checkout</button>
            </div>
          </div>`;
      }
      root.addEventListener("input", (e) => { if (e.target.id === "notes") notes = e.target.value; });
      root.addEventListener("change", (e) => {
        const q = e.target.closest("[data-qty]"); if (!q) return;
        const items = cart.read(); items[+q.dataset.qty].qty = Math.max(1, Math.min(50, parseInt(q.value, 10) || 1)); cart.write(items); draw();
      });
      root.addEventListener("click", (e) => {
        const r = e.target.closest("[data-remove]");
        if (r) { const items = cart.read(); items.splice(+r.dataset.remove, 1); cart.write(items); draw(); return; }
        if (e.target.id === "checkout") {
          const lines = cart.read().map((i) => { const p = P.find((x) => x.id === i.id); return p ? `${i.qty} × ${p.name} (${money(p.price * i.qty)})` : ""; }).filter(Boolean);
          const body = "Hi Kim! I'd like to order:\n\n" + lines.join("\n") + "\n\nNotes: " + (notes || "") + "\n\nName:\nShipping address:\nPhone:\n";
          location.href = `mailto:${SITE.email}?subject=${encodeURIComponent("Macaron order")}&body=${encodeURIComponent(body)}`;
        }
      });
      draw();
    },

    blog() {
      const cards = $$("#posts .post-card");
      const more = $("#load-more"), none = $("#no-results"), search = $("#search");
      const PAGE = 24;
      let shown = PAGE, cat = new URLSearchParams(location.search).get("category") || "", q = "";
      function match(c) {
        return (!cat || c.dataset.cats.split("|").includes(cat)) && (!q || c.dataset.search.includes(q) || c.textContent.toLowerCase().includes(q));
      }
      function draw() {
        let n = 0;
        cards.forEach((c) => { const ok = match(c); c.hidden = !ok || n >= shown; if (ok) n++; });
        more.hidden = n <= shown;
        none.hidden = n > 0;
        $$("#filters button").forEach((b) => b.classList.toggle("active", b.dataset.cat === cat));
      }
      $("#filters").addEventListener("click", (e) => {
        const b = e.target.closest("button"); if (!b) return;
        cat = b.dataset.cat; shown = PAGE;
        history.replaceState(null, "", cat ? `?category=${encodeURIComponent(cat)}` : location.pathname);
        draw();
      });
      search.addEventListener("input", () => { q = search.value.trim().toLowerCase(); shown = PAGE; draw(); });
      more.addEventListener("click", () => { shown += PAGE; draw(); });
      draw();
    },

    login() {
      $("#login-form").addEventListener("submit", (e) => { e.preventDefault(); $(".form-note").textContent = "Customer accounts aren't available yet."; });
    },
  };

  document.addEventListener("DOMContentLoaded", () => {
    initInterestButtons();
    const toggle = $(".menu-toggle"), nav = $(".main-nav");
    toggle.addEventListener("click", () => toggle.setAttribute("aria-expanded", nav.classList.toggle("open")));

    // "Macarons" flyout menu
    const closeDrops = (except) => $$(".nav-group.open").forEach((g) => {
      if (g !== except) { g.classList.remove("open"); $(".nav-drop", g).setAttribute("aria-expanded", "false"); }
    });
    $$(".nav-drop").forEach((btn) => btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const g = btn.parentElement, open = !g.classList.contains("open");
      closeDrops(g);
      g.classList.toggle("open", open);
      btn.setAttribute("aria-expanded", String(open));
    }));
    document.addEventListener("click", (e) => { if (!e.target.closest(".nav-group")) closeDrops(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDrops(); });

    // photo carousels
    $$(".carousel").forEach((c) => {
      const track = $(".car-track", c);
      const step = () => Math.max(track.clientWidth * 0.8, 240);
      $(".prev", c).addEventListener("click", () => track.scrollBy({ left: -step(), behavior: "smooth" }));
      $(".next", c).addEventListener("click", () => track.scrollBy({ left: step(), behavior: "smooth" }));
      const update = () => {
        $(".prev", c).disabled = track.scrollLeft < 4;
        $(".next", c).disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
      };
      track.addEventListener("scroll", update, { passive: true });
      window.addEventListener("resize", update);
      update();
    });
    count();
    const fn = pages[document.body.dataset.page];
    if (fn) fn();
  });
})();
