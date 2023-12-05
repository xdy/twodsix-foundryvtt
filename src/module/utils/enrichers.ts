// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

//Adapted from https://github.com/pafvel/dragonbane/blob/master/modules/journal.js

export function addCustomEnrichers() {
  CONFIG.TextEditor.enrichers.push(
    {
      pattern: /@DisplayTable\[(.+?)\](?:{(.+?)})?/gm,
      enricher: enrichDisplayTable
    },
    {
      pattern: /@Table\[(.+?)\](?:{(.+?)})?/gm,
      enricher: rollTable
    }
  );
}

async function enrichDisplayTable (match, options) {
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

async function rollTable (match, options) {
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

function displayTable(uuid, table, tableName) {
  if (!table) {
    return "";
  }

  /*
  // Rollable table in caption
  let html = `
  <table>
      <caption>@Table[${uuid}]{${tableName}}</caption>
      <tr>
          <th>[[/roll ${table.formula}]]</th>
          <th>${game.i18n.localize("DoD.journal.tableResult")}</th>
      </tr>`;
  */

  // Rollable table in roll column header
  let html = `
  <table>
      <caption class="table-caption">${tableName}</caption>
      <tr>
          <th style="text-transform: uppercase;">@Table[${uuid}]{${table.formula}}</th>
          <th>${game.i18n.localize("Table Result")}</th>
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

function findTable(tableName:string, options?:any) {
  const table = game.tables.find(i => i.name.toLowerCase() == tableName.toLowerCase()) || fromUuidSync(tableName);
  if (!table) {
    if (!options?.noWarnings){
      sendWarning("WARNING.tableNotFound", {id: tableName});
    }
    return null;
  }
  if (!(table instanceof RollTable)) {
    if (!options?.noWarning){
      sendWarning("WARNING.typeMismatch", {id: tableName});
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

export async function handleTableRoll(event) {
  const tableId = event.currentTarget.dataset.tableId;
  const tableName = event.currentTarget.dataset.tableName;
  const table = fromUuidSync(tableId) || this.findTable(tableName);
  if (table) {
    if (event.type == "click") { // left click
      table.draw();
    } else { // right click
      table.sheet.render(true);
    }
  }
  event.preventDefault();
  event.stopPropagation();
}
