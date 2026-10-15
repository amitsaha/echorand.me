const stateElement = document.getElementById("jev-state");
const statusElement = document.getElementById("jev-status");
const resultElement = document.getElementById("jev-result");
const policyElement = document.getElementById("jev-policy");
const runButton = document.getElementById("jev-run");

const escalateAt = 0.7;
const frustrationAt = 1.5;
const routeAt = 0.55;

const departments = [
  { key: "to return or exchange an item", label: "Returns" },
  { key: "where their package is", label: "Shipping" },
  { key: "about a charge on their card", label: "Billing" },
];

const frustrationLevels = [
  { key: "the customer is calm", label: "Calm" },
  { key: "the customer is frustrated", label: "Frustrated" },
  { key: "the customer is very angry", label: "Very angry" },
];

const examples = {
  mixed: "Shoes arrived two weeks late and in the wrong size. Also I see two charges on my card.",
  shipping: "Where is my package? The tracking number has not moved in two days.",
  angry: "This is the third time you sent the wrong item. Refund me today or I am disputing the charge.",
};

let requestId = 0;
let busy = false;
let lastStatus = "";
let lastProgressMark = "";

const worker = new Worker(new URL("./jev-style-worker.js", import.meta.url), {
  type: "module",
});

function setStatus(text) {
  if (text === lastStatus) {
    return;
  }
  lastStatus = text;
  statusElement.textContent = text;
}

function formatProbability(value) {
  return Number(value || 0).toFixed(2);
}

function renderPolicy() {
  policyElement.replaceChildren();
  const heading = document.createElement("h2");
  heading.textContent = "What the code will do";
  const list = document.createElement("ol");
  [
    `Send it to a person now when urgent attention is at least ${escalateAt.toFixed(2)}, or the frustration score is at least ${frustrationAt.toFixed(2)} (0 is calm, 2 is very angry).`,
    `Otherwise, ask a person which team when the leading team is below ${routeAt.toFixed(2)}.`,
    "Otherwise, route to the leading team.",
  ].forEach(function (text) {
    const item = document.createElement("li");
    item.textContent = text;
    list.appendChild(item);
  });
  policyElement.append(heading, list);
}

function barRow(label, probability, lead) {
  const row = document.createElement("div");
  row.className = lead ? "jev-row is-lead" : "jev-row";
  const head = document.createElement("div");
  head.className = "jev-row-head";
  const name = document.createElement("span");
  name.textContent = label;
  const value = document.createElement("span");
  value.textContent = formatProbability(probability);
  head.append(name, value);
  const track = document.createElement("div");
  track.className = "jev-track";
  const fill = document.createElement("span");
  fill.className = "jev-fill";
  fill.style.width = `${Math.max(0, Math.min(100, Math.round(probability * 100)))}%`;
  track.appendChild(fill);
  row.append(head, track);
  return row;
}

function card(title, detail) {
  const section = document.createElement("section");
  section.className = "jev-card";
  const heading = document.createElement("h2");
  heading.textContent = title;
  const note = document.createElement("p");
  note.textContent = detail;
  section.append(heading, note);
  return section;
}

function probabilitiesFor(items, scores) {
  return items.map(function (item) {
    return { label: item.label, probability: scores[item.key] || 0 };
  });
}

function leading(rows) {
  return rows.reduce(function (best, row) {
    return row.probability > best.probability ? row : best;
  }, rows[0]);
}

function chooseAction(departmentRows, noul, frustrationScore) {
  const leader = leading(departmentRows);
  const urgent = noul >= escalateAt;
  const heated = frustrationScore >= frustrationAt;
  if (urgent || heated) {
    let because = `Urgent attention is ${formatProbability(noul)}, which is past ${escalateAt.toFixed(2)}.`;
    if (urgent && heated) {
      because = `Urgent attention is ${formatProbability(noul)} and frustration is ${frustrationScore.toFixed(2)}. Both are past their cutoffs.`;
    } else if (heated) {
      because = `Frustration is ${frustrationScore.toFixed(2)}, which is past ${frustrationAt.toFixed(2)}.`;
    }
    return {
      action: "Send this to a person now",
      because: because,
    };
  }
  if (leader.probability < routeAt) {
    return {
      action: "Ask a person which team",
      because: `${leader.label} leads at ${formatProbability(leader.probability)}, which is below ${routeAt.toFixed(2)}.`,
    };
  }
  return {
    action: `Route to ${leader.label.toLowerCase()}`,
    because: `${leader.label} is ${formatProbability(leader.probability)}, which clears ${routeAt.toFixed(2)}.`,
  };
}

function renderResult(data) {
  const departmentRows = probabilitiesFor(departments, data.department);
  const frustrationRows = probabilitiesFor(frustrationLevels, data.frustration);
  const noul = data.urgency["needs urgent human attention"] || 0;
  const frustrationScore = frustrationRows.reduce(function (sum, row, index) {
    return sum + index * row.probability;
  }, 0);
  const decision = chooseAction(departmentRows, noul, frustrationScore);
  const departmentLead = leading(departmentRows).label;
  const frustrationLead = leading(frustrationRows).label;

  resultElement.replaceChildren();

  const decisionCard = card("Action", decision.because);
  const action = document.createElement("p");
  action.className = "jev-action";
  action.textContent = decision.action;
  decisionCard.insertBefore(action, decisionCard.lastChild);
  resultElement.appendChild(decisionCard);

  const choiceCard = card("Choice", "Which team should handle this?");
  departmentRows.forEach(function (row) {
    choiceCard.appendChild(barRow(row.label, row.probability, row.label === departmentLead));
  });
  resultElement.appendChild(choiceCard);

  const noulCard = card("Noul", "Does this need urgent human attention?");
  noulCard.appendChild(barRow("Yes", noul, noul >= 0.5));
  noulCard.appendChild(barRow("No", 1 - noul, noul < 0.5));
  resultElement.appendChild(noulCard);

  const scoreCard = card("Score", `Frustration is ${frustrationScore.toFixed(2)} on a scale from 0 to 2.`);
  frustrationRows.forEach(function (row) {
    scoreCard.appendChild(barRow(row.label, row.probability, row.label === frustrationLead));
  });
  resultElement.appendChild(scoreCard);
  resultElement.scrollIntoView({ block: "nearest" });
}

