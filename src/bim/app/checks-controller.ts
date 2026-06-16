import type { HealthCheckIssue, HealthCheckIssueType } from "../checks/check-types.ts";
import {
  addIDSPropertyRequirement,
  exportIDSSpecifications,
  getIDSTitle,
  getLoadedIDSSpecificationCount,
  loadIDSSpecifications,
  runModelHealthChecks,
} from "../checks/model-health.ts";
import {
  clearStoredChecksSettings,
  createDefaultChecksRuleRegistry,
  loadChecksRuleRegistry,
  saveStoredChecksSettings,
} from "../checks/check-settings.ts";
import {
  exportChecksCsv,
  exportChecksJson,
  formatChecksSummary,
  renderChecksPanel,
} from "../ui/checks-panel.ts";
import { renderChecksSettingsPanel } from "../ui/checks-settings-panel.ts";
import { createMessage } from "../ui/dom-utils.ts";
import type { BimElementRecord } from "../data/element-index.ts";
import { getHealthIssueCount } from "../state/workspace-state.ts";
import type { BimAppContext } from "./app-context.ts";
import { logControllerError } from "../ui/controller-errors.ts";

export interface ChecksControllerHooks {
  canUseChecks: () => boolean;
  rebuildDataIndex: () => Promise<void>;
  selectDataRecord: (record: BimElementRecord) => Promise<void>;
  createIssueFromHealthCheck: (healthIssue: HealthCheckIssue) => void;
  downloadTextFile: (name: string, content: string, type: string) => void;
}

