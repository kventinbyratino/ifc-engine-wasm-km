import type { Profile } from "../types.ts";

export interface KmShellChromeDom {
  profileScreen: HTMLElement;
  bimStub: HTMLElement;
}

export function stripKmProfileChrome(profile: Profile, dom: KmShellChromeDom) {
  if (profile !== "km") return false;

  dom.profileScreen.remove();
  dom.bimStub.remove();
  return true;
}
