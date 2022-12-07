// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.
//Code directly from dnd5e system
/**
 * A standardized helper function for simplifying the constant parts of a multipart roll formula.
 *
 * @param {string} formula                          The original roll formula.
 * @param {object} [options]                        Formatting options.
 * @param {boolean} [options.preserveFlavor=false]  Preserve flavor text in the simplified formula.
 *
 * @returns {string}  The resulting simplified formula.
 */
export function simplifyRollFormula(formula, { preserveFlavor=false } = {}):string {
  // Create a new roll and verify that the formula is valid before attempting simplification.
  let roll;
  try {
    roll = new Roll(formula);
  } catch(err) {
    console.warn(`Unable to simplify formula '${formula}': ${err}`);
  }
  Roll.validate(roll.formula);

  // Optionally strip flavor annotations.
  if ( !preserveFlavor ) {
    roll.terms = Roll.parse(roll.formula.replace(RollTerm.FLAVOR_REGEXP, ""));
  }
  // Perform arithmetic simplification on the existing roll terms.
  roll.terms = _simplifyOperatorTerms(roll.terms);

  if ( /[*/]/.test(roll.formula) ) {
    return ( roll.isDeterministic ) && ( !/\[/.test(roll.formula) || !preserveFlavor )
      ? roll.evaluate({ async: false }).total.toString()
      : roll.constructor.getFormula(roll.terms);
  }

  // Flatten the roll formula and eliminate string terms.
  roll.terms = _expandParentheticalTerms(roll.terms);
  roll.terms = Roll.simplifyTerms(roll.terms);

  // Group terms by type and perform simplifications on various types of roll term.
  // eslint-disable-next-line prefer-const
  let { poolTerms, diceTerms, mathTerms, numericTerms } = _groupTermsByType(roll.terms);
  numericTerms = _simplifyNumericTerms(numericTerms ?? []);
  diceTerms = _simplifyDiceTerms(diceTerms ?? []);

  // Recombine the terms into a single term array and remove an initial + operator if present.
  const simplifiedTerms = [diceTerms, poolTerms, mathTerms, numericTerms].flat().filter(Boolean);
  if ( simplifiedTerms[0]?.operator === "+" ) {
    simplifiedTerms.shift();
  }
  return roll.constructor.getFormula(simplifiedTerms);
}

/* -------------------------------------------- */

/**
 * A helper function to perform arithmetic simplification and remove redundant operator terms.
 * @param {RollTerm[]} terms  An array of roll terms.
 * @returns {RollTerm[]}      A new array of roll terms with redundant operators removed.
 */
function _simplifyOperatorTerms(terms) {
  return terms.reduce((acc, term) => {
    const prior = acc[acc.length - 1];
    const ops = new Set([prior?.operator, term.operator]);

    // If one of the terms is not an operator, add the current term as is.
    if ( ops.has(undefined) ) {
      acc.push(term);
    // Replace consecutive "+ -" operators with a "-" operator.
    } else if ( (ops.has("+")) && (ops.has("-")) ) {
      acc.splice(-1, 1, new OperatorTerm({ operator: "-" }));
    // Replace double "-" operators with a "+" operator.
    } else if ( (ops.has("-")) && (ops.size === 1) ) {
      acc.splice(-1, 1, new OperatorTerm({ operator: "+" }));
    // Don't include "+" operators that directly follow "+", "*", or "/". Otherwise, add the term as is.
    } else if ( !ops.has("+") ) {
      acc.push(term);
    }
    return acc;
  }, []);
}

/* -------------------------------------------- */

/**
 * A helper function for combining unannotated numeric terms in an array into a single numeric term.
 * @param {object[]} terms  An array of roll terms.
 * @returns {object[]}      A new array of terms with unannotated numeric terms combined into one.
 */
function _simplifyNumericTerms(terms) {
  const simplified = [];
  const { annotated, unannotated } = _separateAnnotatedTerms(terms);

  // Combine the unannotated numerical bonuses into a single new NumericTerm.
  if ( unannotated.length ) {
    const staticBonus = Roll.safeEval(Roll.getFormula(unannotated));
    if ( staticBonus === 0 ) {
      return [...annotated];
    }
    // If the staticBonus is greater than 0, add a "+" operator so the formula remains valid.
    if ( staticBonus > 0 ) {
      simplified.push(new OperatorTerm({ operator: "+"}));
    }
    simplified.push(new NumericTerm({ number: staticBonus} ));
  }
  return [...simplified, ...annotated];
}

/* -------------------------------------------- */

/**
 * A helper function to group dice of the same size and sign into single dice terms.
 * @param {object[]} terms  An array of DiceTerms and associated OperatorTerms.
 * @returns {object[]}      A new array of simplified dice terms.
 */
function _simplifyDiceTerms(terms) {
  const { annotated, unannotated } = _separateAnnotatedTerms(terms);

  // Split the unannotated terms into different die sizes and signs
  const diceQuantities = unannotated.reduce((obj, curr, i) => {
    if ( curr instanceof OperatorTerm ) {
      return obj;
    }
    const key = `${unannotated[i - 1].operator}${curr.faces}`;
    obj[key] = (obj[key] ?? 0) + curr.number;
    return obj;
  }, {});

  // Add new die and operator terms to simplified for each die size and sign
  const simplified = Object.entries(diceQuantities).flatMap(([key, number]) => ([
    new OperatorTerm({ operator: key.charAt(0) }),
    new Die({ number, faces: parseInt(key.slice(1)) })
  ]));
  return [...simplified, ...annotated];
}

/* -------------------------------------------- */

/**
 * A helper function to extract the contents of parenthetical terms into their own terms.
 * @param {object[]} terms  An array of roll terms.
 * @returns {object[]}      A new array of terms with no parenthetical terms.
 */
function _expandParentheticalTerms(terms) {
  terms = terms.reduce((acc, term) => {
    if ( term instanceof ParentheticalTerm ) {
      if ( term.isDeterministic ) {
        term = new NumericTerm({ number: Roll.safeEval(term.term) });
      } else {
        const subterms = new Roll(term.term).terms;
        term = _expandParentheticalTerms(subterms);
      }
    }
    acc.push(term);
    return acc;
  }, []);
  return _simplifyOperatorTerms(terms.flat());
}

/* -------------------------------------------- */

/**
 * A helper function to group terms into PoolTerms, DiceTerms, MathTerms, and NumericTerms.
 * MathTerms are included as NumericTerms if they are deterministic.
 * @param {RollTerm[]} terms  An array of roll terms.
 * @returns {object}          An object mapping term types to arrays containing roll terms of that type.
 */
function _groupTermsByType(terms) {
  // Add an initial operator so that terms can be rearranged arbitrarily.
  if ( !(terms[0] instanceof OperatorTerm) ) {
    terms.unshift(new OperatorTerm({ operator: "+" }));
  }

  return terms.reduce((obj, term, i) => {
    let type;
    if ( term instanceof DiceTerm ) {
      type = DiceTerm;
    } else if ( (term instanceof MathTerm) && (term.isDeterministic) ) {
      type = NumericTerm;
    } else {
      type = term.constructor;
    }
    const key = `${type.name.charAt(0).toLowerCase()}${type.name.substring(1)}s`;

    // Push the term and the preceding OperatorTerm.
    (obj[key] = obj[key] ?? []).push(terms[i - 1], term);
    return obj;
  }, {});
}

/* -------------------------------------------- */

/**
 * A helper function to separate annotated terms from unannotated terms.
 * @param {object[]} terms     An array of DiceTerms and associated OperatorTerms.
 * @returns {Array | Array[]}  A pair of term arrays, one containing annotated terms.
 */
function _separateAnnotatedTerms(terms) {
  return terms.reduce((obj, curr, i) => {
    if ( curr instanceof OperatorTerm ) {
      return obj;
    }
    obj[curr.flavor ? "annotated" : "unannotated"].push(terms[i - 1], curr);
    return obj;
  }, { annotated: [], unannotated: [] });
}
