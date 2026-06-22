import type { Profile } from "../types.ts";
import type { BimAppContext } from "./app-context.ts";
import { BIM_PROFILE_PATH, KM_PROFILE_PATH, KM_VIEWER_PATH, createProfilePath, trimTrailingSlash } from "../config.ts";

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
    if (profile === "pending") profile = "km";
    return createProfilePath(profile);
  }

  function navigateToProfile(profile: Profile) {
    const nextPath = profilePath(profile);

    if (window.location.pathname !== nextPath) {
      window.history.pushState({ profile }, "", nextPath);
    }

    selectProfile(profile);
  }

  function syncProfileWithLocation() {
    const path = trimTrailingSlash(window.location.pathname);

    if (path === trimTrailingSlash(KM_PROFILE_PATH) || path === trimTrailingSlash(KM_VIEWER_PATH)) {
      selectProfile("km");
      return;
    }

    if (path === trimTrailingSlash(BIM_PROFILE_PATH)) {
      selectProfile("bim");
      return;
    }

    selectProfile("km");
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
