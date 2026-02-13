// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.
import { AbstractTwodsixActorSheet } from "./AbstractTwodsixActorSheet";
import { TWODSIX } from "../config";
import { buildTradeReportRows, generateTradeInformation } from "../trade/TradeGenerator";

export class TwodsixWorldSheet extends foundry.applications.api.HandlebarsApplicationMixin(AbstractTwodsixActorSheet) {
  static DEFAULT_OPTIONS = {
    sheetType: "TwodsixWorldSheet",
    classes: ["twodsix", "world", "actor"],
    dragDrop: [],
    position: {
      width: 835,
      height: 600
    },
    window: {
      resizable: true,
      icon: "fa-solid fa-globe"
    },
    form: {
      submitOnChange: true,
      submitOnClose: true
    },
    tag: "form",
    actions: {
      editSVG: this.#onEditWorldImage,
      generateTrade: this.#onGenerateTrade
    },
  };

  static PARTS = {
    main: {
      template: "systems/twodsix/templates/actors/world-sheet.hbs",
      scrollable: ["", ".world-environment-container", "world-environment-container"]
    }
  };

  static TABS = {
    primary: {
      tabs: [
        {id: "worlddata", icon: "fa-solid fa-globe", label: "TWODSIX.World.Tabs.WorldData"},
        {id: "description", icon: "fa-solid fa-book", label: "TWODSIX.World.Tabs.Description"},
        {id: "trade", icon: "fa-solid fa-coins", label: "TWODSIX.World.Tabs.Trade"},
        {id: "environment", icon: "fa-solid fa-leaf", label: "TWODSIX.World.Tabs.Environment"},
        {id: "notes", icon: "fa-solid fa-sticky-note", label: "TWODSIX.World.Tabs.Notes"}
      ],
      initial: "worlddata"
    }
  };