export function createChecksController(ctx: BimAppContext, hooks: ChecksControllerHooks) {
  const { workspace } = ctx;
  const { components, fragments } = ctx.viewer;
  const {
    checksPanel,
    checksSummary,
    runChecksBtn,
    idsFileInput,
    idsTitleInput,
    idsSpecNameInput,
    idsEntityInput,
    idsPsetInput,
    idsPropertyInput,
    checksSettingsSummary,
    saveChecksSettingsBtn,
    resetChecksSettingsBtn,
    checksSettingsOutput,
    checksOutput,
  } = ctx.dom;

  function toggleChecksPanel() {
    if (checksPanel.hidden) {
      openChecksPanel();
      return;
    }

    closeChecksPanel();
  }

  function openChecksPanel() {
    if (!hooks.canUseChecks()) {
      checksPanel.hidden = true;
      ctx.setStatus("Model Health Checks доступны только в профиле BIM");
      ctx.showToast("Model Health Checks доступны только в профиле BIM", "error");
      return;
    }

    checksPanel.hidden = false;
    renderChecksPanel({
      report: workspace.checks.healthReport,
      output: checksOutput,
      onSelect: hooks.selectDataRecord,
      onCreateIssue: hooks.createIssueFromHealthCheck,
    });
    checksSummary.textContent = formatChecksSummary(workspace.checks.healthReport);
    syncChecksSettingsPanel();
  }

  function closeChecksPanel() {
    checksPanel.hidden = true;
  }

  function syncChecksSettingsPanel() {
    if (!hooks.canUseChecks()) {
      checksSettingsSummary.textContent = "Доступно только в BIM";
      checksSettingsOutput.replaceChildren(createMessage("Откройте BIM-профиль, чтобы управлять правилами проверок."));
      return;
    }

    renderChecksSettingsPanel({
      registry: workspace.checks.ruleRegistry,
      summary: checksSettingsSummary,
      output: checksSettingsOutput,
    });
  }

  function loadChecksSettings(profile = workspace.viewer.activeProfile) {
    workspace.checks.ruleRegistry = loadChecksRuleRegistry(profile);
    syncChecksSettingsPanel();
  }

  function saveChecksSettings() {
    if (!hooks.canUseChecks()) return null;
    return saveStoredChecksSettings(workspace.viewer.activeProfile, workspace.checks.ruleRegistry);
  }

  function resetChecksSettings() {
    workspace.checks.ruleRegistry = createDefaultChecksRuleRegistry();
    clearStoredChecksSettings(workspace.viewer.activeProfile);
    syncChecksSettingsPanel();
    workspace.checks.healthReport = null;
    checksSummary.textContent = "Настройки проверок сброшены";
    checksOutput.replaceChildren(createMessage("Настройки проверок сброшены. Запустите проверку повторно."));
  }

  function handleChecksSettingsChange(event: Event) {
    if (!hooks.canUseChecks()) return;
    const target = event.target as HTMLInputElement | null;
    if (!target) return;

    const toggleType = target.dataset.checksRuleToggle;
    const priorityType = target.dataset.checksRulePriority;
    if (!toggleType && !priorityType) return;

    if (toggleType) {
      if (target.checked) workspace.checks.ruleRegistry.enableRule(toggleType as HealthCheckIssueType);
      else workspace.checks.ruleRegistry.disableRule(toggleType as HealthCheckIssueType);
    }

    if (priorityType) {
      const priority = Number(target.value);
      if (Number.isFinite(priority)) {
        workspace.checks.ruleRegistry.setRulePriority(priorityType as never, priority);
      }
    }

    workspace.checks.healthReport = null;
    checksSummary.textContent = "Настройки проверок изменены";
    checksOutput.replaceChildren(createMessage("Настройки проверок изменены. Запустите проверку ещё раз."));
    saveChecksSettings();
    syncChecksSettingsPanel();
  }

  function handleSaveChecksSettings() {
    const payload = saveChecksSettings();
    if (!payload) return;
    ctx.setStatus("Настройки проверок сохранены");
    ctx.showToast(`Настройки проверок сохранены: ${payload.rules.length} правил`, "success");
    syncChecksSettingsPanel();
  }

  function handleResetChecksSettings() {
    resetChecksSettings();
    ctx.setStatus("Настройки проверок сброшены");
    ctx.showToast("Настройки проверок сброшены", "success");
  }
  async function loadIDSFile() {
    const file = idsFileInput.files?.[0];
    if (!file) return;
    try {
      const xml = await file.text();
      const specs = loadIDSSpecifications(components, xml);
      const loadedTitle = getIDSTitle(components);
      if (loadedTitle) idsTitleInput.value = loadedTitle;
      workspace.checks.healthReport = null;
      checksSummary.textContent = `IDS загружен: ${specs.length} specs`;
      checksOutput.replaceChildren(createMessage(`Файл ${file.name}. Запустите проверку по IDS.`));
      ctx.showToast(`IDS загружен: ${specs.length} specs`, "success");
    } catch (error) {
      logControllerError(error);
      checksSummary.textContent = "Ошибка IDS";
      checksOutput.replaceChildren(createMessage(error instanceof Error ? error.message : String(error)));
      ctx.showToast(error instanceof Error ? error.message : String(error), "error");
    }
  }

  function addIDSRequirementFromForm() {
    const title = idsTitleInput.value.trim() || "BIM IDS";
    const specificationName = idsSpecNameInput.value.trim();
    const entity = idsEntityInput.value.trim();
    const propertySet = idsPsetInput.value.trim();
    const propertyName = idsPropertyInput.value.trim();

    if (!(specificationName && entity && propertySet && propertyName)) {
      checksSummary.textContent = "Заполните spec, entity, pset и property";
      ctx.showToast("Заполните spec, entity, pset и property", "error");
      return;
    }

    const spec = addIDSPropertyRequirement(components, {
      title,
      specificationName,
      entity,
      propertySet,
      propertyName,
    });
    workspace.checks.healthReport = null;
    checksSummary.textContent = `IDS spec добавлен: ${spec.name}`;
    ctx.showToast(`IDS spec добавлен: ${spec.name}`, "success");
    checksOutput.replaceChildren(
      createMessage(`Всего IDS specs: ${getLoadedIDSSpecificationCount(components)}. Можно сохранить IDS или проверить модель.`),
    );
  }

  function saveIDSFile() {
    if (getLoadedIDSSpecificationCount(components) === 0) {
      checksSummary.textContent = "Нет IDS specs для сохранения";
      ctx.showToast("Нет IDS specs для сохранения", "error");
      return;
    }

    const xml = exportIDSSpecifications(components, idsTitleInput.value);
    hooks.downloadTextFile("bim-requirements.ids", xml, "application/xml");
    checksSummary.textContent = `IDS сохранён: ${getLoadedIDSSpecificationCount(components)} specs`;
    ctx.showToast(`IDS сохранён: ${getLoadedIDSSpecificationCount(components)} specs`, "success");
  }

  async function runChecks() {
    if (!hooks.canUseChecks()) return;
    if (fragments.list.size === 0) return;

    runChecksBtn.loading = true;
    try {
      checksPanel.hidden = false;
      if (workspace.data.elementIndex.length === 0) {
        checksSummary.textContent = "Сначала индексируем элементы...";
        await hooks.rebuildDataIndex();
      }
      workspace.checks.healthReport = runModelHealthChecks(workspace.data.elementIndex, workspace.checks.ruleRegistry);
      checksSummary.textContent = formatChecksSummary(workspace.checks.healthReport);
      renderChecksPanel({
        report: workspace.checks.healthReport,
        output: checksOutput,
        onSelect: hooks.selectDataRecord,
        onCreateIssue: hooks.createIssueFromHealthCheck,
      });
      const issueCount = getHealthIssueCount(workspace.checks);
      ctx.setStatus(`Model Health: ${issueCount} проблем`);
      ctx.showToast(`Model Health: ${issueCount} проблем`, "success");
    } catch (error) {
      logControllerError(error);
      checksSummary.textContent = "Ошибка проверки";
      checksOutput.replaceChildren(createMessage(error instanceof Error ? error.message : String(error)));
      ctx.showToast(error instanceof Error ? error.message : String(error), "error");
    } finally {
      runChecksBtn.loading = false;
    }
  }

  function resetChecks() {
    workspace.checks.healthReport = null;
    checksSummary.textContent = "Проверка не выполнена";
    checksOutput.replaceChildren(createMessage("Загрузите модель и запустите проверку."));
  }

  checksSettingsOutput.onchange = handleChecksSettingsChange;
  saveChecksSettingsBtn.onclick = () => handleSaveChecksSettings();
  resetChecksSettingsBtn.onclick = () => handleResetChecksSettings();

  return {
    toggleChecksPanel,
    openChecksPanel,
    closeChecksPanel,
    loadChecksSettings,
    loadIDSFile,
    addIDSRequirementFromForm,
    saveIDSFile,
    runChecks,
    resetChecks,
    exportChecksCsv,
    exportChecksJson,
  };
}
