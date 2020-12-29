/* eslint-disable no-underscore-dangle */
import { _createDescriptionTable } from '../subjectAbbreviationParser';

describe('subjectAbbreviationParser', () => {
  it('_createDescriptionTable builds mapping', () => {
    const banner = [
      {
        code: 'ACCT',
        description: 'Accounting',
      },
      {
        code: 'AVM',
        description: 'Adv Manufacturing System - CPS',
      },
    ];
    const map = {
      Accounting: 'ACCT',
      'Adv Manufacturing System - CPS': 'AVM',
    };
    expect(_createDescriptionTable(banner)).toEqual(map);
  });
});