  /** @override */
  async _prepareContext(options): Promise<any> {
    const context = await super._prepareContext(options);

    // Build single-line lookup strings for selectOption helpers
    context.WorldSizeOptions = buildStatLookup(TWODSIX.WorldSizeOptions, ["label", "gravity"]);
    context.WorldAtmosphereOptions = buildStatLookup(TWODSIX.WorldAtmosphereOptions, ["label", "pressure", "notes"]);
    context.WorldHydrographicsOptions = buildStatLookup(TWODSIX.WorldHydrographicsOptions, ["label", "notes"]);
    context.WorldPopulationOptions = buildStatLookup(TWODSIX.WorldPopulationOptions, ["label", "notes"]);
    context.StarportClassOptions = buildStatLookup(TWODSIX.StarportClassOptions, ["label", "bestFuel", "annualMaintenance", "shipyardCapacity"]);
    context.WorldGovernmentOptions = buildStatLookup(TWODSIX.WorldGovernmentOptions, ["label", "notes"]);
    context.WorldLawLevelOptions = buildStatLookup(TWODSIX.WorldLawLevelOptions, ["label", "notes"]);
    context.WorldTechLevelOptions = buildStatLookup(TWODSIX.WorldTechLevelOptions, ["label", "notes"]);
    // Exclude gasGiant and planetoidBelt from feature selection
    context.WorldFeaturesOptions = Object.fromEntries(
      Object.entries(TWODSIX.WorldFeaturesOptions).filter(
        ([key]) => key !== "gasGiant" && key !== "planetoidBelt"
      )
    );
    context.features = buildWorldFeaturesContext();
    // Build displayFeatures for icon display: features plus gasGiant/planetoidBelt if present
    const displayFeatures = [...(context.actor.system.features || [])];
    if (context.actor.system.numGasGiants > 0) {
      displayFeatures.push("gasGiant");
    }
    if (context.actor.system.numPlanetoidBelts > 0) {
      displayFeatures.push("planetoidBelt");
    }
    context.displayFeatures = displayFeatures;
    context.WorldTravelZoneOptions = TWODSIX.WorldTravelZones;
    context.getUWP = generateUWP(this.actor);
    const tradeCodesColor = generateTradeCodes(this.actor);
    context.getTradeCodes = tradeCodesColor.codes;
    context.fillColor = tradeCodesColor.fillColor || '#ffffff';
    context.showDefaultImage = this.actor.img === 'systems/twodsix/assets/icons/default_world.png';
    if (this.actor.isToken && this.token && context.showDefaultImage) {
      if (this.token.texture.tint.css !== tradeCodesColor.fillColor ) {
        await this.token.update({ "texture.tint": tradeCodesColor.fillColor });
      }
    }

    if (game.settings.get('twodsix', 'useProseMirror')) {
      const TextEditorImp = foundry.applications.ux.TextEditor.implementation;
      context.richText = {
        description: await TextEditorImp.enrichHTML(context.system.description, {secrets: this.document.isOwner}),
        climate: await TextEditorImp.enrichHTML(context.system.climate, {secrets: this.document.isOwner}),
        hazards: await TextEditorImp.enrichHTML(context.system.hazards, {secrets: this.document.isOwner}),
        specialRules: await TextEditorImp.enrichHTML(context.system.specialRules, {secrets: this.document.isOwner}),
        adventureHooks: await TextEditorImp.enrichHTML(context.system.adventureHooks, {secrets: this.document.isOwner}),
        notes: await TextEditorImp.enrichHTML(context.system.notes, {secrets: this.document.isOwner}),
      };
    }
    return context;
  }
  /**
   * Edit a World Image.
   * Allows SVG element to be clicked and changed as default only works with img elements.
   * @this {TwodsixWorldSheet}
   * @type {ApplicationClickAction}
   */
  static async #onEditWorldImage(_event, target) {
    if (target.nodeName !== "svg") {
      throw new Error("The editSVG action is available only for SVG elements.");
    }
    // If Tokenizer is active and provides an API, delegate to it
    const tokenizerApi = game.modules.get("vtta-tokenizer")?.api;
    if (tokenizerApi && typeof tokenizerApi.launch === "function") {
      tokenizerApi.launch(this.document);
      return;
    }
    // Default image picker logic
    const attr = "img";
    const current = foundry.utils.getProperty(this.document._source, attr);
    const defaultImage = 'systems/twodsix/assets/icons/default_world.png';
    const fp = new foundry.applications.apps.FilePicker.implementation({
      current,
      type: "image",
      redirectToRoot: defaultImage ? [defaultImage] : [],
      callback: path => {
        // Only accept valid image extensions (including .svg)
        if (!/\.(png|jpg|jpeg|webp|svg|gif)$/i.test(path)) {
          ui.notifications.error(game.i18n.localize("ERROR.FileInvalidImageExtension"));
          return;
        }
        target.src = path;
        // Update the document's property (e.g., img or other attr)
        if (this.options.form.submitOnChange) {
          this.document.update({ [attr]: path });
        }
      },
      position: {
        top: this.position.top + 40,
        left: this.position.left + 10
      },
      document: this.document
    });
    await fp.browse();
  }

  /**
   * Generate trade information based on Cepheus Engine rules.
   * Implements the Speculative Trade Checklist from SRD Chapter 7.
   * @this {TwodsixWorldSheet}
   * @type {ApplicationClickAction}
   */
  static async #onGenerateTrade(_event, _target) {
    // Create dialog for trader skill and buyer modifier
    const dialogContent = await foundry.applications.handlebars.renderTemplate('systems/twodsix/templates/chat/trade-dialog.hbs');
    const result = await foundry.applications.api.DialogV2.wait({
      window: {
        title: game.i18n.localize("TWODSIX.Trade.TradeParametersPrompt"),
      },
      position: {width: 500},
      content: dialogContent,
      buttons: [
        {
          action: "generate",
          label: game.i18n.localize("TWODSIX.Trade.GenerateButton"),
          default: true,
          callback: (_eventDialog, _button, dialog) => {
            return {
              brokerSkill: parseInt(dialog.element.querySelector("#brokerSkill")?.value || 0),
              useLocalBroker: (dialog.element.querySelector("#useLocalBroker")?.checked ?? false),
              buyerModifier: parseInt(dialog.element.querySelector("#buyerModifier")?.value || 0),
              supplierModifier: parseInt(dialog.element.querySelector("#supplierModifier")?.value || 0),
              restrictTradeCodes: (dialog.element.querySelector("#restrictTradeCodes")?.checked ?? false),
              capSameWorld: (dialog.element.querySelector("#capSameWorld")?.checked ?? true),
              includeIllegal: (dialog.element.querySelector("#includeIllegal")?.checked ?? false),
              action: "generate"
            };
          }
        },
        {
          action: "cancel",
          label: game.i18n.localize("Cancel")
        }
      ],
      rejectClose: false
    }, { id: `trade-params-dialog-${this.document.id}` });

    if (!result || result === "cancel") {
      return;
    }

    // Use values returned from callback
    const { brokerSkill, useLocalBroker, buyerModifier, supplierModifier, restrictTradeCodes, capSameWorld, includeIllegal } = result || {};

    const worldData = {
      name: this.document.name,
      tradeCodes: generateTradeCodes(this.document).codes.map((c) => c.code),
      starport: this.document.system.starport,
      zone: this.document.system.travelZone || 'Green',
      lawLevel: this.document.system.lawLevel,
      includeIllegalGoods: includeIllegal,
      capSameWorld,
      restrictTradeGoodsToCodes: restrictTradeCodes,
      traderSkill: useLocalBroker ? 0 : Math.max(0, Math.min(15, brokerSkill)),
      useLocalBroker,
      localBrokerSkill: useLocalBroker ? Math.max(0, Math.min(4, brokerSkill)) : 0,
      supplierModifier: supplierModifier,
      buyerModifier: buyerModifier
    };

    const tradeInfo = generateTradeInformation(worldData);
    tradeInfo.worldData = worldData;

    // Helper to format numbers with locale
    const formatCr = (num: number): string => {
      return num.toLocaleString(game.i18n.lang, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    };

    // Build and format trade report rows using TradeGenerator utility
    tradeInfo.rows = buildTradeReportRows(tradeInfo);

    // Purchase pricing summary (buying from suppliers)
    if (tradeInfo.brokerInfo.useLocalBroker) {
      tradeInfo.capNote = tradeInfo.brokerInfo.requestedSkill > tradeInfo.brokerInfo.starportCap
        ? ` (${game.i18n.format("TWODSIX.Trade.CappedAtStarport", {cap: tradeInfo.brokerInfo.starportCap})})`
        : "";
    }

    // Display the report using DialogV2
    const tradeReport = await foundry.applications.handlebars.renderTemplate('systems/twodsix/templates/chat/trade-report.hbs', tradeInfo);
    const buttons = [
      {
        action: "copyChat",
        icon: "fa-solid fa-comment",
        label: game.i18n.localize("TWODSIX.Trade.CopyToChat"),
        callback: () => {
          ChatMessage.create({
            content: tradeReport,
            speaker: ChatMessage.getSpeaker({ actor: this.document })
          });
        }
      },
      {
        action: "copyClipboard",
        icon: "fa-solid fa-copy",
        label: game.i18n.localize("TWODSIX.Trade.CopyToClipboard"),
        callback: () => {
          navigator.clipboard.writeText(tradeReport).then(() => {
            ui.notifications?.info(game.i18n.localize("TWODSIX.Trade.CopiedToClipboard"));
          }, () => {
            ui.notifications?.error(game.i18n.localize("TWODSIX.Trade.ClipboardFailed"));
          });
        }
      },
      {
        action: "close",
        icon: "fa-solid fa-xmark",
        label: game.i18n.localize("TWODSIX.Trade.Close")
      }
    ];
    await foundry.applications.api.DialogV2.wait({
      window: { title: game.i18n.localize("TWODSIX.Trade.GenerationReport"), icon: "fa-solid fa-coins" },
      position: {width: 700},
      content: tradeReport,
      buttons: buttons,
      rejectClose: false
    });
  }
}

