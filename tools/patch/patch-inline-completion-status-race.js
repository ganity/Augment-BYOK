#!/usr/bin/env node
"use strict";

const path = require("path");

const { replaceOnceRegex } = require("../lib/patch");
const { loadPatchText, savePatchText } = require("./patch-target");

const MARKER = "__augment_byok_inline_completion_status_race_patched_v1";

function requireCapture(match, index, label) {
  const value = String(match[index] || "");
  if (!value) throw new Error(`inline completion status race: missing capture for ${label}`);
  return value;
}

function patchInlineCompletionStatusRace(filePath) {
  const { original, alreadyPatched } = loadPatchText(filePath, { marker: MARKER });
  if (alreadyPatched) return { changed: false, reason: "already_patched" };

  const next = replaceOnceRegex(
    original,
    /let\s+([A-Za-z_$][\w$]*)=this\._stateController\.setState\(MJr\);try\{let\s+([A-Za-z_$][\w$]*)=await\s+this\._completionsModel\.generateCompletion\(([A-Za-z_$][\w$]*),([A-Za-z_$][\w$]*),([A-Za-z_$][\w$]*)\);if\(\2&&\2\.completions\.length===0\)\{let\s+([A-Za-z_$][\w$]*)=this\._stateController\.setState\(VJr\);setTimeout\(\(\)=>\{\6\.dispose\(\)\},lvo\)\}return\s+\2\}catch\(([A-Za-z_$][\w$]*)\)\{\7 instanceof Z3\|\|this\._stateController\.setState\(DJr\)\}finally\{\1\.dispose\(\)\}/g,
    (match) => {
      const loadingStateVar = requireCapture(match, 1, "loadingStateVar");
      const resultVar = requireCapture(match, 2, "resultVar");
      const documentVar = requireCapture(match, 3, "documentVar");
      const positionVar = requireCapture(match, 4, "positionVar");
      const timelineVar = requireCapture(match, 5, "timelineVar");
      const emptyStateVar = requireCapture(match, 6, "emptyStateVar");
      const errorVar = requireCapture(match, 7, "errorVar");

      return (
        `let __byok_inlineCompletionStatusSeq=(this.__augment_byok_inlineCompletionStatusSeq=(this.__augment_byok_inlineCompletionStatusSeq||0)+1),` +
        `__byok_inlineCompletionStatusIsLatest=()=>this.__augment_byok_inlineCompletionStatusSeq===__byok_inlineCompletionStatusSeq,` +
        `${loadingStateVar}=this._stateController.setState(MJr);` +
        `try{let ${resultVar}=await this._completionsModel.generateCompletion(${documentVar},${positionVar},${timelineVar});` +
        `if(${resultVar}&&${resultVar}.completions.length===0&&__byok_inlineCompletionStatusIsLatest()){` +
        `let ${emptyStateVar}=this._stateController.setState(VJr);setTimeout(()=>{${emptyStateVar}.dispose()},lvo)}` +
        `return ${resultVar}}catch(${errorVar}){` +
        `${errorVar} instanceof Z3||(__byok_inlineCompletionStatusIsLatest()&&this._stateController.setState(DJr))` +
        `}finally{${loadingStateVar}.dispose()}`
      );
    },
    "inline completion status race: _getCompletions state flow"
  );

  savePatchText(filePath, next, { marker: MARKER });
  return { changed: true, reason: "patched" };
}

module.exports = { patchInlineCompletionStatusRace };

if (require.main === module) {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error(`usage: ${path.basename(process.argv[1])} <extension/out/extension.js>`);
    process.exit(2);
  }
  patchInlineCompletionStatusRace(filePath);
}