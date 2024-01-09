// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

export default class TwodsixCombatant extends Combatant {
  protected _getInitiativeFormula():string {
    if ((<TwodsixActor>this.actor).type === "ship") {
      return <string>game.settings.get("twodsix", "shipInitiativeFormula");
    } else {
      return <string>game.settings.get("twodsix", "initiativeFormula");
    }
  }
}
