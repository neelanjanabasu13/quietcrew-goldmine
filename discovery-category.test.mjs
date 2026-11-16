import assert from "node:assert/strict";
import test from "node:test";
import { categorySearches, matchesCategory, recommendationTerm, supportedCategories } from "./discovery-category.mjs";

test("Legal rejects restaurants and searches for solicitors using Google's lawyer type", () => {
  const restaurant = { types: ["indian_restaurant", "restaurant", "establishment"], primaryType: "indian_restaurant" };
  assert.equal(matchesCategory(restaurant, "Legal"), false);
  assert.equal(matchesCategory(restaurant, "Restaurants and cafés"), true);
  assert.equal(matchesCategory({ types: ["lawyer", "establishment"], primaryType: "lawyer" }, "Legal"), true);
  assert.equal(matchesCategory({ types: ["establishment"] }, "Legal"), false);
  assert.equal(recommendationTerm("Legal"), "solicitors");
  assert.deepEqual(categorySearches("Legal", 3).map(({ type }) => type), ["lawyer", "lawyer", "lawyer"]);
});

test("every storefront category maps to official place types within the existing page budget", () => {
  assert.deepEqual([...supportedCategories].sort(), [
    "Restaurants and cafés", "Bars and pubs", "Dental", "Hair", "Fitness",
    "Beauty and aesthetics", "Estate agencies", "Accountancy", "Legal",
    "Home services", "Automotive", "Veterinary", "Private healthcare", "Retail", "Hospitality",
  ].sort());
  for (const category of supportedCategories) {
    const searches = categorySearches(category, 3);
    assert.ok(searches.length > 0);
    assert.ok(searches.reduce((sum, { pages }) => sum + pages, 0) <= 9);
    assert.ok(searches.every(({ type }) => matchesCategory({ types: [type] }, category)));
    assert.ok(recommendationTerm(category).length > 0);
  }
  assert.ok(categorySearches("Restaurants and cafés", 3).some(({ type }) => type === "cafe"));
  assert.throws(() => categorySearches("constructor", 3), /supported/);
});