// Build a context.features object with localized names and image paths for world features
function buildWorldFeaturesContext(): Record<string, { name: string; img: string }> {
  const features: Record<string, { name: string; img: string }> = {};
  const iconMap: Record<string, string> = {
    scoutBase: "scout-ship.svg",
    navalBase: "star-formation.svg",
    gasGiant: "jupiter.svg",
    highPort: "defense-satellite.svg",
    travellersAid: "suitcase.svg", // Change if you have a better icon
    pirateBase: "pirate-skull.svg",
    planetoidBelt: "asteroid-X.svg"
  };
  for (const [key, locKey] of Object.entries(TWODSIX.WorldFeaturesOptions)) {
    features[key] = {
      name: game.i18n.localize(locKey),
      img: `systems/twodsix/assets/icons/${iconMap[key] || (key + '.svg')}`
    };
  }
  return features;
}

// Generic function to build stat lookup strings with localization and key prefix
function buildStatLookup(options: Record<string, any>, fields: string[]): Record<string, string> {
  return Object.entries(options).reduce((acc, [key, value]) => {
    const parts = fields.map(field => {
      if (typeof value[field] === "string") {
        return game.i18n.localize(value[field]);
      }
      return "";
    });
    acc[key] = `${key}: ${parts.filter(Boolean).join(" | ")}`;
    return acc;
  }, {});
}

/**
 * Generate Universal World Profile (UWP) string for a world.
 * Accepts either a stats object or a world actor (with system property).
 * Calculates single base code per Cepheus SRD rules.
 * @param input Object with stats or a world actor
 * @returns UWP string (e.g. A123456-7A)
 */
