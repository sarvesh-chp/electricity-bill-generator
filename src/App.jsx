import { useState, useEffect, useRef } from 'react';
import { DEFAULT_CFG, parseMessage, buildMessage } from './calc.js';

const KEY = 'bill-cfg-v1';
const PHONE_ERROR = 'Set the contact number in Settings.';
const load = () => {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === null) return { config: DEFAULT_CFG, feedback: { type: 'success', text: 'Default settings loaded.' } };
    const config = JSON.parse(saved);
    if (config && config.people && config.people.length === DEFAULT_CFG.people.length)
      return { config, feedback: { type: 'success', text: 'Saved settings loaded.' } };
    return { config: DEFAULT_CFG, feedback: { type: 'error', text: 'Saved settings were invalid. Default settings loaded.' } };
  } catch {
    return { config: DEFAULT_CFG, feedback: { type: 'error', text: 'Could not load saved settings. Default settings loaded.' } };
  }
};
const ok = (v) => String(v).trim() !== '' && Number.isFinite(Number(v)) && Number(v) >= 0;

function Feedback({ feedback }) {
  if (!feedback) return null;
  return <p className={`feedback ${feedback.type}`} role={feedback.type === 'error' ? 'alert' : 'status'}>{feedback.text}</p>;
}

export default function App() {
  const [initialState] = useState(load);
  const [cfg, setCfg] = useState(initialState.config);
  const [view, setView] = useState('main');
  const [msg, setMsg] = useState('');
  const [bills, setBills] = useState({ old: '', new: '', water: '1320' });
  const [errors, setErrors] = useState([]);
  const [out, setOut] = useState(null);
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState(initialState.feedback);
  const initialRender = useRef(true);

  useEffect(() => {
    if (initialRender.current) {
      initialRender.current = false;
      return;
    }
    try {
      localStorage.setItem(KEY, JSON.stringify(cfg));
      setFeedback({ type: 'success', text: 'Settings updated and saved.' });
    } catch {
      setFeedback({ type: 'error', text: 'Settings changed, but could not be saved in this browser.' });
    }
  }, [cfg]);

  const setP = (i, k, v) => setCfg({ ...cfg, people: cfg.people.map((p, j) => (j === i ? { ...p, [k]: v } : p)) });

  function generate(e) {
    e.preventDefault();
    const errs = [];
    if (!msg.trim()) errs.push('Paste the message.');
    if (!ok(bills.old) || !ok(bills.new) || !ok(bills.water)) errs.push('Old meter bill, new meter bill and water bill are required numbers.');
    if (!cfg.phone.trim()) errs.push(PHONE_ERROR);
    if (![cfg.fixedStd, cfg.taxRate, cfg.dueDay, ...cfg.people.flatMap((p) => [p.fixed, p.tax])].every(ok))
      errs.push('Every value in Settings must be a number.');
    let res = null;
    if (!errs.length) {
      try { res = buildMessage(parseMessage(msg), cfg, { old: +bills.old, new: +bills.new, water: +bills.water }); }
      catch (x) { errs.push(x.message); }
    }
    setErrors(errs); setOut(res); setCopied(false);
    setFeedback(res
      ? { type: 'success', text: 'Bill calculated successfully.' }
      : { type: 'error', text: 'Calculation failed. Review the errors below and try again.' });
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(out.text);
      setCopied(true);
      setFeedback({ type: 'success', text: 'Message copied to clipboard.' });
    } catch {
      setCopied(false);
      setFeedback({ type: 'error', text: 'Could not copy the message. Check clipboard permissions and try again.' });
    }
  }

  if (view === 'settings') {
    return (
      <main className="settings">
        <h2>Settings</h2>
        <Feedback feedback={feedback} />
        <label>Contact number (shown in the message) *</label>
        <input required value={cfg.phone} onChange={(e) => {
          const phone = e.target.value;
          setCfg({ ...cfg, phone });
          if (phone.trim()) setErrors((current) => current.filter((error) => error !== PHONE_ERROR));
        }} />
        <div className="row settings-grid">
          <div><label>Standard fixed charge *</label><input type="number" step="any" value={cfg.fixedStd} onChange={(e) => setCfg({ ...cfg, fixedStd: e.target.value })} /></div>
          <div><label>Tax per sq ft *</label><input type="number" step="any" value={cfg.taxRate} onChange={(e) => setCfg({ ...cfg, taxRate: e.target.value })} /></div>
          <div><label>Due day of month *</label><input type="number" value={cfg.dueDay} onChange={(e) => setCfg({ ...cfg, dueDay: e.target.value })} /></div>
        </div>
        <h3>Per person</h3>
        <div className="table-wrap">
        <table className="settings-table"><thead><tr><th scope="col">Person</th><th scope="col">Fixed charge ₹</th><th scope="col">Municipal tax ₹</th></tr></thead><tbody>
          {cfg.people.map((p, i) => (
            <tr key={p.key}><td>{p.hi}</td>
              <td data-label="Fixed charge ₹"><input aria-label={`${p.hi} fixed charge`} type="number" step="any" value={p.fixed} onChange={(e) => setP(i, 'fixed', e.target.value)} /></td>
              <td data-label="Municipal tax ₹"><input aria-label={`${p.hi} municipal tax`} type="number" step="any" value={p.tax} onChange={(e) => setP(i, 'tax', e.target.value)} /></td></tr>
          ))}</tbody></table>
        </div>
        <div className="settings-actions">
        <button onClick={() => setView('main')}>Done</button>
        <button className="alt" onClick={() => {
          if (confirm('Reset all settings to defaults?'))
            setCfg({ ...DEFAULT_CFG, people: DEFAULT_CFG.people.map((person) => ({ ...person })) });
        }}>Reset to defaults</button>
        </div>
      </main>
    );
  }

  return (
    <form className="calculator" onSubmit={generate}>
      <h2>Bill Calculator <button type="button" className="alt" onClick={() => {
        setFeedback({ type: 'success', text: 'Settings loaded.' });
        setView('settings');
      }}>Settings</button></h2>
      <label>Message *</label>
      <textarea required value={msg} onChange={(e) => { setMsg(e.target.value); setFeedback(null); }} placeholder={'25/10/2026\n-----\nRajkumar ---- 16\n...'} />
      <div className="row">
        <div><label>Old meter bill ₹ *</label><input required type="number" step="any" min="0" value={bills.old} onChange={(e) => { setBills({ ...bills, old: e.target.value }); setFeedback(null); }} /></div>
        <div><label>New meter bill ₹ *</label><input required type="number" step="any" min="0" value={bills.new} onChange={(e) => { setBills({ ...bills, new: e.target.value }); setFeedback(null); }} /></div>
        <div><label>Water bill ₹ *</label><input required type="number" step="any" min="0" value={bills.water} onChange={(e) => { setBills({ ...bills, water: e.target.value }); setFeedback(null); }} /></div>
      </div>
      <button type="submit">Calculate</button>
      <Feedback feedback={feedback} />
      {errors.map((x) => <div className="err" key={x}>{x}</div>)}
      {out && (<>
        <p>{out.summary}</p>
        <pre>{out.text}</pre>
        <button type="button" onClick={copy}>{copied ? 'Copied ✓' : 'Copy message'}</button>
      </>)}
    </form>
  );
}
