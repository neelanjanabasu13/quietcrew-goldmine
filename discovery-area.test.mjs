import assert from "node:assert/strict";
import test from "node:test";
import { containsLocation, nearbyAreas, resolveAreaRectangle, widenRectangle } from "./discovery-area.mjs";

function feature(name, southwest, northeast) {
  return {
    address_components: [
      { long_name: name, types: ["neighborhood"] },
      { long_name: "London", types: ["postal_town"] },
    ],
    geometry: { bounds: { southwest, northeast } },
  };
}
const highgate = feature("Highgate", { lat: 51.565, lng: -0.156 }, { lat: 51.581, lng: -0.137 });

test("uses Google's mapped extent and rejects a business outside the local and nearby search", async () => {
  const rectangle = await resolveAreaRectangle("Highgate, London, UK", async () => [highgate]);
  assert.equal(containsLocation(rectangle, { latitude: 51.568, longitude: -0.153 }), true);
  assert.equal(containsLocation(rectangle, { latitude: 51.572, longitude: -0.14 }), true);
  assert.equal(containsLocation(widenRectangle(rectangle), { latitude: 51.519, longitude: -0.137 }), false);
  assert.equal(containsLocation(rectangle, { latitude: null, longitude: -0.14 }), false);
});

test("combined areas resolve both names, and an unrelated or partial match fails closed", async () => {
  const soho = feature("Soho", { lat: 51.51, lng: -0.14 }, { lat: 51.52, lng: -0.13 });
  const carnaby = feature("Carnaby", { lat: 51.51, lng: -0.15 }, { lat: 51.52, lng: -0.139 });
  const rectangle = await resolveAreaRectangle("Soho and Carnaby, London, UK", async (scope) =>
    [scope.startsWith("Soho") ? soho : carnaby]);
  assert.equal(rectangle.low.longitude, -0.15);
  assert.equal(rectangle.high.longitude, -0.13);
  await assert.rejects(resolveAreaRectangle("Soho, London, UK", async () => [highgate]));
  await assert.rejects(resolveAreaRectangle("Highgate, London, UK", async () => [{ ...highgate, partial_match: true }]));
});

test("nearby labels require specific neighbourhood evidence", () => {
  const place = (longText, type) => ({ addressComponents: [{ longText, types: [type] }] });
  assert.deepEqual(nearbyAreas([
    place("London", "sublocality"),
    place("Highgate", "neighborhood"),
    place("London", "postal_town"),
    place("Crouch End", "neighborhood"),
    place("Crouch End", "neighborhood"),
    place("Muswell Hill", "neighborhood"),
  ], "Highgate, London, UK"), ["Crouch End, London, UK", "Muswell Hill, London, UK"]);
});
