export const DEFAULT_CFG = {
  phone: '', fixedStd: 203.05, taxRate: 0.716, dueDay: 10,
  people: [
    { key: 'rajkumar', hi: 'राजकुमार', fixed: 203.05, tax: 880 },
    { key: 'sanjay', hi: 'संजय', fixed: 203.05, tax: 701 },
    { key: 'nakul', hi: 'नकुल', fixed: 203.05, tax: 443 },
    { key: 'vikash', hi: 'विकास', fixed: 114.93, tax: 423 },
    { key: 'harshit', hi: 'हर्षित', fixed: 114.93, tax: 400 },
    { key: 'shyamsundar', hi: 'श्यामसुंदर', fixed: 203.05, tax: 768 },
    { key: 'jitendar', hi: 'जितेन्द्र', fixed: 203.05, tax: 808 },
    { key: 'mahendra', hi: 'महेंद्र', fixed: 203.05, tax: 322 },
  ],
};
const ALIASES = { rajkumar: 'rajkumar', sanjay: 'sanjay', nakul: 'nakul', vikash: 'vikash', vikas: 'vikash',
  harshit: 'harshit', shyamsundar: 'shyamsundar', jitendar: 'jitendar', jitendra: 'jitendar',
  jitender: 'jitendar', mahendra: 'mahendra' };
const MONTHS = ['जनवरी', 'फ़रवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'];
const r2 = (x) => Math.round((x + 1e-9) * 100) / 100;
const pad = (n) => String(n).padStart(2, '0');
const ds = (d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
const money = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(2));
const SEP = /^[-‐‑‒–—―\s]+$/;

export function parseMessage(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const m = lines[0] && lines[0].match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) throw new Error('First line must be a date in DD/MM/YYYY format.');
  const [d, mo, y] = [+m[1], +m[2], +m[3]];
  const t = new Date(y, mo - 1, d);
  if (t.getDate() !== d || t.getMonth() !== mo - 1) throw new Error('The date in the message is not a valid date.');
  const sections = [[]];
  for (const line of lines.slice(1)) {
    if (SEP.test(line)) { if (sections[sections.length - 1].length) sections.push([]); }
    else sections[sections.length - 1].push(line);
  }
  const blocks = sections.filter((s) => s.length);
  if (blocks.length !== 2) throw new Error('Expected two blocks (old meter, new meter) separated by a dashed line.');
  const [old, neu] = blocks.map((b, i) => {
    const out = {};
    for (const line of b) {
      const e = line.match(/^(.*?)[\s\-‐‑‒–—―]+(\d+(?:\.\d+)?)$/);
      if (!e) throw new Error(`Cannot read this line: "${line}"`);
      const key = ALIASES[e[1].toLowerCase().replace(/[^a-z]/g, '')];
      if (!key) throw new Error(`Unknown name "${e[1]}" in ${i ? 'new' : 'old'} meter block.`);
      if (key in out) throw new Error(`"${e[1]}" appears twice in the ${i ? 'new' : 'old'} meter block.`);
      out[key] = Number(e[2]);
    }
    return out;
  });
  return { d, mo, y, old, neu };
}

export function buildMessage({ d, mo, y, old, neu }, cfg, bills) {
  const missing = cfg.people.filter((p) => !(p.key in old) && !(p.key in neu)).map((p) => p.key);
  if (missing.length) throw new Error(`Missing in message: ${missing.join(', ')}`);
  const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
  const oldU = sum(old), newU = sum(neu);
  const oldRate = oldU ? r2(bills.old / oldU) : 0;
  const newRate = newU ? r2(bills.new / newU) : 0;
  const rows = cfg.people.map((p) => {
    const hasOld = p.key in old, hasNew = p.key in neu;
    const o = old[p.key] || 0, n = neu[p.key] || 0;
    const oa = r2(o * oldRate), na = r2(n * newRate);
    const fixed = Number(p.fixed), tax = Number(p.tax);
    return { p, hasOld, hasNew, o, n, oa, na, fixed, tax, total: Math.round(oa + na + fixed + tax) };
  });
  const nb = Math.round(bills.new), ob = Math.round(bills.old);
  const grand = rows.reduce((a, r) => a + r.total, 0);
  const A = grand - nb;
  const start = new Date(y, mo - 2, d + 1), end = new Date(y, mo - 1, d), due = new Date(y, mo, Number(cfg.dueDay));
  const std = money(Number(cfg.fixedStd));
  const L = [
    '👉🏻 बिजली,पानी एवं म्युनिसिपल टैक्स का हिसाब प्रति परिवार', '',
    `${MONTHS[mo - 1]} ${y}`, `  (${ds(start)} से ${ds(end)} तक) `, '',
    'जमा करना है____', `₹ ${A} + ${nb}`, `~ ₹ ${grand}`, '',
    `यूनिट consumed - ${oldU} & ${newU}  (पुराने मीटर और नए मीटर का )`,
    'बिजली खपत चार्ज ~', `     ₹ ${ob}`, `  + ₹ ${nb}`, ' ऑनलाइन चार्ज  के साथ', '',
    `@₹ ${oldRate.toFixed(2)}/यूनिट`, `@₹ ${newRate.toFixed(2)}/यूनिट`, '',
    ` पानी का बिल (₹ ${money(Number(bills.water))} ) और कुछ फिक्स्ड चार्ज प्रति परिवार  ₹ ${std}`, '',
    'बिल का क्रम इस प्रकार है=', '', ' पुराने मीटर का  रीडिंग और बिल', '+ नए मीटर का रीडिंग और बिल',
    '+पानी+ कंजरवेंसी चार्ज ', `@₹ ${std}`, `+ म्युनिसिपल टैक्स (@${cfg.taxRate}/स्क्वायर फ़ीट)`, '',
    '      इसे कैलकुलेट करने पर  फाइनल देय', '',
  ];
  for (const r of rows) {
    const units = r.hasOld && r.hasNew ? `${r.o} & ${r.n}` : `${r.hasOld ? r.o : r.n}`;
    const elec = [r.hasOld && `₹ ${money(r.oa)}`, r.hasNew && `₹ ${money(r.na)}`].filter(Boolean).join(' + ');
    L.push(`${r.p.hi} (${units} यूनिट)`, elec, `+ ₹ ${money(r.fixed)} + ₹ ${money(r.tax)}`, `टोटल ~ ₹ ${r.total}/-`, '');
  }
  L.push(`फाइनल अमाउंट देखकर कृप्या मेरे mobile No. ${cfg.phone.trim()} पर UPI से या नकद दिनांक`, `${ds(due)} तक जमा कर दे।☝🏼`);
  return { text: L.join('\n'), summary: `Old: ${oldU} units @ ₹${oldRate.toFixed(2)} | New: ${newU} units @ ₹${newRate.toFixed(2)}` };
}
