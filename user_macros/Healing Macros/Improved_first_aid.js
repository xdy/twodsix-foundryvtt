const MULTIPLIER = 1.0;
firstAid();

async function firstAid(){
	let patients = await game.user.targets;
	let pointsToHeal = await getHealAmount();
	
	if (patients!== null && pointsToHeal >0){
		for(let patient of patients){
			healCharacter(pointsToHeal*MULTIPLIER, game.actors.get(patient.data.actorId));
		}
	}
}

async function healCharacter(pointsToHeal, patient){
	//console.log("Patient: ", patient); 
			
	//define characteristic healing order
	let heal_order = ['endurance', 'strength','dexterity'];

	let char_id='';
	
	//Remove damage in the healing order
	for (let i= 0; i<heal_order.length; ++i){
							
		let cur_damage = patient.data.data.characteristics[heal_order[i]].damage;
		
		if (cur_damage >0){
			let new_damage = Math.max(0, cur_damage-pointsToHeal);
			char_id = 'data.characteristics.'+ heal_order[i]+'.damage';
			
			await patient.update({
				[char_id]: new_damage
			});
			
			pointsToHeal -= cur_damage-new_damage; 
		}
		
		if (pointsToHeal<1) {break;}
	}
}

async function getHealAmount(){
	const skillRolls = await game.messages._source.filter(m=>m.flavor != undefined);
	const healing = await skillRolls.filter(m=>m.flavor.includes("Medicine"));
	let retVal = 0;
	
	if (healing.length >0){
		retVal = healing[healing.length-1].flags.twodsix.effect;
		//console.log("Calc Heal", retVal);
	}
		
	return(retVal);
}
