const statusElement = document.getElementById("llm-status");
const answerElement = document.getElementById("llm-answer");
const contextWindowElement = document.getElementById("llm-context-window");
const buttonElement = document.getElementById("run-llm");
const clearButtonElement = document.getElementById("clear-llm");
const contextElement = document.getElementById("post-context");
const questionElement = document.getElementById("question");

const maxExcerptChars = 1100;
const stopWords = new Set(
  "the and for with this that from have what about your how why when where which into than then they them their was were are you not but can all any its post text main mainly does did just than over also more most some such only other into onto about".split(
    " "
  )
);

let conversation = [];
let requestId = 0;
let busy = false;
let modelLabel = "FLAN-T5 base";
let modelDevice = "";
let lastStatus = "";
let lastProgressBucket = -1;
let sawTotalProgress = false;

const worker = new Worker(new URL("./tiny-llm-worker.js", import.meta.url), {
  type: "module",
});

function setStatus(text) {
  if (text === lastStatus) {
    return;
  }
  lastStatus = text;
  statusElement.textContent = text;
}

function readyStatus() {
  const where = modelDevice ? ` on ${modelDevice}` : "";
  return `${modelLabel} is ready${where}. Later questions reuse the copy stored in this browser.`;
}

function words(text) {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(function (word) {
      return word.length > 2 && !stopWords.has(word);
    });
}

function chunksOf(text) {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map(function (part) {
      return part.trim();
    })
    .filter(Boolean);
  if (paragraphs.length > 1) {
    return paragraphs;
  }

  const lines = text
    .split(/\n/)
    .map(function (part) {
      return part.trim();
    })
    .filter(Boolean);
  if (lines.length > 1) {
    return lines;
  }

  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map(function (part) {
      return part.trim();
    })
    .filter(function (part) {
      return part.length > 40;
    });
  return sentences.length ? sentences : [text];
}

function clip(text, maxChars) {
  if (text.length <= maxChars) {
    return text;
  }
  return text.slice(0, maxChars).trim();
}

function excerptFor(context, question) {
  if (context.length <= maxExcerptChars) {
    return {
      text: context,
      note: `Using the full text (${context.length} characters).`,
    };
  }

  const chunks = chunksOf(context);
  const terms = words(question);
  const ranked = chunks
    .map(function (text, index) {
      const haystack = text.toLowerCase();
      let score = 0;
      terms.forEach(function (term) {
        if (haystack.includes(term)) {
          score += 1;
        }
      });
      return { text: text, index: index, score: score };
    })
    .sort(function (a, b) {
      return b.score - a.score || a.index - b.index;
    });

  const selected = new Map();
  const openingBudget = Math.min(chunks[0].length, Math.floor(maxExcerptChars * 0.45));
  selected.set(0, clip(chunks[0], openingBudget));
  ranked.forEach(function (item) {
    if (item.score <= 0 || selected.has(item.index)) {
      return;
    }
    const used = Array.from(selected.values()).join("\n\n").length;
    if (used >= maxExcerptChars) {
      return;
    }
    selected.set(item.index, clip(item.text, maxExcerptChars - used));
  });

  const text = Array.from(selected.entries())
    .sort(function (a, b) {
      return a[0] - b[0];
    })
    .map(function (entry) {
      return entry[1];
    })
    .join("\n\n");
  const matched = ranked.some(function (item) {
    return item.score > 0;
  });
  return {
    text: text,
    note: matched
      ? `Using ${text.length} of ${context.length} characters: the opening, plus paragraphs that share words with your question.`
      : `No paragraph shared words with the question, so this uses the first ${text.length} of ${context.length} characters.`,
  };
}

function previewNote() {
  const text = contextElement.value.trim();
  if (!text) {
    contextWindowElement.textContent = "Paste a post, or open this page from a post.";
    return;
  }
  if (text.length <= maxExcerptChars) {
    contextWindowElement.textContent = `Full text ready (${text.length} characters).`;
    return;
  }
  contextWindowElement.textContent = `This text is ${text.length} characters. A question uses the opening and the paragraphs that share words with it.`;
}

function renderEmpty() {
  answerElement.replaceChildren();
  const empty = document.createElement("p");
  empty.className = "llm-empty";
  empty.textContent = "No responses yet.";
  answerElement.appendChild(empty);
}

function startTurn(title) {
  const empty = answerElement.querySelector(".llm-empty");
  if (empty) {
    answerElement.replaceChildren();
  }
  const turn = document.createElement("div");
  turn.className = "llm-turn";
  const heading = document.createElement("strong");
  heading.textContent = `${conversation.length}. ${title}`;
  const body = document.createElement("p");
  body.textContent = "";
  turn.append(heading, body);
  answerElement.appendChild(turn);
  answerElement.scrollIntoView({ block: "nearest" });
  return body;
}

function buildPrompt(excerpt, question) {
  return `Context: ${excerpt} Question: ${question} Answer:`;
}

function setBusy(next) {
  busy = next;
  buttonElement.disabled = next;
  clearButtonElement.disabled = next;
  answerElement.setAttribute("aria-busy", next ? "true" : "false");
}

