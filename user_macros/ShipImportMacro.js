// Twodsix Ship Statblock Import Macro
// Paste a statblock in the prompt and this macro will create a TwodsixActor ship with components.

(async () => {
  // Prompt for statblock input using DialogV2.input
  const statblockResult = await foundry.applications.api.DialogV2.input({
    window: { title: "Import Ship Statblock", icon: "fa-solid fa-ship" },
    content: `<p>Paste the ship statblock below:</p><textarea name="statblock" style="width:100%;height:200px;"></textarea>`,
    ok: { label: "Import" },
    cancel: { label: "Cancel" }
  });
  const statblock = statblockResult?.statblock;
  if (!statblock) {
    return ui.notifications.warn("Import cancelled.");
  }

  // --- Parsing utility ---
  function parseShipStatblock(text) {
    const shipName = (text.match(/^(.*?)\n/) || [])[1]?.trim() || "Unnamed Ship";
    const tonnage = Number((text.match(/Tonnage:\s*(\d+)/i) || [])[1]);
    const armor = (text.match(/Armor:\s*([^;]+)/i) || [])[1]?.replace(/\n/g, ' ').trim();
    const maneuver = Number((text.match(/Maneuver:\s*(\d+)[- ]*G/i) || [])[1]);
    const jump = Number((text.match(/Jump:\s*(\d+)/i) || [])[1]);
    const powerPlant = (text.match(/P-Plant:\s*Rating\s*(\d+)/i) || [])[1];
    const fuel = Number((text.match(/Fuel:\s*(\d+)/i) || [])[1]);
    const computer = (text.match(/Computer:\s*([^;]+)/i) || [])[1]?.replace(/\n/g, ' ').trim();
    const cost = (text.match(/Cost:\s*([^;]+)/i) || [])[1]?.replace(/\n/g, ' ').trim();
    // Armament: capture up to Fittings or Crew or end of line
    const armamentMatch = text.match(/Armament:\s*([\s\S]*?)(?:Fittings:|Crew:|$)/i);
    const armament = armamentMatch ? armamentMatch[1].replace(/\n/g, ' ').trim() : undefined;
    const fittings = (text.match(/Fittings:\s*([^\n]+)/i) || [])[1]?.trim();
    const crew = (text.match(/Crew:\s*([^\n]+)/i) || [])[1]?.trim();
    const staterooms = Number((text.match(/(\d+)x?staterooms?/i) || [])[1]);
    const cryoberths = Number((text.match(/(\d+)x?cryoberths?/i) || [])[1]);
    const lowBerths = Number((text.match(/(\d+)x?emergency low berths?/i) || [])[1]);
    const magazine = Number((text.match(/magazine \((\d+) missiles?\)/i) || [])[1]);
    const escapePods = Number((text.match(/(\d+)x?escape pods?/i) || [])[1]);
    const armory = (text.match(/armory for (\d+) marines?/i) || [])[1];
    const fuelProcessor = (text.match(/fuel processor \(([^)]+)\)/i) || [])[1];
    const cargo = Number((text.match(/([\d.]+)\s*tons? of cargo/i) || [])[1]);

    // Weapons and hardpoints parsing
    const weapons = [];
    const hardpoints = [];
    // Unified non-weapon terms list
    const nonWeaponTermsList = [
      'fittings', 'gunners', 'crew', 'troops', 'marines', 'stateroom', 'berth', 'pod', 'processor', 'armory', 'cargo',
      'engineer', 'medic', 'operator', 'co', 'captain', 'escape', 'magazine', 'space'
    ];
    const nonWeaponTerms = new RegExp(nonWeaponTermsList.join('|'), 'i');
    // For cleaning trailing non-weapon words
    const trailingNonWeaponWords = new RegExp(`\\b(${nonWeaponTermsList.join('|')})s?\\b.*$`, 'i');
    if (armament) {
      // Find all turret/hardpoint patterns (can be multiple)
      // Example: '3x triple turrets: 1x missile, 2x pulse lasers; 2x double turrets: 2x beam lasers'
      let armamentRemainder = armament;
      const turretRegex = /(\d+)x?\s*([\w\s]+turrets?):\s*([^;]+)/gi;
      let turretMatch;
      console.log('--- Armament String ---', armament);
      while ((turretMatch = turretRegex.exec(armamentRemainder)) !== null) {
        const turretCount = Number(turretMatch[1]) || 1;
        const turretType = turretMatch[2].trim();
        const turretContents = turretMatch[3];
        // Add hardpoints
        for (let i = 0; i < turretCount; i++) {
          hardpoints.push({ name: turretType, quantity: 1 });
        }
        // Parse weapons inside turrets (one component per weapon type per turret)
        turretContents.split(/[,;]/).forEach(w => {
          const m = w.match(/(\d+)x?\s*([\w\s\-']+)/i);
          if (m) {
            for (let i = 0; i < turretCount; i++) {
              weapons.push({
                name: m[2].trim(),
                quantity: Number(m[1])
              });
            }
          } else if (w.trim()) {
            for (let i = 0; i < turretCount; i++) {
              weapons.push({ name: w.trim(), quantity: 1 });
            }
          }
        });
        // Remove the matched turret section from armament string
        armamentRemainder = armamentRemainder.replace(turretMatch[0], "");
      }
      // Parse any remaining weapons outside turrets
      armamentRemainder.split(/[;,]/).forEach(w => {
        const m = w.match(/(\d+)x?\s*([\w\s\-']+)/i);
        if (m) {
          weapons.push({
            name: m[2].trim(),
            quantity: Number(m[1]) || 1
          });
        } else if (w.trim()) {
          weapons.push({ name: w.trim(), quantity: 1 });
        }
      });
      // Filter out non-weapon and malformed entries from weapons array
      const weaponKeywords = /laser|missile|cannon|gun|railgun|plasma|particle|sand|fusion|gauss|autocannon|beam|pulse|torpedo|barbette|spinal/i;
      for (let i = weapons.length - 1; i >= 0; i--) {
        // Remove trailing non-weapon words (e.g., 'Fittings', 'Crew', etc.)
        weapons[i].name = weapons[i].name.replace(trailingNonWeaponWords, '').trim();
        if (!weaponKeywords.test(weapons[i].name) || nonWeaponTerms.test(weapons[i].name) || weapons[i].name.length < 2) {
          weapons.splice(i, 1);
        }
      }
    }
    // Fittings parsing
    const fittingsArr = [];
    if (fittings) {
      fittings.split(/,/).forEach(f => {
        const m = f.match(/(\d+)x?\s*([\w\s\-']+)/i);
        let name = m ? m[2].trim() : f.trim();
        // Skip escape pods in fittings if already parsed as dedicated field
        if (name && /escape pods?/i.test(name) && escapePods) return;
        if (m) {
          fittingsArr.push({
            name: name,
            quantity: Number(m[1]) || 1
          });
        } else if (f.trim()) {
          fittingsArr.push({ name: name, quantity: 1 });
        }
      });
    }
    return {
      name: shipName, tonnage, armor, maneuver, jump, powerPlant, fuel, computer, cost, weapons, hardpoints, fittings: fittingsArr, crew,
      staterooms, cryoberths, lowBerths, magazine, escapePods, armory, fuelProcessor, cargo
    };
  }

  // --- Helper: Map component type from name ---
  function mapComponentType(componentName) {
    // Simple mapping based on keywords in the component name
    const n = componentName.toLowerCase();
    if (n.includes("laser") || n.includes("missile") || n.includes("cannon") || n.includes("gun")) {
      return "armament";
    }
    if ( n.includes("turret") ) {
      return "hardpoint";
    }
    if (n.includes("stateroom") || n.includes("cryoberth") || n.includes("low berth")) {
      return "accomodations";
    }
    if (n.includes("magazine")) {
      return "magazine";
    }
    if (n.includes("escape pod")) {
      return "otherInternal";
    }
    if (n.includes("armory")) {
      return "otherInternal";
    }
    if (n.includes("fuel processor")) {
      return "fuel";
    }
    if (n.includes("cargo")) {
      return "cargo";
    }
    if (n.includes("computer")) {
      return "computer";
    }
    if (n.includes("power plant") || n.includes("p-plant")) {
      return "power";
    }
    if (n.includes("m-drive") || n.includes("maneuver")) {
      return "drive";
    }
    if (n.includes("j-drive") || n.includes("jump")) {
      return "drive";
    }
    if (n.includes("sensor")) {
      return "sensor";
    }
    // Default fallback
    return "otherInternal";
  }

  // --- Main import logic ---
  const parsed = parseShipStatblock(statblock);
  if (!parsed.name || !parsed.tonnage) {
    return ui.notifications.error("Failed to parse ship name or tonnage. Please check the statblock format.");
  }

  // Create the ship actor
  const actorData = {
    name: parsed.name,
    type: "ship",
    system: {
      deckPlan: "",
      crew: {},
      crewLabel: {},
      cargo: "",
      financeNotes: "",
      maintenanceCost: "0",
      mortgageCost: "0",
      shipValue: parsed.cost ? String(parsed.cost) : "0",
      isMassProduced: false,
      commonFunds: 0,
      financeValues: { cash: 0 },
      reqPower: {
        systems: 0, "m-drive": 0, "j-drive": 0, sensors: 0, weapons: 0
      },
      weightStats: {
        systems: 0, cargo: parsed.cargo ? Number(parsed.cargo) : 0, fuel: parsed.fuel ? Number(parsed.fuel) : 0, vehicles: 0, available: 0
      },
      shipPositionActorIds: {},
      shipStats: {
        hull: { value: parsed.tonnage ? Number(parsed.tonnage) : 0, max: parsed.tonnage ? Number(parsed.tonnage) : 0, min: 0 },
        fuel: { value: parsed.fuel ? Number(parsed.fuel) : 0, max: parsed.fuel ? Number(parsed.fuel) : 0, min: 0, isRefined: true },
        power: { value: 0, max: 0, min: 0 },
        armor: {
          name: parsed.armor || "",
          weight: "",
          cost: "",
          value: 0,
          max: 0,
          min: 0
        },
        mass: { value: 0, max: 0, min: 0 },
        fuel_tanks: { name: "", weight: "", cost: "" },
        drives: {
          overdrive: false,
          jDrive: { rating: parsed.jump ? Number(parsed.jump) : 0 },
          mDrive: { rating: parsed.maneuver ? Number(parsed.maneuver) : 0 }
        },
        bandwidth: { value: 0, max: 0, min: 0 }
      },
      combatPosition: 0,
      characteristics: { morale: { value: 0, max: 0, min: 0 } }
    }
  };
  const shipActor = await Actor.create(actorData);

  // Prepare items/components
  const items = [];

  // Add hull component for displacement weight (primary hull)
  if (parsed.tonnage) {
    items.push({
      name: `Hull (${parsed.tonnage} tons)`,
      type: "component",
      system: {
        subtype: "hull",
        weight: String(parsed.tonnage),
        isBaseHull: true
      }
    });
  }

  // Drives
  if (parsed.maneuver) {
    items.push({
      name: `M-Drive ${parsed.maneuver}G`,
      type: "component",
      system: { subtype: "drive", rating: String(parsed.maneuver), driveType: "mdrive" }
    });
  }
  if (parsed.jump) {
    items.push({
      name: `J-Drive ${parsed.jump}`,
      type: "component",
      system: { subtype: "drive", rating: String(parsed.jump), driveType: "jdrive" }
    });
  }
  if (parsed.powerPlant) {
    items.push({
      name: `Power Plant ${parsed.powerPlant}`,
      type: "component",
      system: { subtype: "power", rating: String(parsed.powerPlant), generatesPower: true }
    });
  }
  // Computer
  if (parsed.computer) {
    items.push({
      name: `Computer ${parsed.computer}`,
      type: "component",
      system: { subtype: "computer", rating: String(parsed.computer) }
    });
  }
  // Armor
  if (parsed.armor) {
    items.push({
      name: parsed.armor,
      type: "component",
      system: { subtype: "armor", features: parsed.armor }
    });
  }

  // Hardpoints (turrets)
  if (parsed.hardpoints && parsed.hardpoints.length > 0) {
    for (const hardpoint of parsed.hardpoints) {
      items.push({
        name: hardpoint.name,
        type: "component",
        system: { subtype: "mount", availableQuantity: String(hardpoint.quantity), quantity: String(hardpoint.quantity) }
      });
    }
  }

  // Weapons
  for (const weapon of parsed.weapons) {
    // If weapon.turrets is set, create one component per turret, each with the specified quantity
    if (weapon.turrets) {
      for (let i = 0; i < weapon.turrets; i++) {
        items.push({
          name: weapon.name,
          type: "component",
          system: { subtype: "armament", availableQuantity: String(weapon.quantity), quantity: String(weapon.quantity) }
        });
      }
    } else {
      items.push({
        name: weapon.name,
        type: "component",
        system: { subtype: "armament", availableQuantity: String(weapon.quantity), quantity: String(weapon.quantity) }
      });
    }
  }
  // Fittings with improved mapping
  for (const fitting of parsed.fittings) {
    // Skip only fittings that are just 'fuel' if parsed.fuel exists, but allow fuel processors and similar
    if (/^fuel$/i.test(fitting.name.trim()) && parsed.fuel) {
      continue;
    }
    let subtype = "otherInternal";
    if (/fuel processor|fuel purification|fuel system/i.test(fitting.name)) {
      subtype = "fuel";
    }
    items.push({
      name: fitting.name,
      type: "component",
      system: { subtype: subtype, availableQuantity: String(fitting.quantity), quantity: String(fitting.quantity) }
    });
  }
  // Staterooms
  if (parsed.staterooms) {
    items.push({
      name: `Staterooms`,
      type: "component",
      system: { subtype: "accomodations", availableQuantity: String(parsed.staterooms), quantity: String(parsed.staterooms) }
    });
  }
  // Cryoberths
  if (parsed.cryoberths) {
    items.push({
      name: `Cryoberths`,
      type: "component",
      system: { subtype: "accomodations", availableQuantity: String(parsed.cryoberths), quantity: String(parsed.cryoberths) }
    });
  }
  // Emergency Low Berths
  if (parsed.lowBerths) {
    items.push({
      name: `Emergency Low Berths`,
      type: "component",
      system: { subtype: "accomodations", availableQuantity: String(parsed.lowBerths), quantity: String(parsed.lowBerths) }
    });
  }
  // Magazine
  if (parsed.magazine) {
    items.push({
      name: `Missile Magazine`,
      type: "component",
      system: { subtype: "ammo", availableQuantity: String(parsed.magazine), quantity: String(parsed.magazine) }
    });
  }
  // Escape Pods
  if (parsed.escapePods) {
    items.push({
      name: `Escape Pods`,
      type: "component",
      system: { subtype: "otherInternal", availableQuantity: String(parsed.escapePods), quantity: String(parsed.escapePods) }
    });
  }
  // Armory
  if (parsed.armory) {
    items.push({
      name: `Armory`,
      type: "component",
      system: { subtype: "otherInternal", features: `For ${parsed.armory} marines` }
    });
  }
  // Fuel Processor
  if (parsed.fuelProcessor) {
    items.push({
      name: `Fuel Processor`,
      type: "component",
      system: { subtype: "fuel", features: parsed.fuelProcessor }
    });
  }
  // Cargo
  if (parsed.cargo) {
    items.push({
      name: `Cargo Space`,
      type: "component",
      system: { subtype: "cargo", tons: String(parsed.cargo) }
    });
  }

  if (items.length > 0) {
    await shipActor.createEmbeddedDocuments("Item", items);
  }

  ui.notifications.info(`Imported ship: ${parsed.name}`);
})();
