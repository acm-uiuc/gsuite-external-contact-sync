import { describe, it, expect, vi, beforeEach } from "vitest";
import { handler } from "../src/sync";
import * as config from "../src/config";
import * as entra from "../src/entra";
import * as gsuite from "../src/gsuite";

vi.mock("../src/config");
vi.mock("../src/entra");
vi.mock("../src/gsuite");

describe("sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("handler", () => {
    it("should successfully sync contacts", async () => {
      const mockConfig = {
        entraTenantId: "tenant-123",
        entraClientId: "client-456",
        entraClientCertificate: "cert-base64",
        googleDelegatedUser: "admin@acm.illinois.edu",
        googleServiceAccountJson: '{"type":"service_account"}',
        deleteRemovedContacts: true,
        environment: "dev" as const,
      };

      vi.mocked(config.getConfig).mockResolvedValue(mockConfig);

      const mockEntraUsers = [
        {
          email: "john@illinois.edu",
          upn: "john@illinois.edu",
          givenName: "John",
          familyName: "Doe",
          displayName: "John Doe",
        },
      ];

      vi.mocked(entra.createEntraClient).mockReturnValue({} as any);
      vi.mocked(entra.getAllEntraUsers).mockResolvedValue(mockEntraUsers);
      vi.mocked(gsuite.createGoogleClient).mockReturnValue({} as any);
      vi.mocked(gsuite.getAllDomainContacts).mockResolvedValue(new Map());
      vi.mocked(gsuite.createDomainContact).mockResolvedValue(true);

      const event = {
        version: "0",
        id: "test-id",
        "detail-type": "Scheduled Event",
        source: "aws.events",
        account: "123456789012",
        time: new Date().toISOString(),
        region: "us-east-2",
        resources: [],
        detail: {},
      } as any;

      const context = {} as any;

      const result = await handler(event, context);

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body).stats.created).toBe(1);
    });

    it("should update existing contacts when they differ", async () => {
      const mockConfig = {
        entraTenantId: "tenant-123",
        entraClientId: "client-456",
        entraClientCertificate: "cert-base64",
        googleDelegatedUser: "admin@acm.illinois.edu",
        googleServiceAccountJson: '{"type":"service_account"}',
        deleteRemovedContacts: true,
        environment: "prod" as const,
      };

      vi.mocked(config.getConfig).mockResolvedValue(mockConfig);

      const mockEntraUsers = [
        {
          email: "john@illinois.edu",
          upn: "john@illinois.edu",
          givenName: "John",
          familyName: "Doe-Updated",
          displayName: "John Doe-Updated", // This is checked in the skip logic!
        },
      ];

      const mockGoogleContacts = new Map([
        [
          "john@illinois.edu",
          {
            id: "contact1",
            etag: "etag1",
            contact: {
              email: "john@illinois.edu",
              givenName: "John",
              familyName: "Doe",
            },
          },
        ],
      ]);

      vi.mocked(entra.createEntraClient).mockReturnValue({} as any);
      vi.mocked(entra.getAllEntraUsers).mockResolvedValue(mockEntraUsers);
      vi.mocked(entra.getPrimaryEmail).mockImplementation((user) =>
        user.email.toLowerCase(),
      );
      vi.mocked(gsuite.createGoogleClient).mockReturnValue({} as any);
      vi.mocked(gsuite.getAllDomainContacts).mockResolvedValue(
        mockGoogleContacts,
      );
      vi.mocked(gsuite.updateDomainContact).mockResolvedValue(true);

      const event = {} as any;
      const context = {} as any;

      const result = await handler(event, context);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.stats.updated).toBe(1);
      expect(gsuite.updateDomainContact).toHaveBeenCalledWith(
        expect.anything(),
        "acm.illinois.edu",
        "contact1",
        "etag1",
        {
          email: "john@illinois.edu",
          givenName: "John",
          familyName: "Doe-Updated",
        },
      );
    });

    it("should delete contacts that are no longer in Entra when deleteRemovedContacts is true", async () => {
      const mockConfig = {
        entraTenantId: "tenant-123",
        entraClientId: "client-456",
        entraClientCertificate: "cert-base64",
        googleDelegatedUser: "admin@acm.illinois.edu",
        googleServiceAccountJson: '{"type":"service_account"}',
        deleteRemovedContacts: true,
        environment: "dev" as const,
      };

      vi.mocked(config.getConfig).mockResolvedValue(mockConfig);

      const mockEntraUsers: any[] = [];

      const mockGoogleContacts = new Map([
        [
          "john@illinois.edu",
          {
            id: "contact1",
            etag: "etag1",
            contact: {
              email: "john@illinois.edu",
              givenName: "John",
              familyName: "Doe",
            },
          },
        ],
      ]);

      vi.mocked(entra.createEntraClient).mockReturnValue({} as any);
      vi.mocked(entra.getAllEntraUsers).mockResolvedValue(mockEntraUsers);
      vi.mocked(gsuite.createGoogleClient).mockReturnValue({} as any);
      vi.mocked(gsuite.getAllDomainContacts).mockResolvedValue(
        mockGoogleContacts,
      );
      vi.mocked(gsuite.deleteDomainContact).mockResolvedValue(true);

      const event = {} as any;
      const context = {} as any;

      const result = await handler(event, context);

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body).stats.deleted).toBe(1);
    });

    it("should not delete contacts when deleteRemovedContacts is false", async () => {
      const mockConfig = {
        entraTenantId: "tenant-123",
        entraClientId: "client-456",
        entraClientCertificate: "cert-base64",
        googleDelegatedUser: "admin@acm.illinois.edu",
        googleServiceAccountJson: '{"type":"service_account"}',
        deleteRemovedContacts: false,
        environment: "dev" as const,
      };

      vi.mocked(config.getConfig).mockResolvedValue(mockConfig);

      const mockEntraUsers: any[] = [];

      const mockGoogleContacts = new Map([
        [
          "john@illinois.edu",
          {
            id: "contact1",
            etag: "etag1",
            contact: {
              email: "john@illinois.edu",
              givenName: "John",
              familyName: "Doe",
            },
          },
        ],
      ]);

      vi.mocked(entra.createEntraClient).mockReturnValue({} as any);
      vi.mocked(entra.getAllEntraUsers).mockResolvedValue(mockEntraUsers);
      vi.mocked(gsuite.createGoogleClient).mockReturnValue({} as any);
      vi.mocked(gsuite.getAllDomainContacts).mockResolvedValue(
        mockGoogleContacts,
      );

      const event = {} as any;
      const context = {} as any;

      const result = await handler(event, context);

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body).stats.deleted).toBe(0);
      expect(gsuite.deleteDomainContact).not.toHaveBeenCalled();
    });

    it("should skip users without family name", async () => {
      const mockConfig = {
        entraTenantId: "tenant-123",
        entraClientId: "client-456",
        entraClientCertificate: "cert-base64",
        googleDelegatedUser: "admin@acm.illinois.edu",
        googleServiceAccountJson: '{"type":"service_account"}',
        deleteRemovedContacts: true,
        environment: "dev" as const,
      };

      vi.mocked(config.getConfig).mockResolvedValue(mockConfig);

      const mockEntraUsers = [
        {
          email: "john@illinois.edu",
          upn: "john@illinois.edu",
          givenName: "John",
          familyName: "",
          displayName: "",
        },
      ];

      vi.mocked(entra.createEntraClient).mockReturnValue({} as any);
      vi.mocked(entra.getAllEntraUsers).mockResolvedValue(mockEntraUsers);
      vi.mocked(gsuite.createGoogleClient).mockReturnValue({} as any);
      vi.mocked(gsuite.getAllDomainContacts).mockResolvedValue(new Map());

      const event = {} as any;
      const context = {} as any;

      const result = await handler(event, context);

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body).stats.created).toBe(0);
      expect(gsuite.createDomainContact).not.toHaveBeenCalled();
    });

    it("should skip users on the same domain as Google Workspace", async () => {
      const mockConfig = {
        entraTenantId: "tenant-123",
        entraClientId: "client-456",
        entraClientCertificate: "cert-base64",
        googleDelegatedUser: "admin@acm.illinois.edu",
        googleServiceAccountJson: '{"type":"service_account"}',
        deleteRemovedContacts: true,
        environment: "dev" as const,
      };

      vi.mocked(config.getConfig).mockResolvedValue(mockConfig);

      const mockEntraUsers = [
        {
          email: "john@acm.illinois.edu",
          upn: "john@acm.illinois.edu",
          givenName: "John",
          familyName: "Doe",
          displayName: "John Doe",
        },
      ];

      vi.mocked(entra.createEntraClient).mockReturnValue({} as any);
      vi.mocked(entra.getAllEntraUsers).mockResolvedValue(mockEntraUsers);
      vi.mocked(gsuite.createGoogleClient).mockReturnValue({} as any);
      vi.mocked(gsuite.getAllDomainContacts).mockResolvedValue(new Map());

      const event = {} as any;
      const context = {} as any;

      const result = await handler(event, context);

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body).stats.created).toBe(0);
      expect(gsuite.createDomainContact).not.toHaveBeenCalled();
    });

    it("should handle errors and rethrow them", async () => {
      vi.mocked(config.getConfig).mockRejectedValue(new Error("Config error"));

      const event = {} as any;
      const context = {} as any;

      await expect(handler(event, context)).rejects.toThrow("Config error");
    });

    it("should throw error for invalid delegated user email", async () => {
      const mockConfig = {
        entraTenantId: "tenant-123",
        entraClientId: "client-456",
        entraClientCertificate: "cert-base64",
        googleDelegatedUser: "invalid-email",
        googleServiceAccountJson: '{"type":"service_account"}',
        deleteRemovedContacts: true,
        environment: "dev" as const,
      };

      vi.mocked(config.getConfig).mockResolvedValue(mockConfig);

      const event = {} as any;
      const context = {} as any;

      await expect(handler(event, context)).rejects.toThrow(
        "Invalid googleDelegatedUser",
      );
    });

    it("should track errors in stats", async () => {
      const mockConfig = {
        entraTenantId: "tenant-123",
        entraClientId: "client-456",
        entraClientCertificate: "cert-base64",
        googleDelegatedUser: "admin@acm.illinois.edu",
        googleServiceAccountJson: '{"type":"service_account"}',
        deleteRemovedContacts: true,
        environment: "dev" as const,
      };

      vi.mocked(config.getConfig).mockResolvedValue(mockConfig);

      const mockEntraUsers = [
        {
          email: "john@illinois.edu",
          upn: "john@illinois.edu",
          givenName: "John",
          familyName: "Doe",
          displayName: "John Doe",
        },
      ];

      vi.mocked(entra.createEntraClient).mockReturnValue({} as any);
      vi.mocked(entra.getAllEntraUsers).mockResolvedValue(mockEntraUsers);
      vi.mocked(gsuite.createGoogleClient).mockReturnValue({} as any);
      vi.mocked(gsuite.getAllDomainContacts).mockResolvedValue(new Map());
      vi.mocked(gsuite.createDomainContact).mockResolvedValue(false);

      const event = {} as any;
      const context = {} as any;

      const result = await handler(event, context);

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body).stats.errors).toBe(1);
    });
  });
});
