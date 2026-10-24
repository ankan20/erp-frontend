/**
 * Transforms the Balance Sheet API response into flat row arrays
 * for the left (Equity & Liabilities) and right (Assets) panels.
 *
 * Row schema:
 *   type    : 'group' | 'item' | 'subtotal' | 'section-total' | 'grand-total'
 *   id      : unique string
 *   label   : display text
 *   code    : CC code (optional)
 *   value   : number | null
 *   depth   : nesting level (0 = top section, 1 = sub-section, 2 = sub-sub, 3 = leaf item)
 *   ancestors: string[] — ids of enclosing groups (used for collapse filtering)
 */

function item(id, code, label, value, depth, ancestors) {
  return { type: "item", id, code, label, value: value ?? null, depth, ancestors };
}
function group(id, label, depth, ancestors) {
  return { type: "group", id, label, depth, ancestors };
}
function subtotal(id, label, value, depth, ancestors) {
  return { type: "subtotal", id, label, value: value ?? null, depth, ancestors };
}
function sectionTotal(id, label, value) {
  return { type: "section-total", id, label, value: value ?? null, depth: 0, ancestors: [] };
}

// ─── Equity & Liabilities ─────────────────────────────────────────────────────

export function buildELRows(el) {
  if (!el) return [];
  const rows = [];

  // ── A: Capital Account ──────────────────────────────────────────────────────
  const a = el.A_capitalAccount || {};
  rows.push(group("A", a.label || "Capital Account", 0, []));

  const a1 = a.A1_shareholdersFund || {};
  rows.push(group("A1", a1.label || "Shareholder's fund", 1, ["A"]));
  (a1.items || []).forEach((it, i) => rows.push(item(`A1_${i}`, it.code, it.label, it.value, 2, ["A", "A1"])));
  rows.push(subtotal("A1_tot", `Total — ${a1.label || "Shareholder's fund"}`, a1.total, 1, ["A"]));

  const a2 = a.A2_CRSF || {};
  rows.push(item("A2", a2.code, a2.label || "Company reserves & surplus fund", a2.value, 1, ["A"]));

  rows.push(sectionTotal("A_tot", `Total A — ${a.label || "Capital Account"}`, a.total));

  // ── B: Non-current liability ────────────────────────────────────────────────
  const b = el.B_nonCurrentLiability || {};
  rows.push(group("B", b.label || "Non-current liability", 0, []));

  const b1 = b.B1_NCTB || {};
  rows.push(group("B1", b1.label || "Long-term borrowings", 1, ["B"]));

  const b11 = b1.B1_1_securedBanking || {};
  rows.push(group("B1_1", b11.label || "Secured loan — banking", 2, ["B", "B1"]));
  (b11.items || []).forEach((it, i) => rows.push(item(`B1_1_${i}`, it.code, it.label, it.value, 3, ["B", "B1", "B1_1"])));
  rows.push(subtotal("B1_1_tot", `Total — ${b11.label || "Secured banking"}`, b11.total, 2, ["B", "B1"]));

  const b12 = b1.B1_2_securedNonBanking || {};
  rows.push(group("B1_2", b12.label || "Secured loan — non-banking", 2, ["B", "B1"]));
  (b12.items || []).forEach((it, i) => rows.push(item(`B1_2_${i}`, it.code, it.label, it.value, 3, ["B", "B1", "B1_2"])));
  rows.push(subtotal("B1_2_tot", `Total — ${b12.label || "Secured non-banking"}`, b12.total, 2, ["B", "B1"]));

  const b13 = b1.B1_3_unsecuredBanking || {};
  rows.push(group("B1_3", b13.label || "Unsecured loan — banking", 2, ["B", "B1"]));
  (b13.items || []).forEach((it, i) => rows.push(item(`B1_3_${i}`, it.code, it.label, it.value, 3, ["B", "B1", "B1_3"])));
  rows.push(subtotal("B1_3_tot", `Total — ${b13.label || "Unsecured banking"}`, b13.total, 2, ["B", "B1"]));

  const b14 = b1.B1_4_unsecuredNonBanking || {};
  rows.push(group("B1_4", b14.label || "Unsecured loan — non-banking", 2, ["B", "B1"]));
  (b14.items || []).forEach((it, i) => rows.push(item(`B1_4_${i}`, it.code, it.label, it.value, 3, ["B", "B1", "B1_4"])));
  rows.push(subtotal("B1_4_tot", `Total — ${b14.label || "Unsecured non-banking"}`, b14.total, 2, ["B", "B1"]));

  rows.push(subtotal("B1_tot", `Total — ${b1.label || "Long-term borrowings"}`, b1.total, 1, ["B"]));

  if (b.B2_NCDT) rows.push(item("B2", b.B2_NCDT.code, b.B2_NCDT.label, b.B2_NCDT.value, 1, ["B"]));
  if (b.B3_NCTL) rows.push(item("B3", b.B3_NCTL.code, b.B3_NCTL.label, b.B3_NCTL.value, 1, ["B"]));
  if (b.B4_NCTP) rows.push(item("B4", b.B4_NCTP.code, b.B4_NCTP.label, b.B4_NCTP.value, 1, ["B"]));

  rows.push(sectionTotal("B_tot", `Total B — ${b.label || "Non-current liability"}`, b.total));

  // ── C: Current liabilities ──────────────────────────────────────────────────
  const c = el.C_currentLiabilities || {};
  rows.push(group("C", c.label || "Current liabilities", 0, []));

  if (c.C1_CLDT) rows.push(item("C1", c.C1_CLDT.code, c.C1_CLDT.label, c.C1_CLDT.value, 1, ["C"]));
  if (c.C2_CLSC) rows.push(item("C2", c.C2_CLSC.code, c.C2_CLSC.label, c.C2_CLSC.value, 1, ["C"]));
  if (c.C3_CLTB) rows.push(item("C3", c.C3_CLTB.code, c.C3_CLTB.label, c.C3_CLTB.value, 1, ["C"]));
  if (c.C4_CLTP) rows.push(item("C4", c.C4_CLTP.code, c.C4_CLTP.label, c.C4_CLTP.value, 1, ["C"]));

  const c5 = c.C5_CLOT || {};
  if ((c5.items || []).length > 0 || c5.label) {
    rows.push(group("C5", c5.label || "Other current liabilities", 1, ["C"]));
    (c5.items || []).forEach((it, i) => rows.push(item(`C5_${i}`, it.code, it.label, it.value, 2, ["C", "C5"])));
    rows.push(subtotal("C5_tot", `Total — ${c5.label || "Other current liabilities"}`, c5.total, 1, ["C"]));
  }

  if (c.C6_CLGP) {
    rows.push(item("C6", c.C6_CLGP.code, c.C6_CLGP.label || "GST payable (output − input)", c.C6_CLGP.value, 1, ["C"]));
  }

  rows.push(sectionTotal("C_tot", `Total C — ${c.label || "Current liabilities"}`, c.total));

  return rows;
}

