//updated for FVTT v13

async function characteristicsMacro() {
  // Create the dialog window
  let dialogTemplate = `
    <div style="display: flex; flex-direction: column;">
      <h2>Traveller Characteristics Roller</h2>
      <div>
        <p>Select rolling options:</p>
        <label><input type="radio" name="option" value="roll6" checked>Roll 2d6, 6 times</label><br>
        <label><input type="radio" name="option" value="roll7">Roll 2d6, 7 times, dropping the lowest result</label><br><br>
      </div>
      <div>
        <h3>Alternate Characteristics </h3>
        <div style="display: flex;">
          <div style="flex: 1;">
            <label>Alt. Characteristic 1 Name:</label>
            <input type="text" name="altSkill1Name" value="Psi"><br>
            <label>Alt. Characteristic 2 Name:</label>
            <input type="text" name="altSkill2Name" value="Luck"><br>
            <label>Alt. Characteristic 3 Name:</label>
            <input type="text" name="altSkill3Name" value="Sanity"><br>
          </div>
          <div style="flex: 1;">
            <label>Alt. Skill 1 Dice (e.g., 2d6):</label>
            <input type="text" name="altSkill1Dice" value="2d6"><br>
            <label>Alt. Skill 2 Dice (e.g., 1d6+1):</label>
            <input type="text" name="altSkill2Dice" value="1d6+1"><br>
            <label>Alt. Skill 3 Dice (e.g., 1d6+1):</label>
            <input type="text" name="altSkill3Dice" value="1d6+1"><br>
          </div>
        </div>
        <label>Disable Alt. Characteristics:</label>
        <input type="checkbox" name="disableAltSkills" checked>
      </div>
    </div>
  `;

  let dialogData = {
    title: "Traveller RPG Macro",
    content: dialogTemplate,
    buttons: [
      {
        action: "rollNow",
        icon: 'fas fa-dice',
        label: "Roll Now!",
        default: true,
        callback: async (_event, target) => {
          // Get selected options and alt skill values
          const option = target.form.elements.option.value;
          const altSkill1Name = target.form.elements.altSkill1Name.value;
          const altSkill1Dice = target.form.elements.altSkill1Dice.value;
          const altSkill2Name = target.form.elements.altSkill2Name.value;
          const altSkill2Dice = target.form.elements.altSkill2Dice.value;
          const altSkill3Name = target.form.elements.altSkill3Name.value;
          const altSkill3Dice = target.form.elements.altSkill3Dice.value;
          const disableAltSkills = target.form.elements.disableAltSkills.checked;

          // Roll the dice and display the results
          let resultMessage = "<h2>Results:</h2>";

          if (option === "roll6") {
            resultMessage += "<strong>Roll 2d6, 6 times:</strong><br>";
            resultMessage += "<table><tr><th>1st Die</th><th>2nd Die</th><th>Total</th></tr>";
            for (let i = 1; i <= 6; i++) {
              const roll1 = await new Roll("d6").roll();
              const roll2 = await new Roll("d6").roll();
              const rollTotal = roll1.total + roll2.total;
              resultMessage += `<tr><td>${roll1.total}</td><td>${roll2.total}</td><td>${rollTotal}</td></tr>`;
            }
            resultMessage += "</table>";
          } else if (option === "roll7") {
            resultMessage += "<strong>Roll 2d6, 7 times, dropping the lowest result:</strong><br>";
            resultMessage += "<table><tr><th>1st Die</th><th>2nd Die</th><th>Total</th></tr>";
            let rolls = [];
            for (let i = 1; i <= 7; i++) {
              const roll1 = await new Roll("d6").roll();
              const roll2 = await new Roll("d6").roll();
              const rollTotal = roll1.total + roll2.total;
              rolls.push({ rollTotal, roll1, roll2 });
            }
            rolls.sort((a, b) => a.rollTotal - b.rollTotal);
            for (let i = 0; i < rolls.length; i++) {
              const { rollTotal, roll1, roll2 } = rolls[i];
              if (i === 0) {
                resultMessage += `<tr style="background-color: black; color: white;"><td>${roll1.total}</td><td>${roll2.total}</td><td>${rollTotal}</td></tr>`;
              } else {
                resultMessage += `<tr><td>${roll1.total}</td><td>${roll2.total}</td><td>${rollTotal}</td></tr>`;
              }
            }
            resultMessage += "</table>";
          }

          if (!disableAltSkills) {
            // Check if altSkill1Dice and altSkill2Dice are not empty
            if (altSkill1Dice && altSkill2Dice) {
              const altRoll1 = await new Roll(altSkill1Dice).roll();
              const altRoll2 = await new Roll(altSkill2Dice).roll();
              resultMessage += `<strong>${altSkill1Name} (${altSkill1Dice}):</strong> ${altRoll1.total}<br>`;
              resultMessage += `<strong>${altSkill2Name} (${altSkill2Dice}):</strong> ${altRoll2.total}<br>`;
              if (altSkill3Dice) {
                const altRoll3 = await new Roll(altSkill3Dice).roll();
                resultMessage += `<strong>${altSkill3Name} (${altSkill3Dice}):</strong> ${altRoll3.total}<br>`;
              }
            }
          }

          // Display the results in a chat message
          ChatMessage.create({
            content: resultMessage,
            speaker: ChatMessage.getSpeaker(),
          });
        },
      },
      {
        action: "cancel",
        icon: 'fas fa-times',
        label: "Cancel",
      },
    ]
  };

  // Show the dialog
  await new foundry.applications.api.DialogV2(dialogData).render(true);
}

// Call the macro function
characteristicsMacro();
