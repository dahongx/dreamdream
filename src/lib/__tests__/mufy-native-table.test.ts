import { expect, test } from "bun:test";
import { hasMufyAdaptedComponent, hasMufyRenderedOpening, needsMufyLightTableRows } from "../import/mufy-native-table";

test("only source black-text tables missing a surface use source row defaults", () => {
  for (const color of ["black", "#000", "#000000", "rgb(0, 0, 0)", "rgba(0, 0, 0, 1)"]) expect(needsMufyLightTableRows({ color })).toBe(true);
  expect(needsMufyLightTableRows({color:"black",backgroundColor:"rgba(0, 0, 0, 0)"})).toBe(true);
});
test("explicit author surfaces, images, light text and gradients are untouched", () => {
  for (const style of [undefined, {}, {color:"white"}, {color:"transparent"}, {color:"black",background:"#222"}, {color:"black",backgroundColor:"white"}, {color:"black",backgroundImage:"linear-gradient(red, blue)"}, {color:"black",background:0}]) expect(needsMufyLightTableRows(style)).toBe(false);
});
test("ordinary rules and disabled imports do not enable platform compatibility", () => {
  const replacement="<artifact><style data-mufy-rendered-opening>body{}</style></artifact>";
  expect(hasMufyRenderedOpening([{enabled:true,replacement}])).toBe(true);
  expect(hasMufyRenderedOpening([{enabled:false,replacement}])).toBe(false);
  expect(hasMufyRenderedOpening([{enabled:true,replacement:"ordinary"}])).toBe(false);
});

test('normal UI migration components enable compatibility without inventing source rules',()=>{
  expect(hasMufyAdaptedComponent([{content:'<style data-mufy-adaptation="mobile-box-model">body{}</style>'}])).toBe(true);
  expect(hasMufyAdaptedComponent([{content:"<style data-mufy-adaptation='mobile-box-model'>body{}</style>"}])).toBe(true);
  expect(hasMufyAdaptedComponent([{content:'<p>mobile-box-model 将莱</p>'}])).toBe(false);
  expect(hasMufyAdaptedComponent([])).toBe(false);
});
