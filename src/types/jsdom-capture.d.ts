/** Minimal typed surface used by local, non-executing HTML capture tools. */
declare module "jsdom" {
  export class JSDOM {
    constructor(html: string);
    readonly window: Window & typeof globalThis;
  }
}
