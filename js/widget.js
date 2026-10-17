/**
 * AI Support Agent — Embeddable Chat Widget
 * Drop-in script, no build step required.
 *
 * Usage (on the client's website):
 *   <script
 *     src="https://your-backend.host/static/widget.js"
 *     data-api-url="https://your-backend.host/api/chat"
 *     data-brand="Acme Support"
 *     data-accent="#0F5C4C"
 *   ></script>
 */
(function () {
  const scriptTag = document.currentScript;
  const API_URL = scriptTag.getAttribute("data-api-url") || "/api/chat";
  const BRAND = scriptTag.getAttribute("data-brand") || "Support";
  const ACCENT = scriptTag.getAttribute("data-accent") || "#0F5C4C";
  const STORAGE_KEY = "aisa_session_id";

  function getSessionId() {
    let id = localStorage.getItem(STORAGE_KEY);
    if (!id) {
      id = "web-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  }

  const css = `
    .aisa-launcher {
      position: fixed; bottom: 22px; right: 22px; z-index: 999999;
      width: 58px; height: 58px; border-radius: 50%;
      background: ${ACCENT}; color: #fff; border: none; cursor: pointer;
      box-shadow: 0 6px 20px rgba(0,0,0,0.25);
      display: flex; align-items: center; justify-content: center;
      font-size: 26px; transition: transform 0.15s ease;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .aisa-launcher:hover { transform: scale(1.06); }
    .aisa-panel {
      position: fixed; bottom: 92px; right: 22px; z-index: 999999;
      width: 360px; max-width: calc(100vw - 32px); height: 520px; max-height: calc(100vh - 140px);
      background: #fff; border-radius: 16px; overflow: hidden;
      box-shadow: 0 12px 40px rgba(0,0,0,0.22);
      display: none; flex-direction: column;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .aisa-panel.aisa-open { display: flex; }
    .aisa-header {
      background: ${ACCENT}; color: #fff; padding: 16px 18px;
      font-weight: 600; font-size: 15px; display: flex; align-items: center; justify-content: space-between;
    }
    .aisa-header small { display: block; font-weight: 400; opacity: 0.85; font-size: 12px; margin-top: 2px; }
    .aisa-close { background: none; border: none; color: #fff; font-size: 20px; cursor: pointer; line-height: 1; }
    .aisa-body { flex: 1; overflow-y: auto; padding: 14px; background: #F7F8F7; }
    .aisa-msg { max-width: 82%; margin-bottom: 10px; padding: 10px 13px; border-radius: 12px; font-size: 14px; line-height: 1.45; }
    .aisa-msg.user { background: ${ACCENT}; color: #fff; margin-left: auto; border-bottom-right-radius: 3px; }
    .aisa-msg.bot { background: #EDEFED; color: #1C1C1C; margin-right: auto; border-bottom-left-radius: 3px; }
    .aisa-msg.ticket { background: #FFF4E5; color: #7A4A00; border: 1px solid #FFD98C; margin-right: auto; }
    .aisa-typing { font-size: 13px; color: #888; padding: 4px 13px; }
    .aisa-input-row { display: flex; border-top: 1px solid #eee; padding: 10px; gap: 8px; }
    .aisa-input { flex: 1; border: 1px solid #ddd; border-radius: 20px; padding: 9px 14px; font-size: 14px; outline: none; }
    .aisa-input:focus { border-color: ${ACCENT}; }
    .aisa-send { background: ${ACCENT}; color: #fff; border: none; border-radius: 20px; padding: 0 16px; font-size: 14px; cursor: pointer; font-weight: 600; }
    .aisa-send:disabled { opacity: 0.5; cursor: not-allowed; }
  `;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  const launcher = document.createElement("button");
  launcher.className = "aisa-launcher";
  launcher.setAttribute("aria-label", "Open support chat");
  launcher.innerHTML = "💬";

  const panel = document.createElement("div");
  panel.className = "aisa-panel";
  panel.innerHTML = `
    <div class="aisa-header">
      <div>${BRAND}<small>Typically replies instantly</small></div>
      <button class="aisa-close" aria-label="Close">&times;</button>
    </div>
    <div class="aisa-body" id="aisa-body"></div>
    <div class="aisa-input-row">
      <input class="aisa-input" id="aisa-input" type="text" placeholder="Type your question..." />
      <button class="aisa-send" id="aisa-send">Send</button>
    </div>
  `;

  document.body.appendChild(launcher);
  document.body.appendChild(panel);

  const body = panel.querySelector("#aisa-body");
  const input = panel.querySelector("#aisa-input");
  const sendBtn = panel.querySelector("#aisa-send");
  const closeBtn = panel.querySelector(".aisa-close");

  function addMessage(text, cls) {
    const el = document.createElement("div");
    el.className = "aisa-msg " + cls;
    el.textContent = text;
    body.appendChild(el);
    body.scrollTop = body.scrollHeight;
  }

  function setTyping(on) {
    let el = body.querySelector(".aisa-typing");
    if (on && !el) {
      el = document.createElement("div");
      el.className = "aisa-typing";
      el.textContent = BRAND + " is typing...";
      body.appendChild(el);
      body.scrollTop = body.scrollHeight;
    } else if (!on && el) {
      el.remove();
    }
  }

  let opened = false;
  launcher.addEventListener("click", () => {
    opened = !opened;
    panel.classList.toggle("aisa-open", opened);
    if (opened && body.children.length === 0) {
      addMessage("Hi! Ask me anything and I'll do my best to help. If I can't answer, I'll open a support ticket for you automatically.", "bot");
    }
  });
  closeBtn.addEventListener("click", () => {
    opened = false;
    panel.classList.remove("aisa-open");
  });

  async function sendMessage() {
    const text = input.value.trim();
    if (!text) return;
    addMessage(text, "user");
    input.value = "";
    sendBtn.disabled = true;
    setTyping(true);

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, session_id: getSessionId() }),
      });
      const data = await res.json();
      setTyping(false);
      if (!res.ok) {
        addMessage("Something went wrong. Please try again in a moment.", "bot");
      } else {
        addMessage(data.answer, data.ticket_created ? "ticket" : "bot");
      }
    } catch (err) {
      setTyping(false);
      addMessage("I couldn't reach the server. Please check your connection and try again.", "bot");
    } finally {
      sendBtn.disabled = false;
      input.focus();
    }
  }

  sendBtn.addEventListener("click", sendMessage);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendMessage();
  });
})();
