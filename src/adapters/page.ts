export interface NavigateOptions {
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
  timeout?: number;
}

export interface WaitOptions {
  timeout?: number;
  state?: 'attached' | 'visible' | 'hidden' | 'detached';
}

export interface ScreenshotOptions {
  path?: string;
  fullPage?: boolean;
  type?: 'png' | 'jpeg';
}

export interface PandaPage {
  goto(url: string, opts?: NavigateOptions): Promise<void>;
  setContent(html: string): Promise<void>;
  click(selector: string): Promise<void>;
  fill(selector: string, value: string): Promise<void>;
  text(selector: string): Promise<string>;
  html(selector?: string): Promise<string>;
  eval<T = unknown>(fnOrExpression: string | ((arg: unknown) => T), arg?: unknown): Promise<T>;
  waitFor(selector: string, opts?: WaitOptions): Promise<void>;
  title(): Promise<string>;
  url(): string;
  screenshot(opts?: ScreenshotOptions): Promise<Uint8Array | string>;
  close(): Promise<void>;
  readonly raw: unknown;
}
