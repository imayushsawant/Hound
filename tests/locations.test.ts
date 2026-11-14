import { test } from "node:test";
import assert from "node:assert/strict";
import { COUNTRIES, getOrderedCountries, isPredefinedCity } from "../src/locations.ts";

test("India location list has Bangalore, Pune, Mumbai, Hyderabad, and Gurgaon in exact sequence", () => {
  const india = COUNTRIES.find((c) => c.name === "India");
  assert.ok(india, "India should be present in countries list");

  const expectedOrder = ["Bangalore", "Pune", "Mumbai", "Hyderabad", "Gurgaon"];
  for (let i = 0; i < expectedOrder.length; i++) {
    assert.equal(india.cities[i], expectedOrder[i], `City at index ${i} should be ${expectedOrder[i]}`);
  }
});

test("getOrderedCountries puts selected country first and retains others", () => {
  // Default (India)
  const defaultList = getOrderedCountries();
  assert.equal(defaultList[0].name, "India");
  assert.ok(defaultList.length > 5);

  // US selected
  const usList = getOrderedCountries("United States");
  assert.equal(usList[0].name, "United States");
  assert.ok(usList.some((c) => c.name === "India"));

  // UK selected
  const ukList = getOrderedCountries("United Kingdom");
  assert.equal(ukList[0].name, "United Kingdom");
  assert.ok(ukList.some((c) => c.name === "India"));
});

test("isPredefinedCity correctly identifies predefined cities vs custom/abroad locations", () => {
  assert.equal(isPredefinedCity("Remote"), true);
  assert.equal(isPredefinedCity("Bangalore"), true);
  assert.equal(isPredefinedCity("Pune"), true);
  assert.equal(isPredefinedCity("Mumbai"), true);
  assert.equal(isPredefinedCity("Hyderabad"), true);
  assert.equal(isPredefinedCity("Gurgaon"), true);
  assert.equal(isPredefinedCity("San Francisco / Bay Area"), true);
  assert.equal(isPredefinedCity("London"), true);
  assert.equal(isPredefinedCity("Singapore"), true);

  // Unknown or custom locations
  assert.equal(isPredefinedCity("Auckland, New Zealand"), false);
  assert.equal(isPredefinedCity("Custom City"), false);
  assert.equal(isPredefinedCity(""), false);
});

test("major global tech centers around the world are included", () => {
  const countryNames = COUNTRIES.map((c) => c.name);
  assert.ok(countryNames.includes("India"));
  assert.ok(countryNames.includes("United States"));
  assert.ok(countryNames.includes("United Kingdom"));
  assert.ok(countryNames.includes("Canada"));
  assert.ok(countryNames.includes("Germany"));
  assert.ok(countryNames.includes("Singapore"));
  assert.ok(countryNames.includes("Australia"));
  assert.ok(countryNames.includes("United Arab Emirates"));
  assert.ok(countryNames.includes("Netherlands"));
  assert.ok(countryNames.includes("Japan"));
});
