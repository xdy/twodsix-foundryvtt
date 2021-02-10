import TwodsixActor from "../module/entities/TwodsixActor";

class ActorUpdater {
  needsConfirmation = false;
  originalValues:Record<string,any> = {};
  updateData:Record<string,any> = {};
  actor: TwodsixActor;
  fieldType:Record<string,string> = {};
  removeFields:Record<string,null> = {};

  constructor(actor: TwodsixActor) {
    this.actor = actor;
  }

  public updateFieldWithNumber(key: string, value: any): void {
    this.originalValues[key] = value;
    this.fieldType[key] = "number";
    let bestGuess = parseFloat(value);

    if (isNaN(bestGuess)) {
      bestGuess = 0;
      this.needsConfirmation = true;
    } else if (bestGuess == parseInt(value, 10)) {
      bestGuess = parseInt(value, 10);
    }
    this.updateData[key] = bestGuess;
  }

  public updateFieldWithText(key:string, value:string):void {
    this.updateData[key] = value;
    this.fieldType[key] = "text";
  }

  public updateFieldWithObject(key:string, value:any):void {
    this.updateData[key] = value;
    this.fieldType[key] = "object";
  }



  removeField(key:string) {
    this.removeFields[`data.-=${key}`] = null;
  }

  private showDialog(resolve: (arg0: Record<string,any>) => void) {
    const inputFields = Object.entries(this.updateData).map(([key, value]) => {
      if (this.fieldType[key] === "object") {
        return "";
      }
      const originalValue = [undefined, ""].includes(this.originalValues[key])  ? "not set" : this.originalValues[key];
      return `<label>${key.substring(5)} (previous value: ${originalValue})<input type="${this.fieldType[key]}" name="${key}" value="${value}"></label>`;
    }).join("");
    let confirmed = false;
    new Dialog({
      title: "Please confirm the data migration",
      content: `<div>Some data could not be automatically migrated to the new version, please confirm and/or modify the data.</div><br><br><h3>${this.actor.name}</h3>` + inputFields,
      buttons: {
        ok: {
          label: "ok",
          callback: (buttonHtml) => {
            confirmed = true;
            $(buttonHtml).find("input").each((i, html) => {
              switch(this.fieldType[html.name]) {
                case "number":
                  this.updateData[html.name] = Number(html.value);
                  break;
                case "text":
                default:
                  this.updateData[html.name] = html.value;
                  break;
              }
            });
            resolve(Object.assign(this.updateData, this.removeFields));
          }
        }
      },
      default: 'ok',
      close: () => {
        if (!confirmed) {
          this.showDialog(resolve);
        }
      },
    }).render(true);
  }

  public async getUpdateData():Promise<Record<string,any>> {
    if (this.needsConfirmation) {
      return new Promise(this.showDialog.bind(this));
    } else {
      return Promise.resolve(Object.assign(this.updateData, this.removeFields));
    }
  }
}

export async function migrate():Promise<void> {
  await Promise.all(TwodsixActor.collection.map(async (actor:TwodsixActor) => {
    if (actor.data.type == "ship") {
      const actorUpdater = new ActorUpdater(actor);
      const ship = actor.data.data.ship;
      if (ship) {
        actorUpdater.updateFieldWithNumber("data.maintenanceCost", ship.maintenance_cost);
        actorUpdater.updateFieldWithText("data.cargo", ship.cargo);
        actorUpdater.updateFieldWithText("data.notes", ship.notes);
        actorUpdater.updateFieldWithObject("data.crew", ship.crew);

        actorUpdater.updateFieldWithNumber("data.reqPower.systems", ship.reqPower["systems"]);
        actorUpdater.updateFieldWithNumber("data.reqPower.m-drive", ship.reqPower["m-drive"]);
        actorUpdater.updateFieldWithNumber("data.reqPower.j-drive", ship.reqPower["j-drive"]);
        actorUpdater.updateFieldWithNumber("data.reqPower.sensors", ship.reqPower["sensors"]);
        actorUpdater.updateFieldWithNumber("data.reqPower.weapons", ship.reqPower["weapons"]);

        actorUpdater.updateFieldWithNumber("data.shipStats.hull.value", ship.shipStats.hullCurrent);
        actorUpdater.updateFieldWithNumber("data.shipStats.hull.max", ship.shipStats.hull);
        actorUpdater.updateFieldWithNumber("data.shipStats.fuel.value", ship.shipStats.fuelCurrent);
        actorUpdater.updateFieldWithNumber("data.shipStats.fuel.max", ship.shipStats.fuel);
        actorUpdater.updateFieldWithNumber("data.shipStats.power.value", ship.shipStats.powerCurrent);
        actorUpdater.updateFieldWithNumber("data.shipStats.power.max", ship.shipStats.power);

        actorUpdater.removeField("ship");
      }

      if (actor.data.data.ship_value !== undefined) {
        actorUpdater.updateFieldWithText("data.shipValue", actor.data.data.ship_value);
        actorUpdater.removeField("ship_value");
      }

      const updateData = await actorUpdater.getUpdateData();
      if (Object.keys(updateData).length) {
        await actor.update(updateData);
      }
    }
  }));
}
