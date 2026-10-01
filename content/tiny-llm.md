---
title: Tiny LLM Lab
---

Try a tiny in-browser LLM to discuss any post text you paste below.
If you came here from a post page, the post content will be loaded automatically.
The model runs fully in your browser, so first load may be slow and long inputs are trimmed to fit the context window.

<p>
  <label for="post-context">Post text:</label><br />
  <textarea id="post-context" rows="10" cols="80" placeholder="Paste text from one of my posts here"></textarea>
</p>
<p>
  <label for="question">Question:</label><br />
  <input id="question" type="text" size="80" placeholder="What is this post mainly about?" />
</p>
<p>
  <button id="run-llm">Ask / Follow up</button>
  <button id="summarize-llm">Summary & key insights</button>
  <button id="bias-llm">Potential author biases</button>
  <button id="clear-llm">Clear conversation</button>
</p>
<p id="llm-status">Model: not loaded</p>
<p id="llm-context-window"></p>
<div id="llm-answer" style="border: 1px solid #ccc; border-radius: 6px; padding: 0.75rem; min-height: 8rem;" aria-live="polite"></div>

<script type="module">
  import { env, pipeline } from "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2";

  env.allowLocalModels = false;
  env.useBrowserCache = true;

  const statusElement = document.getElementById("llm-status");
  const answerElement = document.getElementById("llm-answer");
  const contextWindowElement = document.getElementById("llm-context-window");
  const buttonElement = document.getElementById("run-llm");
  const summarizeButtonElement = document.getElementById("summarize-llm");
  const biasButtonElement = document.getElementById("bias-llm");
  const clearButtonElement = document.getElementById("clear-llm");
  const contextElement = document.getElementById("post-context");
  const questionElement = document.getElementById("question");

  const modelName = "Xenova/flan-t5-small";
  const maxContextChars = 4000;
  const maxConversationTurns = 4;
  let generator;
  let conversation = [];

  function escapeHTML(value) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function truncateContext(context) {
    if (context.length <= maxContextChars) {
      return { text: context, truncated: false };
    }

    return { text: context.slice(0, maxContextChars), truncated: true };
  }

  function setContextWindowStatus(context) {
    const { truncated } = truncateContext(context);
    contextWindowElement.textContent = truncated
      ? `Input trimmed to ~${maxContextChars} characters to fit browser model context limits.`
      : `Using full input (${context.length} characters).`;
  }

  function renderConversation() {
    if (!conversation.length) {
      answerElement.textContent = "No responses yet.";
      return;
    }

    answerElement.innerHTML = conversation
      .map(function (entry, index) {
        return `<div style="margin-bottom: 1rem;">
  <strong>${index + 1}. ${entry.title}</strong>
  <pre style="white-space: pre-wrap; margin: 0.35rem 0 0;">${escapeHTML(entry.answer)}</pre>
</div>`;
      })
      .join("");
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

      statusElement.textContent = "Loading post content...";
      const response = await fetch(sourceUrl.toString());
      if (!response.ok) {
        statusElement.textContent = "Could not load post content";
        return;
      }

      const html = await response.text();
      const documentNode = new DOMParser().parseFromString(html, "text/html");
      const article = documentNode.querySelector("article");
      if (!article) {
        statusElement.textContent = "Could not find post content";
        return;
      }

      contextElement.value = article.textContent.trim();
      setContextWindowStatus(contextElement.value);
      statusElement.textContent = "Post content preloaded";
    } catch (error) {
      statusElement.textContent = "Could not preload post content";
      console.error(error);
    }
  }

  async function getGenerator() {
    if (generator) {
      return generator;
    }

    statusElement.textContent = "Loading tiny model in your browser (first run can take a bit)...";
    generator = await pipeline("text2text-generation", modelName);
    statusElement.textContent = `Model loaded: ${modelName}`;
    return generator;
  }

  async function askModel(mode) {
    const context = contextElement.value.trim();
    const question = questionElement.value.trim();

    if (!context) {
      statusElement.textContent = "Please provide post text.";
      return;
    }

    if (mode === "question" && !question) {
      statusElement.textContent = "Please ask a question for a follow-up response.";
      return;
    }

    const { text: trimmedContext, truncated } = truncateContext(context);
    setContextWindowStatus(context);
    buttonElement.disabled = true;
    summarizeButtonElement.disabled = true;
    biasButtonElement.disabled = true;
    clearButtonElement.disabled = true;
    statusElement.textContent = truncated
      ? "Generating response from trimmed context..."
      : "Generating response...";

    try {
      const llm = await getGenerator();
      const recentConversation = conversation.slice(-maxConversationTurns);
      const historyText = recentConversation
        .map(function (entry) {
          return `${entry.title}\n${entry.answer}`;
        })
        .join("\n\n");

      const promptByMode = {
        question: `You are a concise technical reading assistant.\n\nPost excerpt:\n${trimmedContext}\n\nRecent conversation:\n${historyText || "None"}\n\nUser question: ${question}\n\nGive a helpful technical answer grounded in the post excerpt.`,
        summary: `Summarize this post excerpt and conversation in concise bullet points.\n\nPost excerpt:\n${trimmedContext}\n\nConversation:\n${historyText || "None"}\n\nInclude:\n- Main ideas\n- Key technical insights\n- Open questions`,
        bias: `Analyze potential author bias based only on this post excerpt and conversation.\n\nPost excerpt:\n${trimmedContext}\n\nConversation:\n${historyText || "None"}\n\nProvide:\n- Possible assumptions or blind spots\n- What viewpoints may be underrepresented\n- Confidence level (low/medium/high) and why`,
      };

      const result = await llm(promptByMode[mode], {
        max_new_tokens: 220,
        temperature: 0.2,
        repetition_penalty: 1.1,
      });
      const answer = result[0].generated_text.trim();
      const titles = {
        question: `Q: ${question}`,
        summary: "Summary & key insights",
        bias: "Potential author biases",
      };
      conversation.push({
        title: titles[mode],
        answer: answer || "No response generated.",
      });
      renderConversation();
      statusElement.textContent = `Model loaded: ${modelName}`;
    } catch (error) {
      statusElement.textContent = "Error running tiny model";
      answerElement.textContent = "Failed to run model in this browser. Please check browser WebAssembly support and network access.";
      console.error(error);
    } finally {
      buttonElement.disabled = false;
      summarizeButtonElement.disabled = false;
      biasButtonElement.disabled = false;
      clearButtonElement.disabled = false;
    }
  }

  buttonElement.addEventListener("click", function () {
    askModel("question");
  });

  summarizeButtonElement.addEventListener("click", function () {
    askModel("summary");
  });

  biasButtonElement.addEventListener("click", function () {
    askModel("bias");
  });

  clearButtonElement.addEventListener("click", function () {
    conversation = [];
    renderConversation();
    statusElement.textContent = `Model loaded: ${generator ? modelName : "not loaded"}`;
  });

  contextElement.addEventListener("input", function () {
    setContextWindowStatus(contextElement.value.trim());
  });

  setContextWindowStatus(contextElement.value.trim());
  renderConversation();
  preloadPostFromQuery();
</script>
