// ---------- Settings ----------
// Change this when you deploy your Flask API.
const API_BASE = "http://127.0.0.1:5000";
// Open index.html?demo=1 to preview the UI without the server (fake numbers).
const DEMO = new URLSearchParams(location.search).has("demo");

// ---------- Elements ----------
const form = document.getElementById("churnForm");
const btn = document.getElementById("predictBtn");
const btnText = btn.querySelector(".btn-text");
const statusEl = document.getElementById("apiStatus");
const autoTotal = document.getElementById("autoTotal");
const tenureEl = form.elements.tenure;
const monthlyEl = form.elements.MonthlyCharges;
const totalEl = form.elements.TotalCharges;

const card = document.getElementById("resultCard");
const ring = document.getElementById("ring");
const pctText = document.getElementById("pctText");
const pctLabel = document.getElementById("pctLabel");
const verdict = document.getElementById("verdict");
const verdictText = document.getElementById("verdictText");
const tipsBox = document.getElementById("tipsBox");
const tipsList = document.getElementById("tipsList");

// ---------- Presets ----------
const PRESETS = {
  risky: {
    gender: "Female", SeniorCitizen: "0", Partner: "No", Dependents: "No",
    PhoneService: "Yes", MultipleLines: "No", InternetService: "Fiber optic",
    OnlineSecurity: "No", OnlineBackup: "No", DeviceProtection: "No", TechSupport: "No",
    StreamingTV: "Yes", StreamingMovies: "Yes", Contract: "Month-to-month",
    PaperlessBilling: "Yes", PaymentMethod: "Electronic check",
    tenure: 2, MonthlyCharges: 89.5, TotalCharges: 179,
  },
  loyal: {
    gender: "Male", SeniorCitizen: "0", Partner: "Yes", Dependents: "Yes",
    PhoneService: "Yes", MultipleLines: "Yes", InternetService: "DSL",
    OnlineSecurity: "Yes", OnlineBackup: "Yes", DeviceProtection: "Yes", TechSupport: "Yes",
    StreamingTV: "No", StreamingMovies: "No", Contract: "Two year",
    PaperlessBilling: "No", PaymentMethod: "Credit card (automatic)",
    tenure: 60, MonthlyCharges: 64.9, TotalCharges: 3894,
  },
};

document.querySelectorAll("[data-preset]").forEach((b) => {
  b.addEventListener("click", () => {
    if (b.dataset.preset === "clear") {
      form.reset();
      autoTotal.checked = true;
      syncTotal();
      resetResult();
      return;
    }
    const p = PRESETS[b.dataset.preset];
    Object.entries(p).forEach(([name, value]) => { form.elements[name].value = value; });
    syncTotal();
  });
});

// ---------- Auto total charges ----------
function syncTotal() {
  const lock = autoTotal.checked;
  totalEl.readOnly = lock;
  if (lock) {
    const t = parseFloat(tenureEl.value) || 0;
    const m = parseFloat(monthlyEl.value) || 0;
    totalEl.value = (t * m).toFixed(2);
  }
}
[tenureEl, monthlyEl, autoTotal].forEach((el) => el.addEventListener("input", syncTotal));
autoTotal.addEventListener("change", syncTotal);
syncTotal();

// ---------- Validation ----------
function validate() {
  let ok = true;
  const rules = {
    tenure: (v) => v >= 0 && v <= 100 && Number.isInteger(v) ? "" : "Enter whole months, 0 to 100.",
    MonthlyCharges: (v) => v >= 0 && v <= 500 ? "" : "Enter an amount from 0 to 500.",
    TotalCharges: (v) => v >= 0 ? "" : "Enter 0 or more.",
  };
  Object.entries(rules).forEach(([name, check]) => {
    const input = form.elements[name];
    const raw = input.value.trim();
    const msg = raw === "" ? "This field is required." : check(Number(raw));
    form.querySelector(`.err[data-for="${name}"]`).textContent = msg;
    input.closest(".field").classList.toggle("invalid", !!msg);
    if (msg) ok = false;
  });
  return ok;
}

// ---------- Build the request ----------
function readForm() {
  const data = {};
  new FormData(form).forEach((value, key) => { data[key] = value; });
  data.SeniorCitizen = Number(data.SeniorCitizen);
  data.tenure = Number(data.tenure);
  data.MonthlyCharges = Number(data.MonthlyCharges);
  data.TotalCharges = Number(data.TotalCharges);
  return data;
}

// ---------- Result display ----------
function setStatus(kind, text) {
  statusEl.className = "status " + kind;
  statusEl.textContent = text;
}

