import type { HealthCheckIssue } from "../checks/check-types";
import {
  addIDSPropertyRequirement,
  exportIDSSpecifications,
  getIDSTitle,
  getLoadedIDSSpecificationCount,
  loadIDSSpecifications,
  runModelHealthChecks,
} from "../checks/model-health";
import {
  exportChecksCsv,
  exportChecksJson,
  formatChecksSummary,
  renderChecksPanel,
} from "../ui/checks-panel";
import { createMessage } from "../ui/dom-utils";
import type { BimElementRecord } from "../data/element-index";
import type { BimAppContext } from "./app-context";

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
      return;
    }

    checksPanel.hidden = false;
    renderChecksPanel({
      report: workspace.healthReport,
      output: checksOutput,
      onSelect: hooks.selectDataRecord,
      onCreateIssue: hooks.createIssueFromHealthCheck,
    });
    checksSummary.textContent = formatChecksSummary(workspace.healthReport);
  }

  function closeChecksPanel() {
    checksPanel.hidden = true;
  }

  async function loadIDSFile() {
    const file = idsFileInput.files?.[0];
    if (!file) return;
    try {
      const xml = await file.text();
      const specs = loadIDSSpecifications(components, xml);
      const loadedTitle = getIDSTitle(components);
      if (loadedTitle) idsTitleInput.value = loadedTitle;
      workspace.healthReport = null;
      checksSummary.textContent = `IDS загружен: ${specs.length} specs`;
      checksOutput.replaceChildren(createMessage(`Файл ${file.name}. Запустите проверку по IDS.`));
    } catch (error) {
      console.error(error);
      checksSummary.textContent = "Ошибка IDS";
      checksOutput.replaceChildren(createMessage(error instanceof Error ? error.message : String(error)));
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
      return;
    }

    const spec = addIDSPropertyRequirement(components, {
      title,
      specificationName,
      entity,
      propertySet,
      propertyName,
    });
    workspace.healthReport = null;
    checksSummary.textContent = `IDS spec добавлен: ${spec.name}`;
    checksOutput.replaceChildren(
      createMessage(`Всего IDS specs: ${getLoadedIDSSpecificationCount(components)}. Можно сохранить IDS или проверить модель.`),
    );
  }

  function saveIDSFile() {
    if (getLoadedIDSSpecificationCount(components) === 0) {
      checksSummary.textContent = "Нет IDS specs для сохранения";
      return;
    }

    const xml = exportIDSSpecifications(components, idsTitleInput.value);
    hooks.downloadTextFile("bim-requirements.ids", xml, "application/xml");
    checksSummary.textContent = `IDS сохранён: ${getLoadedIDSSpecificationCount(components)} specs`;
  }

  async function runChecks() {
    if (!hooks.canUseChecks()) return;
    if (fragments.list.size === 0) return;

    runChecksBtn.loading = true;
    try {
      checksPanel.hidden = false;
      if (workspace.elementIndex.length === 0) {
        checksSummary.textContent = "Сначала индексируем элементы...";
        await hooks.rebuildDataIndex();
      }
      workspace.healthReport = runModelHealthChecks(workspace.elementIndex);
      checksSummary.textContent = formatChecksSummary(workspace.healthReport);
      renderChecksPanel({
        report: workspace.healthReport,
        output: checksOutput,
        onSelect: hooks.selectDataRecord,
        onCreateIssue: hooks.createIssueFromHealthCheck,
      });
      ctx.setStatus(`Model Health: ${workspace.healthReport.summary.issueCount} проблем`);
    } catch (error) {
      console.error(error);
      checksSummary.textContent = "Ошибка проверки";
      checksOutput.replaceChildren(createMessage(error instanceof Error ? error.message : String(error)));
    } finally {
      runChecksBtn.loading = false;
    }
  }

  function resetChecks() {
    workspace.healthReport = null;
    checksSummary.textContent = "Проверка не выполнена";
    checksOutput.replaceChildren(createMessage("Загрузите модель и запустите проверку."));
  }

  return {
    toggleChecksPanel,
    openChecksPanel,
    closeChecksPanel,
    loadIDSFile,
    addIDSRequirementFromForm,
    saveIDSFile,
    runChecks,
    resetChecks,
    exportChecksCsv,
    exportChecksJson,
  };
}
