import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Sparkles, CreditCard, Smartphone, Wallet, Globe, Check, ChevronRight, Gift, ArrowUpCircle } from "lucide-react";
import { api } from "../../lib/api.js";
import { assetUrl } from "../../lib/config.js";
import { useToast, useConfirm } from "../shared/ui.jsx";
import { SubBadge } from "../shared/icons.jsx";
import { useT } from "../../contexts/I18nContext.jsx";

const TIER_COLORS = { 1: "#b0a070", 2: "#c8a84b", 3: "#e0b84d", 4: "#818cf8" };
const SPARKS_BASE = { plus: 300, premium: 600 };
const FIAT_BASE = {
  plus:    { RUB: 99,   USD: 0.99,  EUR: 0.89 },
  premium: { RUB: 299,  USD: 2.99,  EUR: 2.79 },
};
const MONTH_MULT = { 1: 1.0, 3: 0.95, 6: 0.90, 12: 0.80 };
const DISCOUNT_PCT = { 1: 0, 3: 5, 6: 10, 12: 20 };
const SYM = { RUB: "₽", USD: "$", EUR: "€", SPARKS: "✦" };

function calcCost(plan, currency, months) {
  const mult = MONTH_MULT[months] || 1;
  if (currency === "SPARKS") {
    const raw = SPARKS_BASE[plan] * months;
    return { raw, cost: Math.floor(raw * mult), saved: Math.floor(raw * (1 - mult)), perMonth: SPARKS_BASE[plan] };
  }
  const base = (FIAT_BASE[plan] || FIAT_BASE.plus)[currency] || FIAT_BASE.plus.RUB;
  const raw = parseFloat((base * months).toFixed(2));
  const cost = parseFloat((raw * mult).toFixed(2));
  return { raw, cost, saved: parseFloat((raw - cost).toFixed(2)), perMonth: base };
}

function iskraPlural(n, t) {
  const mod10 = Math.abs(n) % 10;
  const mod100 = Math.abs(n) % 100;
  if (mod100 >= 11 && mod100 <= 19) return t("plus.spark.many", { n });
  if (mod10 === 1) return t("plus.spark.1", { n });
  if (mod10 >= 2 && mod10 <= 4) return t("plus.spark.few", { n });
  return t("plus.spark.many", { n });
}

function makeLevels(t) {
  return [
    { num: 1, range: t("plus.lv.1.range"), icon: "✦", iconClass: "xp-lv1", perks: [t("plus.lv.1.p1"), t("plus.lv.1.p2"), t("plus.lv.1.p3"), t("plus.lv.1.p4")] },
    { num: 2, range: t("plus.lv.2.range"), icon: "✦✦", iconClass: "xp-lv2", perks: [t("plus.lv.2.p1"), t("plus.lv.2.p2"), t("plus.lv.2.p3"), t("plus.lv.2.p4")] },
    { num: 3, range: t("plus.lv.3.range"), icon: "✦✦✦", iconClass: "xp-lv3", perks: [t("plus.lv.3.p1"), t("plus.lv.3.p2"), t("plus.lv.3.p3"), t("plus.lv.3.p4"), t("plus.lv.3.p5")] },
  ];
}

function makeFullPerks(t) {
  return [
    { icon: "🌈", title: t("plus.fp.0.title"), desc: t("plus.fp.0.desc") },
    { icon: "🎨", title: t("plus.fp.1.title"), desc: t("plus.fp.1.desc") },
    { icon: "⚡", title: t("plus.fp.2.title"), desc: t("plus.fp.2.desc") },
    { icon: "🔥", title: t("plus.fp.3.title"), desc: t("plus.fp.3.desc") },
    { icon: "◆", title: t("plus.fp.4.title"), desc: t("plus.fp.4.desc") },
    { icon: "⭐", title: t("plus.fp.5.title"), desc: t("plus.fp.5.desc") },
  ];
}

function makePackages(t) {
  return [
    { id: "p100",  iskra: 100,  price: 79,   label: t("plus.pkg.0") },
    { id: "p300",  iskra: 300,  price: 199,  label: t("plus.pkg.1") },
    { id: "p600",  iskra: 600,  price: 349,  label: t("plus.pkg.2") },
    { id: "p1500", iskra: 1500, price: 799,  label: t("plus.pkg.3"), popular: true },
    { id: "p5000", iskra: 5000, price: 2499, label: t("plus.pkg.4") },
  ];
}

function getPayMethods(t) {
  return [
    { id: "sbp",        label: t("plus.method.sbp.label"),    icon: <Smartphone size={18}/>, desc: t("plus.method.sbp.desc"),    needsCard: false },
    { id: "card_ru",    label: t("plus.method.cardRu.label"), icon: <CreditCard size={18}/>, desc: t("plus.method.cardRu.desc"), needsCard: true  },
    { id: "apple_pay",  label: "Apple Pay",                   icon: <Wallet size={18}/>,     desc: t("plus.method.apple.desc"),  needsCard: false },
    { id: "google_pay", label: "Google Pay",                  icon: <Wallet size={18}/>,     desc: t("plus.method.google.desc"), needsCard: false },
    { id: "paypal",     label: "PayPal",                      icon: <Globe size={18}/>,      desc: "PayPal",                     needsCard: false },
    { id: "visa",       label: "Visa",                        icon: <CreditCard size={18}/>, desc: t("plus.method.visa.desc"),   needsCard: true  },
    { id: "mastercard", label: "Mastercard",                  icon: <CreditCard size={18}/>, desc: t("plus.method.mc.desc"),     needsCard: true  },
  ];
}

function makeDurations(t) {
  return [
    { value: 1,  label: t("plus.dur.1m") },
    { value: 3,  label: t("plus.dur.3m") },
    { value: 6,  label: t("plus.dur.6m") },
    { value: 12, label: t("plus.dur.1y") },
  ];
}

