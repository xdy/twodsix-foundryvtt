getModifier('text', 'Enter DM (-4 to +3)');

async function getModifier (type, text) {
  let value = await new Promise((resolve) => {
    new Dialog({
      modal: true,
      title: 'Input DM modifier',
      content: `<table style="width:100%"><tr><th><label>${
          text}</label></th><td><input type="${
          type}" name="input"/></td></tr></table>`,
      buttons: {
        Ok: {
          label: 'Ok',
          callback: (html) => { resolve(html.find('input').val()); }
        }
      }
    }).render(true);
  });

  let r = new Roll("2d6+@DM",{DM: value});
  r.evaluate();

  game.tables.getName('Book Titles').draw({roll: r});
}
