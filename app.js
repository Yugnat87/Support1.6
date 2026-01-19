let rawData = [];
let data = [];

let FIELDS = {
  category: null,
  subIssue: null,
  symptomId: null,
  symptomDesc: null,
  actionSupport: null,
  actionField: null,
  sparePart: null,
  sopLink: null
};

const state = {
  symptomId: null,
  confirmedGroup: null
};

const symptomSelect = document.getElementById("symptomSelect");
const symptomSearch = document.getElementById("symptomSearch");

const actionsSection = document.getElementById("actionsSection");
const actionsList = document.getElementById("actionsList");

const maintenanceSection = document.getElementById("maintenanceSection");
const maintenanceContent = document.getElementById("maintenanceContent");
const copyBtn = document.getElementById("copyBtn");

let symptomMap = {}; // id → description

/* =============================
   LOAD DATA
============================= */
fetch("data.json")
  .then(r => r.json())
  .then(json => {
    rawData = Array.isArray(json)
      ? json
      : Array.isArray(json.rows)
        ? json.rows
        : Object.values(json);

    detectFields(rawData[0]);
    data = rawData;
    buildSymptomMap();
    populateSymptoms();
  });

/* =============================
   FIELD DETECTION
============================= */
function detectFields(sample) {
  const keys = Object.keys(sample);

  FIELDS.category      = keys.find(k => k.toLowerCase().includes("category"));
  FIELDS.subIssue      = keys.find(k => k.toLowerCase().includes("sub"));
  FIELDS.actionSupport = keys.find(k => k.toLowerCase().includes("support"));
  FIELDS.actionField   = keys.find(k => k.toLowerCase().includes("actions for field"));
  FIELDS.sparePart     = keys.find(k => k.toLowerCase().includes("spare"));
  FIELDS.sopLink       = keys.find(k => k.toLowerCase().includes("sop"));

  FIELDS.symptomId = keys.find(k => /^s-\d+/i.test(String(sample[k])));
  FIELDS.symptomDesc = keys.find(k => {
    const v = String(sample[k] || "");
    return v && k !== FIELDS.symptomId && !/^s-\d+/i.test(v);
  });
}

/* =============================
   BUILD SYMPTOM MAP
============================= */
function buildSymptomMap() {
  symptomMap = {};
  data.forEach(r => {
    const id = r[FIELDS.symptomId];
    if (!symptomMap[id]) {
      symptomMap[id] = r[FIELDS.symptomDesc];
    }
  });
}

/* =============================
   POPULATE SYMPTOMS (FILTERABLE)
============================= */
function populateSymptoms(filter = "") {
  symptomSelect.innerHTML = '<option value="">-- Choose symptom --</option>';

  const f = filter.toLowerCase();

  Object.keys(symptomMap)
    .sort((a, b) => a.localeCompare(b))
    .filter(id => {
      const label = `${id} ${symptomMap[id]}`.toLowerCase();
      return label.includes(f);
    })
    .forEach(id => {
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = `${id} — ${symptomMap[id]}`;
      symptomSelect.appendChild(opt);
    });
}

/* =============================
   SEARCH HANDLER
============================= */
symptomSearch.addEventListener("input", e => {
  populateSymptoms(e.target.value);
});

/* =============================
   SYMPTOM SELECT
============================= */
symptomSelect.addEventListener("change", e => {
  resetUI();
  state.symptomId = e.target.value;
  if (state.symptomId) loadActionsForSymptom();
});

/* =============================
   FIELD ORDER HELPER
============================= */
function getFieldOrder(row) {
  const txt = String(row[FIELDS.actionField] || "");
  const m = txt.match(/^(\d+)_/);
  return m ? parseInt(m[1], 10) : 999;
}

