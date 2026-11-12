export type EngineName = 'lightpanda' | 'playwright' | 'puppeteer';
export type DriverName = 'playwright' | 'puppeteer';

export interface EnginePlan {
  engine: EngineName;
  driver: DriverName;
  mode: 'cdp' | 'launch';
  cdpUrl?: string;
  executablePath?: string;
  /** false opens a real browser window (unsupported by the lightpanda engine). */
  headless: boolean;
  /** Delay between driver actions, in ms, to make a headed run watchable. */
  slowMo?: number;
}