function articleToText(article) {
  const chunks = [];
  article.querySelectorAll("h1, h2, h3, h4, h5, p, li, pre, blockquote").forEach(function (node) {
    if (node.closest("details, script, style")) {
      return;
    }
    if (node.parentElement && node.parentElement.closest("li, blockquote, pre")) {
      return;
    }
    const text = node.tagName === "PRE"
      ? node.textContent.replace(/\n{3,}/g, "\n\n").trim()
      : node.textContent.replace(/\s+/g, " ").trim();
    if (text) {
      chunks.push(text);
    }
  });
  return chunks.join("\n\n");
}

async function preloadPostFromQuery() {
  const source = new URLSearchParams(window.location.search).get("source");
  if (!source) {
    return;
  }

  try {
    const sourceUrl = new URL(source, window.location.origin);
    if (sourceUrl.origin !== window.location.origin) {
      return;
    }

    setStatus("Loading post content…");
    const response = await fetch(sourceUrl.toString());
    if (!response.ok) {
      setStatus("Could not load post content.");
      return;
    }

    const html = await response.text();
    const documentNode = new DOMParser().parseFromString(html, "text/html");
    const article = documentNode.querySelector("article");
    if (!article) {
      setStatus("Could not find post content.");
      return;
    }

    contextElement.value = articleToText(article);
    previewNote();
    setStatus("Post content preloaded. Ask a question when you are ready.");
  } catch (error) {
    setStatus("Could not preload post content.");
    console.error(error);
  }
}

function describeProgress(info) {
  if (!info) {
    return "";
  }
  if (info.status === "progress_total") {
    sawTotalProgress = true;
  } else if (info.status !== "progress" || sawTotalProgress) {
    return "";
  }
  const file = (info.file || "model").split("/").pop();
  const bucket = Math.floor((info.progress || 0) / 5);
  const mark = `${file}:${bucket}`;
  if (mark === lastProgressBucket) {
    return "";
  }
  lastProgressBucket = mark;
  const loaded = info.loaded ? `${Math.round(info.loaded / (1024 * 1024))} MB` : "";
  const total = info.total ? `${Math.round(info.total / (1024 * 1024))} MB` : "";
  const amount = loaded && total ? ` (${loaded} of ${total})` : "";
  const shortName = file.replace(/_quantized\.onnx$/i, "").replace(/\.onnx$/i, "").replace(/_/g, " ");
  return `Downloading ${shortName}… ${Math.round(info.progress || 0)}%${amount}`;
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
  if (data.type === "ready") {
    modelLabel = data.label || modelLabel;
    modelDevice = data.device || "";
    if (!busy) {
      setStatus(readyStatus());
    }
    return;
  }
  if (data.id !== requestId) {
    return;
  }
  if (data.type === "generating") {
    setStatus(`Reading the excerpt on ${modelDevice || "this device"}…`);
    return;
  }
  if (data.type === "done") {
    const body = answerElement.querySelector(".llm-turn:last-child p");
    const answer = data.text || "No response generated.";
    if (body) {
      body.textContent = answer;
    }
    if (conversation.length) {
      conversation[conversation.length - 1].answer = answer;
    }
    setBusy(false);
    setStatus(readyStatus());
    return;
  }
  if (data.type === "error") {
    const body = answerElement.querySelector(".llm-turn:last-child p");
    const message = data.message || "Unknown error";
    if (body && !body.textContent) {
      body.textContent = "The model did not finish. See the status line for the reason.";
    }
    setBusy(false);
    setStatus(`Could not run the model. ${message}`);
  }
};

worker.onerror = function (event) {
  console.error(event);
  setBusy(false);
  setStatus("The model script failed to load. Check the network and reload this page.");
};

function askModel() {
  if (busy) {
    return;
  }

  const context = contextElement.value.trim();
  const question = questionElement.value.trim();
  if (!context) {
    setStatus("Paste a post first.");
    return;
  }
  if (!question) {
    setStatus("Type a question about something the post states.");
    questionElement.focus();
    return;
  }

  const excerpt = excerptFor(context, question);
  const title = `Q: ${question}`;
  const prompt = buildPrompt(excerpt.text, question);
  conversation.push({ title: title, answer: "" });
  startTurn(title);
  contextWindowElement.textContent = excerpt.note;
  lastProgressBucket = -1;
  sawTotalProgress = false;
  requestId += 1;
  setBusy(true);
  setStatus("Starting the model…");
  worker.postMessage({
    type: "generate",
    id: requestId,
    prompt: prompt,
  });
}

buttonElement.addEventListener("click", askModel);

clearButtonElement.addEventListener("click", function () {
  if (busy) {
    return;
  }
  conversation = [];
  renderEmpty();
  setStatus(modelDevice ? readyStatus() : "Answers cleared. The model downloads on the next question.");
});

questionElement.addEventListener("keydown", function (event) {
  if (event.key === "Enter") {
    event.preventDefault();
    askModel();
  }
});

contextElement.addEventListener("input", previewNote);

renderEmpty();
previewNote();
setStatus("The model downloads when you ask the first question.");
preloadPostFromQuery();
