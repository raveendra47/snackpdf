// src/engine/errors.ts
var EngineError = class extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = "EngineError";
  }
};
var MESSAGES = {
  "invalid-pdf": "This does not appear to be a valid PDF.",
  "password-required": "This PDF needs a password before it can be opened.",
  "wrong-password": "The password was not accepted.",
  "unsupported-pdf": "This PDF uses a feature that could not be processed safely.",
  "out-of-memory": "There is not enough available memory to process this file.",
  cancelled: "The operation was cancelled.",
  "no-output": "The resulting file could not be created.",
  busy: "Another PDF operation is already running in this tab.",
  "invalid-options": "One or more settings are not valid.",
  "engine-failed": "The resulting file could not be created."
};
function publicMessage(code) {
  return MESSAGES[code] ?? MESSAGES["engine-failed"];
}
function mapEngineFailure(details) {
  const text = details.toLowerCase();
  if (text.includes("password did not match") || text.includes("invalid password")) {
    return new EngineError("wrong-password", publicMessage("wrong-password"));
  }
  if (text.includes("requires a password") || text.includes("passwordprotected")) {
    return new EngineError("password-required", publicMessage("password-required"));
  }
  if (text.includes("not a pdf file") || text.includes("pdf header") || text.includes("syntaxerror")) {
    return new EngineError("invalid-pdf", publicMessage("invalid-pdf"));
  }
  if (text.includes("out of memory") || text.includes("cannot grow memory")) {
    return new EngineError("out-of-memory", publicMessage("out-of-memory"));
  }
  if (text.includes("undefinedresult") || text.includes("unrecoverable error")) {
    return new EngineError("unsupported-pdf", publicMessage("unsupported-pdf"));
  }
  return new EngineError("engine-failed", publicMessage("engine-failed"));
}
export {
  EngineError,
  mapEngineFailure,
  publicMessage
};
