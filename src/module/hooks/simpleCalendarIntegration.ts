// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

/**
 * Hook for proxy socket that advances time as activeGM for the Simple Calendar Module
 * @param {number} timeUsed the scalar of time
 * @param {string} timeUnit the units (key) of the timeUsed scalar, e.g. secs
 */
Hooks.on("advanceTime", async (timeUsed: number, timeUnit:string) => {
  if (game.users.activeGM === game.user) {
    await advanceTimeGM(timeUsed, timeUnit);
  }
});

/**
 * Advances Time for the Simple Calendar Module when GM
 * @param {number} timeUsed the scalar of time
 * @param {string} timeUnit the units (key) of the timeUsed scalar, e.g. secs
 */
export async function advanceTimeGM(timeUsed: number, timeUnit:string): Promise<void> {
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
