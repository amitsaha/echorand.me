import { env, pipeline } from "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2";

const modelName = "Xenova/flan-t5-base";

env.allowLocalModels = false;
env.useBrowserCache = true;

// GitHub Pages is not cross-origin isolated, so multi-threaded WASM cannot start.
try {
  env.backends.onnx.wasm.numThreads = 1;
  env.backends.onnx.wasm.proxy = false;
} catch (error) {
  console.warn("Could not configure the WASM runtime", error);
}

let generatorPromise = null;

function loadGenerator() {
  if (!generatorPromise) {
    generatorPromise = createGenerator().catch(function (error) {
      generatorPromise = null;
      throw error;
    });
  }
  return generatorPromise;
}

async function createGenerator() {
  const generator = await pipeline("text2text-generation", modelName, {
    progress_callback: function (info) {
      self.postMessage({ type: "progress", info: info });
    },
  });
  self.postMessage({
    type: "ready",
    label: "FLAN-T5 base",
    device: "CPU",
  });
  return generator;
}

self.onmessage = async function (event) {
  const data = event.data || {};
  if (data.type !== "generate" || !data.prompt) {
    return;
  }

  try {
    const generator = await loadGenerator();
    self.postMessage({ type: "generating", id: data.id });
    const result = await generator(data.prompt, {
      max_new_tokens: 80,
      do_sample: false,
      repetition_penalty: 1.1,
    });
    const text = result && result[0] && result[0].generated_text ? result[0].generated_text.trim() : "";
    self.postMessage({
      type: "done",
      id: data.id,
      text: text || "No response generated.",
    });
  } catch (error) {
    console.error(error);
    self.postMessage({
      type: "error",
      id: data.id,
      message: error && error.message ? error.message : String(error),
    });
  }
};
