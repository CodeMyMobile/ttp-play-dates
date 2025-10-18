import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  dedupe,
  normalizePhone,
  parseFile,
  parsePasted,
} from "./useContactInvites.js";

describe("normalizePhone", () => {
  it("formats US numbers to E.164", () => {
    assert.equal(normalizePhone("(555) 123-4567"), "+15551234567");
  });

  it("keeps international prefix", () => {
    assert.equal(normalizePhone("+44 20 7946 0958"), "+442079460958");
  });

  it("returns empty string for invalid", () => {
    assert.equal(normalizePhone(""), "");
    assert.equal(normalizePhone("abc"), "");
  });
});

describe("dedupe", () => {
  it("keeps the first occurrence of duplicate phones and emails", () => {
    const contacts = dedupe([
      { id: "1", phone: "+15551234567", name: "First" },
      { id: "2", phone: "5551234567", name: "Duplicate" },
      { id: "3", email: "friend@example.com" },
      { id: "4", email: "Friend@example.com" },
    ]);
    assert.equal(contacts.length, 2);
    assert.equal(contacts[0].id, "1");
    assert.equal(contacts[1].id, "3");
  });
});

describe("parsePasted", () => {
  it("parses numbers and emails and de-dupes", () => {
    const contacts = parsePasted(
      "+1 555-123-4567\nfriend@example.com\n+15551234567",
    );
    assert.equal(contacts.length, 2);
    const phoneContact = contacts.find((contact) => contact.phone);
    const emailContact = contacts.find((contact) => contact.email);
    assert.equal(phoneContact?.phone, "+15551234567");
    assert.equal(emailContact?.email, "friend@example.com");
  });
});

describe("parseFile", () => {
  it("parses CSV rows", async () => {
    const csv = "name,phone,email\nAlex,+1 555 123 4567,alex@example.com\nJamie,,jamie@example.com";
    const file = new File([csv], "contacts.csv", { type: "text/csv" });
    const contacts = await parseFile(file);
    assert.equal(contacts.length, 2);
    assert.equal(contacts[0].name, "Alex");
    assert.equal(contacts[0].phone, "+15551234567");
    assert.equal(contacts[1].email, "jamie@example.com");
  });

  it("parses VCF entries", async () => {
    const vcf = `BEGIN:VCARD\nFN:Casey Jones\nTEL:+1-555-987-6543\nEMAIL:casey@example.com\nEND:VCARD`;
    const file = new File([vcf], "contacts.vcf", { type: "text/vcard" });
    const contacts = await parseFile(file);
    assert.equal(contacts.length, 1);
    assert.equal(contacts[0].phone, "+15559876543");
    assert.equal(contacts[0].email, "casey@example.com");
  });
});