// ─── Terms Modal ──────────────────────────────────────────────
function TermsModal({ onClose }) {
  const t = useT();
  return createPortal(
    <div className="modal-overlay fade-in" onClick={onClose}>
      <div className="modal terms-modal pop-in" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{t("plus.terms.title")}</h3>
          <button className="btn ghost" onClick={onClose}>✕</button>
        </div>
        <div className="terms-body">
          <section className="terms-section"><h4>{t("plus.terms.s1.title")}</h4><p>{t("plus.terms.s1.body")}</p></section>
          <section className="terms-section"><h4>{t("plus.terms.s2.title")}</h4><p>{t("plus.terms.s2.body")}</p></section>
          <section className="terms-section"><h4>{t("plus.terms.s3.title")}</h4><p>{t("plus.terms.s3.body")}</p></section>
          <section className="terms-section"><h4>{t("plus.terms.s4.title")}</h4><p>{t("plus.terms.s4.body")}</p></section>
          <section className="terms-section"><h4>{t("plus.terms.s5.title")}</h4><p>{t("plus.terms.s5.body")}</p></section>
        </div>
        <div style={{ padding: "14px 20px" }}>
          <button className="btn accent" style={{ width: "100%" }} onClick={onClose}>{t("plus.terms.ok")}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Buy Sparks Modal ─────────────────────────────────────────
function BuyIskraModal({ token, balance, onClose, onSuccess }) {
  const t = useT();
  const PACKAGES = makePackages(t);
  const PAY_METHODS = getPayMethods(t);

  const [pkg, setPkg] = useState(null);
  const [method, setMethod] = useState("sbp");
  const [step, setStep] = useState("pick");
  const [newBalance, setNewBalance] = useState(balance);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const proceed = async () => {
    if (!pkg || !method) return;
    setBusy(true);
    setStep("processing");
    try {
      const r = await api("/iskra/buy", { method: "POST", token, body: { packageId: pkg.id, payMethod: method } });
      setNewBalance(r.balance);
      onSuccess(r.balance);
      setStep("done");
    } catch (e) {
      toast(e.message || t("common.error"), { type: "error" });
      setStep("method");
    } finally { setBusy(false); }
  };

  return createPortal(
    <div className="modal-overlay fade-in" onClick={step === "done" ? onClose : undefined}>
      <div className="modal iskra-buy-modal pop-in" onClick={e => e.stopPropagation()}>

        {step === "pick" && (
          <>
            <div className="iskra-modal-head">
              <div>
                <div className="iskra-modal-title">{t("plus.buy.title")}</div>
                <div className="iskra-modal-bal">{t("plus.buy.balance")} <b>{iskraPlural(balance, t)}</b></div>
              </div>
              <button className="btn ghost" onClick={onClose}>✕</button>
            </div>
            <div className="iskra-modal-section">
              <div className="iskra-section-label">{t("plus.buy.pickPkg")}</div>
              <div className="iskra-pkgs">
                {PACKAGES.map(p => (
                  <button key={p.id} className={`iskra-pkg ${pkg?.id === p.id ? "iskra-pkg-on" : ""} ${p.popular ? "iskra-pkg-popular" : ""}`}
                    onClick={() => setPkg(p)}>
                    {p.popular && <span className="iskra-popular-tag">{t("plus.pkg.popular")}</span>}
                    <div className="iskra-pkg-ico">✦</div>
                    <div className="iskra-pkg-n">{p.iskra}</div>
                    <div className="iskra-pkg-label">{p.label}</div>
                    <div className="iskra-pkg-price">{p.price} ₽</div>
                    <div className="iskra-pkg-per">{(p.price / p.iskra).toFixed(2)} ₽/✦</div>
                    {pkg?.id === p.id && <div className="iskra-pkg-check"><Check size={13}/></div>}
                  </button>
                ))}
              </div>
            </div>
            <div className="iskra-modal-foot">
              <button className="btn accent" style={{ width: "100%", fontSize: 15, padding: "12px 0" }}
                onClick={() => { if (pkg) setStep("method"); }} disabled={!pkg}>
                {pkg ? t("plus.buy.btn", { iskra: iskraPlural(pkg.iskra, t), price: pkg.price }) : t("plus.buy.noPkg")}
              </button>
              <button className="xp-pay-cancel" onClick={onClose}>{t("common.cancel")}</button>
            </div>
          </>
        )}

        {step === "method" && (
          <>
            <div className="iskra-modal-head">
              <button className="btn ghost" style={{ padding: "4px 8px" }} onClick={() => setStep("pick")}>{t("common.back")}</button>
              <div style={{ flex: 1, textAlign: "center" }}>
                <div className="iskra-modal-title">{t("plus.payModal.payment")}</div>
                <div className="iskra-modal-bal"><span className="iskra-spark-ico">✦</span> {iskraPlural(pkg.iskra, t)} — {pkg.price} ₽</div>
              </div>
              <button className="btn ghost" onClick={onClose}>✕</button>
            </div>
            <div className="iskra-modal-section">
              <div className="iskra-section-label">{t("plus.buy.payMethod")}</div>
              <div className="iskra-methods">
                {PAY_METHODS.map(m => (
                  <button key={m.id} className={`iskra-method ${method === m.id ? "iskra-method-on" : ""}`}
                    onClick={() => setMethod(m.id)}>
                    <span className="iskra-method-icon">{m.icon}</span>
                    <div className="iskra-method-info">
                      <div className="iskra-method-name">{m.label}</div>
                      <div className="iskra-method-desc">{m.desc}</div>
                    </div>
                    {method === m.id && <Check size={14} className="iskra-method-check"/>}
                  </button>
                ))}
              </div>
            </div>
            <div className="iskra-modal-foot">
              <div className="iskra-demo-note"><span>⚠️</span><span>{t("plus.buy.demo")}</span></div>
              <button className="btn accent" style={{ width: "100%", fontSize: 15, padding: "12px 0" }}
                onClick={proceed} disabled={busy || !method}>
                {t("plus.buy.payBtn", { price: pkg.price, method: PAY_METHODS.find(m => m.id === method)?.label })}
              </button>
              <button className="xp-pay-cancel" onClick={onClose}>{t("common.cancel")}</button>
            </div>
          </>
        )}

        {step === "processing" && (
          <div className="pay-processing">
            <div className="iskra-done-spark" style={{ animation: "none", fontSize: 40 }}>✦</div>
            <div className="pay-proc-title">{t("plus.buy.processing.title")}</div>
            <div className="pay-proc-sub">{t("plus.dontClose")}</div>
          </div>
        )}

        {step === "done" && (
          <div className="iskra-done">
            <div className="iskra-done-spark">✦</div>
            <h3>{t("plus.buy.done.title")}</h3>
            <p>{t("plus.buy.done.balance")} <b>{iskraPlural(newBalance, t)}</b></p>
            <button className="btn accent" style={{ marginTop: 16, width: "100%" }} onClick={onClose}>{t("plus.buy.done.ok")}</button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

// ─── Unified Purchase Modal ───────────────────────────────────
// Handles: new sub (Sparks or fiat) + upgrade (Sparks or fiat)
// Steps: currency → duration → [payment if fiat] → confirm → processing → done
function PurchaseModal({ plan, token, balance, subscription, onClose, onSuccess }) {
  const t = useT();
  const DURATIONS = makeDurations(t);
  const PAY_METHODS = getPayMethods(t);
  const toast = useToast();

  const currentTier = subscription?.tier || 0;
  const newTier = plan === "premium" ? 4 : 1;
  const isUpgrade = subscription?.active && currentTier > 0 && newTier > currentTier;
  const planLabel = plan === "premium" ? "Xalle Premium" : "Xalle Plus";
  const planColor = plan === "premium" ? "#818cf8" : "var(--accent)";
  const planIcon = plan === "premium" ? "◆" : "✦";

  const [step, setStep] = useState("currency");
  const [currency, setCurrency] = useState("RUB");
  const [months, setMonths] = useState(1);
  const [method, setMethod] = useState("sbp");
  const [card, setCard] = useState({ number: "", expiry: "", cvv: "", name: "" });
  const [agreed, setAgreed] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [proration, setProration] = useState(null);
  const [busy, setBusy] = useState(false);
  const [doneResult, setDoneResult] = useState(null);

  useEffect(() => {
    if (step !== "confirm" || !isUpgrade || currency !== "SPARKS") return;
    api(`/iskra/proration?plan=${plan}&months=${months}`, { token })
      .then(setProration).catch(() => {});
  }, [step, plan, months, isUpgrade, currency, token]);

  const pricing = calcCost(plan, currency, months);
  const prorationDiscount = (isUpgrade && currency === "SPARKS" && proration?.prorationDiscount) || 0;
  const finalCost = Math.max(0, pricing.cost - prorationDiscount);
  const sym = SYM[currency];
  const canAffordSparks = currency !== "SPARKS" || balance >= finalCost;
  const selectedMethod = PAY_METHODS.find(m => m.id === method);

  const goNext = () => {
    if (step === "currency") { setStep("duration"); return; }
    if (step === "duration") { setStep(currency === "SPARKS" ? "confirm" : "payment"); return; }
    if (step === "payment") { setStep("confirm"); return; }
  };

  const goBack = () => {
    if (step === "duration") { setStep("currency"); return; }
    if (step === "payment") { setStep("duration"); return; }
    if (step === "confirm") { setStep(currency === "SPARKS" ? "duration" : "payment"); return; }
  };

  const formatCard = (v) => v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
  const formatExpiry = (v) => { const d = v.replace(/\D/g, "").slice(0, 4); return d.length > 2 ? d.slice(0, 2) + "/" + d.slice(2) : d; };

  const submit = async () => {
    if (!agreed) return;
    if (selectedMethod?.needsCard && currency !== "SPARKS") {
      if (!card.number || !card.expiry || !card.cvv || !card.name.trim()) {
        toast(t("plus.payModal.errCard"), { type: "error" }); return;
      }
    }
    setBusy(true);
    setStep("processing");
    try {
      let r;
      if (currency === "SPARKS") {
        const endpoint = isUpgrade ? "/iskra/upgrade" : "/iskra/subscribe";
        r = await api(endpoint, { method: "POST", token, body: { plan, months } });
      } else {
        const endpoint = isUpgrade ? "/iskra/upgrade-fiat" : "/iskra/buy-fiat";
        r = await api(endpoint, { method: "POST", token, body: { plan, months, currency, payMethod: method } });
      }
      setDoneResult(r);
      onSuccess?.(r);
      setStep("done");
    } catch (e) {
      toast(e.message || t("common.error"), { type: "error" });
      setStep("confirm");
    } finally { setBusy(false); }
  };

  const CURRENCY_OPTIONS = [
    { id: "RUB",    label: t("plus.purchase.currency.rub"),    desc: "₽", sym: "₽" },
    { id: "USD",    label: t("plus.purchase.currency.usd"),    desc: "$", sym: "$" },
    { id: "EUR",    label: t("plus.purchase.currency.eur"),    desc: "€", sym: "€" },
    { id: "SPARKS", label: t("plus.purchase.currency.sparks"), desc: t("plus.purchase.currency.sparks.desc"), sym: "✦" },
  ];

  return createPortal(
    <div className="modal-overlay fade-in" onClick={step === "done" ? onClose : undefined}>
      <div className="modal xp-pay-modal pop-in" onClick={e => e.stopPropagation()}>

        {/* CURRENCY STEP */}
        {step === "currency" && (
          <>
            <div className="xp-pay-head">
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: planColor, fontSize: 18 }}>{planIcon}</span>
                <h3>{isUpgrade ? t("plus.purchase.upgrade.title", { plan: planLabel }) : t("plus.purchase.title", { plan: planLabel })}</h3>
              </div>
              <button className="btn ghost" onClick={onClose}>✕</button>
            </div>
            <div className="iskra-modal-section" style={{ margin: "4px 0 6px" }}>
              <div className="iskra-section-label">{t("plus.purchase.step.currency")}</div>
              <div className="purchase-currency-grid">
                {CURRENCY_OPTIONS.map(c => (
                  <button key={c.id} className={`purchase-currency-opt ${currency === c.id ? "sel" : ""}`}
                    onClick={() => setCurrency(c.id)}>
                    <span className="purchase-currency-sym">{c.sym}</span>
                    <div className="purchase-currency-info">
                      <div className="purchase-currency-name">{c.label}</div>
                      {c.id === "SPARKS" && (
                        <div className="purchase-currency-bal">
                          {t("plus.isub.yourBalance")}: <b>{iskraPlural(balance, t)}</b>
                        </div>
                      )}
                      {c.id !== "SPARKS" && (
                        <div className="purchase-currency-bal">
                          {calcCost(plan, c.id, 1).perMonth} {c.sym}{t("plus.payModal.perMonth")}
                        </div>
                      )}
                    </div>
                    {currency === c.id && <Check size={14} className="purchase-currency-check"/>}
                  </button>
                ))}
              </div>
            </div>
            <div className="xp-pay-footer">
              <button className="btn accent" style={{ width: "100%", fontSize: 15, padding: "12px 0" }}
                onClick={goNext}>
                {t("plus.payModal.continue")} <ChevronRight size={16} style={{ display: "inline", marginLeft: 4, verticalAlign: "middle" }}/>
              </button>
              <button className="xp-pay-cancel" onClick={onClose}>{t("common.cancel")}</button>
            </div>
          </>
        )}

        {/* DURATION STEP */}
        {step === "duration" && (
          <>
            <div className="xp-pay-head">
              <button className="btn ghost" style={{ padding: "4px 8px" }} onClick={goBack}>{t("common.back")}</button>
              <h3 style={{ flex: 1, textAlign: "center" }}>{t("plus.purchase.step.duration")}</h3>
              <button className="btn ghost" onClick={onClose}>✕</button>
            </div>
            <div className="iskra-modal-section" style={{ margin: "4px 0 6px" }}>
              <div className="purchase-dur-list">
                {DURATIONS.map(d => {
                  const p = calcCost(plan, currency, d.value);
                  const disc = DISCOUNT_PCT[d.value] || 0;
                  return (
                    <button key={d.value} className={`purchase-dur-opt ${months === d.value ? "sel" : ""}`}
                      onClick={() => setMonths(d.value)}>
                      <div className="purchase-dur-label">{d.label}</div>
                      <div className="purchase-dur-price">
                        <span className="purchase-dur-cost">{sym}{p.cost.toLocaleString()}</span>
                        {p.saved > 0 && <span className="purchase-dur-old">{sym}{p.raw.toLocaleString()}</span>}
                      </div>
                      <div className="purchase-dur-right">
                        <span className="purchase-dur-per">
                          {sym}{(currency === "SPARKS" ? Math.floor(p.cost / d.value) : parseFloat((p.cost / d.value).toFixed(2))).toLocaleString()}{t("plus.payModal.perMonth")}
                        </span>
                        {disc > 0 && <span className="purchase-dur-save">−{disc}%</span>}
                      </div>
                      {months === d.value && <Check size={13} className="purchase-dur-check"/>}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="xp-pay-footer">
              <button className="btn accent" style={{ width: "100%", fontSize: 15, padding: "12px 0" }}
                onClick={goNext}>
                {t("plus.payModal.continue")} <ChevronRight size={16} style={{ display: "inline", marginLeft: 4, verticalAlign: "middle" }}/>
              </button>
              <button className="xp-pay-cancel" onClick={onClose}>{t("common.cancel")}</button>
            </div>
          </>
        )}

        {/* PAYMENT METHOD STEP (fiat only) */}
        {step === "payment" && (
          <>
            <div className="xp-pay-head">
              <button className="btn ghost" style={{ padding: "4px 8px" }} onClick={goBack}>{t("common.back")}</button>
              <h3 style={{ flex: 1, textAlign: "center" }}>{t("plus.payModal.payMethod")}</h3>
              <button className="btn ghost" onClick={onClose}>✕</button>
            </div>
            <div className="xp-pay-plan">
              <div>
                <div className="xp-pay-plan-name" style={{ color: planColor }}>{planLabel}</div>
                <div className="xp-pay-plan-per">{DURATIONS.find(d => d.value === months)?.label} · {sym}{pricing.cost.toLocaleString()}</div>
              </div>
              <div className="xp-pay-plan-price">{sym}{pricing.cost.toLocaleString()}</div>
            </div>
            <div className="iskra-modal-section" style={{ margin: "14px 0 6px" }}>
              <div className="iskra-methods">
                {PAY_METHODS.map(m => (
                  <button key={m.id} className={`iskra-method ${method === m.id ? "iskra-method-on" : ""}`}
                    onClick={() => setMethod(m.id)}>
                    <span className="iskra-method-icon">{m.icon}</span>
                    <div className="iskra-method-info">
                      <div className="iskra-method-name">{m.label}</div>
                      <div className="iskra-method-desc">{m.desc}</div>
                    </div>
                    {method === m.id && <Check size={14} className="iskra-method-check"/>}
                  </button>
                ))}
              </div>
            </div>
            <div className="xp-pay-footer">
              <button className="btn accent" style={{ width: "100%", fontSize: 15, padding: "12px 0" }}
                onClick={goNext} disabled={!method}>
                {t("plus.payModal.continue")} <ChevronRight size={16} style={{ display: "inline", marginLeft: 4, verticalAlign: "middle" }}/>
              </button>
              <button className="xp-pay-cancel" onClick={onClose}>{t("common.cancel")}</button>
            </div>
          </>
        )}

        {/* CONFIRM STEP */}
        {step === "confirm" && (
          <>
            <div className="xp-pay-head">
              <button className="btn ghost" style={{ padding: "4px 8px" }} onClick={goBack}>{t("common.back")}</button>
              <h3 style={{ flex: 1, textAlign: "center" }}>{t("plus.purchase.step.confirm")}</h3>
              <button className="btn ghost" onClick={onClose}>✕</button>
            </div>

            {/* Card details if needed */}
            {currency !== "SPARKS" && selectedMethod?.needsCard && (
              <div className="xp-pay-body">
                <div className="xp-pay-field">
                  <label>{t("plus.payModal.cardNumber")}</label>
                  <input placeholder="0000 0000 0000 0000" value={card.number}
                    onChange={e => setCard(c => ({ ...c, number: formatCard(e.target.value) }))} maxLength={19} inputMode="numeric" autoFocus />
                </div>
                <div className="xp-pay-row">
                  <div className="xp-pay-field">
                    <label>{t("plus.payModal.expiry")}</label>
                    <input placeholder="MM/YY" value={card.expiry}
                      onChange={e => setCard(c => ({ ...c, expiry: formatExpiry(e.target.value) }))} maxLength={5} inputMode="numeric" />
                  </div>
                  <div className="xp-pay-field">
                    <label>{t("plus.payModal.cvv")}</label>
                    <input placeholder="•••" type="password" value={card.cvv}
                      onChange={e => setCard(c => ({ ...c, cvv: e.target.value.replace(/\D/g, "").slice(0, 3) }))} maxLength={3} inputMode="numeric" />
                  </div>
                </div>
                <div className="xp-pay-field">
                  <label>{t("plus.payModal.cardName")}</label>
                  <input placeholder="IVAN IVANOV" value={card.name}
                    onChange={e => setCard(c => ({ ...c, name: e.target.value.toUpperCase() }))} />
                </div>
              </div>
            )}

            {currency !== "SPARKS" && !selectedMethod?.needsCard && (
              <div className="pay-redirect-note">
                <div className="pay-redirect-icon">{selectedMethod?.icon}</div>
                <div>
                  <div className="pay-redirect-title">{t("plus.payModal.redirect.title", { method: selectedMethod?.label })}</div>
                  <div className="pay-redirect-desc">{t("plus.payModal.redirect.desc")}</div>
                </div>
              </div>
            )}

            {/* Summary */}
            <div className="purchase-summary">
              <div className="purchase-summary-row">
                <span>{t("plus.purchase.confirm.plan")}</span>
                <span style={{ color: planColor, fontWeight: 600 }}>{planIcon} {planLabel}</span>
              </div>
              <div className="purchase-summary-row">
                <span>{t("plus.purchase.confirm.duration")}</span>
                <span>{DURATIONS.find(d => d.value === months)?.label}</span>
              </div>
              {pricing.saved > 0 && (
                <div className="purchase-summary-row">
                  <span>{t("plus.purchase.confirm.price")}</span>
                  <span><s style={{ color: "var(--ink-faint)", marginRight: 4 }}>{sym}{pricing.raw.toLocaleString()}</s>{sym}{pricing.cost.toLocaleString()}</span>
                </div>
              )}
              {isUpgrade && currency === "SPARKS" && proration?.prorationDiscount > 0 && (
                <div className="purchase-summary-row" style={{ color: "var(--green, #4caf50)" }}>
                  <span>{t("plus.purchase.confirm.proration")}</span>
                  <span>− ✦{proration.prorationDiscount.toLocaleString()}</span>
                </div>
              )}
              <div className="purchase-summary-divider" />
              <div className="purchase-summary-row purchase-summary-total">
                <span>{t("plus.purchase.confirm.total")}</span>
                <span style={{ color: planColor, fontWeight: 700, fontSize: 16 }}>{sym}{finalCost.toLocaleString()}</span>
              </div>
              {currency === "SPARKS" && (
                <div className={`purchase-summary-balance ${canAffordSparks ? "ok" : "low"}`}>
                  <span>{t("plus.isub.yourBalance")} ✦{balance.toLocaleString()}</span>
                  <span className={canAffordSparks ? "iskra-ok" : "iskra-low"}>
                    {canAffordSparks ? `${t("plus.purchase.balance.after")} ✦${(balance - finalCost).toLocaleString()}` : t("plus.isub.insufficient")}
                  </span>
                </div>
              )}
              {isUpgrade && (
                <div className="purchase-summary-upgrade-note">
                  <ArrowUpCircle size={13}/> {t("plus.purchase.confirm.upgrade.note", { from: subscription?.tier === 1 ? "Plus" : "Plus", to: planLabel })}
                </div>
              )}
            </div>

            <div className="xp-pay-agree" onClick={() => setAgreed(v => !v)}>
              <div className={`xp-agree-box ${agreed ? "xp-agree-box-on" : ""}`}>
                {agreed && <Check size={11} strokeWidth={3}/>}
              </div>
              <span className="xp-agree-text">
                {t("plus.payModal.agreeText1")}{" "}
                <button className="xp-agree-link" onClick={e => { e.stopPropagation(); setShowTerms(true); }}>
                  {t("plus.payModal.agreeLink")}
                </button>
                {" "}{t("plus.payModal.agreeText2")}
              </span>
            </div>
            {showTerms && <TermsModal onClose={() => setShowTerms(false)} />}

            <div className="xp-pay-footer" style={{ marginTop: 4 }}>
              {currency !== "SPARKS" && (
                <div className="iskra-demo-note"><span>⚠️</span><span>{t("plus.buy.demo")}</span></div>
              )}
              <button className="btn accent" style={{ width: "100%", fontSize: 15, padding: "12px 0" }}
                onClick={submit} disabled={busy || !agreed || (currency === "SPARKS" && !canAffordSparks)}>
                {busy ? t("plus.isub.processing") : !canAffordSparks ? t("plus.isub.insufficient") : t("plus.purchase.payBtn", { cost: `${sym}${finalCost.toLocaleString()}` })}
              </button>
              {currency !== "SPARKS" && <div className="xp-pay-secure">{t("plus.payModal.secure")}</div>}
              <button className="xp-pay-cancel" onClick={onClose}>{t("common.cancel")}</button>
            </div>
          </>
        )}

        {/* PROCESSING */}
        {step === "processing" && (
          <div className="pay-processing">
            <div className="pay-spin" />
            <div className="pay-proc-title">{t("plus.payModal.processing.title")}</div>
            <div className="pay-proc-sub">{t("plus.dontClose")}</div>
          </div>
        )}

        {/* DONE */}
        {step === "done" && (
          <div className="pay-done">
            <div className="pay-done-check">✓</div>
            <div className="pay-done-title">
              {isUpgrade ? t("plus.purchase.done.upgrade", { plan: planLabel }) : t("plus.purchase.done.new", { plan: planLabel })}
            </div>
            {currency === "SPARKS" && doneResult?.balance !== undefined && (
              <div className="pay-done-sub">{t("plus.buy.done.balance")} {iskraPlural(doneResult.balance, t)}</div>
            )}
            <button className="btn accent" style={{ marginTop: 20, width: "100%", padding: "12px 0" }} onClick={onClose}>
              {t("plus.buy.done.ok")}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

// ─── Gift Modal ───────────────────────────────────────────────
// Supports gifting subscription OR Sparks, with Sparks or fiat payment
function GiftModal({ token, balance, onClose, onSuccess, me }) {
  const t = useT();
  const DURATIONS = makeDurations(t);
  const PAY_METHODS = getPayMethods(t);
  const PACKAGES = makePackages(t);
  const toast = useToast();

  const [giftType, setGiftType] = useState("sub"); // "sub" | "sparks"
  const [handle, setHandle] = useState("");
  const [resolvedName, setResolvedName] = useState(null);
  const [plan, setPlan] = useState("plus");
  const [months, setMonths] = useState(1);
  const [sparksPkg, setSparksPkg] = useState(null); // for gifting sparks
  const [message, setMessage] = useState("");
  const [currency, setCurrency] = useState("RUB");
  const [method, setMethod] = useState("sbp");
  const [card, setCard] = useState({ number: "", expiry: "", cvv: "", name: "" });
  const [agreed, setAgreed] = useState(false);
  const [step, setStep] = useState("form"); // form|currency|payment|confirm|processing|done
  const [busy, setBusy] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSugg, setShowSugg] = useState(false);
  const [doneResult, setDoneResult] = useState(null);

  const cleanHandle = handle.replace(/^@/, "").trim();

  useEffect(() => {
    if (cleanHandle.length < 1) { setSuggestions([]); return; }
    const timer = setTimeout(async () => {
      try {
        const r = await api(`/users/search?q=${encodeURIComponent(cleanHandle)}`, { token });
        setSuggestions((r || []).filter(u => u.handle !== me?.handle).slice(0, 5));
        setShowSugg(true);
      } catch { setSuggestions([]); }
    }, 250);
    return () => clearTimeout(timer);
  }, [cleanHandle, token]);

  const pickSugg = (u) => {
    setHandle(u.handle);
    setResolvedName(u.name);
    setSuggestions([]);
    setShowSugg(false);
  };

  const subPricing = calcCost(plan, currency, months);
  const sparksCost = currency === "SPARKS" && giftType === "sparks" ? (sparksPkg?.iskra || 0) : 0;
  const subCost = currency === "SPARKS" && giftType === "sub" ? subPricing.cost : 0;
  const totalSparksCost = giftType === "sub" ? subCost : sparksCost;
  const canAfford = currency !== "SPARKS" || balance >= totalSparksCost;
  const sym = SYM[currency];
  const selectedMethod = PAY_METHODS.find(m => m.id === method);

  const PLAN_INFO = {
    plus:    { label: "Xalle Plus",    color: "var(--accent)", emoji: "✦" },
    premium: { label: "Xalle Premium", color: "#818cf8",       emoji: "◆" },
  };

  const isFormValid = cleanHandle && (giftType === "sub" ? true : (currency === "SPARKS" ? !!sparksPkg : !!sparksPkg));

  const goToNext = () => {
    if (step === "form") { setStep("currency"); return; }
    if (step === "currency") { setStep(currency === "SPARKS" ? "confirm" : "payment"); return; }
    if (step === "payment") { setStep("confirm"); return; }
  };

  const goBack = () => {
    if (step === "currency") { setStep("form"); return; }
    if (step === "payment") { setStep("currency"); return; }
    if (step === "confirm") { setStep(currency === "SPARKS" ? "currency" : "payment"); return; }
  };

  const formatCard = (v) => v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
  const formatExpiry = (v) => { const d = v.replace(/\D/g, "").slice(0, 4); return d.length > 2 ? d.slice(0, 2) + "/" + d.slice(2) : d; };

  const submit = async () => {
    if (!agreed) return;
    setBusy(true);
    setStep("processing");
    try {
      let r;
      if (giftType === "sub") {
        r = await api("/iskra/gift-subscribe", { method: "POST", token, body: { toHandle: cleanHandle, plan, months, message: message.trim(), currency, payMethod: method } });
      } else {
        r = await api("/iskra/gift-sparks", { method: "POST", token, body: { toHandle: cleanHandle, amount: sparksPkg?.iskra, message: message.trim(), currency, payMethod: method } });
      }
      setDoneResult(r);
      onSuccess?.(r.balance);
      setStep("done");
    } catch (e) {
      toast(e.message || t("common.error"), { type: "error" });
      setStep("confirm");
    } finally { setBusy(false); }
  };

  const CURRENCY_OPTIONS = [
    { id: "RUB",    label: t("plus.purchase.currency.rub"),    sym: "₽" },
    { id: "USD",    label: t("plus.purchase.currency.usd"),    sym: "$" },
    { id: "EUR",    label: t("plus.purchase.currency.eur"),    sym: "€" },
    { id: "SPARKS", label: t("plus.purchase.currency.sparks"), sym: "✦" },
  ];

  const giftCostLabel = () => {
    if (giftType === "sub") {
      const p = calcCost(plan, currency, months);
      return `${sym}${p.cost.toLocaleString()}`;
    }
    if (!sparksPkg) return "—";
    if (currency === "SPARKS") return `✦${sparksPkg.iskra.toLocaleString()}`;
    return `${sym}${sparksPkg.price}`;
  };

  return createPortal(
    <div className="modal-overlay fade-in" onClick={step === "done" ? onClose : undefined}>
      <div className="modal iskra-sub-modal pop-in" onClick={e => e.stopPropagation()}>

        {/* FORM STEP */}
        {step === "form" && (
          <>
            <div className="iskra-sub-modal-head">
              <div className="iskra-sub-modal-icon">🎁</div>
              <div className="iskra-sub-modal-headtext">
                <div className="iskra-sub-modal-title">{t("plus.gift.title")}</div>
              </div>
              <button className="btn ghost iskra-sub-modal-close" onClick={onClose}>✕</button>
            </div>

            <div style={{ padding: "0 20px 4px" }}>
              {/* Gift type toggle */}
              <div className="gift-type-row">
                <button className={`gift-type-btn ${giftType === "sub" ? "sel" : ""}`} onClick={() => setGiftType("sub")}>
                  {t("plus.gift.type.sub")}
                </button>
                <button className={`gift-type-btn ${giftType === "sparks" ? "sel" : ""}`} onClick={() => setGiftType("sparks")}>
                  ✦ {t("plus.gift.type.sparks")}
                </button>
              </div>

              {/* Sub: plan + duration */}
              {giftType === "sub" && (
                <>
                  <div className="gift-plan-row" style={{ marginTop: 12 }}>
                    {["plus", "premium"].map(p => {
                      const pi = PLAN_INFO[p];
                      const sel = plan === p;
                      return (
                        <button key={p} className={`gift-plan-btn ${sel ? "gift-plan-sel" : ""}`}
                          style={sel ? { borderColor: pi.color, background: `color-mix(in srgb, ${pi.color} 10%, var(--surface))` } : {}}
                          onClick={() => setPlan(p)}>
                          <span className="gift-plan-ico" style={{ color: pi.color }}>{pi.emoji}</span>
                          <span className="gift-plan-name">{pi.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="gift-months-row" style={{ marginTop: 10 }}>
                    {DURATIONS.map(d => (
                      <button key={d.value} className={`gift-months-btn ${months === d.value ? "sel" : ""}`}
                        onClick={() => setMonths(d.value)}>
                        {d.label}
                        {DISCOUNT_PCT[d.value] > 0 && <span className="gift-months-disc">−{DISCOUNT_PCT[d.value]}%</span>}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* Sparks: package picker */}
              {giftType === "sparks" && (
                <div className="iskra-pkgs" style={{ marginTop: 10 }}>
                  {PACKAGES.map(p => (
                    <button key={p.id} className={`iskra-pkg ${sparksPkg?.id === p.id ? "iskra-pkg-on" : ""} ${p.popular ? "iskra-pkg-popular" : ""}`}
                      onClick={() => setSparksPkg(p)}>
                      {p.popular && <span className="iskra-popular-tag">{t("plus.pkg.popular")}</span>}
                      <div className="iskra-pkg-ico">✦</div>
                      <div className="iskra-pkg-n">{p.iskra}</div>
                      <div className="iskra-pkg-label">{p.label}</div>
                      <div className="iskra-pkg-price">{p.price} ₽</div>
                      {sparksPkg?.id === p.id && <div className="iskra-pkg-check"><Check size={13}/></div>}
                    </button>
                  ))}
                </div>
              )}

              {/* Recipient */}
              <label className="gift-field-label" style={{ marginTop: 14 }}>{t("plus.gift.recipient")}</label>
              <div className="gift-handle-wrap">
                <input
                  className="mp-input"
                  placeholder={t("plus.gift.handlePlaceholder")}
                  value={handle}
                  onChange={e => { setHandle(e.target.value); setResolvedName(null); }}
                  onFocus={() => suggestions.length > 0 && setShowSugg(true)}
                  onBlur={() => setTimeout(() => setShowSugg(false), 150)}
                  style={{ width: "100%", marginBottom: 0 }}
                />
                {showSugg && suggestions.length > 0 && (
                  <div className="mention-dropdown gift-sugg-drop">
                    {suggestions.map(u => (
                      <button key={u.handle} className="mention-item" onMouseDown={() => pickSugg(u)}>
                        {u.avatar_url
                          ? <img src={assetUrl(u.avatar_url)} className="mention-av av-img" alt={u.name} />
                          : <div className="mention-av">{(u.name || "?")[0].toUpperCase()}</div>
                        }
                        <div>
                          <div className="mention-name">{u.name}</div>
                          <div className="mention-handle">@{u.handle}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Message */}
              <label className="gift-field-label" style={{ marginTop: 10 }}>{t("plus.gift.msgOptional")}</label>
              <textarea
                className="mp-input"
                placeholder={t("plus.gift.msgPlaceholder")}
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={2}
                maxLength={200}
                style={{ width: "100%", resize: "none", marginBottom: 0 }}
              />
            </div>

            <div className="xp-pay-footer" style={{ marginTop: 4 }}>
              <button className="btn accent" style={{ width: "100%", fontSize: 15, padding: "12px 0" }}
                onClick={goToNext} disabled={!cleanHandle || (giftType === "sparks" && !sparksPkg)}>
                {t("plus.gift.continue")} <ChevronRight size={16} style={{ display: "inline", marginLeft: 4, verticalAlign: "middle" }}/>
              </button>
              <button className="xp-pay-cancel" onClick={onClose}>{t("common.cancel")}</button>
            </div>
          </>
        )}

        {/* CURRENCY STEP */}
        {step === "currency" && (
          <>
            <div className="xp-pay-head">
              <button className="btn ghost" style={{ padding: "4px 8px" }} onClick={goBack}>{t("common.back")}</button>
              <h3 style={{ flex: 1, textAlign: "center" }}>{t("plus.purchase.step.currency")}</h3>
              <button className="btn ghost" onClick={onClose}>✕</button>
            </div>
            <div className="iskra-modal-section" style={{ margin: "4px 0 6px" }}>
              <div className="purchase-currency-grid">
                {CURRENCY_OPTIONS.map(c => (
                  <button key={c.id} className={`purchase-currency-opt ${currency === c.id ? "sel" : ""}`}
                    onClick={() => setCurrency(c.id)}>
                    <span className="purchase-currency-sym">{c.sym}</span>
                    <div className="purchase-currency-info">
                      <div className="purchase-currency-name">{c.label}</div>
                      {c.id === "SPARKS" && (
                        <div className="purchase-currency-bal">{t("plus.isub.yourBalance")}: <b>{iskraPlural(balance, t)}</b></div>
                      )}
                    </div>
                    {currency === c.id && <Check size={14} className="purchase-currency-check"/>}
                  </button>
                ))}
              </div>
            </div>
            <div className="xp-pay-footer">
              <button className="btn accent" style={{ width: "100%", fontSize: 15, padding: "12px 0" }} onClick={goToNext}>
                {t("plus.payModal.continue")} <ChevronRight size={16} style={{ display: "inline", marginLeft: 4, verticalAlign: "middle" }}/>
              </button>
              <button className="xp-pay-cancel" onClick={onClose}>{t("common.cancel")}</button>
            </div>
          </>
        )}

        {/* PAYMENT STEP */}
        {step === "payment" && (
          <>
            <div className="xp-pay-head">
              <button className="btn ghost" style={{ padding: "4px 8px" }} onClick={goBack}>{t("common.back")}</button>
              <h3 style={{ flex: 1, textAlign: "center" }}>{t("plus.payModal.payMethod")}</h3>
              <button className="btn ghost" onClick={onClose}>✕</button>
            </div>
            <div className="xp-pay-plan">
              <div>
                <div className="xp-pay-plan-name">🎁 @{cleanHandle}</div>
                <div className="xp-pay-plan-per">{giftType === "sub" ? PLAN_INFO[plan].label : "✦ Искорки"}</div>
              </div>
              <div className="xp-pay-plan-price">{giftCostLabel()}</div>
            </div>
            <div className="iskra-modal-section" style={{ margin: "14px 0 6px" }}>
              <div className="iskra-methods">
                {PAY_METHODS.map(m => (
                  <button key={m.id} className={`iskra-method ${method === m.id ? "iskra-method-on" : ""}`}
                    onClick={() => setMethod(m.id)}>
                    <span className="iskra-method-icon">{m.icon}</span>
                    <div className="iskra-method-info">
                      <div className="iskra-method-name">{m.label}</div>
                      <div className="iskra-method-desc">{m.desc}</div>
                    </div>
                    {method === m.id && <Check size={14} className="iskra-method-check"/>}
                  </button>
                ))}
              </div>
            </div>
            <div className="xp-pay-footer">
              <button className="btn accent" style={{ width: "100%", fontSize: 15, padding: "12px 0" }} onClick={goToNext} disabled={!method}>
                {t("plus.payModal.continue")} <ChevronRight size={16} style={{ display: "inline", marginLeft: 4, verticalAlign: "middle" }}/>
              </button>
              <button className="xp-pay-cancel" onClick={onClose}>{t("common.cancel")}</button>
            </div>
          </>
        )}

        {/* CONFIRM STEP */}
        {step === "confirm" && (
          <>
            <div className="iskra-sub-modal-head">
              <div className="iskra-sub-modal-icon">🎁</div>
              <div className="iskra-sub-modal-headtext">
                <div className="iskra-sub-modal-title">{t("plus.gift.confirm.title")}</div>
              </div>
              <button className="btn ghost iskra-sub-modal-close" onClick={onClose}>✕</button>
            </div>

            {currency !== "SPARKS" && selectedMethod?.needsCard && (
              <div className="xp-pay-body">
                <div className="xp-pay-field">
                  <label>{t("plus.payModal.cardNumber")}</label>
                  <input placeholder="0000 0000 0000 0000" value={card.number}
                    onChange={e => setCard(c => ({ ...c, number: formatCard(e.target.value) }))} maxLength={19} inputMode="numeric" autoFocus />
                </div>
                <div className="xp-pay-row">
                  <div className="xp-pay-field">
                    <label>{t("plus.payModal.expiry")}</label>
                    <input placeholder="MM/YY" value={card.expiry}
                      onChange={e => setCard(c => ({ ...c, expiry: formatExpiry(e.target.value) }))} maxLength={5} inputMode="numeric" />
                  </div>
                  <div className="xp-pay-field">
                    <label>{t("plus.payModal.cvv")}</label>
                    <input placeholder="•••" type="password" value={card.cvv}
      onChange={e => setCard(c => ({ ...c, cvv: e.target.value.replace(/\D/g, "").slice(0, 3) }))} maxLength={3} inputMode="numeric" />
                  </div>
                </div>
                <div className="xp-pay-field">
                  <label>{t("plus.payModal.cardName")}</label>
                  <input placeholder="IVAN IVANOV" value={card.name}
                    onChange={e => setCard(c => ({ ...c, name: e.target.value.toUpperCase() }))} />
                </div>
              </div>
            )}

            <div className="gift-confirm-body">
              <div className="gift-confirm-row">
                <span className="gift-confirm-label">{t("plus.gift.recipient")}</span>
                <span className="gift-confirm-val">@{cleanHandle}{resolvedName && ` (${resolvedName})`}</span>
              </div>
              {giftType === "sub" ? (
                <>
                  <div className="gift-confirm-row">
                    <span className="gift-confirm-label">{t("plus.gift.plan")}</span>
                    <span className="gift-confirm-val" style={{ color: PLAN_INFO[plan].color }}>{PLAN_INFO[plan].emoji} {PLAN_INFO[plan].label}</span>
                  </div>
                  <div className="gift-confirm-row">
                    <span className="gift-confirm-label">{t("plus.gift.duration")}</span>
                    <span className="gift-confirm-val">{DURATIONS.find(d => d.value === months)?.label || `${months}`}</span>
                  </div>
                </>
              ) : (
                <div className="gift-confirm-row">
                  <span className="gift-confirm-label">{t("plus.gift.type.sparks")}</span>
                  <span className="gift-confirm-val">✦ {sparksPkg?.iskra?.toLocaleString()}</span>
                </div>
              )}
              <div className="gift-confirm-row">
                <span className="gift-confirm-label">{t("plus.gift.cost")}</span>
                <span className="gift-confirm-val">{giftCostLabel()}</span>
              </div>
              {currency === "SPARKS" && (
                <div className={`gift-confirm-row ${canAfford ? "" : "iskra-low"}`} style={{ color: canAfford ? undefined : "var(--like)" }}>
                  <span className="gift-confirm-label">{t("plus.gift.willRemain")}</span>
                  <span className="gift-confirm-val">{canAfford ? `✦ ${(balance - totalSparksCost).toLocaleString()}` : t("plus.gift.notEnough")}</span>
                </div>
              )}
              {message.trim() && (
                <div className="gift-confirm-msg">
                  <span className="gift-confirm-label">{t("plus.gift.messageLabel")}</span>
                  <span className="gift-confirm-msg-text">«{message.trim()}»</span>
                </div>
              )}
              <div className="gift-confirm-terms">{t("plus.gift.terms")}</div>
            </div>

            <div className="xp-pay-agree" onClick={() => setAgreed(v => !v)}>
              <div className={`xp-agree-box ${agreed ? "xp-agree-box-on" : ""}`}>
                {agreed && <Check size={11} strokeWidth={3}/>}
              </div>
              <span className="xp-agree-text">{t("plus.isub.noRefund1")} <b>{t("plus.isub.noRefundBold")}</b> {t("plus.isub.noRefund2")}</span>
            </div>

            <div className="xp-pay-footer" style={{ marginTop: 4 }}>
              {currency !== "SPARKS" && <div className="iskra-demo-note"><span>⚠️</span><span>{t("plus.buy.demo")}</span></div>}
              <button className="btn accent" style={{ width: "100%" }} onClick={submit}
                disabled={busy || !agreed || (currency === "SPARKS" && !canAfford)}>
                {busy ? t("plus.gift.sending") : t("plus.gift.confirmBtn", { cost: giftCostLabel() })}
              </button>
              <button className="xp-pay-cancel" onClick={goBack}>{t("common.back")}</button>
            </div>
          </>
        )}

        {/* PROCESSING */}
        {step === "processing" && (
          <div className="pay-processing">
            <div className="pay-spin" />
            <div className="pay-proc-title">{t("plus.payModal.processing.title")}</div>
            <div className="pay-proc-sub">{t("plus.dontClose")}</div>
          </div>
        )}

        {/* DONE */}
        {step === "done" && (
          <div className="iskra-done" style={{ padding: "36px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 52, marginBottom: 8 }}>🎁</div>
            <h3 style={{ fontSize: 20, marginBottom: 6 }}>{t("plus.gift.done.title")}</h3>
            <p style={{ color: "var(--ink-soft)", marginBottom: 4 }}>
              {giftType === "sub"
                ? t("plus.gift.done.msg", { handle: cleanHandle, plan: PLAN_INFO[plan].label, dur: DURATIONS.find(d => d.value === months)?.label || `${months}` })
                : t("plus.gift.sparks.done.msg", { handle: cleanHandle, amount: sparksPkg?.iskra?.toLocaleString() })}
            </p>
            {currency === "SPARKS" && doneResult?.balance !== undefined && (
              <p style={{ color: "var(--ink-faint)", fontSize: 13, marginBottom: 20 }}>
                {t("plus.gift.done.balance")} <b>{iskraPlural(doneResult.balance, t)}</b>
              </p>
            )}
            <button className="btn accent" style={{ width: "100%" }} onClick={onClose}>{t("plus.buy.done.ok")}</button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

// ─── Main Component ───────────────────────────────────────────
export default function XallePlus({ me, token, onMeUpdate }) {
  const t = useT();
  const LEVELS = makeLevels(t);
  const FULL_PERKS = makeFullPerks(t);

  const [purchasePlan, setPurchasePlan] = useState(null); // "plus" | "premium"
  const [buyIskra, setBuyIskra] = useState(false);
  const [giftOpen, setGiftOpen] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const [iskraBalance, setIskraBalance] = useState(0);
  const [loadingSub, setLoadingSub] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();

  const loadSubData = () => {
    if (!token) return;
    Promise.all([
      api("/subscription", { token }),
      api("/iskra/balance", { token }),
    ]).then(([sub, isk]) => {
      setSubscription(sub);
      setIskraBalance(isk.balance || 0);
    }).catch(() => {});
  };

  useEffect(() => {
    setLoadingSub(true);
    loadSubData();
    setLoadingSub(false);
  }, [token]);

  // Real-time sync: refresh when WS notifies about subscription change
  useEffect(() => {
    const h = () => loadSubData();
    window.addEventListener("subscription:updated", h);
    return () => window.removeEventListener("subscription:updated", h);
  }, [token]);

  const cancelSub = async () => {
    if (!(await confirm({ title: t("plus.cancel.title"), message: t("plus.cancel.msg"), danger: true, okText: t("plus.cancel.ok") }))) return;
    try {
      await api("/subscription", { method: "DELETE", token });
      setSubscription(s => ({ ...s, canceled: true }));
      toast(t("plus.cancel.toast"), { type: "info" });
    } catch (e) { toast(e.message, { type: "error" }); }
  };

  const handlePurchaseSuccess = (r) => {
    if (r?.balance !== undefined) setIskraBalance(r.balance);
    // Refresh sub state from server
    api("/subscription", { token }).then(setSubscription).catch(() => {});
    onMeUpdate?.();
  };

  const tier = subscription?.tier || 0;
  const active = subscription?.active;

  // Button logic per plan
  const getPlanButton = (planName) => {
    const planTier = planName === "premium" ? 4 : 1;
    if (active && tier >= planTier) return null; // Active — no button
    if (active && tier > 0 && planTier > tier) {
      return (
        <div className="xp-plan-btns">
          <button className="btn accent xp-btn" onClick={() => setPurchasePlan(planName)}>
            <ArrowUpCircle size={15}/> {t("plus.plan.upgrade")}
          </button>
        </div>
      );
    }
    return (
      <div className="xp-plan-btns">
        <button className="btn accent xp-btn" onClick={() => setPurchasePlan(planName)}>
          {t("plus.plan.subscribe")}
        </button>
      </div>
    );
  };

  return (
    <div className="screen xp-screen">
      <div className="card iskra-combo-card">
        <div className="iskra-combo-top">
          <div className="iskra-header">
            <div className="iskra-header-left">
              <div className="iskra-icon">✦</div>
              <div>
                <div className="iskra-title">{t("plus.iskraBox.title")}</div>
                <div className="iskra-subtitle">{t("plus.iskraBox.subtitle")}</div>
              </div>
            </div>
            <div className="iskra-balance-badge">
              <span className="iskra-balance-val">{iskraPlural(iskraBalance, t)}</span>
            </div>
          </div>
          <div className="iskra-perks-row">
            <div className="iskra-perk"><span>✦</span>{t("plus.iskraBox.perk1")}</div>
            <div className="iskra-perk"><span>✦</span>{t("plus.iskraBox.perk2")}</div>
            <div className="iskra-perk"><span>✦</span>{t("plus.iskraBox.perk3")}</div>
          </div>
          <div className="iskra-btn-row">
            <button className="btn accent iskra-buy-btn" onClick={() => setBuyIskra(true)}>
              <Sparkles size={15}/> {t("plus.iskraBox.buyBtn")}
            </button>
            <button className="btn ghost iskra-gift-btn" onClick={() => setGiftOpen(true)}>
              <Gift size={15}/> {t("plus.iskraBox.giftBtn")}
            </button>
          </div>
        </div>

        <div className="iskra-combo-divider" />

        <div className="iskra-combo-sub">
          <div className="iskra-combo-sub-label">{t("plus.mySubBox.label")}</div>
          {loadingSub ? (
            <div className="iskra-combo-tier" style={{ color: "var(--ink-faint)" }}>{t("plus.mySubBox.loading")}</div>
          ) : (
            <>
              <div className="iskra-combo-tier-row">
                <div className="iskra-combo-tier" style={tier > 0 ? { color: TIER_COLORS[tier] || "var(--accent)" } : {}}>
                  {t(`plus.tier.${tier}`)}
                </div>
                {tier > 0 && <SubBadge tier={tier} grantedAt={subscription?.grantedAt} />}
              </div>
              {active && subscription?.expires && (
                <div className="iskra-combo-expires">
                  {subscription.canceled ? t("plus.mySubBox.canceled") : t("plus.mySubBox.activeUntil")}<b>{subscription.expires?.slice(0, 10)}</b>
                </div>
              )}
              {active && !subscription?.canceled && (
                <button className="btn ghost xp-cancel-btn" style={{ marginTop: 4 }} onClick={cancelSub}>{t("plus.mySubBox.cancelBtn")}</button>
              )}
              {!active && (
                <div className="iskra-combo-cta">{t("plus.mySubBox.cta")}</div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="xp-plans">
        {/* Plus Plan */}
        <div className="xp-plan card">
          <div className="xp-plan-head">
            <div className="xp-plan-name"><span className="xp-plan-logo">Xalle <span className="xp-p">Plus</span></span></div>
            <div className="xp-plan-price">
              <span className="xp-price">99 ₽</span><span className="xp-per">{t("plus.plan.perMonth")}</span>
            </div>
          </div>
          <div className="iskra-sub-price-alt">
            {t("plus.plan.orIskra")} <span className="iskra-spark-ico">✦</span> {iskraPlural(SPARKS_BASE.plus, t)} {t("plus.isub.perMonth")}
          </div>
          <p className="xp-plan-desc">{t("plus.plan.plus.desc")}</p>
          {active && tier >= 1 && tier < 4 && (
            <div className="xp-active-tag">{t("plus.plan.active")}</div>
          )}
          {getPlanButton("plus")}
          <div className="xp-levels">
            {LEVELS.map(lv => (
              <div key={lv.num} className={`xp-level ${tier === lv.num ? "active-tier" : ""}`}>
                <div className="xp-level-head">
                  <span className={`xp-level-icon ${lv.iconClass}`}>{lv.icon}</span>
                  <div>
                    <div className="xp-level-title">{t("plus.level.title", { n: lv.num })}<span className="xp-level-range-inline">{lv.range}</span></div>
                    <div className="xp-level-badge-preview">
                      <span className="xp-level-badge-name">Имя</span>
                      <SubBadge tier={lv.num} />
                    </div>
                  </div>
                  {tier === lv.num && <span className="xp-tier-active-badge">{t("plus.level.yours")}</span>}
                </div>
                <ul className="xp-level-perks">{lv.perks.map((p, i) => <li key={i}><span className="xp-check">✓</span>{p}</li>)}</ul>
              </div>
            ))}
          </div>
        </div>

        {/* Premium Plan */}
        <div className={`xp-plan xp-full card ${tier === 4 ? "active-tier-card" : ""}`}>
          <div className="xp-full-badge">{t("plus.premium.maxBadge")}</div>
          <div className="xp-plan-head">
            <div className="xp-plan-name"><span className="xp-plan-logo">Xalle</span><span className="xp-full-tag">Premium</span><SubBadge tier={4} /></div>
            <div className="xp-plan-price"><span className="xp-price">299 ₽</span><span className="xp-per">{t("plus.plan.perMonth")}</span></div>
          </div>
          <div className="iskra-sub-price-alt">
            {t("plus.plan.orIskra")} <span className="iskra-spark-ico">✦</span> {iskraPlural(SPARKS_BASE.premium, t)} {t("plus.isub.perMonth")}
          </div>
          <p className="xp-plan-desc">{t("plus.plan.premium.desc")}</p>
          {tier === 4 && <div className="xp-active-tag">{t("plus.premium.active")}</div>}
          {getPlanButton("premium")}
          <div className="xp-full-includes">
            <div className="xp-fi-title">{t("plus.premium.includes")}</div>
            <div className="xp-full-perks">
              {FULL_PERKS.map((p, i) => (
                <div key={i} className="xp-full-perk">
                  <div className="xp-fp-ico-wrap">{p.icon}</div>
                  <div><div className="xp-fp-title">{p.title}</div><div className="xp-fp-desc">{p.desc}</div></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {buyIskra && (
        <BuyIskraModal token={token} balance={iskraBalance} onClose={() => setBuyIskra(false)}
          onSuccess={(bal) => setIskraBalance(bal)} />
      )}
      {giftOpen && (
        <GiftModal token={token} balance={iskraBalance} onClose={() => setGiftOpen(false)}
          onSuccess={(bal) => { if (bal !== undefined) setIskraBalance(bal); }} me={me} />
      )}
      {purchasePlan && (
        <PurchaseModal plan={purchasePlan} token={token} balance={iskraBalance} subscription={subscription}
          onClose={() => setPurchasePlan(null)} onSuccess={handlePurchaseSuccess} />
      )}
    </div>
  );
}
