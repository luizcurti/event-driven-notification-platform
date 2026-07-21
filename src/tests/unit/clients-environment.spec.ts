describe("clients and environment bootstrap", () => {
  afterEach(() => {
    jest.resetModules();
    delete process.env.AWS_ENDPOINT_URL;
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
  });

  it("loads clients without local endpoint", async () => {
    const module = await import("../../infrastructure/aws/clients");
    expect(module.documentClient).toBeDefined();
  });

  it("loads clients with local endpoint", async () => {
    process.env.AWS_ENDPOINT_URL = "http://localhost:4566";
    process.env.AWS_ACCESS_KEY_ID = "test";
    process.env.AWS_SECRET_ACCESS_KEY = "test";
    jest.resetModules();

    const module = await import("../../infrastructure/aws/clients");
    expect(module.documentClient).toBeDefined();
  });

  it("loads clients with local endpoint and default credentials", async () => {
    process.env.AWS_ENDPOINT_URL = "http://localhost:4566";
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    jest.resetModules();

    const module = await import("../../infrastructure/aws/clients");
    expect(module.documentClient).toBeDefined();
  });

  it("loads environment custom endpoint and default", async () => {
    const envDefault = await import("../../infrastructure/aws/environment");
    expect(envDefault.environment.awsEndpointUrl).toBeUndefined();

    process.env.AWS_ENDPOINT_URL = "http://localhost:4566";
    jest.resetModules();

    const envCustom = await import("../../infrastructure/aws/environment");
    expect(envCustom.environment.awsEndpointUrl).toBe("http://localhost:4566");
  });
});
