/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */

import macros from '../utils/macros';

it('alphabet is 26', () => {
  expect(macros.ALPHABET.length).toBe(26);
});

it('logging things work', () => {
  macros.warn();
  macros.verbose();
  macros.error('fjdaj');
});

it('can get env vars', () => {
  expect(!!macros.getAllEnvVariables()).toBe(true);
});

it('some other stuff doesnt crash', () => {
  macros.logAmplitudeEvent('test event', { hi: 4 });
});

it('logAmplitudeEvent should not crash', () => {
  macros.logAmplitudeEvent('event_from_testing', {
    a: 3,
  });
});