function describeProgress(info) {
  if (!info || (info.status !== "progress" && info.status !== "progress_total")) {
    return "";
  }
  const file = (info.file || "model").split("/").pop();
  const bucket = Math.floor((info.progress || 0) / 5);
  const mark = `${file}:${bucket}`;
  if (mark === lastProgressMark) {
    return "";
  }
  lastProgressMark = mark;
  const loaded = info.loaded ? `${Math.round(info.loaded / (1024 * 1024))} MB` : "";
  const total = info.total ? `${Math.round(info.total / (1024 * 1024))} MB` : "";
  const amount = loaded && total ? ` (${loaded} of ${total})` : "";
  return `Downloading the classifier… ${Math.round(info.progress || 0)}%${amount}`;
}

worker.onmessage = function (event) {
  const data = event.data || {};
  if (data.type === "progress") {
    const text = describeProgress(data.info);
    if (text) {
      setStatus(text);
    }
    return;
  }
  if (data.id !== requestId) {
    return;
  }
  if (data.type === "ready") {
    setStatus("Answering the three questions…");
    return;
  }
  if (data.type === "step") {
    setStatus(`Answering ${data.label}…`);
    return;
  }
  if (data.type === "done") {
    renderResult(data);
    busy = false;
    runButton.disabled = false;
    setStatus("Decision ready. The classifier stays in this browser.");
    return;
  }
  if (data.type === "error") {
    busy = false;
    runButton.disabled = false;
    resultElement.replaceChildren();
    setStatus(`Could not run the classifier. ${data.message || "Unknown error"}`);
  }
};

worker.onerror = function (event) {
  console.error(event);
  busy = false;
  runButton.disabled = false;
  setStatus("The classifier script failed to load. Check the network and reload this page.");
};

function decide() {
  if (busy) {
    return;
  }
  const state = stateElement.value.trim();
  if (!state) {
    setStatus("Paste a message first.");
    stateElement.focus();
    return;
  }
  busy = true;
  runButton.disabled = true;
  lastProgressMark = "";
  requestId += 1;
  resultElement.replaceChildren();
  setStatus("Starting the classifier…");
  worker.postMessage({ type: "decide", id: requestId, state: state });
}

runButton.addEventListener("click", decide);

document.querySelectorAll("[data-example]").forEach(function (button) {
  button.addEventListener("click", function () {
    stateElement.value = examples[button.getAttribute("data-example")] || "";
    stateElement.focus();
  });
});

renderPolicy();
setStatus("The classifier downloads when you press Decide.");

const groups = [
  { name: "Black patients", scores: [0.22, 0.34, 0.41, 0.48, 0.55, 0.63, 0.74, 0.88] },
  { name: "White patients", scores: [0.39, 0.52, 0.61, 0.7, 0.76, 0.82, 0.9, 0.96] },
];

const cutoffInput = document.getElementById("jev-cutoff");
const cutoffValue = document.getElementById("jev-cutoff-value");
const groupsSummary = document.getElementById("jev-groups-summary");
const groupsBoards = document.getElementById("jev-groups-boards");

function cutoffFromInput() {
  return Math.round(Number(cutoffInput.value) * 100) / 100;
}

function renderGroups() {
  const cutoff = cutoffFromInput();
  cutoffValue.textContent = cutoff.toFixed(2);
  const counts = groups.map(function (group) {
    return group.scores.filter(function (score) {
      return score >= cutoff;
    }).length;
  });
  groupsSummary.textContent = `At ${cutoff.toFixed(2)}, the line offers extra care to ${counts[0]} of ${groups[0].scores.length} ${groups[0].name}, and ${counts[1]} of ${groups[1].scores.length} ${groups[1].name}.`;

  groupsBoards.replaceChildren();
  groups.forEach(function (group, groupIndex) {
    const board = document.createElement("section");
    board.className = "jev-card";
    const heading = document.createElement("h3");
    heading.textContent = group.name;
    const rate = document.createElement("p");
    rate.textContent = `${counts[groupIndex]} of ${group.scores.length} offered extra care`;
    board.append(heading, rate);
    group.scores.forEach(function (score, index) {
      const escalated = score >= cutoff;
      const row = document.createElement("div");
      row.className = escalated ? "jev-row is-lead" : "jev-row";
      const head = document.createElement("div");
      head.className = "jev-row-head";
      const name = document.createElement("span");
      name.textContent = `Patient ${index + 1}`;
      const value = document.createElement("span");
      value.textContent = `${score.toFixed(2)} · ${escalated ? "Extra care" : "Routine care"}`;
      head.append(name, value);
      const track = document.createElement("div");
      track.className = "jev-track";
      const fill = document.createElement("span");
      fill.className = "jev-fill";
      fill.style.width = `${Math.round(score * 100)}%`;
      const mark = document.createElement("span");
      mark.className = "jev-mark";
      mark.style.left = `${Math.round(cutoff * 100)}%`;
      track.append(fill, mark);
      row.append(head, track);
      board.appendChild(row);
    });
    groupsBoards.appendChild(board);
  });
}

cutoffInput.addEventListener("input", renderGroups);
renderGroups();
