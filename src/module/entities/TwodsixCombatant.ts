export default class TwodsixCombatant extends Combatant {
  protected _getInitiativeFormula():string {
    if (["ship", "ship_v2"].includes((<TwodsixActor>this.actor).type)) {
      return <string>game.settings.get("twodsix", "shipInitiativeFormula");
    } else {
      return <string>game.settings.get("twodsix", "initiativeFormula");
    }
  }
}
