import {advantageDisadvantageTerm} from "./settings";

export default function registerHandlebarsHelpers():void {

  Handlebars.registerHelper('advantageDisadvantageTerm', (str) => {
    return advantageDisadvantageTerm(str);
  });

}
