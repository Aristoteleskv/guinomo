// Scene module base: construct with the scene, load assets, resolve `ready`.

import { deferred, type Deferred } from '../core/deferred';
import type { EnvironmentScene } from './environmentScene';

export abstract class SceneModule {
  readonly scene: EnvironmentScene;
  readonly ready: Deferred<void> = deferred();

  constructor(scene: EnvironmentScene) {
    this.scene = scene;
    // `init()` (async in most subclasses) must run after subclass class-field
    // initializers. Calling it synchronously here reads arrow-field handlers
    // before they exist, which previously pushed `undefined` into
    // beforeRenderCbs for worlds whose init had no leading await.
    queueMicrotask(() => void this.init());
  }

  protected abstract init(): void;
}
