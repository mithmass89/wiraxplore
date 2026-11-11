// src/utils/logger.ts
import chalk from 'chalk';

export const log = {
  info: (msg: string) => console.log(chalk.cyan('i'), msg),
  ok: (msg: string) => console.log(chalk.green('✓'), msg),
  warn: (msg: string) => console.log(chalk.yellow('!'), msg),
  error: (msg: string) => console.error(chalk.red('✗'), msg),
  step: (msg: string) => console.log(chalk.magenta('→'), msg),
  dim: (msg: string) => console.log(chalk.gray(msg)),
};
