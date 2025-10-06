import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createGoogleClient,
  getAllDomainContacts,
  createDomainContact,
  updateDomainContact,
  deleteDomainContact,
} from "../src/gsuite";
import { google } from "googleapis";

vi.mock("googleapis");
global.fetch = vi.fn();

describe("gsuite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createGoogleClient", () => {
    it("should create Google Auth client with domain-wide delegation", () => {
      const mockGoogleAuth = vi.fn();
      vi.mocked(google.auth.GoogleAuth).mockImplementation(
        mockGoogleAuth as any,
      );

      const serviceAccountJson = JSON.stringify({
        type: "service_account",
        project_id: "test-project",
        private_key_id: "key-id",
        private_key:
          "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----\n",
        client_email: "test@test-project.iam.gserviceaccount.com",
      });

      const delegatedUser = "admin@example.com";

      createGoogleClient(serviceAccountJson, delegatedUser);

      expect(mockGoogleAuth).toHaveBeenCalledWith({
        credentials: JSON.parse(serviceAccountJson),
        scopes: ["https://www.google.com/m8/feeds"],
        clientOptions: {
          subject: delegatedUser,
        },
      });
    });
  });

  describe("getAllDomainContacts", () => {
    it("should fetch all domain shared contacts", async () => {
      const mockGetClient = vi.fn().mockResolvedValue({
        getAccessToken: vi.fn().mockResolvedValue({ token: "test-token" }),
      });

      const mockAuth = {
        getClient: mockGetClient,
      } as any;

      const mockContacts = {
        feed: {
          entry: [
            {
              id: {
                $t: "https://www.google.com/m8/feeds/contacts/example.com/base/contact1",
              },
              gd$etag: "etag1",
              gd$email: [{ address: "john@illinois.edu", primary: "true" }],
              gd$name: {
                gd$givenName: { $t: "John" },
                gd$familyName: { $t: "Doe" },
              },
            },
          ],
        },
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockContacts,
      } as any);

      const result = await getAllDomainContacts(mockAuth, "example.com");

      expect(result.size).toBe(1);
      expect(result.get("john@illinois.edu")).toEqual({
        id: "contact1",
        etag: "etag1",
        contact: {
          email: "john@illinois.edu",
          givenName: "John",
          familyName: "Doe",
        },
      });
    });

    it("should handle pagination with multiple pages", async () => {
      const mockGetClient = vi.fn().mockResolvedValue({
        getAccessToken: vi.fn().mockResolvedValue({ token: "test-token" }),
      });

      const mockAuth = {
        getClient: mockGetClient,
      } as any;

      // Create 1000 contacts for first page
      const mockContactsPage1 = {
        feed: {
          entry: Array.from({ length: 1000 }, (_, i) => ({
            id: {
              $t: `https://www.google.com/m8/feeds/contacts/example.com/base/contact${i}`,
            },
            gd$etag: `etag${i}`,
            gd$email: [{ address: `user${i}@illinois.edu` }],
            gd$name: {
              gd$givenName: { $t: "User" },
              gd$familyName: { $t: `${i}` },
            },
          })),
        },
      };

      // Empty second page to end pagination
      const mockContactsPage2 = {
        feed: {
          entry: [],
        },
      };

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockContactsPage1,
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockContactsPage2,
        } as any);

      const result = await getAllDomainContacts(mockAuth, "example.com");

      expect(result.size).toBe(1000);
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it("should handle pagination with partial last page", async () => {
      const mockGetClient = vi.fn().mockResolvedValue({
        getAccessToken: vi.fn().mockResolvedValue({ token: "test-token" }),
      });

      const mockAuth = {
        getClient: mockGetClient,
      } as any;

      const mockContactsPage1 = {
        feed: {
          entry: Array.from({ length: 500 }, (_, i) => ({
            id: {
              $t: `https://www.google.com/m8/feeds/contacts/example.com/base/contact${i}`,
            },
            gd$etag: `etag${i}`,
            gd$email: [{ address: `user${i}@illinois.edu` }],
            gd$name: {
              gd$givenName: { $t: "User" },
              gd$familyName: { $t: `${i}` },
            },
          })),
        },
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockContactsPage1,
      } as any);

      const result = await getAllDomainContacts(mockAuth, "example.com");

      expect(result.size).toBe(500);
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("should handle API errors", async () => {
      const mockGetClient = vi.fn().mockResolvedValue({
        getAccessToken: vi.fn().mockResolvedValue({ token: "test-token" }),
      });

      const mockAuth = {
        getClient: mockGetClient,
      } as any;

      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 403,
        statusText: "Forbidden",
        text: async () => "Access denied",
      } as any);

      await expect(
        getAllDomainContacts(mockAuth, "example.com"),
      ).rejects.toThrow("Failed to fetch contacts: Forbidden - Access denied");
    });

    it("should skip entries without email", async () => {
      const mockGetClient = vi.fn().mockResolvedValue({
        getAccessToken: vi.fn().mockResolvedValue({ token: "test-token" }),
      });

      const mockAuth = {
        getClient: mockGetClient,
      } as any;

      const mockContacts = {
        feed: {
          entry: [
            {
              id: {
                $t: "https://www.google.com/m8/feeds/contacts/example.com/base/contact1",
              },
              gd$etag: "etag1",
              gd$email: [],
              gd$name: {
                gd$givenName: { $t: "John" },
                gd$familyName: { $t: "Doe" },
              },
            },
          ],
        },
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockContacts,
      } as any);

      const result = await getAllDomainContacts(mockAuth, "example.com");

      expect(result.size).toBe(0);
    });

    it("should handle empty feed", async () => {
      const mockGetClient = vi.fn().mockResolvedValue({
        getAccessToken: vi.fn().mockResolvedValue({ token: "test-token" }),
      });

      const mockAuth = {
        getClient: mockGetClient,
      } as any;

      const mockContacts = {
        feed: {},
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockContacts,
      } as any);

      const result = await getAllDomainContacts(mockAuth, "example.com");

      expect(result.size).toBe(0);
    });

    it("should use primary email when multiple emails exist", async () => {
      const mockGetClient = vi.fn().mockResolvedValue({
        getAccessToken: vi.fn().mockResolvedValue({ token: "test-token" }),
      });

      const mockAuth = {
        getClient: mockGetClient,
      } as any;

      const mockContacts = {
        feed: {
          entry: [
            {
              id: {
                $t: "https://www.google.com/m8/feeds/contacts/example.com/base/contact1",
              },
              gd$etag: "etag1",
              gd$email: [
                { address: "secondary@illinois.edu" },
                { address: "primary@illinois.edu", primary: "true" },
              ],
              gd$name: {
                gd$givenName: { $t: "John" },
                gd$familyName: { $t: "Doe" },
              },
            },
          ],
        },
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockContacts,
      } as any);

      const result = await getAllDomainContacts(mockAuth, "example.com");

      expect(result.get("primary@illinois.edu")).toBeDefined();
      expect(result.get("secondary@illinois.edu")).toBeUndefined();
    });

    it("should use first email when no primary is specified", async () => {
      const mockGetClient = vi.fn().mockResolvedValue({
        getAccessToken: vi.fn().mockResolvedValue({ token: "test-token" }),
      });

      const mockAuth = {
        getClient: mockGetClient,
      } as any;

      const mockContacts = {
        feed: {
          entry: [
            {
              id: {
                $t: "https://www.google.com/m8/feeds/contacts/example.com/base/contact1",
              },
              gd$etag: "etag1",
              gd$email: [
                { address: "first@illinois.edu" },
                { address: "second@illinois.edu" },
              ],
              gd$name: {
                gd$givenName: { $t: "John" },
                gd$familyName: { $t: "Doe" },
              },
            },
          ],
        },
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockContacts,
      } as any);

      const result = await getAllDomainContacts(mockAuth, "example.com");

      expect(result.get("first@illinois.edu")).toBeDefined();
    });

    it("should normalize email addresses to lowercase", async () => {
      const mockGetClient = vi.fn().mockResolvedValue({
        getAccessToken: vi.fn().mockResolvedValue({ token: "test-token" }),
      });

      const mockAuth = {
        getClient: mockGetClient,
      } as any;

      const mockContacts = {
        feed: {
          entry: [
            {
              id: {
                $t: "https://www.google.com/m8/feeds/contacts/example.com/base/contact1",
              },
              gd$etag: "etag1",
              gd$email: [{ address: "John.Doe@Illinois.EDU" }],
              gd$name: {
                gd$givenName: { $t: "John" },
                gd$familyName: { $t: "Doe" },
              },
            },
          ],
        },
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockContacts,
      } as any);

      const result = await getAllDomainContacts(mockAuth, "example.com");

      expect(result.get("john.doe@illinois.edu")).toBeDefined();
      expect(result.get("John.Doe@Illinois.EDU")).toBeUndefined();
    });
  });

  describe("createDomainContact", () => {
    it("should create a new domain shared contact", async () => {
      const mockGetClient = vi.fn().mockResolvedValue({
        getAccessToken: vi.fn().mockResolvedValue({ token: "test-token" }),
      });

      const mockAuth = {
        getClient: mockGetClient,
      } as any;

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
      } as any);

      const contact = {
        email: "john@illinois.edu",
        givenName: "John",
        familyName: "Doe",
      };

      const result = await createDomainContact(
        mockAuth,
        "example.com",
        contact,
      );

      expect(result).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        "https://www.google.com/m8/feeds/contacts/example.com/full",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/atom+xml",
            "GData-Version": "3.0",
          }),
        }),
      );
    });

    it("should include email in XML body", async () => {
      const mockGetClient = vi.fn().mockResolvedValue({
        getAccessToken: vi.fn().mockResolvedValue({ token: "test-token" }),
      });

      const mockAuth = {
        getClient: mockGetClient,
      } as any;

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
      } as any);

      const contact = {
        email: "john@illinois.edu",
        givenName: "John",
        familyName: "Doe",
      };

      await createDomainContact(mockAuth, "example.com", contact);

      const callArgs = vi.mocked(fetch).mock.calls[0];
      const body = callArgs[1]?.body as string;

      expect(body).toContain("john@illinois.edu");
      expect(body).toContain("<gd:givenName>John</gd:givenName>");
      expect(body).toContain("<gd:familyName>Doe</gd:familyName>");
      expect(body).toContain("<gd:fullName>John Doe</gd:fullName>");
    });

    it("should handle creation errors", async () => {
      const mockGetClient = vi.fn().mockResolvedValue({
        getAccessToken: vi.fn().mockResolvedValue({ token: "test-token" }),
      });

      const mockAuth = {
        getClient: mockGetClient,
      } as any;

      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        text: async () => "Invalid contact data",
      } as any);

      const contact = {
        email: "john@illinois.edu",
        givenName: "John",
        familyName: "Doe",
      };

      const result = await createDomainContact(
        mockAuth,
        "example.com",
        contact,
      );

      expect(result).toBe(false);
    });

    it("should escape XML special characters in names", async () => {
      const mockGetClient = vi.fn().mockResolvedValue({
        getAccessToken: vi.fn().mockResolvedValue({ token: "test-token" }),
      });

      const mockAuth = {
        getClient: mockGetClient,
      } as any;

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
      } as any);

      const contact = {
        email: "test@example.com",
        givenName: 'John<script>alert("xss")</script>',
        familyName: "Doe & Associates",
      };

      await createDomainContact(mockAuth, "example.com", contact);

      const callArgs = vi.mocked(fetch).mock.calls[0];
      const body = callArgs[1]?.body as string;

      expect(body).toContain("&lt;script&gt;");
      expect(body).toContain("&amp;");
      expect(body).not.toContain("<script>");
      expect(body).not.toContain("& Associates");
    });

    it("should escape all XML special characters", async () => {
      const mockGetClient = vi.fn().mockResolvedValue({
        getAccessToken: vi.fn().mockResolvedValue({ token: "test-token" }),
      });

      const mockAuth = {
        getClient: mockGetClient,
      } as any;

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
      } as any);

      const contact = {
        email: "test&user@example.com",
        givenName: `John<>"'&`,
        familyName: "Doe",
      };

      await createDomainContact(mockAuth, "example.com", contact);

      const callArgs = vi.mocked(fetch).mock.calls[0];
      const body = callArgs[1]?.body as string;

      expect(body).toContain("&amp;");
      expect(body).toContain("&lt;");
      expect(body).toContain("&gt;");
      expect(body).toContain("&quot;");
      expect(body).toContain("&apos;");
    });

    it("should handle errors thrown during creation", async () => {
      const mockGetClient = vi.fn().mockResolvedValue({
        getAccessToken: vi.fn().mockResolvedValue({ token: "test-token" }),
      });

      const mockAuth = {
        getClient: mockGetClient,
      } as any;

      vi.mocked(fetch).mockRejectedValue(new Error("Network error"));

      const contact = {
        email: "john@illinois.edu",
        givenName: "John",
        familyName: "Doe",
      };

      const result = await createDomainContact(
        mockAuth,
        "example.com",
        contact,
      );

      expect(result).toBe(false);
    });
  });

  describe("updateDomainContact", () => {
    it("should update an existing domain shared contact", async () => {
      const mockGetClient = vi.fn().mockResolvedValue({
        getAccessToken: vi.fn().mockResolvedValue({ token: "test-token" }),
      });

      const mockAuth = {
        getClient: mockGetClient,
      } as any;

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
      } as any);

      const contact = {
        email: "john@illinois.edu",
        givenName: "John",
        familyName: "Doe",
      };

      const result = await updateDomainContact(
        mockAuth,
        "example.com",
        "contact1",
        "etag1",
        contact,
      );

      expect(result).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        "https://www.google.com/m8/feeds/contacts/example.com/full/contact1",
        expect.objectContaining({
          method: "PUT",
          headers: expect.objectContaining({
            "If-Match": "etag1",
          }),
        }),
      );
    });

    it("should handle update errors", async () => {
      const mockGetClient = vi.fn().mockResolvedValue({
        getAccessToken: vi.fn().mockResolvedValue({ token: "test-token" }),
      });

      const mockAuth = {
        getClient: mockGetClient,
      } as any;

      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 409,
        statusText: "Conflict",
        text: async () => "ETag mismatch",
      } as any);

      const contact = {
        email: "john@illinois.edu",
        givenName: "John",
        familyName: "Doe",
      };

      const result = await updateDomainContact(
        mockAuth,
        "example.com",
        "contact1",
        "etag1",
        contact,
      );

      expect(result).toBe(false);
    });

    it("should handle errors thrown during update", async () => {
      const mockGetClient = vi.fn().mockResolvedValue({
        getAccessToken: vi.fn().mockResolvedValue({ token: "test-token" }),
      });

      const mockAuth = {
        getClient: mockGetClient,
      } as any;

      vi.mocked(fetch).mockRejectedValue(new Error("Network error"));

      const contact = {
        email: "john@illinois.edu",
        givenName: "John",
        familyName: "Doe",
      };

      const result = await updateDomainContact(
        mockAuth,
        "example.com",
        "contact1",
        "etag1",
        contact,
      );

      expect(result).toBe(false);
    });
  });

  describe("deleteDomainContact", () => {
    it("should delete a domain shared contact", async () => {
      const mockGetClient = vi.fn().mockResolvedValue({
        getAccessToken: vi.fn().mockResolvedValue({ token: "test-token" }),
      });

      const mockAuth = {
        getClient: mockGetClient,
      } as any;

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
      } as any);

      const result = await deleteDomainContact(
        mockAuth,
        "example.com",
        "contact1",
        "etag1",
        "john@illinois.edu",
      );

      expect(result).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        "https://www.google.com/m8/feeds/contacts/example.com/full/contact1",
        expect.objectContaining({
          method: "DELETE",
          headers: expect.objectContaining({
            "If-Match": "etag1",
          }),
        }),
      );
    });

    it("should handle deletion errors", async () => {
      const mockGetClient = vi.fn().mockResolvedValue({
        getAccessToken: vi.fn().mockResolvedValue({ token: "test-token" }),
      });

      const mockAuth = {
        getClient: mockGetClient,
      } as any;

      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: async () => "Contact not found",
      } as any);

      const result = await deleteDomainContact(
        mockAuth,
        "example.com",
        "contact1",
        "etag1",
        "john@illinois.edu",
      );

      expect(result).toBe(false);
    });

    it("should handle errors thrown during deletion", async () => {
      const mockGetClient = vi.fn().mockResolvedValue({
        getAccessToken: vi.fn().mockResolvedValue({ token: "test-token" }),
      });

      const mockAuth = {
        getClient: mockGetClient,
      } as any;

      vi.mocked(fetch).mockRejectedValue(new Error("Network error"));

      const result = await deleteDomainContact(
        mockAuth,
        "example.com",
        "contact1",
        "etag1",
        "john@illinois.edu",
      );

      expect(result).toBe(false);
    });
  });
});
