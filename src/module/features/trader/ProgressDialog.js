/**
 * ProgressDialog.js
 * A simple updating progress dialog for long-running operations.
 */

export class ProgressDialog extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
  static DEFAULT_OPTIONS = {
    id: 'trader-progress-dialog',
    tag: 'div',
    classes: ['twodsix', 'progress-dialog'],
    window: { title: 'TWODSIX.Trader.Progress.Title', resizable: false, controls: [] },
    position: { width: 400, height: 'auto' },
  };

  static PARTS = {
    main: {
      template: 'systems/twodsix/templates/trader/progress-dialog.hbs',
    },
  };

  constructor(options = {}) {
    super(options);
    this.label = options.label || '';
    this.progressText = options.progressText || '';
    this.sectorsLoaded = 0;
    this.sectorsTotal = 0;
    this.subsectorsLoaded = 0;
    this.subsectorsTotal = 0;
    this.worldsLoaded = 0;
    this.worldsTotal = 0;
    this.worldsCreated = 0;
    this.worldsToCreate = 0;
  }

  async _prepareContext(_options) {
    return {
      label: this.label,
      progressText: this.progressText,
      sectorsLoaded: this.sectorsLoaded,
      sectorsTotal: this.sectorsTotal,
      subsectorsLoaded: this.subsectorsLoaded,
      subsectorsTotal: this.subsectorsTotal,
      worldsLoaded: this.worldsLoaded,
      worldsTotal: this.worldsTotal,
      worldsCreated: this.worldsCreated,
      worldsToCreate: this.worldsToCreate,
      displaySectors: this.sectorsTotal > 0,
      displaySubsectors: this.subsectorsTotal > 0,
      displayWorlds: this.worldsTotal > 0 || this.worldsToCreate > 0
    };
  }

  /**
   * Update the progress and re-render.
   * @param {object} data
   */
  updateProgress(data = {}) {
    if (data.label !== undefined) {
      this.label = data.label;
    }
    if (data.progressText !== undefined) {
      this.progressText = data.progressText;
    }
    if (data.sectorsLoaded !== undefined) {
      this.sectorsLoaded = data.sectorsLoaded;
    }
    if (data.sectorsTotal !== undefined) {
      this.sectorsTotal = data.sectorsTotal;
    }
    if (data.subsectorsLoaded !== undefined) {
      this.subsectorsLoaded = data.subsectorsLoaded;
    }
    if (data.subsectorsTotal !== undefined) {
      this.subsectorsTotal = data.subsectorsTotal;
    }
    if (data.worldsLoaded !== undefined) {
      this.worldsLoaded = data.worldsLoaded;
    }
    if (data.worldsTotal !== undefined) {
      this.worldsTotal = data.worldsTotal;
    }
    if (data.worldsCreated !== undefined) {
      this.worldsCreated = data.worldsCreated;
    }
    if (data.worldsToCreate !== undefined) {
      this.worldsToCreate = data.worldsToCreate;
    }

    if (this.element) {
      this.render();
    }
  }
}
