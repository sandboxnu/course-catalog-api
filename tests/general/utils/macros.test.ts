/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */

import macros, { EnvLevel, getEnvLevel } from "../../../utils/macros";

afterEach(() => {
  jest.clearAllMocks();
});

describe("getEngLevel", () => {
  const env = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...env,
      PROD: null,
      NODE_ENV: null,
      CI: null,
      DEV: null,
      TEST: null,
    };
  });

  afterEach(() => {
    process.env = env;
  });

  it("production CI", () => {
    process.env.CI = "true";
    process.env.NODE_ENV = "not test and not dev";
    expect(getEnvLevel()).toBe(EnvLevel.PROD);
    process.env.NODE_ENV = "test";
    expect(getEnvLevel()).not.toBe(EnvLevel.PROD);
    process.env.NODE_ENV = "dev";
    expect(getEnvLevel()).not.toBe(EnvLevel.PROD);
  });

  it("is a production env", () => {
    process.env.CI = null;
    process.env.TEST = "true";
    process.env.PROD = "true";
    expect(getEnvLevel()).toBe(EnvLevel.PROD);
    process.env.PROD = null;
    expect(getEnvLevel()).not.toBe(EnvLevel.PROD);
    process.env.NODE_ENV = "prod";
    expect(getEnvLevel()).toBe(EnvLevel.PROD);
  });

  it("is a dev env", () => {
    process.env.DEV = "true";
    expect(getEnvLevel()).toBe(EnvLevel.DEV);
    process.env.DEV = null;
    process.env.TEST = "true";
    expect(getEnvLevel()).not.toBe(EnvLevel.DEV);
    process.env.NODE_ENV = "dev";
    expect(getEnvLevel()).toBe(EnvLevel.DEV);
  });

  it("is a test env", () => {
    process.env.TEST = "true";
    expect(getEnvLevel()).toBe(EnvLevel.TEST);
  });

  it("defaults to a dev env", () => {
    expect(getEnvLevel()).toBe(EnvLevel.DEV);
  });
});

it("env variables don't re-fetch if already fetched once", () => {
  const envKey = "fake_key";
  macros.getAllEnvVariables();
  process.env[envKey] = "here";
  expect(macros.getAllEnvVariables()[envKey]).toBeUndefined();
});

describe("utility functions", () => {
  it("isNumeric", () => {
    expect(macros.isNumeric("this is not a number")).toBeFalsy();
    expect(macros.isNumeric(Number.NaN.toString())).toBeFalsy();
    expect(macros.isNumeric("three")).toBeFalsy();
    expect(macros.isNumeric("asd24sdf./,sdfsd32_1!21we")).toBeFalsy();
    expect(macros.isNumeric("$12")).toBeFalsy();
    expect(macros.isNumeric("💙💛🚧🚧😊🎁👏⚠")).toBeFalsy();

    expect(macros.isNumeric("2")).toBeTruthy();
    expect(macros.isNumeric("-23")).toBeTruthy();
    expect(macros.isNumeric("2.3141")).toBeTruthy();
    expect(macros.isNumeric("43_122")).toBeTruthy();
    expect(macros.isNumeric(Number.MAX_SAFE_INTEGER.toString())).toBeTruthy();
  });
});
