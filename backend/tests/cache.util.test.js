const { InMemoryTtlCache } = require("../src/utils/cache");

describe("InMemoryTtlCache", () => {
  test("stores and retrieves values before expiry", () => {
    const cache = new InMemoryTtlCache({ maxEntries: 10 });
    cache.set("key:a", { value: 1 }, 1000);
    expect(cache.get("key:a")).toEqual({ value: 1 });
  });

  test("expires entries after ttl", async () => {
    const cache = new InMemoryTtlCache({ maxEntries: 10 });
    cache.set("key:b", "hello", 5);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(cache.get("key:b")).toBeUndefined();
  });

  test("invalidates keys by prefix", () => {
    const cache = new InMemoryTtlCache({ maxEntries: 10 });
    cache.set("projects:list:1", "a", 1000);
    cache.set("projects:detail:2", "b", 1000);
    cache.set("users:me", "c", 1000);

    cache.invalidateByPrefix("projects:");

    expect(cache.get("projects:list:1")).toBeUndefined();
    expect(cache.get("projects:detail:2")).toBeUndefined();
    expect(cache.get("users:me")).toBe("c");
  });
});
