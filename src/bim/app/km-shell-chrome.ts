import type { Profile } from "../types.ts";

export interface KmShellChromeDom {
  profileScreen: HTMLElement;
  bimStub: HTMLElement;
}

function removeById(id: string) {
  if (typeof document === "undefined") return;
  const element = document.getElementById(id);
  element?.remove();
}

function removeBySelector(selector: string) {
  if (typeof document === "undefined") return;
  const element = document.querySelector(selector);
  element?.remove();
}

export function stripKmProfileChrome(profile: Profile, dom: KmShellChromeDom) {
  if (profile !== "km") return false;

  dom.profileScreen.remove();
  dom.bimStub.remove();

  for (const id of [
    "uploadModeModal",
    "libraryModal",
    "federationBtn",
    "dataBrowserBtn",
    "checksBtn",
    "issuesBtn",
    "clashBtn",
    "drawingsBtn",
    "helpBtn",
    "federationPanel",
    "dataPanel",
    "checksPanel",
    "issuesPanel",
    "clashPanel",
    "drawingsPanel",
    "helpPage",
    "propertiesPanel",
    "drawingSplitHandle",
    "topBackBtn",
    "emptyExampleBtn",
    "emptyLibraryBtn",
  ]) {
    removeById(id);
  }

  removeBySelector(".side-panel");
  return true;
}
