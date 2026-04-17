// CharGenDecisionStore.js — Encapsulates replay/undo decision state for CharGenApp.

export class CharGenDecisionStore {
  decisions = [];
  cursor = 0;

  resetCursor() {
    this.cursor = 0;
  }

  resetAll() {
    this.decisions = [];
    this.cursor = 0;
  }

  /**
   * Reserve the next replay slot and return { index, decision }.
   * `decision` is null when there is no stored replay value at this index.
   */
  next() {
    const index = this.cursor++;
    const decision = index < this.decisions.length ? this.decisions[index] : null;
    return { index, decision };
  }

  push(decision) {
    this.decisions.push(decision);
  }

  replace(index, decision) {
    if (index >= 0 && index < this.decisions.length) {
      this.decisions[index] = decision;
    }
  }

  /**
   * Trim history up to the previous choice decision.
   * Returns true if undo removed at least one choice.
   */
  undoLastChoice() {
    let i = this.decisions.length - 1;
    while (i >= 0 && this.decisions[i].type !== 'choice') {
      i--;
    }
    if (i < 0) {
      return false;
    }
    this.decisions = this.decisions.slice(0, i);
    this.cursor = Math.min(this.cursor, this.decisions.length);
    return true;
  }
}