/* =============================
   ACTIONS BY SUB-ISSUE (ORDERED)
============================= */
function loadActionsForSymptom() {
  actionsSection.classList.remove("hidden");
  actionsList.innerHTML = "";

  const rowsForSymptom = data.filter(r =>
    r[FIELDS.symptomId] === state.symptomId &&
    String(r[FIELDS.actionSupport] || "").trim() !== "/"
  );

  const bySub = {};
  rowsForSymptom.forEach(r => {
    const sub = r[FIELDS.subIssue] || "Other";
    if (!bySub[sub]) bySub[sub] = [];
    bySub[sub].push(r);
  });

  Object.keys(bySub).forEach(sub => {
    const block = document.createElement("div");
    block.className = "subissue-block";
    block.innerHTML = `<div class="subissue-title">${sub}</div>`;

    const bySupport = {};
    bySub[sub].forEach(r => {
      const key = r[FIELDS.actionSupport];
      if (!bySupport[key]) bySupport[key] = [];
      bySupport[key].push(r);
    });

    Object.values(bySupport)
      .sort((a, b) => Math.min(...a.map(getFieldOrder)) - Math.min(...b.map(getFieldOrder)))
      .forEach(rows => {
        const first = rows[0];

        const sopValue = String(first[FIELDS.sopLink] || "").trim().toUpperCase();
        const showHowTo = sopValue && sopValue !== "/" && sopValue !== "I";

        const actionDiv = document.createElement("div");
        actionDiv.className = "action-line assess";
        actionDiv.innerHTML = `
          <div class="action-text">${first[FIELDS.actionSupport]}</div>
          <div class="action-buttons">
            <button class="issue-btn">Issue confirmed</button>
            ${showHowTo ? `<button class="howto-btn">How to</button>` : ""}
          </div>
        `;

        actionDiv.querySelector(".issue-btn").onclick = () => {
          state.confirmedGroup = rows;
          showMaintenance();
        };

        if (showHowTo) {
          actionDiv.querySelector(".howto-btn").onclick = () => {
            window.open(first[FIELDS.sopLink], "_blank");
          };
        }

        block.appendChild(actionDiv);
      });

    actionsList.appendChild(block);
  });
}

/* =============================
   MAINTENANCE (UNCHANGED)
============================= */
function showMaintenance() {
  const rows = state.confirmedGroup;
  if (!rows || !rows.length) return;

  const base = rows[0];
  const symptomText = `${base[FIELDS.symptomId]} — ${base[FIELDS.symptomDesc]}`;

  const actions = rows
    .sort((a, b) => getFieldOrder(a) - getFieldOrder(b))
    .map(r => r[FIELDS.actionField])
    .filter(Boolean);

  const spare = String(base[FIELDS.sparePart] || "").trim();
  const showSpare = spare && spare !== "/";

  maintenanceContent.innerHTML = `
    <div class="maintenance-box">
      <div class="maintenance-row">
        <div class="maintenance-label">Sub issue:</div>
        <div class="maintenance-value">${base[FIELDS.subIssue]}</div>
      </div>
      <div class="maintenance-row">
        <div class="maintenance-label">Symptom to confirm on site:</div>
        <div class="maintenance-value">${symptomText}</div>
      </div>
      <div class="maintenance-row">
        <div class="maintenance-label">Actions to do:</div>
        <div class="maintenance-value">
          ${actions.map(a => `
            <label class="checkbox-item">
              <input type="checkbox" /> ${a}
            </label>`).join("")}
        </div>
      </div>
      ${showSpare ? `
      <div class="maintenance-row">
        <div class="maintenance-label">Spare parts needed:</div>
        <div class="maintenance-value">
          <label class="checkbox-item">
            <input type="checkbox" /> ${spare}
          </label>
        </div>
      </div>` : ""}
    </div>
  `;

  maintenanceSection.classList.remove("hidden");
}

/* =============================
   RESET
============================= */
function resetUI() {
  actionsSection.classList.add("hidden");
  maintenanceSection.classList.add("hidden");
  state.confirmedGroup = null;
}
