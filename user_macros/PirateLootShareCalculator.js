//updated for v13
(async () => {
  // Function to save input values and checkbox state to local storage
  function saveInputsToLocalStorage(inputs) {
    for (const [key, value] of Object.entries(inputs)) {
      localStorage.setItem(key, value);
    }
    localStorage.setItem("travellerCaptain", inputs["travellerCaptain"]);
  }

  // Function to retrieve input values and checkbox state from local storage
  function getInputsFromLocalStorage() {
    const inputs = {};
    const keys = ["netLoot", "travellers", "captain", "ordinary", "good", "excellent", "legendary", "other"];
    for (const key of keys) {
      const value = localStorage.getItem(key);
      inputs[key] = value !== null ? parseInt(value) : 0; // Treat blank values as zero
    }
    inputs["travellerCaptain"] = localStorage.getItem("travellerCaptain") === "true";
    return inputs;
  }

  // Create the first dialog
  const previousInputs = getInputsFromLocalStorage();

  const firstDialog = new foundry.applications.api.DialogV2({
    window: {
      title: "Calculate Shares",
      icon: "fa-solid fa-skull-crossbones"
    },
    content: `
      <div>
        <b>Net Loot:</b>
        <input type="number" name="netLoot" value="${previousInputs["netLoot"]}" />
      </div>
      <div>
        <b>Travellers (2 Shares Each):</b>
        <input type="number" name="travellers" value="${previousInputs["travellers"]}" />
        <span id="traveller-cut"></span>
      </div>
      <div>
        <b>Captain (5 Shares Each):</b>
        <input type="number" name="captain" value="${previousInputs["captain"]}" />
        <label for="travellerCaptain">Is a Traveller Captain?</label>
        <input type="checkbox" name="travellerCaptain" ${previousInputs["travellerCaptain"] ? "checked" : ""} />
        <span id="captain-cut"></span>
      </div>
      <div>
        <b>Ordinary Crew (1 Share Each):</b>
        <input type="number" name="ordinary" value="${previousInputs["ordinary"]}" />
        <span id="ordinary-cut"></span>
      </div>
      <div>
        <b>Good Crew (2 Shares Each):</b>
        <input type="number" name="good" value="${previousInputs["good"]}" />
        <span id="good-cut"></span>
      </div>
      <div>
        <b>Excellent Crew (3 Shares Each):</b>
        <input type="number" name="excellent" value="${previousInputs["excellent"]}" />
        <span id="excellent-cut"></span>
      </div>
      <div>
        <b>Legendary Crew (5 Shares Each):</b>
        <input type="number" name="legendary" value="${previousInputs["legendary"]}" />
        <span id="legendary-cut"></span>
      </div>
      <div>
        <b>Other Shares (Any Additional Shares):</b>
        <input type="number" name="other" value="${previousInputs["other"]}" />
        <span id="other-shares-cut"></span>
      </div>
    `,
    buttons: [
      {
        action: "calculate",
        label: "Calculate",
        callback: async (_event, target) => {
          const netLoot = parseInt(target.form.elements.netLoot.value);
          const travellers = parseInt(target.form.elements.travellers.value);
          const captain = parseInt(target.form.elements.captain.value);
          const isTravellerCaptain = target.form.elements.travellerCaptain.checked;
          const ordinary = parseInt(target.form.elements.ordinary.value);
          const good = parseInt(target.form.elements.good.value);
          const excellent = parseInt(target.form.elements.excellent.value);
          const legendary = parseInt(target.form.elements.legendary.value);
          const other = parseInt(target.form.elements.other.value);

          // Treat blank values as zero
          const valuesToCheck = [netLoot, travellers, captain, ordinary, good, excellent, legendary, other];
          for (let i = 0; i < valuesToCheck.length; i++) {
            if (isNaN(valuesToCheck[i])) {
              valuesToCheck[i] = 0;
            }
          }

          // Calculate Ruler's Cut (10% of Net Loot)
          const rulersCut = Math.floor(valuesToCheck[0] * 0.1);

          // Calculate Gross Loot (Net Loot minus Ruler's Cut)
          const grossLoot = valuesToCheck[0] - rulersCut;

          // Calculate Total Shares
          const totalShares = valuesToCheck[1] * 2 + valuesToCheck[2] * 5 + valuesToCheck[3] + valuesToCheck[4] * 2 + valuesToCheck[5] * 3 + valuesToCheck[6] * 5 + valuesToCheck[7];

          // Calculate Traveller Cut
          const travellerShares = valuesToCheck[1] * 2;
          const travellerCut = Math.round((grossLoot / totalShares) * travellerShares);

          // Calculate Captain Cut
          const captainShares = valuesToCheck[2] * 5;
          const captainCut = Math.round((grossLoot / totalShares) * captainShares);

          // Calculate Ordinary Cut
          const ordinaryCut = Math.round((grossLoot / totalShares) * valuesToCheck[3]);

          // Calculate Good Cut
          const goodShares = valuesToCheck[4] * 2;
          const goodCut = Math.round((grossLoot / totalShares) * goodShares);

          // Calculate Excellent Cut
          const excellentShares = valuesToCheck[5] * 3;
          const excellentCut = Math.round((grossLoot / totalShares) * excellentShares);

          // Calculate Legendary Cut
          const legendaryShares = valuesToCheck[6] * 5;
          const legendaryCut = Math.round((grossLoot / totalShares) * legendaryShares);

          // Calculate Other Shares Cut
          const otherShares = valuesToCheck[7];
          const otherSharesCut = Math.round((grossLoot / totalShares) * otherShares);

          // Calculate Value per Share
          const valuePerShare = Math.round(grossLoot / totalShares);

          // Calculate Total Traveller Take
          const totalTravellerTake = travellerCut + (isTravellerCaptain ? Math.floor(captainCut/captain) : 0);

          // Save inputs and checkbox state to local storage
          const inputs = {
            "netLoot": valuesToCheck[0],
            "travellers": valuesToCheck[1],
            "captain": valuesToCheck[2],
            "ordinary": valuesToCheck[3],
            "good": valuesToCheck[4],
            "excellent": valuesToCheck[5],
            "legendary": valuesToCheck[6],
            "other": valuesToCheck[7],
            "travellerCaptain": isTravellerCaptain,
          };
          saveInputsToLocalStorage(inputs);

          // Create a new dialog to display the results
          const secondDialog = new foundry.applications.api.DialogV2({
            window: {
              title: "Shares Calculation Result",
              icon: "fa-solid fa-sack-xmark"
            },
            content: `
              <div>
                <b>Ruler's Tithe</b> ${rulersCut}
                <br>
                <b>Gross Loot:</b> ${grossLoot}
                <hr>
                <b>Shares Breakdown:</b>
                <table>
                  <tr>
                    <th>Shares Type</th>
                    <th>Shares</th>
                    <th>Cut</th>
                  </tr>
                  <tr>
                    <td>Traveller Shares</td>
                    <td>${travellerShares}</td>
                    <td>${isNaN(travellerCut)? "N/A" : travellerCut}</td>
                  </tr>
                  <tr>
                    <td>Captain Shares</td>
                    <td>${captainShares}</td>
                    <td>${isNaN(captainCut) ? "N/A" : captainCut}</td>
                  </tr>
                  <tr>
                    <td>Ordinary Shares</td>
                    <td>${valuesToCheck[3]}</td>
                    <td>${isNaN(ordinaryCut) ? "N/A" : ordinaryCut}</td>
                  </tr>
                  <tr>
                    <td>Good Shares</td>
                    <td>${goodShares}</td>
                    <td>${isNaN(goodCut) ? "N/A" : goodCut}</td>
                  </tr>
                  <tr>
                    <td>Excellent Shares</td>
                    <td>${excellentShares}</td>
                    <td>${isNaN(excellentCut) ? "N/A" : excellentCut}</td>
                  </tr>
                  <tr>
                    <td>Legendary Shares</td>
                    <td>${legendaryShares}</td>
                    <td>${isNaN(legendaryCut) ? "N/A" : legendaryCut}</td>
                  </tr>
                  <tr>
                    <td>Other Shares</td>
                    <td>${otherShares}</td>
                    <td>${isNaN(otherSharesCut) ? "N/A" : otherSharesCut}</td>
                  </tr>
                </table>
                <hr>
                <b>Total Shares:</b> ${totalShares}
                <br>
                <b>Value per Share:</b> ${valuePerShare}
                <br>
                <b>Total Traveller Take:</b> ${totalTravellerTake}
              </div>
            `,
            buttons: [
              {
                action: "sendToChat",
                label: "Send to Chat",
                callback: async (event2) => {
                  // Get the content of the second dialog
                  const content = event2.currentTarget.querySelector(".dialog-content").innerHTML;

                  // Send the content to Foundry VTT's chat as a regular message
                  ChatMessage.create({ content });
                },
              }
            ]
          });

          // Render the second dialog
          secondDialog.render(true);
        },
      },
    ],
  });

  // Render the first dialog
  firstDialog.render(true);
})();