function resetResult() {
  card.className = "result idle";
  ring.style.setProperty("--pct", 0);
  pctText.textContent = "–";
  pctLabel.textContent = "will churn?";
  verdict.textContent = "No prediction yet";
  verdictText.textContent = "Submit the form to see the result here.";
  tipsBox.hidden = true;
}

// Works with any of these API replies: { churn: true }, { prediction: "Yes" },
// { prediction: 1 }, { label: "Yes" }
function isChurn(res) {
  if (typeof res.churn === "boolean") return res.churn;
  const v = String(res.prediction ?? res.label ?? "").trim().toLowerCase();
  return ["yes", "1", "true", "churn"].includes(v);
}

function showResult(res, data) {
  const churn = isChurn(res);
  const level = churn ? "high" : "low";

  card.className = "result " + level;
  ring.style.setProperty("--pct", 100); // full coloured ring for both answers
  pctText.textContent = churn ? "Yes" : "No";
  pctLabel.textContent = "will churn?";

  if (churn) {
    verdict.textContent = "Customer will churn";
    verdictText.textContent = "This customer is likely to cancel. Reach out soon.";
  } else {
    verdict.textContent = "Customer will stay";
    verdictText.textContent = "This customer looks loyal. Keep the service quality up.";
  }

  const tips = buildTips(data, level);
  tipsList.innerHTML = "";
  tips.forEach((t) => {
    const li = document.createElement("li");
    li.textContent = t;
    tipsList.appendChild(li);
  });
  tipsBox.hidden = tips.length === 0;
}

function showError(message) {
  card.className = "result error";
  ring.style.setProperty("--pct", 0);
  pctText.textContent = "!";
  pctLabel.textContent = "error";
  verdict.textContent = "Could not get a prediction";
  verdictText.textContent = message;
  tipsBox.hidden = true;
}

// Simple rule-based suggestions (not from the model)
function buildTips(d, level) {
  if (level === "low") return ["Offer a loyalty reward or a referral bonus to keep them happy."];
  const tips = [];
  if (d.Contract === "Month-to-month") tips.push("Offer a discount to move them to a one or two year contract.");
  if (d.InternetService !== "No" && d.TechSupport === "No") tips.push("Offer a free trial of tech support. Customers with support tend to stay longer.");
  if (d.PaymentMethod === "Electronic check") tips.push("Encourage automatic payments with a small bill credit.");
  if (d.tenure < 12) tips.push("They are new. Send a personal onboarding call or welcome offer.");
  if (d.MonthlyCharges > 80) tips.push("Their bill is high. Review their plan and suggest a better-value bundle.");
  if (d.InternetService === "Fiber optic" && d.OnlineSecurity === "No") tips.push("Bundle online security into their fiber plan.");
  return tips.slice(0, 4);
}

// ---------- Demo mode (fake numbers, only to preview the UI) ----------
function demoPredict(d) {
  let s = 0.25;
  if (d.Contract === "Month-to-month") s += 0.3;
  if (d.Contract === "Two year") s -= 0.2;
  if (d.tenure < 12) s += 0.2;
  if (d.tenure > 48) s -= 0.15;
  if (d.PaymentMethod === "Electronic check") s += 0.1;
  if (d.InternetService === "Fiber optic") s += 0.08;
  if (d.TechSupport === "Yes") s -= 0.08;
  return { churn: s >= 0.5, demo: true };
}

// ---------- Talk to the API ----------
async function predict(data) {
  if (DEMO) {
    await new Promise((r) => setTimeout(r, 500));
    return demoPredict(data);
  }
  const resp = await fetch(API_BASE + "/predict", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const body = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(body.error || "Server error (" + resp.status + ").");
  return body;
}

async function checkServer() {
  if (DEMO) { setStatus("demo", "Demo mode (fake numbers)"); return; }
  try {
    const r = await fetch(API_BASE + "/health");
    if (!r.ok) throw new Error();
    setStatus("ok", "Model server online");
  } catch {
    setStatus("down", "Server offline");
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!validate()) return;

  const data = readForm();
  btn.disabled = true;
  btn.classList.add("loading");
  btnText.textContent = "Predicting…";

  try {
    const res = await predict(data);
    showResult(res, data);
    if (!DEMO) setStatus("ok", "Model server online");
    // On phones the result sits above the form, so bring it into view
    if (window.matchMedia("(max-width: 860px)").matches) {
      card.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  } catch (err) {
    const offline = err instanceof TypeError;
    showError(offline
      ? "Cannot reach the server. Start it with: python app.py"
      : err.message);
    if (offline) setStatus("down", "Server offline");
  } finally {
    btn.disabled = false;
    btn.classList.remove("loading");
    btnText.textContent = "Predict churn";
  }
});

checkServer();
