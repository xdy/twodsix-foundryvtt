export default class TwodsixCombatant extends Combatant {
  protected _getInitiativeFormula():string {
    if ((<TwodsixActor>this.actor).type === "ship") {
      return <string>game.settings.get("twodsix", "shipInitiativeFormula");
    } else {
      return <string>game.settings.get("twodsix", "initiativeFormula");
    }
  }
}
