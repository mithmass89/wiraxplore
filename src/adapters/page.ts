export type WaitState = 'attached' | 'visible' | 'hidden' | 'detached';

export interface NavigateOptions {
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
  timeout?: number;
}

export interface WaitOptions {
  timeout?: number;
  /** Default 'visible'. All four states are implemented identically on every driver. */
  state?: WaitState;
}

export interface FillOptions {
  /** Also blur the field after writing (default false). */
  blur?: boolean;
}

export interface TypeOptions {
  /** Delay between keystrokes in ms. Default 0. */
  delay?: number;
  /** Clear the field first (default true). */
  clear?: boolean;
}

export interface ScreenshotOptions {
  path?: string;
  fullPage?: boolean;
  type?: 'png' | 'jpeg';
  /** Capture only this element instead of the viewport. */
  selector?: string;
}

export interface Viewport {
  width: number;
  height: number;
}

export interface PandaPage {
  goto(url: string, opts?: NavigateOptions): Promise<void>;
  setContent(html: string): Promise<void>;
  click(selector: string): Promise<void>;
  /** Set the value directly and dispatch input + change. No key events. */
  fill(selector: string, value: string, opts?: FillOptions): Promise<void>;
  /** Real keystrokes, so keydown/keypress/masks behave like a user. */
  type(selector: string, text: string, opts?: TypeOptions): Promise<void>;
  /** Press a single key on the focused element, e.g. 'Enter', 'Tab', 'Escape'. */
  press(key: string): Promise<void>;
  text(selector: string): Promise<string>;
  value(selector: string): Promise<string>;
  html(selector?: string): Promise<string>;
  eval<T = unknown>(fnOrExpression: string | ((arg: unknown) => T), arg?: unknown): Promise<T>;
  waitFor(selector: string, opts?: WaitOptions): Promise<void>;
  /** Wait until an in-page predicate returns truthy. Replaces hand-rolled polling. */
  waitForFunction<T = unknown>(
    fnOrExpression: string | ((arg: unknown) => T),
    arg?: unknown,
    opts?: { timeout?: number; polling?: number },
  ): Promise<T>;
  setViewport(viewport: Viewport): Promise<void>;
  title(): Promise<string>;
  url(): string;
  screenshot(opts?: ScreenshotOptions): Promise<Uint8Array | string>;
  close(): Promise<void>;
  readonly raw: unknown;
}
