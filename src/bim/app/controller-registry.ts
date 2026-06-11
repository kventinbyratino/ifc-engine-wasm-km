export interface ControllerRegistryEntry {
  open?: () => void;
  close?: () => void;
  render?: () => void;
  reset?: () => void;
  refresh?: () => void;
  persist?: () => unknown;
}

export function createControllerRegistry() {
  const controllers = new Map<string, ControllerRegistryEntry>();

  return {
    register(name: string, entry: ControllerRegistryEntry) {
      controllers.set(name, {
        ...controllers.get(name),
        ...entry,
      });
    },
    open(name: string) {
      controllers.get(name)?.open?.();
    },
    close(name: string) {
      controllers.get(name)?.close?.();
    },
    render(name: string) {
      controllers.get(name)?.render?.();
    },
    reset(name: string) {
      controllers.get(name)?.reset?.();
    },
    refresh(name: string) {
      controllers.get(name)?.refresh?.();
    },
    persist(name: string) {
      return controllers.get(name)?.persist?.();
    },
  };
}
