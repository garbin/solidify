import DataLoader from "dataloader"

export class Loader {
  loaders: Record<string, DataLoader<unknown, unknown>> = {}

  constructor(loaders: Record<string, DataLoader<unknown, unknown>> = {}) {
    this.loaders = loaders
  }

  acquire<K, V>(
    name: string,
    batchFun: (keys: readonly K[]) => Promise<(V | Error | null)[]>,
    options?: DataLoader.Options<K, V>,
  ): DataLoader<K, V> {
    if (!this.loaders[name]) {
      this.loaders[name] = new DataLoader(
        batchFun as (
          keys: readonly unknown[],
        ) => Promise<(unknown | Error | null)[]>,
        options,
      )
    }
    return this.loaders[name] as DataLoader<K, V>
  }
}
