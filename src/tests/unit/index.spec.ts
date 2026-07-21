import * as exported from "../../index";

describe("index exports", () => {
  it("exports handler module", () => {
    expect(exported).toBeDefined();
  });
});
