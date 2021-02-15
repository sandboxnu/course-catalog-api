import simplifyRequirements from '../simplifyPrereqs';
import { CourseReq } from '../../../../types/types';

function C(s: string): CourseReq {
  return {
    subject: 'PHYS',
    classId: s,
  };
}

it('simplifyRequirements shoudl work', () => {
  expect(simplifyRequirements({
    type: 'or',
    values: [{
      type: 'or',
      values: [C('1'), {
        type: 'or',
        values: [C('6')],
      }],
    }, {
      type: 'or',
      values: [C('1'), {
        type: 'or',
        values: [{
          type: 'or',
          values: [C('1'), {
            type: 'or',
            values: [C('6')],
          }],
        }, {
          type: 'or',
          values: [C('1'), {
            type: 'or',
            values: [C('6')],
          }],
        }],
      }],
    }],
  })).toEqual({
    type: 'or',
    values: ['1', '6', '1', '1', '6', '1', '6'].map(C),
  });
});

it('simplifyRequirements shoudl work2', () => {
  expect(simplifyRequirements({
    type: 'and',
    values: [{
      type: 'or',
      values: [{
        subject: 'PHYS',
        classId: '1148',
      }, {
        subject: 'PHYS',
        classId: '1148',
      }],
    }],
  })).toEqual({
    type: 'or',
    values: [{
      subject: 'PHYS',
      classId: '1148',
    }, {
      subject: 'PHYS',
      classId: '1148',
    }],
  });
});

it('simplifyRequirements should put course req in a boolreq', () => {
  expect(simplifyRequirements({
    subject: 'PHYS',
    classId: '1148',
  })).toEqual({
    type: 'and',
    values: [{
      subject: 'PHYS',
      classId: '1148',
    }],
  });
});
