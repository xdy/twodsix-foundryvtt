// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

/**
 * Hook for proxy socket that advances time as activeGM for the Simple Calendar Module
 * @param {number} timeUsed the scalar of time
 * @param {string} timeUnit the units (key) of the timeUsed scalar, e.g. secs
 */
Hooks.on("advanceTime", async (timeUsed: number, timeUnit:string) => {
  if (game.users.activeGM === game.user) {
    await advanceTime(timeUsed, timeUnit);
  }
});

/**
 * Advances Time (either core or SimpleCalendar)
 * @param {number} timeUsed the scalar of time
 * @param {string} timeUnit the units (key) of the timeUsed scalar, e.g. secs
 */
export async function advanceTime(timeUsed: number, timeUnit:string): Promise<void> {
  if (game.modules.get("foundryvtt-simple-calendar")?.active) {
    await advanceTimeSC(timeUsed, timeUnit);
  } else {
    await advanceTimeCore(timeUsed, timeUnit);
  }
}

/**
 * Advances Time for the Simple Calendar Module
 * @param {number} timeUsed the scalar of time
 * @param {string} timeUnit the units (key) of the timeUsed scalar, e.g. secs
 */
async function advanceTimeSC(timeUsed: number, timeUnit:string): Promise<void> {
  switch (timeUnit) {
    case "sec":
      await SimpleCalendar.api.changeDate({seconds: timeUsed});
      break;
    case "min":
      await SimpleCalendar.api.changeDate({minute: timeUsed});
      break;
    case "hrs":
      await SimpleCalendar.api.changeDate({hour: timeUsed});
      break;
    case "days":
      await SimpleCalendar.api.changeDate({day: timeUsed});
      break;
    case "weeks":
      await SimpleCalendar.api.changeDate({day: timeUsed * 7});
      break;
    case "months":
      await SimpleCalendar.api.changeDate({month: timeUsed});
      break;
    case "rounds":
      await SimpleCalendar.api.changeDate({seconds: timeUsed * CONFIG.time.roundTime});
      break;
    default:
      break;
  }
}
/**
 * Advances Time for core GameTime
 * @param {number} timeUsed the scalar of time
 * @param {string} timeUnit the units (key) of the timeUsed scalar, e.g. secs
 */
async function advanceTimeCore(timeUsed: number, timeUnit:string): Promise<void> {
  let timeInSecs = timeUsed;
  switch (timeUnit) {
    case "sec":
      break;
    case "min":
      timeInSecs *= 60;
      break;
    case "hrs":
      timeInSecs *= 3600;
      break;
    case "days":
      timeInSecs *= 86400;
      break;
    case "weeks":
      timeInSecs *= 604800;
      break;
    case "months":
      timeInSecs *= 2628288;
      break;
    case "rounds":
      timeInSecs *= CONFIG.time.roundTime;
      break;
    default:
      break;
  }
  await game.time.advance(timeInSecs);
}
