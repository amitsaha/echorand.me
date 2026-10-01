---
title: Tiny LLM Lab
---

Try a tiny in-browser LLM to ask questions about any post text you paste below.

<p>
  <label for="post-context">Post text:</label><br />
  <textarea id="post-context" rows="10" cols="80" placeholder="Paste text from one of my posts here"></textarea>
</p>
<p>
  <label for="question">Question:</label><br />
  <input id="question" type="text" size="80" placeholder="What is this post mainly about?" />
</p>
<p>
  <button id="run-llm">Ask tiny LLM</button>
</p>
<p id="llm-status">Model: not loaded</p>
<pre id="llm-answer"></pre>

<script type="module">
  import { env, pipeline } from "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2";

  env.allowLocalModels = false;
  env.useBrowserCache = true;

  const statusElement = document.getElementById("llm-status");
  const answerElement = document.getElementById("llm-answer");
  const buttonElement = document.getElementById("run-llm");
  const contextElement = document.getElementById("post-context");
  const questionElement = document.getElementById("question");

  const modelName = "Xenova/distilgpt2";
  let generator;

  async function getGenerator() {
    if (generator) {
      return generator;
    }

    statusElement.textContent = "Loading tiny model in your browser...";
    generator = await pipeline("text-generation", modelName);
    statusElement.textContent = `Model loaded: ${modelName}`;
    return generator;
  }

  buttonElement.addEventListener("click", async function () {
    const context = contextElement.value.trim();
    const question = questionElement.value.trim();

    if (!context || !question) {
      answerElement.textContent = "Please provide both post text and a question.";
      return;
    }

    buttonElement.disabled = true;
    statusElement.textContent = "Generating answer...";
    answerElement.textContent = "";

    try {
      const llm = await getGenerator();
      const prompt = `Context:\n${context}\n\nQuestion:\n${question}\n\nAnswer:`;
      const result = await llm(prompt, {
        max_new_tokens: 120,
        temperature: 0.7,
        repetition_penalty: 1.1,
      });
      answerElement.textContent = result[0].generated_text.replace(prompt, "").trim();
      statusElement.textContent = `Model loaded: ${modelName}`;
    } catch (error) {
      answerElement.textContent = "Failed to run model in this browser. Please check browser WebAssembly support and network access.";
      statusElement.textContent = "Error running tiny model";
      console.error(error);
    } finally {
      buttonElement.disabled = false;
    }
  });
</script>
