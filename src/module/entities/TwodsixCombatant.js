export default class TwodsixCombatant extends Combatant {
  _getInitiativeFormula() {
    if (this.actor.type === "ship") {
      return game.settings.get("twodsix", "shipInitiativeFormula");
    } else {
      return game.settings.get("twodsix", "initiativeFormula");
    }
  }
}