// ─── Assets ───────────────────────────────────────────────────────────────────

export function buildAssetsRows(assets) {
  if (!assets) return [];
  const rows = [];

  // ── A: Non-current assets ───────────────────────────────────────────────────
  const a = assets.A_nonCurrentAssets || {};
  rows.push(group("A", a.label || "Non-current assets", 0, []));

  const a1 = a.A1_fixedAssets || {};
  rows.push(group("A1", a1.label || "Fixed assets", 1, ["A"]));
  (a1.items || []).forEach((it, i) => rows.push(item(`A1_${i}`, it.code, it.label || it.code, it.value, 2, ["A", "A1"])));
  rows.push(subtotal("A1_tot", `Total — ${a1.label || "Fixed assets"}`, a1.total, 1, ["A"]));

  if (a.A2_NCIV) rows.push(item("A2", a.A2_NCIV.code, a.A2_NCIV.label, a.A2_NCIV.value, 1, ["A"]));
  if (a.A3_NCTA) rows.push(item("A3", a.A3_NCTA.code, a.A3_NCTA.label, a.A3_NCTA.value, 1, ["A"]));
  if (a.A4_LTLA) rows.push(item("A4", a.A4_LTLA.code, a.A4_LTLA.label, a.A4_LTLA.value, 1, ["A"]));
  if (a.A5_NCCA) rows.push(item("A5", a.A5_NCCA.code, a.A5_NCCA.label, a.A5_NCCA.value, 1, ["A"]));

  rows.push(sectionTotal("A_tot", `Total A — ${a.label || "Non-current assets"}`, a.total));

  // ── B: Current assets ───────────────────────────────────────────────────────
  const b = assets.B_currentAssets || {};
  rows.push(group("B", b.label || "Current assets", 0, []));

  const b1 = b.B1_CACS || {};
  if ((b1.items || []).length > 0 || b1.label) {
    rows.push(group("B1", b1.label || "Closing stock", 1, ["B"]));
    (b1.items || []).forEach((it, i) => rows.push(item(`B1_${i}`, it.code, it.label, it.value, 2, ["B", "B1"])));
    rows.push(subtotal("B1_tot", `Total — ${b1.label || "Closing stock"}`, b1.total, 1, ["B"]));
  }

  if (b.B3_CASD) rows.push(item("B3", b.B3_CASD.code, b.B3_CASD.label, b.B3_CASD.value, 1, ["B"]));
  if (b.B8_CART) rows.push(item("B8_ret", b.B8_CART.code, b.B8_CART.label, b.B8_CART.value, 1, ["B"]));

  const b4 = b.B4_CALA || {};
  if ((b4.items || []).length > 0 || b4.label) {
    rows.push(group("B4", b4.label || "Short-term loans & advances", 1, ["B"]));
    (b4.items || []).forEach((it, i) => rows.push(item(`B4_${i}`, it.code, it.label, it.value, 2, ["B", "B4"])));
    rows.push(subtotal("B4_tot", `Total — ${b4.label || "Short-term loans & advances"}`, b4.total, 1, ["B"]));
  }

  if (b.B5_CACI) rows.push(item("B5", b.B5_CACI.code, b.B5_CACI.label, b.B5_CACI.value, 1, ["B"]));
  if (b.B6_CATS) rows.push(item("B6", b.B6_CATS.code, b.B6_CATS.label, b.B6_CATS.value, 1, ["B"]));
  if (b.B7_CAOA) rows.push(item("B7", b.B7_CAOA.code, b.B7_CAOA.label, b.B7_CAOA.value, 1, ["B"]));
  if (b.B_gstExcessInput) rows.push(item("B_gst", null, b.B_gstExcessInput.label || "GST excess input credit", b.B_gstExcessInput.value, 1, ["B"]));

  const b8 = b.B8_CABA || {};
  if ((b8.accounts || []).length > 0 || b8.label) {
    rows.push(group("B8", b8.label || "Bank accounts", 1, ["B"]));
    (b8.accounts || []).forEach((acct, i) => rows.push(item(`B8_${i}`, acct.code, acct.name, acct.balance, 2, ["B", "B8"])));
    rows.push(subtotal("B8_tot", `Total — ${b8.label || "Bank accounts"}`, b8.total, 1, ["B"]));
  }

  if (b.B9_CACH) rows.push(item("B9", b.B9_CACH.code, b.B9_CACH.label, b.B9_CACH.value, 1, ["B"]));

  rows.push(sectionTotal("B_tot", `Total B — ${b.label || "Current assets"}`, b.total));

  return rows;
}
