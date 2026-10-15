import { env, pipeline } from "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2";

env.allowLocalModels = false;
env.useBrowserCache = true;

// GitHub Pages is not cross-origin isolated, so multi-threaded WASM cannot start.
try {
  env.backends.onnx.wasm.numThreads = 1;
  env.backends.onnx.wasm.proxy = false;
} catch (error) {
  console.warn("Could not configure the WASM runtime", error);
}

const modelName = "Xenova/mobilebert-uncased-mnli";
let classifierPromise = null;

function loadClassifier() {
  if (!classifierPromise) {
    classifierPromise = pipeline("zero-shot-classification", modelName, {
      quantized: true,
      progress_callback: function (info) {
        self.postMessage({ type: "progress", info: info });
      },
    }).catch(function (error) {
      classifierPromise = null;
      throw error;
    });
  }
  return classifierPromise;
}

async function classify(classifier, text, labels, template) {
  const result = await classifier(text, labels, {
    multi_label: false,
    hypothesis_template: template,
  });
  const output = Array.isArray(result) ? result[0] : result;
  const scores = {};
  output.labels.forEach(function (label, index) {
    scores[label] = output.scores[index];
  });
  return scores;
}

self.onmessage = async function (event) {
  const data = event.data || {};
  if (data.type !== "decide") {
    return;
  }

  try {
    const classifier = await loadClassifier();
    self.postMessage({ type: "ready", id: data.id });
    const state = String(data.state || "").slice(0, 1200);

    self.postMessage({ type: "step", id: data.id, label: "which team" });
    const department = await classify(
      classifier,
      state,
      [
        "to return or exchange an item",
        "where their package is",
        "about a charge on their card",
      ],
      "The customer is asking {}."
    );

    self.postMessage({ type: "step", id: data.id, label: "urgent attention" });
    const urgency = await classify(
      classifier,
      state,
      ["needs urgent human attention", "can wait for a normal reply"],
      "This message {}."
    );

    self.postMessage({ type: "step", id: data.id, label: "frustration" });
    const frustration = await classify(
      classifier,
      state,
      ["the customer is calm", "the customer is frustrated", "the customer is very angry"],
      "In this message, {}."
    );

    self.postMessage({
      type: "done",
      id: data.id,
      department: department,
      urgency: urgency,
      frustration: frustration,
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
