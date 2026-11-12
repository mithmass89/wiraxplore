export type EngineName = 'lightpanda' | 'playwright' | 'puppeteer';
export type DriverName = 'playwright' | 'puppeteer';

export interface EnginePlan {
  engine: EngineName;
  driver: DriverName;
  mode: 'cdp' | 'launch';
  cdpUrl?: string;
  executablePath?: string;
}