export function generateUWP(input: any): string {
  let stats;
  let features = [];
  if (input.system) {
    // Assume actor object
    stats = {
      starport: input.system.starport,
      size: input.system.size,
      atmosphere: input.system.atmosphere,
      hydrographics: input.system.hydrographics,
      population: input.system.population,
      government: input.system.government,
      lawLevel: input.system.lawLevel,
      techLevel: input.system.techLevel
    };
    features = Array.isArray(input.system.features) ? input.system.features : [];
  } else {
    stats = input;
    features = Array.isArray(input.features) ? input.features : [];
  }
  // Convert all values to uppercase hex strings
  const hex = (v: string | number) => {
    if (typeof v === "number") {
      return v.toString(16).toUpperCase();
    }
    return v.toUpperCase();
  };
  const starport = hex(stats.starport);
  const size = hex(stats.size);
  const atmosphere = hex(stats.atmosphere);
  const hydrographics = hex(stats.hydrographics);
  const population = hex(stats.population);
  const government = hex(stats.government);
  const lawLevel = hex(stats.lawLevel);
  const techLevel = hex(stats.techLevel);

  // Calculate single base code per Cepheus SRD rules
  let baseCode = "";
  const hasNaval = features.includes("navalBase");
  const hasScout = features.includes("scoutBase");
  const hasPirate = features.includes("pirateBase");
  if (hasNaval && hasScout) {
    baseCode = "A";
  } else if (hasScout && hasPirate) {
    baseCode = "G";
  } else if (hasNaval) {
    baseCode = "N";
  } else if (hasPirate) {
    baseCode = "P";
  } else if (hasScout) {
    baseCode = "S";
  }

  // Format: Starport + Size + Atmosphere + Hydrographics + Population + Government + LawLevel + '-' + TechLevel + baseCode
  let uwp = `${starport}${size}${atmosphere}${hydrographics}${population}${government}${lawLevel}-${techLevel}${baseCode}`;

  // Add travel zone code: 'A' for Amber, 'R' for Red
  const travelZone = input.system?.travelZone || input.travelZone || "";
  if (typeof travelZone === "string") {
    const tz = travelZone.trim().toLowerCase();
    if (tz === "amber") {
      uwp += " A";
    } else if (tz === "red") {
      uwp += " R";
    }
  }
  // Add populationModifier, numPlanetoidBelts, numGasGiants if present in the data model
  let popMod, belts, giants;
  if (input.system) {
    popMod = input.system.populationModifier;
    belts = input.system.numPlanetoidBelts;
    giants = input.system.numGasGiants;
  } else {
    popMod = input.populationModifier;
    belts = input.numPlanetoidBelts;
    giants = input.numGasGiants;
  }
  // Only append if at least one is > 0
  if ((popMod && popMod > 0) || (belts && belts > 0) || (giants && giants > 0)) {
    uwp += `   ${popMod || 0}${belts || 0}${giants || 0}`;
  }
  return uwp;
}

/**
 * Generate Trade Codes for a world per Cepheus SRD rules.
 * Accepts either a stats object or a world actor (with system property).
 * @param input Object with stats or a world actor
 * @returns Array of { code, tooltip } objects
 */
