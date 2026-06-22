import type { Profile } from "../types.ts";
import type { BimAppContext } from "./app-context.ts";

export interface BimProfileRouterOptions {
  ctx: BimAppContext;
  closeDataPanel: () => void;
  closeChecksPanel: () => void;
  closeIssuesPanel: () => void;
  closeClashPanel: () => void;
  closeDrawingsPanel: () => void;
  refreshModelState: () => void;
  onProfileChange?: (profile: Profile) => void;
}

export function createProfileRouter({
  ctx,
  closeDataPanel,
  closeChecksPanel,
  closeIssuesPanel,
  closeClashPanel,
  closeDrawingsPanel,
  refreshModelState,
  onProfileChange,
}: BimProfileRouterOptions) {
  const { app, bimStub } = ctx.dom;

  function profilePath(profile: Profile) {
    if (profile === "km") return "/blue/km/";
    if (profile === "bim") return "/ifc-engine-wasm/bim/";
    return "/blue/km/";
  }

  function navigateToProfile(profile: Profile) {
    const nextPath = profilePath(profile);

    if (window.location.pathname !== nextPath) {
      window.history.pushState({ profile }, "", nextPath);
    }

    selectProfile(profile);
  }

  function syncProfileWithLocation() {
    const path = window.location.pathname.replace(/\/+$/, "");

    if (path === "/blue/km" || path === "/blue/km/viewer") {
      selectProfile("km");
      return;
    }

    if (path === "/ifc-engine-wasm/bim") {
      selectProfile("bim");
      return;
    }

    selectProfile("pending");
  }

  function selectProfile(profile: Profile) {
    ctx.workspace.viewer.activeProfile = profile;
    app.classList.remove("profile-pending", "profile-km", "profile-bim");
    bimStub.hidden = true;

    if (profile === "pending") {
      app.classList.add("profile-pending");
      refreshProfilePanels();
      onProfileChange?.(profile);
      return;
    }

    app.classList.add(profile === "km" ? "profile-km" : "profile-bim");
    refreshProfilePanels();
    onProfileChange?.(profile);
  }

  function canUseDataBrowser() {
    return ctx.getCapabilities().dataBrowser;
  }

  function canUseDrawings() {
    return ctx.getCapabilities().drawings;
  }

  function canUseChecks() {
    return ctx.getCapabilities().qaQc;
  }

  function canUseIssues() {
    return ctx.getCapabilities().issues;
  }

  function canUseCoordination() {
    return ctx.getCapabilities().coordination;
  }

  function refreshProfilePanels() {
    if (!canUseDataBrowser()) closeDataPanel();
    if (!canUseChecks()) closeChecksPanel();
    if (!canUseIssues()) closeIssuesPanel();
    if (!canUseCoordination()) closeClashPanel();
    if (!canUseDrawings()) closeDrawingsPanel();
    refreshModelState();
  }

  if (typeof window.addEventListener === "function") {
    window.addEventListener("popstate", syncProfileWithLocation);
  }

  return {
    profilePath,
    navigateToProfile,
    syncProfileWithLocation,
    selectProfile,
    canUseDataBrowser,
    canUseDrawings,
    canUseChecks,
    canUseIssues,
    canUseCoordination,
    refreshProfilePanels,
  };
}
