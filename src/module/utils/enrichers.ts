// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import { getControlledTraveller } from "../sheets/TwodsixVehicleSheet";
import TwodsixItem  from "../entities/TwodsixItem";
import { getInitialSettingsFromFormula } from "./TwodsixRollSettings";
import { TwodsixRollSettings } from "./TwodsixRollSettings";

// Adapted from https://github.com/pafvel/dragonbane/blob/master/modules/journal.js

// Add custom enrichers during init phase
export function addCustomEnrichers() {
  CONFIG.TextEditor.enrichers.push(
    {
      pattern: /@DisplayTable\[(.+?)\](?:{(.+?)})?/gm,
      enricher: enrichDisplayTable
    },
    {
      pattern: /@Table\[(.+?)\](?:{(.+?)})?/gm,
      enricher: rollTable
    },
    {
      pattern: /@SkillRoll(?:\[(.*?)\])?(?:{(.*?)})?/gm,
      enricher: rollSkill
    }
  );
}

/**
 * Convert a rollTable link in a journal entry with a nice format of the table based on roll table name or uuid.
 * @param {any} match   An array matching the RegEx expression. Match[0] is the unernriched JE string.  Match[1] is the table name or UUID.  Match[2] is the user entered table label.
 * @param {any} options Options to the roll action
 * @returns {Promise<HTMLDivElement>} The displayed html element for the enriched RollTable reference
 */
async function enrichDisplayTable (match: any, options: any): Promise<HTMLDivElement> {
  const table = findTable(match[1], options);
  const tableName = match[2] ?? table?.name;
  const a = document.createElement("div");
  if (table) {
    a.classList.add("display-table");
    const html = displayTable(match[1], table, tableName);
    a.innerHTML = await TextEditor.enrichHTML(html, {async: true});
  } else {
    a.dataset.tableId = match[1];
    if (match[2]) {
      a.dataset.tableName = match[2];
    }
    a.classList.add("content-link");
    a.classList.add("broken");
    a.innerHTML = `<i class="fas fa-unlink"></i> ${tableName}`;
  }
  return a;
}

/**
 * A rollable link in a journal entry to a RollTable.
 * @param {string} match   An array matching the RegEx expression. Match[0] is the unernriched JE string.  Match[1] is the table name or UUID.  Match[2] is the user entered table label.
 * @param {string} options Options to the roll action
 * @returns {HTMLAnchorElement} The rolltable in an html format
 */
async function rollTable (match: any, options: any): Promise<HTMLAnchorElement> {
  const table = findTable(match[1], options);
  const tableName = match[2] ?? table?.name;
  const a = document.createElement("a");
  if (table) {
    a.classList.add("inline-roll");
    a.classList.add("table-roll");
    a.dataset.tableId = table.uuid;
    a.dataset.tableName = table.name;
    a.innerHTML = `<i class="fas fa-dice-d20"></i><i class="fas fa-th-list"></i> ${tableName}`;
  } else {
    a.dataset.tableId = match[1];
    if (match[2]) {
      a.dataset.tableName = match[2];
    }
    a.classList.add("content-link");
    a.classList.add("broken");
    a.innerHTML = `<i class="fas fa-unlink"></i> ${tableName}`;
  }
  return a;
}

/**
 * A rollable link in a skill.
 * @param {string} match   An array matching the RegEx expression. Match[0] is the unenriched JE string.  Match[1] is the skill name.  Match[2] is the user entered skill label.
 * @param {string} options Options to the roll action
 * @returns {HTMLAnchorElement} The rolltable in an html format
 */
async function rollSkill (match: any, _options: any): Promise<HTMLAnchorElement> {
  const skillName = match[1] || "";
  const descrip = match[2] || match[1];
  const a = document.createElement("a");
  a.classList.add("inline-roll");
  a.classList.add("skill-roll");
  a.dataset.parseString = skillName;
  a.innerHTML = `<i class="fa-solid fa-dice"></i> ${descrip}`;
  return a;
}

/**
 * Convert a rollTable link in a journal entry with a nice format of the table based on roll table name or uuid.
 * @param {string} uuid   The rolltable UUID.
 * @param {string} tableName The string name of the table
 * @returns {string} The rolltable in an html format
 */
