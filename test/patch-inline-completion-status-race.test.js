const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { patchInlineCompletionStatusRace } = require("../tools/patch/patch-inline-completion-status-race");

function withTempDir(prefix, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  try {
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function readUtf8(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function writeUtf8(filePath, content) {
  fs.writeFileSync(filePath, content, "utf8");
}

test("patchInlineCompletionStatusRace: guards inline completion status updates and is idempotent", () => {
  withTempDir("augment-byok-inline-status-", (dir) => {
    const filePath = path.join(dir, "extension.js");
    const src = [
      `class InlineCompletionProvider{`,
      `  async _getCompletions(r,n,i,o){let s=this._pendingCompletions.getPendingCompletion(r,n);if(s&&s.completions.length>0)return s;if(i.selectedCompletionInfo?.text)return;let a=this._stateController.setState(MJr);try{let c=await this._completionsModel.generateCompletion(r,n,o);if(c&&c.completions.length===0){let l=this._stateController.setState(VJr);setTimeout(()=>{l.dispose()},lvo)}return c}catch(c){c instanceof Z3||this._stateController.setState(DJr)}finally{a.dispose()}}`,
      `}`
    ].join("\n");
    writeUtf8(filePath, src);

    const r1 = patchInlineCompletionStatusRace(filePath);
    assert.equal(r1.changed, true);

    const out1 = readUtf8(filePath);
    assert.ok(out1.includes("__augment_byok_inline_completion_status_race_patched_v1"));
    assert.ok(out1.includes("this.__augment_byok_inlineCompletionStatusSeq=(this.__augment_byok_inlineCompletionStatusSeq||0)+1"));
    assert.ok(out1.includes("__byok_inlineCompletionStatusIsLatest=()=>this.__augment_byok_inlineCompletionStatusSeq===__byok_inlineCompletionStatusSeq"));
    assert.ok(out1.includes("c&&c.completions.length===0&&__byok_inlineCompletionStatusIsLatest()"));
    assert.ok(out1.includes("c instanceof Z3||(__byok_inlineCompletionStatusIsLatest()&&this._stateController.setState(DJr))"));

    const r2 = patchInlineCompletionStatusRace(filePath);
    assert.equal(r2.changed, false);
    const out2 = readUtf8(filePath);
    assert.equal(out2, out1);
  });
});