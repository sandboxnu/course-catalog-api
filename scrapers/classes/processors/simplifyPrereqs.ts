/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */

import {
  Requisite, isCourseReq, BooleanReq, isBooleanReq,
} from '../../../types/types';

//this is given the output of formatRequirements, where data.type and data.values exist
// if there is an or embedded in another or, merge them (and and's too)
//and if there is a subvalue of only 1 len, merge that too
function simplifyRequirementsBase(data: Requisite): Requisite {
  if (typeof data === 'string') {
    return data;
  }

  if (isCourseReq(data)) {
    return data;
  }

  // Must have .values and .type from here on
  const retVal = {
    type: data.type,
    values: [],
  };

  // Simplify all children
  data.values.forEach((subData) => {
    subData = simplifyRequirementsBase(subData);

    if (isBooleanReq(subData)) {
      //if same type, merge
      if (subData.type === data.type) {
        retVal.values = retVal.values.concat(subData.values);
        return;

        // If only contains 1 value, merge
      }

      if (subData.values.length === 1) {
        retVal.values.push(subData.values[0]);
        return;
      }
    }

    //just add the subdata
    retVal.values.push(subData);
  });

  // Simplify this node
  if (retVal.values.length === 1) {
    return retVal.values[0];
  }

  return retVal;
}


export default function simplifyRequirements(data: Requisite): BooleanReq {
  data = simplifyRequirementsBase(data);
  if (!isBooleanReq(data)) {
    return {
      type: 'and',
      values: [data],
    };
  }

  return data;
}
