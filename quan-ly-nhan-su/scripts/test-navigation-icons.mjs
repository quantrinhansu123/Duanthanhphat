import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
import React from "react";
import * as icons from "@phosphor-icons/react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
function load(relative, dependencies = {}) {
  const exports = {};
  const source = fs.readFileSync(new URL(relative, import.meta.url), "utf8");
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, {
    exports,
    require: (id) => dependencies[id] ?? require(id),
  });
  return exports;
}
const { navigation } = load("../src/data/navigation.ts");
const { groupIcons, childIcons } = load("../src/data/navigationIcons.ts", {
  "@/components/icons": icons,
});
for (const group of navigation) {
  assert.ok(groupIcons[group.id], `Missing group icon: ${group.id}`);
  for (const child of group.children) {
    assert.ok(childIcons[child.id], `Missing child icon: ${child.id}`);
    const markup = renderToStaticMarkup(React.createElement(childIcons[child.id], {
      size: 18, weight: "regular", "aria-hidden": true,
    }));
    assert.match(markup, /<svg[^>]*aria-hidden="true"/);
  }
}
console.log(`Navigation icons OK: ${navigation.length} groups, ${navigation.flatMap(g => g.children).length} children`);