export function generateTradeCodes(input: any): { code: string, tooltip: string }[] {
  let stats;
  if (input.system) {
    stats = {
      starport: input.system.starport,
      size: input.system.size,
      atmosphere: input.system.atmosphere,
      hydrographics: input.system.hydrographics,
      population: input.system.population,
      government: input.system.government,
      lawLevel: input.system.lawLevel,
      techLevel: input.system.techLevel
    };
  } else {
    stats = input;
  }
  // Convert all values to numbers for comparison
  const num = (v: string | number) => {
    if (typeof v === "string") {
      return parseInt(v, 16);
    }
    return v;
  };
  const size = num(stats.size);
  const atmosphere = num(stats.atmosphere);
  const hydrographics = num(stats.hydrographics);
  const population = num(stats.population);
  const government = num(stats.government);
  const lawLevel = num(stats.lawLevel);
  const techLevel = num(stats.techLevel);

  const codes: { code: string, tooltip: string }[] = [];
  let fillColor = '#ffffff';
  // Agricultural (Ag): Atmosphere 4-9, Hydrographics 4-8, Population 5-7
  if (atmosphere >= 4 && atmosphere <= 9 && hydrographics >= 4 && hydrographics <= 8 && population >= 5 && population <= 7) {
    codes.push({ code: "Ag", tooltip: tradeCodeTooltip("Ag") });
  }
  // Asteroid (As): Size 0, Atmosphere 0, Hydrographics 0
  if (size === 0 && atmosphere === 0 && hydrographics === 0) {
    codes.push({ code: "As", tooltip: tradeCodeTooltip("As") });
  }
  // Barren (Ba): Population 0, Government 0, LawLevel 0
  if (population === 0 && government === 0 && lawLevel === 0) {
    codes.push({ code: "Ba", tooltip: tradeCodeTooltip("Ba") });
    fillColor = '#999999';
  }
  // Desert (De): Atmosphere >= 2, Hydrographics 0
  if (atmosphere >= 2 && hydrographics === 0) {
    codes.push({ code: "De", tooltip: tradeCodeTooltip("De") });
    fillColor = '#cc8800';
  }
  // Fluid Oceans (Fl): Atmosphere >= 10, Hydrographics >= 1
  if (atmosphere >= 10 && hydrographics >= 1) {
    codes.push({ code: "Fl", tooltip: tradeCodeTooltip("Fl") });
    fillColor = '#ff6600';
  }
  // Garden (Ga): Size 5, 6, or 8; Atmosphere 4-9; Hydrographics 4-8
  if ((size === 5 || size === 6 || size === 8) && atmosphere >= 4 && atmosphere <= 9 && hydrographics >= 4 && hydrographics <= 8) {
    codes.push({ code: "Ga", tooltip: tradeCodeTooltip("Ga") });
    fillColor = '#009900';
  }
  // High Population (Hi): Population >= 9
  if (population >= 9) {
    codes.push({ code: "Hi", tooltip: tradeCodeTooltip("Hi") });
  }
  // Ice-Capped (Ic): Atmosphere 0-1, Hydrographics >= 1
  if ((atmosphere === 0 || atmosphere === 1) && hydrographics >= 1) {
    codes.push({ code: "Ic", tooltip: tradeCodeTooltip("Ic") });
    fillColor = '#ccccff';
  }
  // Industrial (In): Atmosphere 0-2, 4, 7, 9; Population >= 9
  if ((atmosphere >= 0 && atmosphere <= 2) || atmosphere === 4 || atmosphere === 7 || atmosphere === 9) {
    if (population >= 9) {
      codes.push({ code: "In", tooltip: tradeCodeTooltip("In") });
    }
  }
  // Low Population (Lo): Population 1-3
  if (population >= 1 && population <= 3) {
    codes.push({ code: "Lo", tooltip: tradeCodeTooltip("Lo") });
  }
  // Non-Agricultural (Na): Atmosphere 0-3, Hydrographics 0-3, Population >= 6
  if (atmosphere >= 0 && atmosphere <= 3 && hydrographics >= 0 && hydrographics <= 3 && population >= 6) {
    codes.push({ code: "Na", tooltip: tradeCodeTooltip("Na") });
  }
  // Non-Industrial (Ni): Population 4-6
  if (population >= 4 && population <= 6) {
    codes.push({ code: "Ni", tooltip: tradeCodeTooltip("Ni") });
  }
  // Poor (Po): Atmosphere 2-5, Hydrographics 0-3
  if (atmosphere >= 2 && atmosphere <= 5 && hydrographics >= 0 && hydrographics <= 3) {
    codes.push({ code: "Po", tooltip: tradeCodeTooltip("Po") });
  }
  // Rich (Ri): Atmosphere 6, 8; Population 6-8
  if ((atmosphere === 6 || atmosphere === 8) && population >= 6 && population <= 8) {
    codes.push({ code: "Ri", tooltip: tradeCodeTooltip("Ri") });
  }
  // Water World (Wa): Hydrographics === 10
  if (hydrographics === 10) {
    codes.push({ code: "Wa", tooltip: tradeCodeTooltip("Wa") });
    fillColor = '#3366cc';
  }
  // Vacuum (Va): Atmosphere 0
  if (atmosphere === 0) {
    codes.push({ code: "Va", tooltip: tradeCodeTooltip("Va") });
  }
  // High Technology (Ht): TechLevel >= 12
  if (techLevel >= 12) {
    codes.push({ code: "Ht", tooltip: tradeCodeTooltip("Ht") });
  }
  // Low Technology (Lt): TechLevel <= 5
  if (techLevel <= 5) {
    codes.push({ code: "Lt", tooltip: tradeCodeTooltip("Lt") });
  }

  return {codes, fillColor};
}

/**
 * Returns the localization string for a trade code under TWODSIX.World.TradeCode.
 * @param code Trade code string (e.g. "Ag")
 * @returns Localization string
 */
export function tradeCodeTooltip(code: string): string {
  return `TWODSIX.World.Stats.TradeCode.${code}`;
}

export default TwodsixWorldSheet;