function displayTable(uuid: string, table:any, tableName: string): string {
  if (!table) {
    return "";
  }

  // Rollable table in roll column header
  let html = `
  <table>
      <caption class="table-caption">${tableName}</caption>
      <tr>
          <th style="text-transform: uppercase; text-align: left;">@Table[${uuid}]{${table.formula}}</th>
          <th style="text-align: left;">${game.i18n.localize("TWODSIX.Table.TableResults")}</th>
      </tr>`;

  for (const result of table.results) {
    html += `
      <tr>
          <td>${result.range[0]}`;
    if (result.range[1] != result.range[0]) {
      html += ` - ${result.range[1]}`;
    }
    if (result.documentCollection == "RollTable") {
      const subTable = findTable(result.text);
      if (subTable?.uuid != table.uuid) {
        let subTableName = result.text;
        if(subTableName.startsWith(table.name)) {
          subTableName = subTableName.slice(table.name.length);
          if (subTableName.startsWith(" - ")) {
            subTableName = subTableName.slice(3);
          }
        }
        html += `</td>
                  <td>${subTable?.description} @DisplayTable[RollTable.${result.documentId}]{${subTableName}}</td>
              </tr>`;
      } else {
        html += `</td>
                  <td>${result.text}</td>
              </tr>`;
      }
    } else if (result.documentCollection == "Item") {
      html += `</td>
              <td>@UUID[Item.${result.documentId}]{${result.text}}</td>
          </tr>`;
    } else {
      html += `</td>
              <td>${result.text}</td>
          </tr>`;
    }
  }
  html += `</table>`;
  return html;
}

/**
 * Finds a RollTable document based on either the RollTable name or uuid.
 * @param {string} tableName   The rolltable UUID or name.
 * @param {any} options The optional find strings
 * @returns {RollTable} The RollTable document
 */
function findTable(tableName:string, options?:any): RollTable {
  const table = game.tables.find(i => i.name.toLowerCase() == tableName.toLowerCase()) || fromUuidSync(tableName);
  if (!table) {
    if (!options?.noWarnings){
      sendWarning("TWODSIX.Warnings.tableNotFound", {id: tableName});
    }
    return null;
  }
  if (!(table instanceof RollTable)) {
    if (!options?.noWarning){
      sendWarning("TWODSIX.Warnings.typeMismatch", {id: tableName});
    }
    return null;
  }
  return table;
}

function sendWarning(msg, params) {
  if (!params) {
    return ui.notifications.warn(game.i18n.localize(msg));
  } else {
    return ui.notifications.warn(game.i18n.format(game.i18n.localize(msg), params));
  }
}

/**
 * Make a roll from a RollTable from a clickable link in JournalEntry.
 * @param {Event} event   The click event.
 */
export async function handleTableRoll(event: Event): Promise<void> {
  event.preventDefault();
  event.stopPropagation();
  const tableId = event.currentTarget.dataset.tableId;
  const tableName = event.currentTarget.dataset.tableName;
  const table = fromUuidSync(tableId) || findTable(tableName);
  if (table) {
    if (event.type == "click") { // left click
      table.draw();
    } else { // right click
      table.sheet.render(true);
    }
  }
}

/**
 * Make a roll from a skill formula using a clickable link in JournalEntry.
 * @param {Event} event   The click event.
 */
export async function handleSkillRoll(event: Event): Promise<void> {
  event.preventDefault();
  event.stopPropagation();
  const parseString:string = event.currentTarget.dataset.parseString;
  const actorToUse = getControlledTraveller();
  if (actorToUse) {
    const parsedValues:any = getInitialSettingsFromFormula(parseString, actorToUse);
    if (parsedValues) {
      if (parsedValues.skill === 'None') {
        actorToUse.characteristicRoll({rollModifiers: parsedValues.rollModifiers, difficulty: parsedValues.difficulty}, true);
      } else {
        const skill:TwodsixItem = parsedValues.skill;
        if (event.type == "click") { // left click
          delete parsedValues.skill;
          const settings:TwodsixRollSettings = await TwodsixRollSettings.create(true, parsedValues, skill, undefined, actorToUse);
          if (!settings.shouldRoll) {
            return;
          }
          await skill.skillRoll(false, settings);
        } else { // right click
          skill.sheet.render(true);
        }
      }
    }
  } else {
    ui.notifications.warn(game.i18n.localize("TWODSIX.Warnings.NoActorSelected"));
  }
}

/**
 * Finds a Skill Item document based on either the name or uuid.
 * @param {string} skillName   The skill name or UUID.
 * @param {any} options The optional find strings
 * @returns {TwodsixItem} The RollTable document
 */
/*function findSkill(skillName:string): TwodsixItem {
  const actorToUse = getControlledTraveller();
  if (actorToUse) {
    let skill = actorToUse.itemTypes.skills?.find(i => i.name.toLowerCase() == skillName.toLowerCase()) || fromUuidSync(skillName);
    if (!skill) {
      skill = actorToUse.getUntrainedSkill();
    }
    return skill;
  } else {
    ui.notifications.warn(game.i18n.localize("TWODSIX.Warnings.NoActorSelected"));
  }
}*/
